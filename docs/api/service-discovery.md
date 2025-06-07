# Service Discovery API

ScorpionJS provides automatic service discovery in distributed environments, inspired by Moleculer. This document provides detailed API documentation for configuring and using service discovery in ScorpionJS.

## Introduction to Service Discovery

Service discovery allows ScorpionJS applications to automatically find and communicate with services across multiple nodes in a distributed environment. This enables building scalable, resilient microservice architectures.

## Configuration

### Basic Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  nodeID: 'node-1',           // Unique identifier for this node
  discovery: {
    type: 'redis',            // Discovery mechanism
    options: {
      host: 'localhost',
      port: 6379
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodeID` | String | Auto-generated | Unique identifier for this node |
| `discovery.type` | String | `'local'` | Discovery mechanism (`'local'`, `'redis'`, `'etcd'`, `'consul'`, etc.) |
| `discovery.options` | Object | `{}` | Options for the discovery mechanism |
| `heartbeatInterval` | Number | `5000` | Interval for sending heartbeats (ms) |
| `heartbeatTimeout` | Number | `15000` | Timeout for considering a node offline (ms) |
| `offlineNodeCheckInterval` | Number | `30000` | Interval for checking offline nodes (ms) |

### Discovery Mechanisms

ScorpionJS supports several discovery mechanisms:

#### Local Discovery

```javascript
const app = createApp({
  discovery: {
    type: 'local' // Default, no additional configuration needed
  }
});
```

#### Redis Discovery

```javascript
const app = createApp({
  discovery: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379,
      password: 'secret',
      db: 0,
      keyPrefix: 'scorpion:'
    }
  }
});
```

#### Etcd Discovery

```javascript
const app = createApp({
  discovery: {
    type: 'etcd',
    options: {
      endpoints: ['http://localhost:2379'],
      auth: {
        username: 'root',
        password: 'secret'
      },
      prefix: 'scorpion/'
    }
  }
});
```

#### Consul Discovery

```javascript
const app = createApp({
  discovery: {
    type: 'consul',
    options: {
      host: 'localhost',
      port: 8500,
      secure: false,
      token: 'secret'
    }
  }
});
```

#### Custom Discovery

```javascript
import { createApp, DiscoveryStrategy } from 'scorpionjs';

// Create a custom discovery strategy
class MyCustomDiscovery extends DiscoveryStrategy {
  constructor(options) {
    super(options);
    this.options = options;
  }
  
  async init(app) {
    this.app = app;
    // Initialize your discovery mechanism
  }
  
  async register(service) {
    // Register a service
  }
  
  async unregister(service) {
    // Unregister a service
  }
  
  async discover() {
    // Discover services
    return [];
  }
  
  async close() {
    // Clean up resources
  }
}

// Register the custom discovery strategy
const app = createApp({
  discovery: {
    type: 'custom',
    strategy: MyCustomDiscovery,
    options: {
      // Custom options
    }
  }
});
```

## Service Registration

Services are automatically registered with the discovery mechanism when they are added to the application:

```javascript
// Register a service
app.service('messages', {
  async find() {
    return [{ text: 'Hello' }];
  }
});
```

### Manual Registration

You can manually register services with additional metadata:

```javascript
app.service('messages', {
  // Service implementation
  async find() {
    return [{ text: 'Hello' }];
  },
  
  // Service metadata
  metadata: {
    version: '1.0.0',
    description: 'Message service',
    tags: ['messages', 'chat']
  }
});
```

## Service Discovery

ScorpionJS automatically discovers services across nodes:

```javascript
// Get a reference to a service (local or remote)
const messagesService = app.service('messages');

// Call the service (transparently works across nodes)
const messages = await messagesService.find();
```

### Finding Services

You can find services based on metadata:

```javascript
// Find services by name
const messageServices = app.findServices('messages');

// Find services by tag
const chatServices = app.findServicesByTag('chat');

// Find services by version
const v1Services = app.findServicesByVersion('1.0.0');

// Find services by custom criteria
const services = app.findServices(service => 
  service.metadata.tags.includes('chat') && 
  service.metadata.version === '1.0.0'
);
```

## Node Management

### Getting Node Information

```javascript
// Get information about all nodes
const nodes = app.getNodes();

// Get information about a specific node
const node = app.getNode('node-2');

// Get information about the local node
const localNode = app.getLocalNode();
```

### Node Events

```javascript
// Listen for node events
app.on('node.added', node => {
  console.log(`Node added: ${node.id}`);
});

app.on('node.removed', node => {
  console.log(`Node removed: ${node.id}`);
});

app.on('node.online', node => {
  console.log(`Node online: ${node.id}`);
});

app.on('node.offline', node => {
  console.log(`Node offline: ${node.id}`);
});
```

## Service Events

```javascript
// Listen for service events
app.on('service.added', service => {
  console.log(`Service added: ${service.name} on node ${service.nodeID}`);
});

app.on('service.removed', service => {
  console.log(`Service removed: ${service.name} from node ${service.nodeID}`);
});

app.on('service.changed', service => {
  console.log(`Service changed: ${service.name} on node ${service.nodeID}`);
});
```

## Load Balancing

ScorpionJS includes built-in load balancing for distributed services:

```javascript
const app = createApp({
  nodeID: 'node-1',
  discovery: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379
    }
  },
  loadBalancer: {
    strategy: 'round-robin', // 'random', 'least-connections', 'consistent-hash'
    preferLocal: true        // Prefer local services when available
  }
});
```

### Load Balancing Strategies

| Strategy | Description |
|----------|-------------|
| `'round-robin'` | Distribute requests evenly across nodes in a circular order |
| `'random'` | Randomly select a node for each request |
| `'least-connections'` | Select the node with the fewest active connections |
| `'consistent-hash'` | Use consistent hashing to route similar requests to the same node |

### Custom Load Balancing

```javascript
import { createApp, LoadBalancerStrategy } from 'scorpionjs';

// Create a custom load balancer strategy
class MyCustomLoadBalancer extends LoadBalancerStrategy {
  constructor(options) {
    super(options);
    this.options = options;
  }
  
  select(service, context) {
    // Select a node for the service
    const nodes = service.getNodes();
    
    // Example: select based on user ID for session affinity
    if (context.params.user) {
      const userIdHash = this.hash(context.params.user.id);
      return nodes[userIdHash % nodes.length];
    }
    
    // Fall back to random selection
    return nodes[Math.floor(Math.random() * nodes.length)];
  }
  
  hash(str) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// Register the custom load balancer strategy
const app = createApp({
  loadBalancer: {
    strategy: MyCustomLoadBalancer,
    options: {
      // Custom options
    }
  }
});
```

## Service Registry

The service registry maintains information about all available services:

```javascript
// Get the service registry
const registry = app.serviceRegistry;

// Get all registered services
const services = registry.getServices();

// Get all instances of a service
const messageInstances = registry.getServiceInstances('messages');

// Check if a service exists
const exists = registry.hasService('messages');
```

## Health Monitoring

ScorpionJS includes health monitoring for services:

```javascript
const app = createApp({
  health: {
    enabled: true,
    interval: 10000,        // Health check interval in ms
    timeout: 5000           // Health check timeout in ms
  }
});

// Add a health check to a service
app.service('database').addHealthCheck(async () => {
  try {
    await db.ping();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});

// Get health status of all services
const healthStatus = await app.getHealthStatus();

// Listen for health events
app.on('health.ok', ({ service, nodeID }) => {
  console.log(`Service ${service} on node ${nodeID} is healthy`);
});

app.on('health.error', ({ service, nodeID, error }) => {
  console.error(`Service ${service} on node ${nodeID} is unhealthy:`, error);
});
```

## Service Versioning

ScorpionJS supports service versioning:

```javascript
// Register different versions of a service
app.service('users.v1', {
  metadata: {
    version: '1.0.0'
  },
  
  async find() {
    // v1 implementation
  }
});

app.service('users.v2', {
  metadata: {
    version: '2.0.0'
  },
  
  async find() {
    // v2 implementation
  }
});

// Get a specific version
const usersV1 = app.service('users.v1');
const usersV2 = app.service('users.v2');

// Or use the version selector
const users = app.service('users', { version: '1.0.0' });
```

## Scaling and Clustering

ScorpionJS makes it easy to scale your application across multiple nodes:

```javascript
// Node 1 (API Gateway)
const gateway = createApp({
  nodeID: 'gateway',
  discovery: {
    type: 'redis',
    options: { host: 'localhost', port: 6379 }
  }
});

// Register API services
gateway.service('api', { /* ... */ });

// Start the gateway
gateway.listen(3000);

// Node 2 (User Service)
const userNode = createApp({
  nodeID: 'user-service',
  discovery: {
    type: 'redis',
    options: { host: 'localhost', port: 6379 }
  }
});

// Register user services
userNode.service('users', { /* ... */ });

// Start the user service
userNode.listen(3001);

// Node 3 (Payment Service)
const paymentNode = createApp({
  nodeID: 'payment-service',
  discovery: {
    type: 'redis',
    options: { host: 'localhost', port: 6379 }
  }
});

// Register payment services
paymentNode.service('payments', { /* ... */ });

// Start the payment service
paymentNode.listen(3002);
```

## Advanced Topics

### Service Mesh

ScorpionJS can integrate with service mesh solutions:

```javascript
import { createApp } from 'scorpionjs';
import serviceMesh from 'scorpionjs-service-mesh';

const app = createApp();

// Configure service mesh
app.configure(serviceMesh({
  type: 'istio',
  options: {
    // Istio configuration
  }
}));
```

### Namespace Isolation

You can isolate services in different namespaces:

```javascript
const app = createApp({
  namespace: 'production'
});

// Services are isolated to the 'production' namespace
app.service('users', { /* ... */ });
```

### Cross-Namespace Communication

```javascript
// Get a service from a different namespace
const testUsers = app.service('users', { namespace: 'test' });

// Call the service
const users = await testUsers.find();
```
