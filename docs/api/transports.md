# Transport API

ScorpionJS supports multiple transport mechanisms for communication between services and clients. This document provides detailed API documentation for configuring and using transports in ScorpionJS.

## Available Transports

ScorpionJS includes the following built-in transports:

1. **REST**: HTTP/REST transport for RESTful APIs
2. **Socket**: WebSocket transport for real-time communication
3. **Custom**: Extensible system for custom transports

## Configuring Transports

Transports are configured when creating a ScorpionJS application:

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  transports: {
    rest: {
      port: 3000,
      host: 'localhost',
      cors: true,
      bodyParser: true,
      compression: true
    },
    socket: {
      port: 3000, // Can share port with REST
      path: '/socket',
      pingInterval: 10000,
      pingTimeout: 5000,
      maxHttpBufferSize: 1e6
    }
  }
});
```

## REST Transport

The REST transport provides RESTful API endpoints for your services.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | Number | `3000` | The port to listen on |
| `host` | String | `'localhost'` | The host to bind to |
| `cors` | Boolean/Object | `false` | CORS configuration |
| `bodyParser` | Boolean/Object | `true` | Body parser configuration |
| `compression` | Boolean | `false` | Enable response compression |
| `prefix` | String | `''` | URL prefix for all endpoints |
| `middleware` | Array | `[]` | Additional middleware to use |

### REST Endpoint Mapping

ScorpionJS automatically maps service methods to REST endpoints:

| Service Method | HTTP Method | Path | Description |
|---------------|------------|------|-------------|
| `find` | GET | `/path` | Get a list of resources |
| `get` | GET | `/path/:id` | Get a single resource |
| `create` | POST | `/path` | Create a new resource |
| `update` | PUT | `/path/:id` | Replace a resource |
| `patch` | PATCH | `/path/:id` | Update parts of a resource |
| `remove` | DELETE | `/path/:id` | Remove a resource |
| `customMethod` | POST | `/path/:id/customMethod` | Custom method |

### Custom REST Method Mapping

You can customize how methods are mapped to REST endpoints:

```javascript
app.service('payments').methods({
  processPayment: {
    http: { method: 'POST', path: '/process' }
  },
  refund: {
    http: { method: 'POST', path: '/:id/refund' }
  },
  getStatus: {
    http: { method: 'GET', path: '/:id/status' }
  }
});
```

### Streaming with REST

The REST transport supports streaming responses from service methods, which is essential for handling large datasets or files efficiently.

**1. JSON Streaming (NDJSON)**

When a service method is expected to return a list of items (e.g., from a `find` method) and the client requests a streaming format, ScorpionJS can send the response as an [NDJSON (Newline Delimited JSON)](http://ndjson.org/) stream. This allows the client to process each JSON object as it arrives, rather than waiting for the entire list to be serialized.

*   **Service Method Example:**
    Assume a `messages` service whose `find` method can return a large number of messages. The service method itself might return an array or a stream; the framework then adapts based on the request context.

    ```javascript
    // services/messages.js
    class MessagesService {
      async find(params) {
        // Simulate fetching many messages
        const messages = [];
        for (let i = 0; i < 1000; i++) {
          messages.push({ id: i, text: `Message ${i}` });
        }
        // The framework will handle streaming this array as NDJSON
        // if the 'Accept: application/x-ndjson' header is present.
        return messages;
      }
    }
    ```

*   **Client Request & Response:**
    *   If the client sends `Accept: application/x-ndjson`:
        ```bash
        curl -H "Accept: application/x-ndjson" http://localhost:3000/messages
        ```
        The response body would be (Content-Type: application/x-ndjson):
        ```
        {"id":0,"text":"Message 0"}
        {"id":1,"text":"Message 1"}
        ...
        {"id":999,"text":"Message 999"}
        ```
        (Each JSON object on a new line)

    *   If the client sends `Accept: application/json` (or no specific `Accept` header implying JSON):
        ScorpionJS would typically send a standard JSON array (Content-Type: application/json).
        ```bash
        curl -H "Accept: application/json" http://localhost:3000/messages
        ```
        The response body would be:
        ```json
        [
          {"id":0,"text":"Message 0"},
          {"id":1,"text":"Message 1"},
          ...
          {"id":999,"text":"Message 999"}
        ]
        ```

**2. File Streaming**

Service methods can stream files directly to the client. This is useful for serving downloads without loading the entire file into memory.

*   **Service Method Example:**
    ```javascript
    // services/files.js
    import fs from 'node:fs';
    import path from 'node:path';

    class FilesService {
      // Assuming 'id' is the filename, passed via route e.g., /files/:id
      async get(id, params) { 
        const filePath = path.join(__dirname, 'public', id); // Important: Sanitize and validate 'id' to prevent directory traversal
        if (!fs.existsSync(filePath)) {
          // throw new NotFound('File not found'); // Use appropriate error class
          throw new Error('File not found');
        }
        // The service returns a ReadableStream.
        // The framework should set appropriate headers like Content-Type and Content-Disposition.
        // Optionally, the service can provide metadata via params:
        // params.streamMetadata = { contentType: 'application/pdf', fileName: id };
        return fs.createReadStream(filePath);
      }
    }
    ```

*   **Client Request:**
    ```bash
    curl http://localhost:3000/files/report.pdf -o report.pdf
    ```
    The REST transport pipes the `ReadableStream` from the service method to the HTTP response, using chunked transfer encoding. The framework should ideally infer `Content-Type` (e.g., from file extension or `params.streamMetadata`) and can set `Content-Disposition: attachment; filename="report.pdf"` to suggest a download.


## Socket Transport

The Socket transport provides real-time communication using WebSockets.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | Number | `3000` | The port to listen on |
| `path` | String | `'/socket'` | The endpoint path for WebSocket connections |
| `pingInterval` | Number | `10000` | How often to ping clients (ms) |
| `pingTimeout` | Number | `5000` | How long to wait for pong response (ms) |
| `maxHttpBufferSize` | Number | `1e6` | Maximum HTTP buffer size |
| `transports` | Array | `['websocket']` | Transport mechanisms to allow |
| `middleware` | Array | `[]` | Additional middleware to use |

### Socket Event Mapping

ScorpionJS automatically maps service methods to socket events:

| Service Method | Socket Event | Description |
|---------------|-------------|-------------|
| `find` | `serviceName::find` | Get a list of resources |
| `get` | `serviceName::get` | Get a single resource |
| `create` | `serviceName::create` | Create a new resource |
| `update` | `serviceName::update` | Replace a resource |
| `patch` | `serviceName::patch` | Update parts of a resource |
| `remove` | `serviceName::remove` | Remove a resource |
| `customMethod` | `serviceName::customMethod` | Custom method |

### Real-time Events

When a service method modifies data, ScorpionJS automatically emits events that clients can listen to:

| Service Method | Emitted Event | Data |
|---------------|--------------|------|
| `create` | `serviceName created` | The created resource |
| `update` | `serviceName updated` | The updated resource |
| `patch` | `serviceName patched` | The patched resource |
| `remove` | `serviceName removed` | The removed resource |

### Streaming with Sockets

The Socket transport also supports streaming, enabling real-time data flows for large datasets or continuous updates without overwhelming the client or server with large single messages. This aligns with the ScorpionJS principle of universal accessibility for service methods.

**1. JSON Streaming (NDJSON-like over Sockets)**

When a service method returns a stream of JSON objects (or an array that the framework decides to stream), the Socket transport can send each object as a separate WebSocket message or as part of an identified sequence.

*   **Service Method Example:**
    (Using a similar `MessagesService.find` method as in the REST example)

    ```javascript
    // services/messages.js
    class MessagesService {
      async find(params) {
        const messages = [];
        for (let i = 0; i < 100; i++) { messages.push({ id: i, text: `Message ${i}` }); }
        // If params.stream is indicated in the WebSocket call, the framework
        // can iterate over this array and send each item as a separate message.
        // Alternatively, if the service method returns a Readable object stream,
        // the framework would pipe it similarly.
        return messages;
      }
    }
    ```

*   **Socket Interaction (Conceptual):**
    The client initiates a call, potentially indicating a preference for streaming. The server then sends multiple messages in response.

    **Client-side Request:**
    ```json
    // Client sends a 'call' message, possibly with a streaming hint
    {
      "type": "call",
      "path": "messages",
      "method": "find",
      "requestId": "reqStream123", // Unique ID for the request
      "params": { "query": { "live": true }, "stream": true } // Optional: 'stream: true' hint
    }
    ```

    **Server-side Responses (Example Sequence):**
    The server might send a series of data messages followed by an end-of-stream marker, all correlated by `requestId`.
    ```json
    // Message 1
    { "type": "stream_data", "requestId": "reqStream123", "data": {"id":0,"text":"Message 0"} }
    // Message 2
    { "type": "stream_data", "requestId": "reqStream123", "data": {"id":1,"text":"Message 1"} }
    // ... more data messages
    // Final Message
    { "type": "stream_end", "requestId": "reqStream123" }
    ```
    The exact message `type` values (`stream_data`, `stream_end`) and the mechanism for enabling streaming would be defined by ScorpionJS's WebSocket protocol. The client library would then reassemble these into a stream-like interface.

**2. File Streaming**

Streaming files over WebSockets involves breaking the file into chunks (typically binary) and sending them as sequential messages. Metadata about the file (name, type, size) might be sent first.

*   **Service Method Example:**
    (Using the same `FilesService.get` method that returns a `ReadableStream`)
    ```javascript
    // services/files.js
    // ... (as in the REST example, returns fs.createReadStream(filePath))
    ```

*   **Socket Interaction (Conceptual):**

    **Client-side Request:**
    ```json
    {
      "type": "call",
      "path": "files", // Or the specific service path for file downloads
      "method": "get",
      "id": "report.pdf", // File identifier
      "requestId": "fileReq456"
    }
    ```

    **Server-side Responses (Example Sequence):**
    1.  (Optional) Metadata message:
        ```json
        {
          "type": "file_metadata",
          "requestId": "fileReq456",
          "data": { "name": "report.pdf", "type": "application/pdf", "size": 1234567 }
        }
        ```
    2.  Series of binary WebSocket messages containing file chunks.
        *(Each message is a raw binary payload representing a chunk of the file)*

    3.  End-of-stream message:
        ```json
        { "type": "file_end", "requestId": "fileReq456" }
        ```
    The client would listen for these messages, collect the binary chunks, and reassemble them into the complete file once the `file_end` message is received, potentially using the information from `file_metadata`.

## Multi-Runtime Support

ScorpionJS is designed to work across multiple JavaScript runtimes:

### Node.js

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Start the server
app.listen(3000).then(() => {
  console.log('Server running at http://localhost:3000');
});
```

### Cloudflare Workers

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return app.handleRequest(request, { env, ctx });
  }
};
```

### AWS Lambda

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Export for AWS Lambda
export const handler = async (event, context) => {
  return app.handleLambdaEvent(event, context);
};
```

### Deno

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Start Deno server
Deno.serve({ port: 3000 }, (request) => {
  return app.handleRequest(request);
});
```

### Bun

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Start Bun server
export default {
  port: 3000,
  fetch(request) {
    return app.handleRequest(request);
  }
};
```

### Fastly Compute

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register services
app.service('messages', { /* ... */ });

// Export for Fastly Compute
addEventListener("fetch", (event) => {
  event.respondWith(app.handleRequest(event.request));
});
```

## Custom Transports

You can create custom transports for ScorpionJS:

```javascript
import { createApp, Transport } from 'scorpionjs';

// Create a custom transport
class MyCustomTransport extends Transport {
  constructor(options) {
    super(options);
    this.options = options;
  }
  
  async setup(app) {
    this.app = app;
    
    // Set up your transport
    
    return this;
  }
  
  async teardown() {
    // Clean up your transport
    
    return this;
  }
  
  // Implement methods to handle service calls
  async serviceMethod(service, method, ...args) {
    // Handle service method call
    return service[method](...args);
  }
}

// Register the custom transport
const app = createApp({
  transports: {
    custom: {
      transport: MyCustomTransport,
      options: {
        // Custom transport options
      }
    }
  }
});
```

## Cross-Transport Communication

ScorpionJS allows services to communicate seamlessly across different transports:

```javascript
// Service registered on the server
app.service('messages', {
  async find() {
    return [{ text: 'Hello' }];
  }
});

// REST client
const restClient = createClient('http://localhost:3000');
await restClient.service('messages').find();

// Socket client
const socketClient = createClient('ws://localhost:3000/socket');
await socketClient.service('messages').find();

// Both clients receive real-time updates
socketClient.service('messages').on('created', message => {
  console.log('New message:', message);
});

// Creating a message through REST triggers the socket event
await restClient.service('messages').create({ text: 'Hello' });
```
