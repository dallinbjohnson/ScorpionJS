# Core Concepts

This section covers the fundamental concepts and architecture of ScorpionJS.

## Table of Contents

- [Application](#application)
- [Services](#services)
- [Hooks](#hooks)
- [Transport](#transport)
- [Schema Validation](#schema-validation)
- [Fault Tolerance](#fault-tolerance)
- [Service Discovery](#service-discovery)
- [Streams](#streams)

## Application

The ScorpionJS application is the central object that coordinates all aspects of your application. It manages services, hooks, and transports.

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  // Configuration options
});
```

## Services

Services are the core building blocks of a ScorpionJS application. Each service provides a set of methods that can be called both locally and remotely.

```javascript
// Define and register a service
app.use('messages', {
  // Standard REST methods
  async find(params) {
    // Return a list of messages
    return [];
  },
  
  async get(id, params) {
    // Return a single message
    return { id, text: 'Hello!' };
  },
  
  async create(data, params) {
    // Create a new message
    return { ...data, id: Date.now() };
  },
  
  async update(id, data, params) {
    // Replace a message
    return { ...data, id };
  },
  
  async patch(id, data, params) {
    // Update parts of a message
    return { id, text: data.text };
  },
  
  async remove(id, params) {
    // Remove a message
    return { id };
  },
  
  // Custom methods
  async customMethod(data, params) {
    // Custom functionality
    return { result: 'Custom operation completed' };
  }
});
```

## Hooks

Hooks are middleware functions that can be registered before, after, or around service method calls. They allow you to modify the input or output of a service method, handle errors, or perform side effects.

```javascript
// Global before hook
app.hooks({
  before: {
    all: [
      async context => {
        console.log(`Global before hook: ${context.path}.${context.method}`);
        return context;
      }
    ]
  }
});

// Service-specific hooks
app.service('messages').hooks({
  before: {
    all: [
      async context => {
        console.log('Before all messages methods');
        return context;
      }
    ],
    find: [
      async context => {
        context.params.query = { ...context.params.query, published: true };
        return context;
      }
    ]
  },
  after: {
    create: [
      async context => {
        // Emit an event after creating a message
        app.service('messages').emit('created', context.result);
        return context;
      }
    ]
  },
  error: {
    all: [
      async context => {
        console.error('Error in messages service:', context.error);
        return context;
      }
    ]
  }
});

// Pattern-based hooks (Hono-inspired)
app.hooks('/api/*', {
  before: {
    all: [
      async context => {
        console.log('API route accessed');
        return context;
      }
    ]
  }
});
```

## Transport

ScorpionJS supports multiple transport mechanisms for communication between services and clients:

- **HTTP/REST**: Standard RESTful API endpoints
- **WebSockets**: Real-time bidirectional communication
- **Custom Transports**: Extensible transport system for custom protocols

```javascript
// Configure transports
const app = createApp({
  transports: {
    rest: {
      port: 3000,
      cors: true
    },
    socket: {
      port: 3000, // Can share port with REST
      path: '/socket'
    }
  }
});
```

## Schema Validation

ScorpionJS provides built-in schema validation using JSON Schema and TypeScript:

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Define a schema for the messages service
const messageSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    id: { type: 'number' },
    text: { type: 'string', minLength: 1, maxLength: 1000 },
    userId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

// Register a service with schema validation
app.use('messages', {
  schema: {
    create: messageSchema,
    update: messageSchema,
    patch: {
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1, maxLength: 1000 }
      }
    },
    query: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  },
  
  async find(params) {
    // The params.query has been validated against the query schema
    return [];
  },
  
  async create(data, params) {
    // The data has been validated against the create schema
    return { ...data, id: Date.now() };
  }
});
```

## Fault Tolerance

ScorpionJS includes several fault tolerance mechanisms inspired by Moleculer:

### Circuit Breaker

Prevents cascading failures by stopping requests to failing services.

```javascript
const app = createApp({
  circuitBreaker: {
    enabled: true,
    threshold: 0.5,        // Error rate threshold
    minRequests: 20,       // Minimum number of requests needed before tripping
    windowTime: 60 * 1000, // Time window for error rate calculation in ms
    halfOpenTime: 10 * 1000 // Time to try half-open state
  }
});
```

### Bulkhead

Limits concurrent requests to prevent resource exhaustion.

```javascript
const app = createApp({
  bulkhead: {
    enabled: true,
    concurrency: 10,       // Maximum concurrent requests
    maxQueueSize: 100      // Maximum queue size for pending requests
  }
});
```

### Retry

Automatically retries failed requests.

```javascript
const app = createApp({
  retry: {
    enabled: true,
    retries: 3,            // Number of retries
    delay: 1000,           // Delay between retries in ms
    maxDelay: 5000,        // Maximum delay
    factor: 2              // Exponential backoff factor
  }
});
```

### Timeout

Sets maximum execution time for service methods.

```javascript
const app = createApp({
  timeout: {
    enabled: true,
    default: 5000          // Default timeout in ms
  }
});

// Service-specific timeout
app.use('longRunningService', {
  timeout: 30000,          // 30 seconds timeout
  
  async processData(data) {
    // Long-running operation
  }
});
```

### Fallback

Provides alternative responses when a service fails.

```javascript
app.service('products').fallback({
  find: async (context, error) => {
    console.error('Products service failed:', error);
    return [{ id: 0, name: 'Fallback Product', price: 0 }];
  }
});
```

## Service Discovery

ScorpionJS provides automatic service discovery in distributed environments:

```javascript
const app = createApp({
  nodeID: 'node-1',
  discovery: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379
    }
  }
});
```

## Streams

ScorpionJS supports native handling of data streams:

```javascript
app.service('files').hooks({
  before: {
    get: [
      async context => {
        // Check if the client accepts streams
        if (context.params.stream) {
          const fileStream = fs.createReadStream(`./uploads/${context.id}`);
          context.result = fileStream;
          return context;
        }
        return context;
      }
    ]
  }
});

// Client-side stream handling
const fileService = client.service('files');
const stream = await fileService.get('123456', { stream: true });
stream.pipe(fs.createWriteStream('./downloaded-file.pdf'));
```
