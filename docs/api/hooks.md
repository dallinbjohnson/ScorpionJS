# Hooks API

Hooks are middleware functions that can be registered before, after, or around service method calls. This document provides detailed API documentation for working with hooks in ScorpionJS.

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

## Hook Context

The hook context object contains information about the current request and is passed to all hooks.

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

### Validation

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
