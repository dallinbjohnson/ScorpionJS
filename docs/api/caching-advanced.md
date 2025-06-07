# Advanced Caching in ScorpionJS

ScorpionJS provides a flexible and powerful caching layer that can significantly improve your application's performance and reduce load on backend services. Beyond basic caching, ScorpionJS supports advanced caching strategies and modules.

## Overview

Configure various caching adapters, define sophisticated invalidation strategies, and apply caching at different levels of your application.

## Features

- **Multiple Cache Adapters**: 
  - In-memory (default)
  - Redis
  - Memcached
  - Custom adapters: Easily implement your own caching solutions.
- **Cache Scopes**: Apply caching globally, per-service, or even per-service-method.
- **Programmatic Cache Control**: Fine-grained control over cache entries, including manual `get`, `set`, `del`, and `clear` operations.
- **Cache Invalidation Strategies**:
  - **Time-To-Live (TTL)**: Automatic expiration of cache entries.
  - **Event-Driven Invalidation**: Automatically invalidate cache entries when related data changes (e.g., after `create`, `update`, `patch`, `remove` service events).
  - **Tag-Based Invalidation**: Assign tags to cache entries and invalidate multiple entries by tag.
- **Conditional Caching**: Define conditions under which data should be cached or retrieved from cache.
- **Cache Key Generation**: Customizable cache key generation strategies.
- **Distributed Caching**: Seamless integration with distributed cache stores like Redis for multi-node deployments.

## Configuration Example

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  cache: {
    default: 'redis', // Default cache store
    stores: {
      memory: {
        adapter: 'memory',
        ttl: 60 // Default TTL in seconds
      },
      redis: {
        adapter: 'redis',
        host: 'localhost',
        port: 6379,
        ttl: 3600
      }
    }
  }
});

// Service-level caching configuration
app.service('products', {
  cache: {
    store: 'redis', // Use the 'redis' store for this service
    ttl: { // Method-specific TTLs
      find: 600,
      get: 1800
    },
    invalidateOn: ['created', 'updated', 'removed'] // Events that invalidate cache
  },
  async find(params) { /* ... */ },
  async get(id, params) { /* ... */ }
});
```

Refer to the main [Configuration API](./configuration.md) for basic cache options and individual adapter documentation for more details.
