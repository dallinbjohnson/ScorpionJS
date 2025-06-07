# Performance Optimization in ScorpionJS

> Documentation for ScorpionJS v1.0.0

This guide covers strategies and best practices for optimizing the performance of your ScorpionJS applications, from database queries to service methods, hooks, and transport layers.

---

## Table of Contents
- [Performance Benchmarks](#performance-benchmarks)
- [Database Optimization](#database-optimization)
- [Service Method Optimization](#service-method-optimization)
- [Hook Performance](#hook-performance)
- [Transport Layer Optimization](#transport-layer-optimization)
- [Caching Strategies](#caching-strategies)
- [Memory Management](#memory-management)
- [Scaling Strategies](#scaling-strategies)
- [Monitoring and Profiling](#monitoring-and-profiling)
- [Performance Testing](#performance-testing)

---

## Performance Benchmarks

ScorpionJS is designed for high performance. Here are some baseline benchmarks on a standard machine (4-core CPU, 16GB RAM):

| Operation | Requests/sec | Average Latency |
|-----------|--------------|-----------------|
| Simple service find | 5,000 | 2ms |
| Service create with hooks | 2,500 | 4ms |
| REST API calls | 1,500 | 6ms |
| WebSocket messages | 10,000 | 1ms |

These numbers can vary based on hardware, network conditions, and application complexity.

---

## Database Optimization

### Query Optimization

```javascript
// Inefficient: Fetches all records then filters in memory
app.service('users').find().then(users => {
  const activeUsers = users.filter(user => user.status === 'active');
});

// Optimized: Filters at the database level
app.service('users').find({
  query: { status: 'active' }
});
```

### Pagination

Always use pagination for large datasets:

```javascript
// Configure default pagination
app.service('messages').options = {
  paginate: {
    default: 25,
    max: 100
  }
};

// Client request with pagination
const result = await app.service('messages').find({
  query: {
    $limit: 25,
    $skip: 50
  }
});
// result = { total, limit, skip, data: [...] }
```

### Selective Fields

Only retrieve the fields you need:

```javascript
// Only fetch necessary fields
const users = await app.service('users').find({
  query: {
    $select: ['id', 'name', 'email']
  }
});
```

### Indexing

Ensure your database has proper indexes:

```javascript
// MongoDB example
app.service('users').Model.createIndex({ email: 1 }, { unique: true });
app.service('messages').Model.createIndex({ createdAt: -1 });
app.service('posts').Model.createIndex({ tags: 1 });
```

---

## Service Method Optimization

### Batch Operations

Use batch operations when possible:

```javascript
// Instead of multiple create calls
const createMany = async (data) => {
  // Custom method that creates multiple records in one operation
  return app.service('items').createMany(data);
};
```

### Async/Await Optimization

Optimize async operations:

```javascript
// Inefficient: Sequential async operations
async function processUser(userId) {
  const user = await app.service('users').get(userId);
  const orders = await app.service('orders').find({ query: { userId } });
  const payments = await app.service('payments').find({ query: { userId } });
  
  return { user, orders, payments };
}

// Optimized: Parallel async operations
async function processUser(userId) {
  const [user, orders, payments] = await Promise.all([
    app.service('users').get(userId),
    app.service('orders').find({ query: { userId } }),
    app.service('payments').find({ query: { userId } })
  ]);
  
  return { user, orders, payments };
}
```

### Avoid N+1 Query Problems

```javascript
// Inefficient: N+1 queries
async function getUsersWithOrders() {
  const users = await app.service('users').find();
  
  // This makes a separate query for each user
  for (const user of users) {
    user.orders = await app.service('orders').find({ query: { userId: user.id } });
  }
  
  return users;
}

// Optimized: Single query with join or two efficient queries
async function getUsersWithOrders() {
  const users = await app.service('users').find();
  const userIds = users.map(user => user.id);
  
  // Single query to get all orders for all users
  const allOrders = await app.service('orders').find({
    query: { userId: { $in: userIds } }
  });
  
  // Group orders by userId in memory
  const ordersByUser = {};
  allOrders.forEach(order => {
    if (!ordersByUser[order.userId]) ordersByUser[order.userId] = [];
    ordersByUser[order.userId].push(order);
  });
  
  // Attach orders to users
  users.forEach(user => {
    user.orders = ordersByUser[user.id] || [];
  });
  
  return users;
}
```

---

## Hook Performance

### Optimize Hook Execution

```javascript
// Inefficient: Running expensive operations on every request
app.service('messages').hooks({
  before: {
    all: [
      async context => {
        // Expensive operation on every request
        await someExpensiveOperation();
        return context;
      }
    ]
  }
});

// Optimized: Only run when necessary
app.service('messages').hooks({
  before: {
    find: [
      async context => {
        // Skip for paginated requests with small limit
        if (context.params.query?.$limit < 10) {
          return context;
        }
        
        // Only run for larger result sets
        await someExpensiveOperation();
        return context;
      }
    ]
  }
});
```

### Use Hook Timeouts

```javascript
import { hookTimeout } from 'scorpionjs-hooks-common';

app.service('users').hooks({
  before: {
    all: [
      // Set a timeout for slow hooks
      hookTimeout(5000) // 5 second timeout
    ]
  }
});
```

### Memoize Expensive Operations

```javascript
import memoize from 'lodash.memoize';

// Memoize expensive function
const getExpensiveData = memoize(async (key) => {
  // Expensive operation
  return result;
}, key => String(key));

app.service('items').hooks({
  before: {
    all: [
      async context => {
        context.params.expensiveData = await getExpensiveData(context.id);
        return context;
      }
    ]
  }
});
```

---

## Transport Layer Optimization

### Compression

Enable compression for HTTP responses:

```javascript
import { compression } from 'scorpionjs-compression';

// Configure compression for the app
app.configure(compression());
```

### WebSocket vs REST

Use WebSockets for real-time data and frequent small updates:

```javascript
// Client-side
import io from 'socket.io-client';
import { createClient } from 'scorpionjs-client';

// Create a client that uses WebSockets
const socket = io('http://localhost:3030');
const client = createClient({
  transport: socket
});

// Server-side
app.configure(socketio());
```

### Batch API Requests

Implement batch endpoints for multiple operations:

```javascript
app.use('/batch', {
  async create(data) {
    const { operations } = data;
    const results = [];
    
    for (const op of operations) {
      try {
        const result = await app.service(op.service)[op.method](op.data, op.params);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }
});
```

---

## Caching Strategies

### Service-level Caching

```javascript
import NodeCache from 'node-cache';

// Create a cache with 5-minute TTL
const cache = new NodeCache({ stdTTL: 300 });

class CachedUserService {
  async get(id, params) {
    const cacheKey = `user:${id}`;
    
    // Try to get from cache first
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    // If not in cache, get from database
    const user = await super.get(id, params);
    
    // Store in cache
    cache.set(cacheKey, user);
    
    return user;
  }
  
  async create(data, params) {
    const user = await super.create(data, params);
    // Invalidate any relevant cache entries
    cache.del(`user:${user.id}`);
    return user;
  }
  
  // Similar cache invalidation for update, patch, remove
}
```

### Redis Caching

For distributed applications:

```javascript
import Redis from 'ioredis';

const redis = new Redis();

app.service('products').hooks({
  before: {
    get: [
      async context => {
        const { id } = context;
        const cacheKey = `product:${id}`;
        
        // Try to get from Redis
        const cached = await redis.get(cacheKey);
        if (cached) {
          // Return cached result and skip service method
          context.result = JSON.parse(cached);
          return context;
        }
        
        return context;
      }
    ]
  },
  
  after: {
    get: [
      async context => {
        const { id, result } = context;
        // Cache the result in Redis with 1-hour expiry
        await redis.set(`product:${id}`, JSON.stringify(result), 'EX', 3600);
        return context;
      }
    ]
  }
});
```

---

## Memory Management

### Monitor Memory Usage

```javascript
import os from 'os';

// Log memory usage every 5 minutes
setInterval(() => {
  const used = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  console.log({
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`,
    totalSystemMemory: `${Math.round(totalMem / 1024 / 1024)} MB`,
    freeSystemMemory: `${Math.round(freeMem / 1024 / 1024)} MB`
  });
}, 5 * 60 * 1000);
```

### Prevent Memory Leaks

```javascript
// Watch for event listener leaks
require('events').EventEmitter.defaultMaxListeners = 15;

// Clean up resources when done
app.on('teardown', async () => {
  // Close database connections
  await app.service('users').Model.disconnect();
  
  // Clear caches
  cache.flushAll();
  
  // Remove event listeners
  app.removeAllListeners();
});
```

---

## Scaling Strategies

### Horizontal Scaling

```javascript
import cluster from 'cluster';
import os from 'os';

if (cluster.isMaster) {
  // Fork workers based on CPU cores
  const numCPUs = os.cpus().length;
  
  console.log(`Master process running, forking ${numCPUs} workers`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  // Worker process - start the app
  const app = createApp();
  // ... configure app
  app.listen(3030);
  
  console.log(`Worker ${process.pid} started`);
}
```

### Load Balancing

```javascript
// Using PM2 for load balancing
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'scorpion-app',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};

// Start with: pm2 start ecosystem.config.js
```

---

## Monitoring and Profiling

### Performance Metrics

```javascript
import prometheus from 'prom-client';

// Create metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

// Hook to collect metrics
app.hooks({
  before: {
    all: [
      context => {
        context.params._metricsStart = Date.now();
        return context;
      }
    ]
  },
  after: {
    all: [
      context => {
        const duration = Date.now() - context.params._metricsStart;
        httpRequestDurationMicroseconds
          .labels(context.method, context.path, context.statusCode || 200)
          .observe(duration);
        return context;
      }
    ]
  }
});

// Expose metrics endpoint as a service
app.service('/metrics', {
  async find() {
    return prometheus.register.metrics();
  }
});
```

### CPU Profiling

```javascript
import { writeFileSync } from 'fs';
import { cpuProfile } from 'scorpionjs-profiler';

// Start profiling for 30 seconds when receiving SIGUSR2
process.on('SIGUSR2', () => {
  console.log('Starting CPU profile for 30 seconds...');
  
  cpuProfile(30000).then(profile => {
    const filename = `profile-${Date.now()}.cpuprofile`;
    writeFileSync(filename, JSON.stringify(profile));
    console.log(`CPU profile saved to ${filename}`);
  });
});

// Trigger with: kill -SIGUSR2 <pid>
```

---

## Performance Testing

### Load Testing

```javascript
// Using Artillery for load testing
// loadtest.yml
config:
  target: "http://localhost:3030"
  phases:
    - duration: 60
      arrivalRate: 5
      rampTo: 50
      name: "Warm up phase"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
  defaults:
    headers:
      Authorization: "Bearer YOUR_TOKEN"

scenarios:
  - name: "Get and create messages"
    flow:
      - get:
          url: "/messages?$limit=10"
      - think: 1
      - post:
          url: "/messages"
          json:
            text: "Load test message"
            userId: "123"
```

### Benchmark Service Methods

```javascript
import { performance } from 'perf_hooks';

async function benchmarkService(service, method, iterations, ...args) {
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await service[method](...args);
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`${service.path}.${method}: ${iterations} calls in ${totalTime.toFixed(2)}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per call`);
  console.log(`Throughput: ${(1000 / avgTime).toFixed(2)} calls/sec`);
}

// Usage
await benchmarkService(app.service('users'), 'find', 1000, { query: { status: 'active' } });
```

---

## Further Reading
- [Configuration API](./configuration.md)
- [Fault Tolerance](./fault-tolerance.md)
- [Database Adapters](./database-adapters.md)
- [Scaling ScorpionJS](./scaling.md)
