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

### More Examples

Here are a few more conceptual examples showcasing how hooks can be used with other framework features:

**Schema Validation (Before Hook):**

```javascript
// Assuming a utility function `validateData` is available
// and `messageSchema` is a JSON schema definition.
app.service('messages').hooks({
  before: {
    create: [
      async context => {
        context.data = await validateData(messageSchema, context.data);
        return context;
      }
    ],
    patch: [
      async context => {
        // Validate only the fields present in the patch data
        context.data = await validateData(messageSchema, context.data, { partial: true });
        return context;
      }
    ]
  }
});
```

**Internationalization (i18n - Before Hook):**

```javascript
app.hooks({
  before: {
    all: [
      async context => {
        // Example: Set locale from an 'Accept-Language' header or a query parameter
        const langHeader = context.params.headers && context.params.headers['accept-language'];
        context.params.locale = determineLocale(langHeader || context.params.query?.locale || 'en');
        return context;
      }
    ]
  }
});

// Dummy function for illustration
function determineLocale(preferred) {
  // Logic to parse header and select best match from supported locales
  return preferred?.split(',')[0].split('-')[0] || 'en';
}
```

**Fault Tolerance (Error Hook Example - Conceptual):**

```javascript
app.service('externalApi').hooks({
  error: {
    all: [
      async context => {
        if (context.error.isCircuitBreakerOpen) {
          console.error(`Circuit breaker is open for ${context.path}. Method: ${context.method}`);
          // Optionally, transform the error or provide a fallback
          context.error = new Error('Service temporarily unavailable. Please try again later.');
        }
        return context; // Error hooks must return the context or throw a new error
      }
    ]
  }
});
```

### Interceptor Hooks

Interceptor hooks are a special type of global hook that run *between* standard global hooks and service-specific hooks. They provide a powerful way to inject logic at a very specific point in the execution chain, often used for fine-grained control, monitoring, or last-minute context modifications before or after the core service logic and its dedicated hooks.

They are registered using `app.interceptorHooks()` with the same structure as `app.hooks()`.

```typescript
app.interceptorHooks({
  before: {
    all: [
      async (context: HookContext<MyApp, Service<MyApp> | undefined>) => {
        console.log('Interceptor Global Before: Runs after regular global before, before service before.');
        // context.service may be undefined here if the hook is truly global
        // and not tied to a service instance via a path pattern.
        return context;
      }
    ]
  },
  around: {
    all: [
      async (context: HookContext<MyApp, Service<MyApp> | undefined>, next: NextFunction<MyApp, Service<MyApp> | undefined>) => {
        console.log('Interceptor Global Around: Before');
        const newContext = await next(context);
        console.log('Interceptor Global Around: After');
        return newContext;
      }
    ]
  }
  // ... other interceptor hooks (after, error)
});

## HookContext Object

The `HookContext` object is central to the hook system. It carries all relevant information about the service method call. Key properties typically include:

*   `app`: The ScorpionJS application instance.
*   `service`: The service instance (undefined for global hooks not matching a service path).
*   `method`: The name of the service method being called (e.g., 'find', 'create', 'customMethod').
*   `type`: The type of hook ('before', 'after', 'error', 'around').
*   `path`: The service path (e.g., 'messages').
*   `id`: The ID for a get, update, patch, or remove call.
*   `data`: The data sent with a create, update, or patch call.
*   `params`: An object containing:
    *   `query`: Query parameters for the service method.
    *   `user`: The authenticated user (if authentication is used).
    *   `provider`: The transport provider (e.g., 'rest', 'websocket').
    *   `headers`: Request headers (primarily for transport-level hooks or information).
    *   `locale`: (Example for i18n) The determined locale for the request.
    *   Other custom parameters passed to the service call or added by hooks.
*   `result`: The result of the service method call (available in `after` and `around` hooks post-`next()`).
*   `error`: The error object if an error occurred (available in `error` and `around` hooks post-`next()` if an error was thrown).
*   `config`: Access to service-specific or global configuration relevant to the hook's operation.

Developers can add custom properties to `context.params` to pass information between hooks or to the service method.

## Dynamic Hook Management and Unregistration

When a service is unregistered using `app.unservice('serviceName')`, all hooks specifically registered for that service (via `app.service('serviceName').hooks(...)`) are automatically removed and will no longer be executed. 

Pattern-based hooks (e.g., `app.hooks('/api/my-service/*', {...})`) are evaluated at runtime. If a service path no longer matches a pattern due to unregistration, the hooks associated with that pattern will naturally cease to apply to the removed service's path.

The internal hook engine is designed to efficiently manage these dynamic changes, ensuring that the correct set of hooks is always applied based on the current state of registered services and hook configurations.
```

Global and Interceptor hooks can be typed to accept `Service<AppType> | undefined` for their service generic if they are intended to run without a specific service context. If registered with a path pattern (e.g., `app.hooks('/users/*', config)`), they become service-specific for matching services, and `context.service` will be defined.

## Hook Execution Order

Hooks are executed in a specific, layered sequence. This order is crucial for understanding how different types of hooks interact and how data flows through the system. `around` hooks, with their `(context, next)` signature, wrap subsequent operations.

**Normal Execution Flow (No Errors):**

1.  **Regular Global `around` (first part)**: The section of the hook function *before* `await next()`.
2.  **Regular Global `before`**: Standard `before` hooks.
3.  **Service-specific `around` (first part)**: For hooks registered on the specific service.
4.  **Service-specific `before`**: Standard `before` hooks for the service.
5.  **Interceptor Global `around` (first part)**: Interceptor `around` hooks.
6.  **Interceptor Global `before`**: Interceptor `before` hooks.
7.  **Service Method Execution**: The actual service method (e.g., `find()`, `create()`) is invoked.
8.  **Interceptor Global `around` (second part)**: The section of the hook function *after* `await next()` completes (LIFO order relative to its first part).
9.  **Interceptor Global `after`**: Standard `after` hooks.
10. **Service-specific `around` (second part)**: (LIFO order).
11. **Service-specific `after`**: Standard `after` hooks for the service.
12. **Regular Global `around` (second part)**: (LIFO order).
13. **Regular Global `after`**: Standard `after` hooks.

**Error Handling Flow:**

If an error occurs at any point (including within a hook or the service method itself), the regular flow is interrupted. The error propagates up through the `around` hook chain (if an `around` hook doesn't catch it and handle it). Then, `error` hooks are executed in the following order:

1.  **Interceptor Global `error`**
2.  **Service-specific `error`**
3.  **Regular Global `error`**

An `around` hook can catch errors from `await next()` using a `try...catch` block. If it catches the error and doesn't re-throw, it can prevent the standard `error` hooks from running for that particular error, effectively handling it within the `around` hook's scope.

This layered approach provides fine-grained control over the request lifecycle and error management.

## Hook Context

The hook context object (`context`) contains information about the current service method call and is passed to all hooks. It's designed to provide a **unified interface to the request and response, abstracting the specifics of the transport layer (HTTP, WebSockets) and interaction model (simple request-response, streaming)**. Hooks can dynamically alter their behavior or modify the `context` object (e.g., `context.data`, `context.params`, `context.result`) based on the incoming data, query parameters, or user information, enabling highly customizable and data-driven request processing pipelines.

For example, whether a `find` method's results are returned as a complete JSON array or streamed as NDJSON, an `after` hook would still typically find the results (or a representation/metadata of the stream) in `context.result`.

| Property | Type | Description |
|----------|------|-------------|
| `app` | Object | The ScorpionJS application |
| `service` | Object / undefined | The service instance this hook is being called on. For global or interceptor hooks not registered to a specific service path/pattern, this may be `undefined`. |
| `path` | String | The service path |
| `method` | String | The service method |
| `type` | String | The hook type (`'before'`, `'after'`, `'error'`, or `'around'`) during its execution. |
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

Around hooks use a `(context, next)` signature, similar to middleware in frameworks like Express or Koa. The `next` function must be called (and usually `await`ed) to proceed to the next hook or the service method. The context returned by `await next()` can be modified before being returned by the current around hook.

```typescript
async function myAroundHook(context: HookContext<MyApp, MyService>, next: NextFunction<MyApp, MyService>) {
  console.log(`Around Hook: Before for ${context.path}.${context.method}`);
  context.params.customData = 'added by around hook';

  try {
    // Call the next hook or the service method. 
    // The context passed to next() is what the *next* hook in the chain will receive.
    const contextAfterNext = await next(context);

    // This code runs *after* all subsequent hooks and the service method have completed.
    console.log(`Around Hook: After for ${context.path}.${context.method}`);
    if (contextAfterNext.result) {
      contextAfterNext.result.processedByAround = true;
    }
    // The context returned here becomes the input for the *previous* hook in the around chain,
    // or the final context if this is the outermost around hook.
    return contextAfterNext;
  } catch (error) {
    console.error(`Error during 'around' for ${context.path}.${context.method}:`, error);
    // Optionally modify context.error or re-throw.
    // If the error is handled here and not re-thrown, subsequent error hooks might not run for this specific error.
    context.error = error; // Ensure the error is on the context if it's to be handled by error hooks.
    throw error; // Re-throwing is common if the hook can't fully handle it, allowing other error handlers to run.
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
