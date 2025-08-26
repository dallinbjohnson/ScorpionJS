import type { Peer } from 'crossws';
import { IScorpionAppInternal, WebSocketTransportConfig } from "./types.js";
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
interface WebSocketClient {
    peer: Peer;
    id: string;
    subscriptions: Set<string>;
    pendingRequests: Map<string, {
        resolve: Function;
        reject: Function;
    }>;
}
export declare class WebSocketTransport {
    private wsAdapter;
    private httpServer?;
    private clients;
    private app;
    private config;
    private clientIdCounter;
    /**
     * Dynamically load the appropriate crossws adapter based on runtime
     */
    private loadCrossWSAdapter;
    constructor(app: IScorpionAppInternal<any>, config?: WebSocketTransportConfig);
    /**
     * Start the WebSocket server using crossws
     */
    start(): Promise<any>;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
    /**
     * Handle new WebSocket connection
     */
    private handleConnection;
    /**
     * Handle incoming WebSocket message
     */
    private handleMessage;
    /**
     * Handle client disconnection
     */
    private handleDisconnection;
    /**
     * Handle WebSocket errors
     */
    private handleError;
    /**
     * Handle service method call via WebSocket
     */
    private handleServiceCall;
    /**
     * Send message to a specific client
     */
    private sendMessage;
    /**
     * Send error message to client
     */
    private sendError;
    /**
     * Broadcast message to all connected clients
     */
    private broadcast;
    /**
     * Broadcast service event to subscribed clients
     */
    private broadcastServiceEvent;
    /**
     * Setup listeners for service events to broadcast to WebSocket clients
     */
    private setupServiceEventListeners;
    /**
     * Get the appropriate event name for a service method
     */
    private getEventNameForMethod;
    /**
     * Get WebSocket adapter instance (for testing or external access)
     */
    getAdapter(): any;
    /**
     * Get connected clients count
     */
    getClientCount(): number;
    /**
     * Get client by ID
     */
    getClient(clientId: string): WebSocketClient | undefined;
}
/**
 * Start WebSocket server for the given app
 */
export declare function startWebSocketServer(app: IScorpionAppInternal<any>, config?: WebSocketTransportConfig): Promise<any>;
export {};
