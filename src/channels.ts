// src/channels.ts

import type { 
  Connection, 
  ConnectionFilter, 
  Channel, 
  ChannelImpl, 
  ChannelManager,
  PublisherFunction,
  HookContext
} from './types.js';

/**
 * Implementation of a Channel that manages a group of connections
 */
export class ChannelImplementation implements ChannelImpl {
  public readonly name: string;
  public _connections: Set<Connection> = new Set();
  public _customData?: any;

  constructor(name: string) {
    this.name = name;
  }

  get connections(): Connection[] {
    return Array.from(this._connections);
  }

  get length(): number {
    return this._connections.size;
  }

  join(connection: Connection): Channel {
    this._connections.add(connection);
    return this;
  }

  leave(connectionOrFilter: Connection | ConnectionFilter): Channel {
    if (typeof connectionOrFilter === 'function') {
      // Filter function - remove connections that match
      const connectionsToRemove = this.connections.filter(connectionOrFilter);
      connectionsToRemove.forEach(conn => this._connections.delete(conn));
    } else {
      // Direct connection object
      this._connections.delete(connectionOrFilter);
    }
    return this;
  }

  filter(filterFn: ConnectionFilter): Channel {
    const filteredChannel = new ChannelImplementation(`${this.name}_filtered`);
    const matchingConnections = this.connections.filter(filterFn);
    matchingConnections.forEach(conn => filteredChannel.join(conn));
    return filteredChannel;
  }

  send(data: any): Channel {
    // Create a copy of this channel with custom data
    const channelWithData = new ChannelImplementation(this.name);
    channelWithData._connections = new Set(this._connections);
    channelWithData._customData = data;
    return channelWithData;
  }

  // Internal methods
  addConnection(connection: Connection): void {
    this._connections.add(connection);
  }

  removeConnection(connection: Connection): void {
    this._connections.delete(connection);
  }

  removeConnections(filterFn: ConnectionFilter): void {
    const connectionsToRemove = this.connections.filter(filterFn);
    connectionsToRemove.forEach(conn => this._connections.delete(conn));
  }

  hasConnection(connection: Connection): boolean {
    return this._connections.has(connection);
  }
}

/**
 * Combined channel that represents multiple channels as one
 */
export class CombinedChannel implements Channel {
  public readonly name: string;
  private channels: Channel[];

  constructor(name: string, channels: Channel[]) {
    this.name = name;
    this.channels = channels;
  }

  get connections(): Connection[] {
    const allConnections = new Set<Connection>();
    this.channels.forEach(channel => {
      channel.connections.forEach(conn => allConnections.add(conn));
    });
    return Array.from(allConnections);
  }

  get length(): number {
    return this.connections.length;
  }

  join(connection: Connection): Channel {
    // Join all underlying channels
    this.channels.forEach(channel => {
      if (channel instanceof ChannelImplementation) {
        channel.join(connection);
      }
    });
    return this;
  }

  leave(connectionOrFilter: Connection | ConnectionFilter): Channel {
    // Leave all underlying channels
    this.channels.forEach(channel => {
      if (channel instanceof ChannelImplementation) {
        channel.leave(connectionOrFilter);
      }
    });
    return this;
  }

  filter(filterFn: ConnectionFilter): Channel {
    const filteredConnections = this.connections.filter(filterFn);
    const filteredChannel = new ChannelImplementation(`${this.name}_filtered`);
    filteredConnections.forEach(conn => filteredChannel.join(conn));
    return filteredChannel;
  }

  send(data: any): Channel {
    // Create a new combined channel with custom data
    const channelsWithData = this.channels.map(channel => channel.send(data));
    return new CombinedChannel(this.name, channelsWithData);
  }
}

/**
 * Manages all channels for the application
 */
export class ChannelManagerImplementation implements ChannelManager {
  private channels: Map<string, ChannelImplementation> = new Map();

  getChannel(name: string): Channel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new ChannelImplementation(name));
    }
    return this.channels.get(name)!;
  }

  getCombinedChannel(names: string[]): Channel {
    const channels = names.map(name => this.getChannel(name));
    return new CombinedChannel(names.join(','), channels);
  }

  getAllChannelNames(): string[] {
    return Array.from(this.channels.keys());
  }

  removeConnection(connection: Connection): void {
    // Remove connection from all channels
    this.channels.forEach(channel => {
      channel.removeConnection(connection);
    });
  }
}

/**
 * Publisher registry for managing event publishing functions
 */
export class PublisherRegistry {
  private appPublishers: Map<string, PublisherFunction> = new Map();
  private servicePublishers: Map<string, Map<string, PublisherFunction>> = new Map();

  // App-level publishers
  setAppPublisher(event: string | null, publisherFn: PublisherFunction): void {
    const key = event || '*'; // Use '*' for all events
    this.appPublishers.set(key, publisherFn);
  }

  // Service-level publishers
  setServicePublisher(servicePath: string, event: string | null, publisherFn: PublisherFunction): void {
    if (!this.servicePublishers.has(servicePath)) {
      this.servicePublishers.set(servicePath, new Map());
    }
    const key = event || '*'; // Use '*' for all events
    this.servicePublishers.get(servicePath)!.set(key, publisherFn);
  }

  // Get publisher for a specific service event
  getPublisher(servicePath: string, event: string): PublisherFunction | null {
    // Publisher precedence (as per docs):
    // 1. Service publisher for specific event
    // 2. Service publisher for all events  
    // 3. App publisher for specific event
    // 4. App publisher for all events

    const servicePublishers = this.servicePublishers.get(servicePath);
    if (servicePublishers) {
      // 1. Service publisher for specific event
      if (servicePublishers.has(event)) {
        return servicePublishers.get(event)!;
      }
      // 2. Service publisher for all events
      if (servicePublishers.has('*')) {
        return servicePublishers.get('*')!;
      }
    }

    // 3. App publisher for specific event
    if (this.appPublishers.has(event)) {
      return this.appPublishers.get(event)!;
    }

    // 4. App publisher for all events
    if (this.appPublishers.has('*')) {
      return this.appPublishers.get('*')!;
    }

    return null;
  }

  // Remove service publishers when service is unregistered
  removeServicePublishers(servicePath: string): void {
    this.servicePublishers.delete(servicePath);
  }
}
