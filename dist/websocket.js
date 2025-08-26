// src/websocket.ts
import * as http from 'http';
import { ScorpionError, NotFound } from "./errors.js";
export class WebSocketTransport {
    wsAdapter;
    httpServer;
    clients = new Map();
    app;
    config;
    clientIdCounter = 0;
    /**
     * Dynamically load the appropriate crossws adapter based on runtime
     */
    async loadCrossWSAdapter() {
        try {
            // Detect runtime and import appropriate adapter
            if (typeof globalThis.Deno !== 'undefined') {
                // Deno runtime
                const { default: crossws } = await import('crossws/adapters/deno');
                return crossws;
            }
            else if (typeof globalThis.Bun !== 'undefined') {
                // Bun runtime
                const { default: crossws } = await import('crossws/adapters/bun');
                return crossws;
            }
            else if (typeof globalThis.WebSocketPair !== 'undefined') {
                // Cloudflare Workers
                const { default: crossws } = await import('crossws/adapters/cloudflare');
                return crossws;
            }
            else {
                // Default to Node.js
                const { default: crossws } = await import('crossws/adapters/node');
                return crossws;
            }
        }
        catch (error) {
            console.warn('[Scorpion WebSocket] Failed to load runtime-specific adapter, falling back to Node.js');
            const { default: crossws } = await import('crossws/adapters/node');
            return crossws;
        }
    }
    constructor(app, config = {}) {
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
    async start() {
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
                    open: (peer) => {
                        this.handleConnection(peer);
                    },
                    message: (peer, message) => {
                        this.handleMessage(peer, message);
                    },
                    close: (peer, details) => {
                        this.handleDisconnection(peer, details);
                    },
                    error: (peer, error) => {
                        this.handleError(peer, error);
                    }
                }
            });
            // Create HTTP server for WebSocket
            const wsPort = this.config.port || 3030;
            this.httpServer = http.createServer();
            // Handle WebSocket upgrade requests
            this.httpServer.on('upgrade', (req, socket, head) => {
                if (req.url === this.config.path && req.headers.upgrade === 'websocket') {
                    this.wsAdapter.handleUpgrade(req, socket, head);
                }
                else {
                    socket.destroy();
                }
            });
            await new Promise((resolve, reject) => {
                this.httpServer.listen(wsPort, this.config.host, () => {
                    console.log(`[Scorpion WebSocket] HTTP server for WebSocket listening on http://${this.config.host}:${wsPort}`);
                    resolve();
                });
                this.httpServer.on('error', reject);
            });
            // Listen for service events to broadcast to clients
            this.setupServiceEventListeners();
            console.log(`[Scorpion WebSocket] WebSocket server listening on ws://${this.config.host}:${wsPort}${this.config.path}`);
            this.app.emit('websocket_listening', this.wsAdapter);
            return this.wsAdapter;
        }
        catch (error) {
            console.error('[Scorpion WebSocket] Failed to start WebSocket server:', error);
            this.app.emit('websocket_error', error);
            return undefined;
        }
    }
    /**
     * Stop the WebSocket server
     */
    async stop() {
        // Close all client connections
        for (const client of this.clients.values()) {
            client.peer.close();
        }
        this.clients.clear();
        if (this.httpServer) {
            await new Promise((resolve) => {
                this.httpServer.close(() => {
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
    handleConnection(peer) {
        const clientId = `client_${++this.clientIdCounter}`;
        const client = {
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
    async handleMessage(peer, message) {
        // Find the client associated with this peer
        const client = Array.from(this.clients.values()).find(c => c.peer === peer);
        if (!client) {
            console.error('[Scorpion WebSocket] Received message from unknown peer');
            return;
        }
        try {
            const parsedMessage = JSON.parse(message.text());
            console.log(`[Scorpion WebSocket] Received message from ${client.id}:`, parsedMessage);
            switch (parsedMessage.type) {
                case 'call':
                    await this.handleServiceCall(client, parsedMessage);
                    break;
                default:
                    this.sendError(client, `Unknown message type: ${parsedMessage.type}`, parsedMessage.requestId);
                    break;
            }
        }
        catch (error) {
            console.error(`[Scorpion WebSocket] Error parsing message from ${client.id}:`, error);
            this.sendError(client, 'Invalid JSON message', undefined, error);
        }
    }
    /**
     * Handle client disconnection
     */
    handleDisconnection(peer, details) {
        const client = Array.from(this.clients.values()).find(c => c.peer === peer);
        if (client) {
            console.log(`[Scorpion WebSocket] Client ${client.id} disconnected`);
            this.clients.delete(client.id);
        }
    }
    /**
     * Handle WebSocket errors
     */
    handleError(peer, error) {
        const client = Array.from(this.clients.values()).find(c => c.peer === peer);
        if (client) {
            console.error(`[Scorpion WebSocket] Client ${client.id} error:`, error);
            this.clients.delete(client.id);
        }
    }
    /**
     * Handle service method call via WebSocket
     */
    async handleServiceCall(client, message) {
        const { requestId, path, method, id, data, params = {} } = message;
        if (!path || !method) {
            this.sendError(client, 'Missing path or method in service call', requestId);
            return;
        }
        try {
            // Get the service
            const serviceInstance = this.app.service(path);
            if (!serviceInstance) {
                throw new NotFound(`Service '${path}' not found`);
            }
            // Prepare parameters for service call
            const callParams = {
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
        }
        catch (error) {
            console.error(`[Scorpion WebSocket] Error in service call ${path}.${method}:`, error);
            if (error instanceof ScorpionError) {
                this.sendError(client, error.message, requestId, error);
            }
            else {
                this.sendError(client, 'Internal server error', requestId, error);
            }
        }
    }
    /**
     * Send message to a specific client
     */
    sendMessage(client, message) {
        try {
            client.peer.send(JSON.stringify(message));
        }
        catch (error) {
            console.error(`[Scorpion WebSocket] Error sending message to ${client.id}:`, error);
        }
    }
    /**
     * Send error message to client
     */
    sendError(client, message, requestId, error) {
        const errorMessage = {
            type: 'error',
            requestId,
            error: {
                name: error?.name || 'Error',
                message,
                code: error?.code,
                statusCode: error?.statusCode || 500
            }
        };
        this.sendMessage(client, errorMessage);
    }
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        for (const client of this.clients.values()) {
            this.sendMessage(client, message);
        }
    }
    /**
     * Broadcast service event to subscribed clients
     */
    broadcastServiceEvent(servicePath, eventName, data) {
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
    setupServiceEventListeners() {
        // Listen for all service events and broadcast them
        const originalEmit = this.app.emit.bind(this.app);
        this.app.emit = (event, ...args) => {
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
    getEventNameForMethod(method) {
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
    getAdapter() {
        return this.wsAdapter;
    }
    /**
     * Get connected clients count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get client by ID
     */
    getClient(clientId) {
        return this.clients.get(clientId);
    }
}
/**
 * Start WebSocket server for the given app
 */
export function startWebSocketServer(app, config) {
    const transport = new WebSocketTransport(app, config);
    return transport.start();
}
//# sourceMappingURL=websocket.js.map