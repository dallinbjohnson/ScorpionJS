# Hooks API

Hooks are middleware functions that can be registered before, after, or around service method calls. They are a cornerstone of ScorpionJS's flexibility, allowing you to compose custom request processing and response handling logic. A key design goal is that **hooks operate transparently and consistently, regardless of whether the service method is invoked via REST, WebSockets, or involves data streaming (including JSON streaming like NDJSON)**. The `context` object passed to hooks aims to abstract these underlying transport details.

## Hook Types

ScorpionJS supports three types of hooks:

1. **Before Hooks**: Run before a service method
2. **After Hooks**: Run after a service method
3. **Error Hooks**: Run when a service method throws an error
4. **Around Hooks**: Wrap around a service method (inspired by FeathersJS v5)

## Hook Registration

### Global Hooks

```javascript
app.hooks({
  before: {
    all: [
      async context => {
        // Run before all service methods
        return context;
      }
    ],
    find: [
      async context => {
        // Run before all find methods
        return context;
      }
    ]
  },
  after: {
    create: [
      async context => {
        // Run after all create methods
        return context;
      }
    ]
  },
  error: {
    all: [
      async context => {
        // Run when any service method throws an error
        return context;
      }
    ]
  },
  around: {
    all: [
      async (context, next) => {
        // Before logic
        context = await next(context);
        // After logic
        return context;
      }
    ]
  }
});
```

### Service Hooks

```javascript
app.service('messages').hooks({
  before: {
    all: [
      async context => {
        // Run before all methods on the messages service
        return context;
      }
    ],
    find: [
      async context => {
        // Run before the find method on the messages service
        return context;
      }
    ]
  },
  after: {
    create: [
      async context => {
        // Run after the create method on the messages service
        return context;
      }
    ]
  },
  error: {
    all: [
      async context => {
        // Run when any method on the messages service throws an error
        return context;
      }
    ]
  },
  around: {
    all: [
      async (context, next) => {
        // Before logic for all methods
        context = await next(context);
        // After logic for all methods
        return context;
      }
    ]
  }
});
```

### Pattern-based Hooks (Hono-inspired)

```javascript
// Apply hooks to services matching a pattern
app.hooks('/api/secure/*', {
  before: {
    all: [
      async context => {
        // Check authentication
        if (!context.params.user) {
          throw new Error('Authentication required');
        }
        return context;
      }
    ]
  }
});

// Apply hooks to specific HTTP methods and paths
app.hooks('POST:/api/payments/*', {
  before: {
    all: [
      async context => {
        // Validate payment data
        return context;
      }
    ]
  }
});
```

## Hook Execution Order

Hooks are executed in a specific sequence, providing a predictable flow for request processing and error handling:

1.  **Global `before` hooks**: Run for all services or matching methods.
2.  **Service-specific `before` hooks**: Run for the targeted service and method.
3.  **`around` hooks (first part)**: The portion of `around` hooks (global then service-specific) before `await next()` is executed.
4.  **Service Method**: The actual service method (e.g., `find`, `create`, custom method) is called.
5.  **`around` hooks (second part)**: The portion of `around` hooks (service-specific then global, in reverse order of the first part) after `await next()` is executed.
6.  **Service-specific `after` hooks**: Run if the method execution was successful.
7.  **Global `after` hooks**: Run if the method execution was successful, after service-specific `after` hooks. The `app.hooks({ after: { all: [...] } })` configuration is the standard way to implement global hooks that run after all service-specific logic for any successful method call.
8.  **`error` hooks (Service-specific then Global)**: If any preceding step (from service `before` hooks through `after` hooks) throws an error, the respective `error` hooks are triggered, starting with service-specific ones, then global ones. `around` hooks can also catch errors via their `try...catch` blocks.

This order ensures that global concerns can wrap service-specific logic, and errors can be handled at appropriate levels.

## Hook Context

The hook context object (`context`) contains information about the current service method call and is passed to all hooks. It's designed to provide a **unified interface to the request and response, abstracting the specifics of the transport layer (HTTP, WebSockets) and interaction model (simple request-response, streaming)**. Hooks can dynamically alter their behavior or modify the `context` object (e.g., `context.data`, `context.params`, `context.result`) based on the incoming data, query parameters, or user information, enabling highly customizable and data-driven request processing pipelines.

For example, whether a `find` method's results are returned as a complete JSON array or streamed as NDJSON, an `after` hook would still typically find the results (or a representation/metadata of the stream) in `context.result`.

| Property | Type | Description |
|----------|------|-------------|
| `app` | Object | The ScorpionJS application |
| `service` | Object | The service this hook is being called on |
| `path` | String | The service path |
| `method` | String | The service method |
| `type` | String | The hook type ('before', 'after', or 'error') |
| `params` | Object | The service method parameters |
| `id` | String/Number | The resource ID (for get, update, patch, remove) |
| `data` | Object | The request data (for create, update, patch) |
| `result` | Any | The result (in after hooks) |
| `error` | Error | The error (in error hooks) |
| `params.stream` or `context.stream` | ReadableStream | (Conceptual) If the request involves a stream (e.g., file upload), it might be exposed here. Hooks could interact with stream metadata or, cautiously, the stream itself. |

Hooks can also interact with streaming data. For example, if a service method consumes or produces a stream (see [Services API - Working with Streams](./services.md#working-with-streams)), hooks might:

*   **Before Hooks**: Access or modify stream metadata passed in `context.params` (e.g., `context.params.fileName`, `context.params.contentType`) before the stream is processed by the service method.
*   **After Hooks**: Access or modify metadata about a stream that was produced by a service method, perhaps stored in `context.result.metadata`.
*   **Error Hooks**: Perform cleanup if an error occurs during stream processing.

Directly manipulating the stream data within a hook (e.g., transforming, buffering) should be done with caution to avoid performance issues and to ensure that the stream remains viable for the service method or the client. It's often better to handle complex stream transformations within the service method itself or dedicated stream processing utilities.

## Hook Functions

### Before and After Hooks

```javascript
async function myHook(context) {
  // Do something with context
  return context;
}
```

### Around Hooks

```javascript
async function myAroundHook(context, next) {
  // Before logic
  console.log('Before method execution');
  
  try {
    // Call the next hook or the service method
    context = await next(context);
    
    // After logic
    console.log('After method execution');
    return context;
  } catch (error) {
    // Error handling
    console.error('Error in method execution:', error);
    throw error;
  }
}
```

## Common Hook Patterns

### Authentication

```javascript
async function authenticate(context) {
  const { params } = context;
  
  if (!params.headers || !params.headers.authorization) {
    throw new Error('Authentication required');
  }
  
  const token = params.headers.authorization.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    context.params.user = await context.app.service('users').get(decoded.userId);
    return context;
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}
```

### Data Validation (Schema-Driven)

Leverage hooks for robust data validation using your preferred schema library (e.g., TypeBox, Zod, JSON Schema). This is a critical point for ensuring data integrity for incoming `data` (on `create`, `update`, `patch`), `params.query`, or even custom properties on the `context`. For more details on defining and using schemas, refer to the [Schema Validation API](./schema-validation.md).

**Example:**

```javascript
async function validateData(schema) {
  return async context => {
    if (context.data) {
      const { error, value } = schema.validate(context.data);
      
      if (error) {
        throw new Error(`Validation error: ${error.message}`);
      }
      
      // Replace with validated data
      context.data = value;
    }
    
    return context;
  };
}
```

### Logging

```javascript
async function logRequest(context) {
  console.log(`${context.path}.${context.method} called with:`, {
    params: context.params,
    id: context.id,
    data: context.data
  });
  
  return context;
}

async function logResponse(context) {
  console.log(`${context.path}.${context.method} returned:`, context.result);
  
  return context;
}

async function logError(context) {
  console.error(`Error in ${context.path}.${context.method}:`, context.error);
  
  return context;
}
```

### Caching

```javascript
const cache = new Map();

async function cacheResult(context) {
  const { method, path, id, params } = context;
  
  if (method === 'get') {
    const cacheKey = `${path}:${id}:${JSON.stringify(params.query || {})}`;
    
    // Check cache
    if (cache.has(cacheKey)) {
      context.result = cache.get(cacheKey);
      return context;
    }
    
    // Let the request go through
    return context;
  }
  
  return context;
}

async function updateCache(context) {
  const { method, path, id, result, params } = context;
  
  if (method === 'get') {
    const cacheKey = `${path}:${id}:${JSON.stringify(params.query || {})}`;
    cache.set(cacheKey, result);
  } else if (['create', 'update', 'patch', 'remove'].includes(method)) {
    // Invalidate cache for this service
    for (const key of cache.keys()) {
      if (key.startsWith(`${path}:`)) {
        cache.delete(key);
      }
    }
  }
  
  return context;
}
```

### Rate Limiting

```javascript
const requestCounts = new Map();

async function rateLimit(options = {}) {
  const {
    max = 100,
    windowMs = 60 * 1000,
    message = 'Too many requests, please try again later'
  } = options;
  
  return async context => {
    const { params } = context;
    const ip = params.ip || 'unknown';
    const now = Date.now();
    
    // Initialize or clean up old requests
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }
    
    const requests = requestCounts.get(ip).filter(time => now - time < windowMs);
    
    if (requests.length >= max) {
      throw new Error(message);
    }
    
    // Add current request
    requests.push(now);
    requestCounts.set(ip, requests);
    
    return context;
  };
}
```

## Hook Execution Order

1. Global before hooks
2. Service-specific before hooks
3. Method execution (wrapped by around hooks)
4. Service-specific after hooks
5. Global after hooks

If an error occurs:

1. Service-specific error hooks
2. Global error hooks

## Combining Hooks

```javascript
// Combine multiple hooks into one
function combine(...hooks) {
  return async context => {
    for (const hook of hooks) {
      context = await hook(context);
    }
    return context;
  };
}

// Usage
app.service('messages').hooks({
  before: {
    create: [
      combine(
        authenticate,
        validateData(messageSchema),
        logRequest
      )
    ]
  }
});
```
