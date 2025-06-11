# Fault Tolerance API

ScorpionJS includes several fault tolerance mechanisms inspired by Moleculer to help build resilient applications. This document provides detailed API documentation for configuring and using fault tolerance features in ScorpionJS.

## Circuit Breaker

The Circuit Breaker pattern prevents cascading failures by stopping requests to failing services.

### Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  circuitBreaker: {
    enabled: true,
    threshold: 0.5,        // Error rate threshold (0.0 - 1.0)
    minRequests: 20,       // Minimum number of requests needed before tripping
    windowTime: 60 * 1000, // Time window for error rate calculation in ms
    halfOpenTime: 10 * 1000, // Time to try half-open state
    failureOnTimeout: true, // Count timeouts as failures
    failureOnReject: true   // Count rejections as failures
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | Boolean | `false` | Enable circuit breaker |
| `threshold` | Number | `0.5` | Error rate threshold (0.0 - 1.0) |
| `minRequests` | Number | `20` | Minimum number of requests needed before tripping |
| `windowTime` | Number | `60000` | Time window for error rate calculation in ms |
| `halfOpenTime` | Number | `10000` | Time to try half-open state in ms |
| `failureOnTimeout` | Boolean | `true` | Count timeouts as failures |
| `failureOnReject` | Boolean | | `true` | Count rejections as failures |

### Service-specific Configuration

```javascript
app.use('users', 
  { // Service implementation
    async find() {
      // ...
    }
  },
  { // Service options
    circuitBreaker: {
      enabled: true,
      threshold: 0.3,        // Lower threshold for this critical service
      minRequests: 10        // Trip after fewer requests
    }
  }
);
```

### Circuit Breaker States

1. **Closed**: Normal operation, requests flow through
2. **Open**: Circuit is tripped, all requests fail fast
3. **Half-Open**: Testing if the service has recovered

### Events

```javascript
app.on('circuit-breaker.open', ({ service }) => {
  console.log(`Circuit breaker opened for service: ${service}`);
});

app.on('circuit-breaker.half-open', ({ service }) => {
  console.log(`Circuit breaker half-opened for service: ${service}`);
});

app.on('circuit-breaker.close', ({ service }) => {
  console.log(`Circuit breaker closed for service: ${service}`);
});
```

## Bulkhead

The Bulkhead pattern limits concurrent requests to prevent resource exhaustion.

### Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  bulkhead: {
    enabled: true,
    concurrency: 10,       // Maximum concurrent requests
    maxQueueSize: 100      // Maximum queue size for pending requests
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | Boolean | `false` | Enable bulkhead |
| `concurrency` | Number | `10` | Maximum concurrent requests |
| `maxQueueSize` | Number | `100` | Maximum queue size for pending requests |

### Service-specific Configuration

```javascript
app.use('fileUpload', 
  { // Service implementation
    async create(data) {
      // File upload implementation
    }
  },
  { // Service options
    bulkhead: {
      enabled: true,
      concurrency: 3,        // Limit concurrent file uploads
      maxQueueSize: 25       // Smaller queue for file uploads
    }
  }
);
```

### Events

```javascript
app.on('bulkhead.reject', ({ service }) => {
  console.log(`Bulkhead rejected request for service: ${service}`);
});
```

## Retry

The Retry pattern automatically retries failed requests.

### Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  retry: {
    enabled: true,
    retries: 3,            // Number of retries
    delay: 1000,           // Delay between retries in ms
    maxDelay: 5000,        // Maximum delay
    factor: 2,             // Exponential backoff factor
    check: err => err && err.retryable // Function to check if error is retryable
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | Boolean | `false` | Enable retry |
| `retries` | Number | `3` | Number of retries |
| `delay` | Number | `1000` | Delay between retries in ms |
| `maxDelay` | Number | `5000` | Maximum delay |
| `factor` | Number | `2` | Exponential backoff factor |
| `check` | Function | `err => true` | Function to check if error is retryable |

### Service-specific Configuration

```javascript
app.use('externalApi', 
  { // Service implementation
    async find() {
      // External API call implementation
    }
  },
  { // Service options
    retry: {
      enabled: true,
      retries: 5,            // More retries for external API
      delay: 500,            // Start with shorter delay
      check: err => err.code >= 500 // Only retry on server errors
    }
  }
);
```

### Events

```javascript
app.on('retry.attempt', ({ service, attempt }) => {
  console.log(`Retry attempt ${attempt} for service: ${service}`);
});

app.on('retry.fail', ({ service, attempts }) => {
  console.log(`All ${attempts} retry attempts failed for service: ${service}`);
});
```

## Timeout

The Timeout pattern sets maximum execution time for service methods.

### Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  timeout: {
    enabled: true,
    default: 5000          // Default timeout in ms
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | Boolean | `false` | Enable timeout |
| `default` | Number | `5000` | Default timeout in ms |

### Service-specific Configuration

```javascript
app.service('longRunningService', {
  timeout: 30000,          // 30 seconds timeout
  
  async processData(data) {
    // Long-running operation
  }
});

// Method-specific timeout
app.service('reports').methods({
  generateReport: {
    timeout: 60000         // 60 seconds timeout for report generation
  }
});
```

### Events

```javascript
app.on('timeout.error', ({ service, method, elapsed }) => {
  console.log(`Timeout after ${elapsed}ms in ${service}.${method}`);
});
```

## Fallback

The Fallback pattern provides alternative responses when a service fails.

### Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Global fallback
app.fallback(async (context, error) => {
  console.error('Service failed:', error);
  return { error: 'Service temporarily unavailable' };
});
```

### Service-specific Fallback

```javascript
app.service('products').fallback({
  find: async (context, error) => {
    console.error('Products service failed:', error);
    return [{ id: 0, name: 'Fallback Product', price: 0 }];
  },
  
  get: async (context, error) => {
    console.error(`Failed to get product ${context.id}:`, error);
    return { id: context.id, name: 'Fallback Product', price: 0 };
  }
});
```

### Method-specific Fallback

```javascript
app.service('recommendations').fallback('getPersonalized', async (context, error) => {
  console.error('Personalized recommendations failed:', error);
  
  // Fall back to popular items
  return await app.service('recommendations').getPopular();
});
```

## Combining Fault Tolerance Mechanisms

ScorpionJS allows you to combine multiple fault tolerance mechanisms:

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  // Enable all fault tolerance mechanisms
  circuitBreaker: {
    enabled: true,
    threshold: 0.5,
    minRequests: 20
  },
  bulkhead: {
    enabled: true,
    concurrency: 10,
    maxQueueSize: 100
  },
  retry: {
    enabled: true,
    retries: 3,
    delay: 1000
  },
  timeout: {
    enabled: true,
    default: 5000
  }
});

// Service with custom fault tolerance configuration
app.service('criticalService', {
  // Circuit breaker configuration
  circuitBreaker: {
    enabled: true,
    threshold: 0.3,
    minRequests: 10
  },
  
  // Bulkhead configuration
  bulkhead: {
    enabled: true,
    concurrency: 5,
    maxQueueSize: 50
  },
  
  // Retry configuration
  retry: {
    enabled: true,
    retries: 5,
    delay: 500
  },
  
  // Timeout configuration
  timeout: 10000,
  
  // Service implementation
  async find() {
    // Implementation
  }
});

// Fallback for the service
app.service('criticalService').fallback({
  find: async (context, error) => {
    return { status: 'degraded', data: [] };
  }
});
```

## Execution Order

When multiple fault tolerance mechanisms are enabled, they are applied in the following order:

1. **Bulkhead**: Limits concurrent requests
2. **Circuit Breaker**: Prevents requests to failing services
3. **Timeout**: Sets maximum execution time
4. **Retry**: Retries failed requests
5. **Fallback**: Provides alternative response

This order ensures that:
- Bulkhead prevents resource exhaustion
- Circuit breaker fails fast for known bad services
- Timeout prevents hanging requests
- Retry attempts to recover from transient failures
- Fallback provides a last resort response
