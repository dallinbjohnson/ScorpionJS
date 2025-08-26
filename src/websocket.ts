// src/websocket.ts

import * as http from 'http';
import { AddressInfo } from 'net';
// Dynamic crossws adapter loading based on runtime
import type { Peer, Message } from 'crossws';
import {
  IScorpionApp,
  IScorpionAppInternal,
  Params,
  Service,
  HookContext,
  WebSocketTransportConfig,
} from "./types.js";
import { ScorpionError, BadRequest, NotFound, InternalServerError } from "./errors.js";

// WebSocket message types for the protocol
export interface WebSocketMessage {
  type: 'call' | 'response' | 'error' | 'event' | 'stream_data' | 'stream_end';
  requestId?: string;
  path?: string;
  method?: string;
  id?: string | number | null;
  data?: any;
  params?: any;
  error?: {
    name: string;
    message: string;
    code?: number;
    statusCode?: number;
  };
  event?: string;
  result?: any;
}

// Client connection wrapper
interface WebSocketClient {
  peer: Peer;
  id: string;
  subscriptions: Set<string>; // Event subscriptions
  pendingRequests: Map<string, { resolve: Function; reject: Function }>; // For request/response tracking
}

export class WebSocketTransport {
  private wsAdapter: any;
  private httpServer?: http.Server;
  private clients: Map<string, WebSocketClient> = new Map();
  private app: IScorpionAppInternal<any>;
  private config: WebSocketTransportConfig;
  private clientIdCounter = 0;

  /**
   * Dynamically load the appropriate crossws adapter based on runtime
   */
  private async loadCrossWSAdapter(): Promise<any> {
    try {
      // Detect runtime and import appropriate adapter
      if (typeof (globalThis as any).Deno !== 'undefined') {
        // Deno runtime
        const { default: crossws } = await import('crossws/adapters/deno');
        return crossws;
      } else if (typeof (globalThis as any).Bun !== 'undefined') {
        // Bun runtime
        const { default: crossws } = await import('crossws/adapters/bun');
        return crossws;
      } else if (typeof (globalThis as any).WebSocketPair !== 'undefined') {
        // Cloudflare Workers
        const { default: crossws } = await import('crossws/adapters/cloudflare');
        return crossws;
      } else {
        // Default to Node.js
        const { default: crossws } = await import('crossws/adapters/node');
        return crossws;
      }
    } catch (error) {
      console.warn('[Scorpion WebSocket] Failed to load runtime-specific adapter, falling back to Node.js');
      const { default: crossws } = await import('crossws/adapters/node');
      return crossws;
    }
  }

  constructor(app: IScorpionAppInternal<any>, config: WebSocketTransportConfig = {}) {
    this.app = app;
    this.config = {
      enabled: true,
      port: 3030,
      host: 'localhost',
      path: '/scorpion',
      ...config
    };
  }

  /**
   * Start the WebSocket server using crossws
   */
  async start(): Promise<any> {
    if (!this.config.enabled) {
      console.log('[Scorpion WebSocket] WebSocket transport is disabled');
      return undefined;
    }

    try {
      // Load the appropriate crossws adapter for the current runtime
      const crossws = await this.loadCrossWSAdapter();
      
      // Create crossws adapter with hooks
      this.wsAdapter = crossws({
        hooks: {
          open: (peer: Peer) => {
            this.handleConnection(peer);
          },
          message: (peer: Peer, message: Message) => {
            this.handleMessage(peer, message);
          },
          close: (peer: Peer, details: { code?: number; reason?: string }) => {
            this.handleDisconnection(peer, details);
          },
          error: (peer: Peer, error: Error) => {
            this.handleError(peer, error);
          }
        }
      });

      // Create HTTP server for WebSocket
      const wsPort = this.config.port;
      this.httpServer = http.createServer();
      
      // Handle WebSocket upgrade requests
      this.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === this.config.path && req.headers.upgrade === 'websocket') {
          this.wsAdapter.handleUpgrade(req, socket, head);
        } else {
          socket.destroy();
        }
      });

      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(wsPort, this.config.host, () => {
          const actualPort = (this.httpServer!.address() as any)?.port || wsPort;
          // Update the app config with the actual port
          this.app.set('websocket.port', actualPort);
          console.log(`[Scorpion WebSocket] HTTP server for WebSocket listening on http://${this.config.host}:${actualPort}`);
          console.log(`[Scorpion WebSocket] WebSocket server listening on ws://${this.config.host}:${actualPort}${this.config.path}`);
          resolve();
        });
        
        this.httpServer!.on('error', (error) => {
          reject(error);
        });
      });
      
      // Listen for service events to broadcast to clients
      this.setupServiceEventListeners();
      this.app.emit('websocket_listening', this.wsAdapter);
      
      return this.wsAdapter;
    } catch (error) {
      console.error('[Scorpion WebSocket] Failed to start WebSocket server:', error);
      this.app.emit('websocket_error', error as Error);
      return undefined;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Close all client connections
    for (const client of this.clients.values()) {
      client.peer.close();
    }
    this.clients.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          console.log('[Scorpion WebSocket] HTTP server closed');
          resolve();
        });
      });
    }
    
    console.log('[Scorpion WebSocket] WebSocket server stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(peer: Peer): void {
    const clientId = `client_${++this.clientIdCounter}`;
    const client: WebSocketClient = {
      peer,
      id: clientId,
      subscriptions: new Set(),
      pendingRequests: new Map()
    };

    this.clients.set(clientId, client);
    console.log(`[Scorpion WebSocket] Client ${clientId} connected`);

    // Send welcome message
    this.sendMessage(client, {
      type: 'event',
      event: 'connected',
      data: { clientId }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(peer: Peer, message: Message): Promise<void> {
    // Find the client associated with this peer
    const client = Array.from(this.clients.values()).find(c => c.peer === peer);
    if (!client) {
      console.error('[Scorpion WebSocket] Received message from unknown peer');
      return;
    }

    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message.text());
      console.log(`[Scorpion WebSocket] Received message from ${client.id}:`, parsedMessage);

      switch (parsedMessage.type) {
        case 'call':
          await this.handleServiceCall(client, parsedMessage);
          break;
        
        default:
          this.sendError(client, `Unknown message type: ${parsedMessage.type}`, parsedMessage.requestId);
          break;
      }
    } catch (error) {
      console.error(`[Scorpion WebSocket] Error parsing message from ${client.id}:`, error);
      this.sendError(client, 'Invalid JSON message', undefined, error as Error);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(peer: Peer, details: { code?: number; reason?: string }): void {
    const client = Array.from(this.clients.values()).find(c => c.peer === peer);
    if (client) {
      console.log(`[Scorpion WebSocket] Client ${client.id} disconnected`);
      this.clients.delete(client.id);
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(peer: Peer, error: Error): void {
    const client = Array.from(this.clients.values()).find(c => c.peer === peer);
    if (client) {
      console.error(`[Scorpion WebSocket] Client ${client.id} error:`, error);
      this.clients.delete(client.id);
    }
  }

  /**
   * Handle service method call via WebSocket
   */
  private async handleServiceCall(client: WebSocketClient, message: WebSocketMessage): Promise<void> {
    const { requestId, path, method, id, data, params = {} } = message;

    if (!path || !method) {
      this.sendError(client, 'Missing path or method in service call', requestId);
      return;
    }

    try {
      // Prepare parameters for service call
      const callParams: Params = {
        ...params,
        provider: 'websocket',
        connection: {
          clientId: client.id,
          peer: client.peer
        }
      };

      // Execute the service call through the app's hook system
      const result = await this.app.executeServiceCall({
        path,
        method,
        id,
        data,
        params: callParams
      });

      // Check if there was an error in the service call
      if (result.error) {
        throw result.error;
      }

      // Send response back to client
      this.sendMessage(client, {
        type: 'response',
        requestId,
        result: result.result
      });

      // Emit real-time events for data modification operations
      if (['create', 'update', 'patch', 'remove'].includes(method)) {
        const eventName = this.getEventNameForMethod(method);
        this.broadcastServiceEvent(path, eventName, result.result);
      }

    } catch (error: any) {
      console.error(`[Scorpion WebSocket] Error in service call ${path}.${method}:`, error);
      
      if (error instanceof ScorpionError) {
        this.sendError(client, error.message, requestId, error);
      } else {
        this.sendError(client, 'Internal server error', requestId, error);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(client: WebSocketClient, message: WebSocketMessage): void {
    try {
      client.peer.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[Scorpion WebSocket] Error sending message to ${client.id}:`, error);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WebSocketClient, message: string, requestId?: string, error?: Error): void {
    const errorMessage: WebSocketMessage = {
      type: 'error',
      requestId,
      error: {
        name: error?.name || 'Error',
        message,
        code: (error as any)?.code,
        statusCode: (error as any)?.statusCode || 500
      }
    };

    this.sendMessage(client, errorMessage);
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      this.sendMessage(client, message);
    }
  }

  /**
   * Broadcast service event to subscribed clients
   */
  private broadcastServiceEvent(servicePath: string, eventName: string, data: any): void {
    const eventKey = `${servicePath} ${eventName}`;
    
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(eventKey) || client.subscriptions.has(`${servicePath} *`)) {
        this.sendMessage(client, {
          type: 'event',
          event: eventKey,
          data
        });
      }
    }
  }

  /**
   * Setup listeners for service events to broadcast to WebSocket clients
   */
  private setupServiceEventListeners(): void {
    // Listen for all service events and broadcast them
    const originalEmit = this.app.emit.bind(this.app);
    
    this.app.emit = (event: string | symbol, ...args: any[]): boolean => {
      const result = originalEmit(event, ...args);
      
      // If this is a service event, broadcast it to WebSocket clients
      if (typeof event === 'string' && event.includes(' ')) {
        const [servicePath, eventName] = event.split(' ', 2);
        if (['created', 'updated', 'patched', 'removed'].includes(eventName)) {
          this.broadcastServiceEvent(servicePath, eventName, args[0]);
        }
      }
      
      return result;
    };
  }

  /**
   * Get the appropriate event name for a service method
   */
  private getEventNameForMethod(method: string): string {
    switch (method) {
      case 'create': return 'created';
      case 'update': return 'updated';
      case 'patch': return 'patched';
      case 'remove': return 'removed';
      default: return method;
    }
  }

  /**
   * Get WebSocket adapter instance (for testing or external access)
   */
  public getAdapter(): any {
    return this.wsAdapter;
  }

  /**
   * Get connected clients count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client by ID
   */
  public getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }
}

/**
 * Start WebSocket server for the given app
 */
export function startWebSocketServer(
  app: IScorpionAppInternal<any>,
  config?: WebSocketTransportConfig
): Promise<WebSocketTransport> {
  const transport = new WebSocketTransport(app, config);
  return transport.start().then(() => transport);
}
