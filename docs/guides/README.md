# Guides

This section provides step-by-step guides for common tasks with ScorpionJS.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Services](#creating-services)
- [Using Hooks](#using-hooks)
- [Schema Validation](#schema-validation)
- [Real-time Communication](#real-time-communication)
- [Authentication](#authentication)
- [Database Integration](#database-integration)
- [Deploying to Different Runtimes](#deploying-to-different-runtimes)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Getting Started

### Installation

```bash
npm install scorpionjs
```

### Creating Your First Application

```javascript
// app.js
import { createApp } from 'scorpionjs';

const app = createApp();

// Register a simple service
app.service('hello', {
  async find() {
    return { message: 'Hello, ScorpionJS!' };
  }
});

// Start the server
app.listen(3000).then(() => {
  console.log('Server running at http://localhost:3000');
});
```

Run your application:

```bash
node app.js
```

Access your service at `http://localhost:3000/hello`.

## Creating Services

Services are the core building blocks of a ScorpionJS application. Here's how to create and use them:

### Basic Service

```javascript
// Basic service with standard REST methods
app.service('messages', {
  // In-memory messages store for this example
  messages: [],
  
  async find(params) {
    return this.messages;
  },
  
  async get(id, params) {
    const message = this.messages.find(m => m.id === parseInt(id));
    if (!message) throw new Error('Message not found');
    return message;
  },
  
  async create(data, params) {
    const message = {
      id: Date.now(),
      text: data.text,
      createdAt: new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  },
  
  async update(id, data, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = {
      id: parseInt(id),
      text: data.text,
      createdAt: this.messages[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    
    this.messages[index] = message;
    return message;
  },
  
  async patch(id, data, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = {
      ...this.messages[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    this.messages[index] = message;
    return message;
  },
  
  async remove(id, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = this.messages[index];
    this.messages.splice(index, 1);
    return message;
  }
});
```

### Service with Custom Methods

```javascript
// Service with custom methods
app.service('payments', {
  async find(params) {
    return [{ id: 1, amount: 100 }];
  },
  
  // Custom method
  async processPayment(data, params) {
    // Process payment logic
    return {
      transactionId: `tx-${Date.now()}`,
      status: 'completed',
      amount: data.amount
    };
  },
  
  // Custom method with specific HTTP method and path
  async refund(id, data, params) {
    // Refund logic
    return {
      transactionId: id,
      status: 'refunded',
      amount: data.amount
    };
  }
});

// Register custom methods
app.service('payments').methods({
  processPayment: {
    http: { method: 'POST', path: '/process' }
  },
  refund: {
    http: { method: 'POST', path: '/:id/refund' }
  }
});
```

## Using Hooks

Hooks allow you to modify the behavior of service methods:

### Global Hooks

```javascript
// Global hooks applied to all services
app.hooks({
  before: {
    all: [
      async context => {
        context.params.requestStartTime = Date.now();
        return context;
      }
    ]
  },
  after: {
    all: [
      async context => {
        const duration = Date.now() - context.params.requestStartTime;
        console.log(`Request to ${context.path}.${context.method} took ${duration}ms`);
        return context;
      }
    ]
  },
  error: {
    all: [
      async context => {
        console.error(`Error in ${context.path}.${context.method}:`, context.error);
        return context;
      }
    ]
  }
});
```

### Service-specific Hooks

```javascript
// Hooks for a specific service
app.service('messages').hooks({
  before: {
    create: [
      async context => {
        // Add user ID from authenticated user
        if (context.params.user) {
          context.data.userId = context.params.user.id;
        }
        return context;
      }
    ],
    find: [
      async context => {
        // Limit results for non-admin users
        if (context.params.user && !context.params.user.isAdmin) {
          context.params.query = {
            ...context.params.query,
            $limit: Math.min(context.params.query.$limit || 10, 50)
          };
        }
        return context;
      }
    ]
  }
});
```

### Pattern-based Hooks

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
```

### Around Hooks

```javascript
// Around hooks wrap the service method execution
app.service('messages').hooks({
  around: {
    all: [
      async (context, next) => {
        console.log('Before method execution');
        
        // Call the next hook or the service method
        context = await next(context);
        
        console.log('After method execution');
        return context;
      }
    ]
  }
});
```

## Schema Validation

ScorpionJS provides built-in schema validation:

### JSON Schema Validation

```javascript
const userSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string',
      minLength: 8
    },
    name: {
      type: 'string'
    }
  }
};

app.service('users', {
  schema: {
    create: userSchema,
    update: userSchema,
    patch: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        password: { type: 'string', minLength: 8 }
      },
      additionalProperties: false
    },
    query: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  },
  
  async find(params) {
    // Query has been validated
    return [];
  },
  
  async create(data, params) {
    // Data has been validated
    return { id: Date.now(), ...data };
  }
});
```

### TypeScript Integration

```typescript
import { createApp, Service, HookContext } from 'scorpionjs';

interface User {
  id?: number;
  email: string;
  password: string;
  name?: string;
}

interface UserQuery {
  email?: string;
  $limit?: number;
}

class UserService implements Service<User, UserQuery> {
  async find(params: { query: UserQuery }): Promise<User[]> {
    // Implementation
    return [];
  }
  
  async create(data: User): Promise<User> {
    // Implementation
    return { id: Date.now(), ...data };
  }
  
  // Other methods...
}

const app = createApp();
app.service('users', new UserService());
```

## Real-time Communication

ScorpionJS makes it easy to build real-time applications:

### Server-side Events

```javascript
app.service('messages').on('created', message => {
  console.log('New message created:', message);
});

app.service('messages').on('patched', (message, context) => {
  console.log('Message updated:', message);
  console.log('User who made the update:', context.params.user);
});
```

### Client-side Real-time

```javascript
// Browser
import { createClient } from 'scorpionjs/client';

const client = createClient('http://localhost:3000');
const messagesService = client.service('messages');

// Listen for real-time events
messagesService.on('created', message => {
  console.log('New message received:', message);
  // Update UI
});

// Create a new message
messagesService.create({ text: 'Hello, real-time!' })
  .then(message => console.log('Message sent:', message));
```

### Custom Events

```javascript
// Server-side
app.service('notifications').publish('newFeature', {
  title: 'New Feature Available',
  description: 'Check out our new feature!'
});

// Client-side
client.service('notifications').on('newFeature', notification => {
  showNotification(notification);
});
```

## Authentication

ScorpionJS provides a flexible authentication system:

```javascript
import { createApp, authenticate } from 'scorpionjs';
import jwt from 'jsonwebtoken';

const app = createApp();

// Authentication service
app.service('authentication', {
  async create(data, params) {
    const { email, password } = data;
    
    // Validate credentials (simplified example)
    const user = await app.service('users').find({
      query: { email }
    }).then(users => users[0]);
    
    if (!user || user.password !== password) {
      throw new Error('Invalid login');
    }
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, 'your-secret-key', {
      expiresIn: '1d'
    });
    
    return { token, user };
  }
});

// Authentication hook
const auth = authenticate({
  secret: 'your-secret-key',
  service: 'users',
  field: 'id'
});

// Apply authentication to protected services
app.service('messages').hooks({
  before: {
    all: [auth]
  }
});
```

## Database Integration

ScorpionJS is data source agnostic and can work with any database:

### MongoDB Example

```javascript
import { createApp } from 'scorpionjs';
import { MongoClient } from 'mongodb';

async function createMongoService(collection) {
  return {
    async find(params) {
      const query = params.query || {};
      return collection.find(query).toArray();
    },
    
    async get(id, params) {
      const result = await collection.findOne({ _id: id });
      if (!result) throw new Error('Not found');
      return result;
    },
    
    async create(data, params) {
      const result = await collection.insertOne(data);
      return { ...data, _id: result.insertedId };
    },
    
    async update(id, data, params) {
      await collection.replaceOne({ _id: id }, data);
      return { ...data, _id: id };
    },
    
    async patch(id, data, params) {
      await collection.updateOne({ _id: id }, { $set: data });
      return { ...await this.get(id), ...data };
    },
    
    async remove(id, params) {
      const result = await collection.findOneAndDelete({ _id: id });
      if (!result.value) throw new Error('Not found');
      return result.value;
    }
  };
}

async function start() {
  const app = createApp();
  
  // Connect to MongoDB
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('scorpionjs-example');
  
  // Register services
  app.service('users', await createMongoService(db.collection('users')));
  app.service('messages', await createMongoService(db.collection('messages')));
  
  // Start the server
  await app.listen(3000);
  console.log('Server started on port 3000');
}

start().catch(console.error);
```

## Deploying to Different Runtimes

ScorpionJS supports multiple JavaScript runtimes:

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

## Error Handling

ScorpionJS provides a comprehensive error handling system:

```javascript
import { createApp, NotFound, BadRequest } from 'scorpionjs';

const app = createApp();

// Service with error handling
app.service('products', {
  async get(id, params) {
    const product = await database.findProduct(id);
    
    if (!product) {
      throw new NotFound(`Product with ID ${id} not found`);
    }
    
    return product;
  },
  
  async create(data, params) {
    if (!data.name) {
      throw new BadRequest('Product name is required');
    }
    
    if (data.price <= 0) {
      throw new BadRequest('Product price must be positive');
    }
    
    return await database.createProduct(data);
  }
});

// Global error handler
app.hooks({
  error: {
    all: [
      async context => {
        // Log all errors
        console.error(`Error in ${context.path}.${context.method}:`, context.error);
        
        // You can modify the error before it's sent to the client
        if (context.error.code === 'INTERNAL_SERVER_ERROR') {
          // Don't expose internal error details to clients
          context.error.message = 'Internal server error';
          delete context.error.stack;
        }
        
        return context;
      }
    ]
  }
});
```

## Testing

ScorpionJS makes it easy to test your services:

```javascript
import { createApp } from 'scorpionjs';
import assert from 'assert';

// Create a test app
const app = createApp();

// Register the service we want to test
app.service('messages', {
  messages: [],
  
  async find() {
    return this.messages;
  },
  
  async create(data) {
    const message = {
      id: this.messages.length + 1,
      text: data.text,
      createdAt: new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  }
});

// Test the service
async function runTests() {
  const messagesService = app.service('messages');
  
  // Test create
  const message = await messagesService.create({ text: 'Test message' });
  assert.strictEqual(message.text, 'Test message');
  assert.strictEqual(typeof message.id, 'number');
  
  // Test find
  const messages = await messagesService.find();
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].id, message.id);
  
  console.log('All tests passed!');
}

runTests().catch(console.error);
```
