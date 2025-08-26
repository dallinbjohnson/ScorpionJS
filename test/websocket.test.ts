// test/websocket.test.ts

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { createApp, ScorpionApp } from '../src/app.js';
import { WebSocketTransport, WebSocketMessage } from '../src/websocket.js';
import { Service } from '../src/types.js';
import WebSocket from 'ws';

// Test service for WebSocket testing
class TestMessagesService implements Service<any> {
  private messages: Array<{ id: number; text: string; createdAt: Date }> = [];
  private idCounter = 0;

  async find(params?: any) {
    return this.messages;
  }

  async get(id: number, params?: any) {
    const message = this.messages.find(m => m.id === id);
    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }
    return message;
  }

  async create(data: { text: string }, params?: any) {
    const message = {
      id: ++this.idCounter,
      text: data.text,
      createdAt: new Date()
    };
    this.messages.push(message);
    return message;
  }

  async update(id: number, data: { text: string }, params?: any) {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex === -1) {
      throw new Error(`Message with id ${id} not found`);
    }
    
    const updatedMessage = {
      ...this.messages[messageIndex],
      text: data.text
    };
    this.messages[messageIndex] = updatedMessage;
    return updatedMessage;
  }

  async patch(id: number, data: Partial<{ text: string }>, params?: any) {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex === -1) {
      throw new Error(`Message with id ${id} not found`);
    }
    
    const patchedMessage = {
      ...this.messages[messageIndex],
      ...data
    };
    this.messages[messageIndex] = patchedMessage;
    return patchedMessage;
  }

  async remove(id: number, params?: any) {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex === -1) {
      throw new Error(`Message with id ${id} not found`);
    }
    
    const removedMessage = this.messages[messageIndex];
    this.messages.splice(messageIndex, 1);
    return removedMessage;
  }

  // Custom method for testing
  async customMethod(data: any, params?: any) {
    return { custom: true, data, timestamp: new Date() };
  }
}

// Helper to create WebSocket client and wait for connection + welcome message
const createWebSocketClient = (port: number, path: string = '/scorpion'): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}${path}`);
    
    ws.on('open', () => {
      // Wait for welcome message after connection is established
      const messageHandler = (data: any) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'connected') {
            ws.off('message', messageHandler);
            resolve(ws);
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };
      
      ws.on('message', messageHandler);
      
      // Timeout for welcome message
      setTimeout(() => {
        ws.off('message', messageHandler);
        reject(new Error('Welcome message timeout'));
      }, 3000);
    });
    
    ws.on('error', reject);
    
    // Timeout for connection
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
  });
};

// Helper to send message and wait for response
const sendMessage = (ws: WebSocket, message: WebSocketMessage): Promise<WebSocketMessage> => {
  return new Promise((resolve, reject) => {
    const requestId = message.requestId || `req_${Date.now()}_${Math.random()}`;
    message.requestId = requestId;

    const timeout = setTimeout(() => {
      reject(new Error('Message response timeout'));
    }, 5000);

    const messageHandler = (data: Buffer) => {
      try {
        const response: WebSocketMessage = JSON.parse(data.toString());
        if (response.requestId === requestId) {
          ws.off('message', messageHandler);
          clearTimeout(timeout);
          resolve(response);
        }
      } catch (error) {
        // Ignore parsing errors for other messages
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify(message));
  });
};

describe('WebSocket Transport', () => {
  // Shared setup for tests that need a running WebSocket server
  const setupWebSocketApp = async () => {
    const app = createApp({
      rest: { enabled: false }, // Disable REST for cleaner testing
      websocket: {
        enabled: true,
        port: 0, // Use dynamic port to avoid conflicts
        host: 'localhost',
        path: '/scorpion'
      }
    });

    // Register test service
    app.use('messages', new TestMessagesService());

    // Start the app (which will start WebSocket server)
    await app.listen();
    
    // Get the configured port
    const port = app.get('websocket.port') || 3030;
    
    return { app, port };
  };

  const cleanupWebSocketApp = async (app: ScorpionApp) => {
    // Clean up - stop the WebSocket server
    if (app && (app as any).wsServer) {
      await (app as any).wsServer.stop();
    }
  };

  describe('Connection Management', () => {
    let app: ScorpionApp;
    let port: number;

    beforeEach(async () => {
      const setup = await setupWebSocketApp();
      app = setup.app;
      port = setup.port;
    });

    afterEach(async () => {
      await cleanupWebSocketApp(app);
    });

    it('should accept WebSocket connections', async () => {
      const ws = await createWebSocketClient(port);
      expect(ws.readyState).to.equal(WebSocket.OPEN);
      ws.close();
    });

    it('should send welcome message on connection', async () => {
      const ws = await createWebSocketClient(port);
      
      const welcomeMessage = await new Promise<WebSocketMessage>((resolve) => {
        ws.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'connected') {
            resolve(message);
          }
        });
      });

      expect(welcomeMessage.type).to.equal('event');
      expect(welcomeMessage.event).to.equal('connected');
      expect(welcomeMessage.data).to.have.property('clientId');
      
      ws.close();
    });
  });

  describe('Service Method Calls', () => {
    let app: ScorpionApp;
    let port: number;
    let ws: WebSocket;

    beforeEach(async () => {
      const setup = await setupWebSocketApp();
      app = setup.app;
      port = setup.port;
      ws = await createWebSocketClient(port);
      // Welcome message is already handled in createWebSocketClient
    });

    afterEach(async () => {
      if (ws) {
        ws.close();
      }
      await cleanupWebSocketApp(app);
    });

    it('should handle find method calls', async () => {
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'find'
      });

      expect(response.type).to.equal('response');
      expect(response.result).to.be.an('array');
    });

    it('should handle create method calls', async () => {
      const testData = { text: 'Hello WebSocket!' };
      
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: testData
      });

      expect(response.type).to.equal('response');
      expect(response.result).to.have.property('id');
      expect(response.result).to.have.property('text', testData.text);
      expect(response.result).to.have.property('createdAt');
    });

    it('should handle get method calls with ID', async () => {
      // First create a message
      const createResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Test message for get' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Then get it
      const getResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'get',
        id: messageId
      });

      expect(getResponse.type).to.equal('response');
      expect(getResponse.result).to.have.property('id', messageId);
      expect(getResponse.result).to.have.property('text', 'Test message for get');
    });

    it('should handle update method calls', async () => {
      // First create a message
      const createResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Original text' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Then update it
      const updateResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'update',
        id: messageId,
        data: { text: 'Updated text' }
      });

      expect(updateResponse.type).to.equal('response');
      expect(updateResponse.result).to.have.property('id', messageId);
      expect(updateResponse.result).to.have.property('text', 'Updated text');
    });

    it('should handle patch method calls', async () => {
      // First create a message
      const createResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Original text' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Then patch it
      const patchResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'patch',
        id: messageId,
        data: { text: 'Patched text' }
      });

      expect(patchResponse.type).to.equal('response');
      expect(patchResponse.result).to.have.property('id', messageId);
      expect(patchResponse.result).to.have.property('text', 'Patched text');
    });

    it('should handle remove method calls', async () => {
      // First create a message
      const createResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Message to remove' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Then remove it
      const removeResponse = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'remove',
        id: messageId
      });

      expect(removeResponse.type).to.equal('response');
      expect(removeResponse.result).to.have.property('id', messageId);
      expect(removeResponse.result).to.have.property('text', 'Message to remove');
    });

    it('should handle custom method calls', async () => {
      const testData = { custom: 'data' };
      
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'customMethod',
        data: testData
      });

      expect(response.type).to.equal('response');
      expect(response.result).to.have.property('custom', true);
      expect(response.result).to.have.property('data');
      expect(response.result.data).to.deep.equal(testData);
      expect(response.result).to.have.property('timestamp');
    });

    it('should return error for non-existent service', async () => {
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'nonexistent',
        method: 'find'
      });

      expect(response.type).to.equal('error');
      expect(response.error).to.have.property('message');
      expect(response.error?.message).to.include('not found');
    });

    it('should return error for invalid message format', async () => {
      const response = await sendMessage(ws, {
        type: 'call',
        path: '', // Invalid: empty path
        method: 'find'
      });

      expect(response.type).to.equal('error');
      expect(response.error).to.have.property('message');
      expect(response.error?.message).to.include('Missing path or method');
    });
  });

  describe('Real-time Events', () => {
    let app: ScorpionApp;
    let port: number;
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      const setup = await setupWebSocketApp();
      app = setup.app;
      port = setup.port;
      ws1 = await createWebSocketClient(port);
      ws2 = await createWebSocketClient(port);
      // Welcome messages are already handled in createWebSocketClient
    });

    afterEach(async () => {
      if (ws1) ws1.close();
      if (ws2) ws2.close();
      await cleanupWebSocketApp(app);
    });

    it('should broadcast created events to all clients', async () => {
      // Set up event listener on ws2
      const eventPromise = new Promise<WebSocketMessage>((resolve) => {
        ws2.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'messages created') {
            resolve(message);
          }
        });
      });

      // Create message via ws1
      await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Broadcast test message' }
      });

      // Wait for event on ws2
      const event = await eventPromise;
      expect(event.type).to.equal('event');
      expect(event.event).to.equal('messages created');
      expect(event.data).to.have.property('text', 'Broadcast test message');
    });

    it('should broadcast updated events to all clients', async () => {
      // First create a message
      const createResponse = await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Original message' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Set up event listener on ws2
      const eventPromise = new Promise<WebSocketMessage>((resolve) => {
        ws2.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'messages updated') {
            resolve(message);
          }
        });
      });

      // Update message via ws1
      await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'update',
        id: messageId,
        data: { text: 'Updated message' }
      });

      // Wait for event on ws2
      const event = await eventPromise;
      expect(event.type).to.equal('event');
      expect(event.event).to.equal('messages updated');
      expect(event.data).to.have.property('text', 'Updated message');
    });

    it('should broadcast patched events to all clients', async () => {
      // First create a message
      const createResponse = await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Original message' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Set up event listener on ws2
      const eventPromise = new Promise<WebSocketMessage>((resolve) => {
        ws2.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'messages patched') {
            resolve(message);
          }
        });
      });

      // Patch message via ws1
      await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'patch',
        id: messageId,
        data: { text: 'Patched message' }
      });

      // Wait for event on ws2
      const event = await eventPromise;
      expect(event.type).to.equal('event');
      expect(event.event).to.equal('messages patched');
      expect(event.data).to.have.property('text', 'Patched message');
    });

    it('should broadcast removed events to all clients', async () => {
      // First create a message
      const createResponse = await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'create',
        data: { text: 'Message to remove' }
      });

      expect(createResponse.type).to.equal('response');
      expect(createResponse.result).to.exist;
      expect(createResponse.result).to.have.property('id');
      const messageId = createResponse.result.id;

      // Set up event listener on ws2
      const eventPromise = new Promise<WebSocketMessage>((resolve) => {
        ws2.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'event' && message.event === 'messages removed') {
            resolve(message);
          }
        });
      });

      // Remove message via ws1
      await sendMessage(ws1, {
        type: 'call',
        path: 'messages',
        method: 'remove',
        id: messageId
      });

      // Wait for event on ws2
      const event = await eventPromise;
      expect(event.type).to.equal('event');
      expect(event.event).to.equal('messages removed');
      expect(event.data).to.have.property('text', 'Message to remove');
    });
  });

  describe('Dynamic Service Management', () => {
    let app: ScorpionApp;
    let port: number;
    let ws: WebSocket;

    beforeEach(async () => {
      const setup = await setupWebSocketApp();
      app = setup.app;
      port = setup.port;
      ws = await createWebSocketClient(port);
      // Welcome message is already handled in createWebSocketClient
    });

    afterEach(async () => {
      if (ws) ws.close();
      await cleanupWebSocketApp(app);
    });

    it('should work with dynamically added services', async () => {
      // Add a new service dynamically
      class DynamicService implements Service<any> {
        async find() {
          return [{ id: 1, name: 'Dynamic Item' }];
        }
      }

      app.use('dynamic', new DynamicService());

      // Test calling the new service
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'dynamic',
        method: 'find'
      });

      // Debug: log the response if it's an error
      if (response.type === 'error') {
        console.log('Dynamic service test error:', response.error);
      }

      expect(response.type).to.equal('response');
      expect(response.result).to.be.an('array');
      expect(response.result[0]).to.have.property('name', 'Dynamic Item');
    });

    it('should handle calls to removed services gracefully', async () => {
      // Remove the messages service
      app.unuse('messages');

      // Try to call the removed service
      const response = await sendMessage(ws, {
        type: 'call',
        path: 'messages',
        method: 'find'
      });

      // Debug: log the actual error message
      console.log('Service removal test error:', response.error);

      expect(response.type).to.equal('error');
      expect(response.error).to.have.property('message');
      expect(response.error?.message).to.include('Service');
    });
  });

  describe('Configuration', () => {
    it('should respect WebSocket configuration options', async () => {
      const customApp = createApp({
        rest: { enabled: false },
        websocket: {
          enabled: true,
          port: 0,
          host: 'localhost',
          path: '/custom-path'
        }
      });

      customApp.use('test', new TestMessagesService());
      await customApp.listen();

      try {
        const customPort = customApp.get('websocket.port') || 3030;
        const customWs = await createWebSocketClient(customPort, '/custom-path');

        expect(customWs.readyState).to.equal(WebSocket.OPEN);
        customWs.close();
      } finally {
        // Clean up the custom app
        await cleanupWebSocketApp(customApp);
      }
    });

    it('should not start WebSocket server when disabled', async () => {
      const disabledApp = createApp({
        rest: { enabled: false },
        websocket: { enabled: false }
      });

      // Should throw error when no transports are enabled
      try {
        await disabledApp.listen();
        expect.fail('Should throw error when no transports are enabled');
      } catch (error: any) {
        expect(error.message).to.include('No transports are enabled');
      }
    });
  });
});
