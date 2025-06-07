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
