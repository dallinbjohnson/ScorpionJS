# Plugins API - Part 3: Plugin Ecosystem and Best Practices

This document concludes the Plugins API documentation with information about the plugin ecosystem, integration patterns, and best practices for ScorpionJS plugins.

## Transport Plugins

### Creating Transport Plugins

```javascript
// websocket-transport-plugin.js
import WebSocket from 'ws';

export default function websocketTransportPlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      port: 8080,
      path: '/ws',
      ...options
    };
    
    // Create WebSocket server
    const wss = new WebSocket.Server({
      port: opts.port,
      path: opts.path
    });
    
    // Store connections
    const connections = new Set();
    
    // Handle connections
    wss.on('connection', (ws) => {
      // Add connection to set
      connections.add(ws);
      
      // Handle messages
      ws.on('message', async (message) => {
        try {
          const { type, service, method, data, params, id } = JSON.parse(message);
          
          if (type === 'call') {
            // Call service method
            const result = await app.service(service)[method](data, params);
            
            // Send result
            ws.send(JSON.stringify({
              type: 'result',
              id,
              result
            }));
          }
        } catch (error) {
          // Send error
          ws.send(JSON.stringify({
            type: 'error',
            id,
            error: {
              message: error.message,
              code: error.code || 500
            }
          }));
        }
      });
      
      // Handle close
      ws.on('close', () => {
        connections.delete(ws);
      });
    });
    
    // Register transport
    app.transports = app.transports || {};
    app.transports.websocket = {
      server: wss,
      connections,
      broadcast: (event, data) => {
        const message = JSON.stringify({
          type: 'event',
          event,
          data
        });
        
        for (const connection of connections) {
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(message);
          }
        }
      }
    };
    
    // Broadcast service events
    app.on('*', (event, data) => {
      app.transports.websocket.broadcast(event, data);
    });
    
    // Close WebSocket server when app closes
    app.on('close', () => {
      wss.close();
    });
  };
}

// Usage
app.configure(websocketTransportPlugin({
  port: 8080,
  path: '/realtime'
}));
```

### Multi-runtime Transport Plugins

```javascript
// universal-transport-plugin.js
export default function universalTransportPlugin(options = {}) {
  return function(app) {
    // Detect runtime environment
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    const isDeno = typeof Deno !== 'undefined';
    const isBrowser = typeof window !== 'undefined';
    const isCloudflareWorker = typeof caches !== 'undefined' && typeof self !== 'undefined' && typeof self.addEventListener === 'function';
    
    // Configure transport based on environment
    if (isNode) {
      app.configure(nodeTransport(options));
    } else if (isDeno) {
      app.configure(denoTransport(options));
    } else if (isCloudflareWorker) {
      app.configure(cloudflareTransport(options));
    } else if (isBrowser) {
      app.configure(browserTransport(options));
    } else {
      throw new Error('Unsupported runtime environment');
    }
    
    // Add universal methods
    app.transports = app.transports || {};
    app.transports.universal = {
      environment: isNode ? 'node' : isDeno ? 'deno' : isCloudflareWorker ? 'cloudflare' : isBrowser ? 'browser' : 'unknown'
    };
  };
}

// Usage
app.configure(universalTransportPlugin({
  port: 3000
}));
```

## Integration Plugins

### Database Integration

```javascript
// mongoose-plugin.js
import mongoose from 'mongoose';

export default function mongoosePlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      uri: 'mongodb://localhost:27017/myapp',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      },
      ...options
    };
    
    // Connect to MongoDB
    mongoose.connect(opts.uri, opts.options);
    
    // Add mongoose to app
    app.mongoose = mongoose;
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      app.logger.info('Connected to MongoDB');
    });
    
    mongoose.connection.on('error', (err) => {
      app.logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      app.logger.info('Disconnected from MongoDB');
    });
    
    // Close connection when app closes
    app.on('close', () => {
      mongoose.connection.close();
    });
  };
}

// Usage
app.configure(mongoosePlugin({
  uri: 'mongodb://localhost:27017/myapp'
}));
```

### External API Integration

```javascript
// stripe-plugin.js
import Stripe from 'stripe';

export default function stripePlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      apiKey: process.env.STRIPE_API_KEY,
      ...options
    };
    
    if (!opts.apiKey) {
      throw new Error('Stripe API key is required');
    }
    
    // Create Stripe client
    const stripe = new Stripe(opts.apiKey);
    
    // Add Stripe to app
    app.stripe = stripe;
    
    // Create Stripe service
    app.service('payments', {
      async create(data, params) {
        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: data.amount,
          currency: data.currency || 'usd',
          description: data.description,
          metadata: data.metadata
        });
        
        return paymentIntent;
      },
      
      async get(id, params) {
        // Get payment intent
        return stripe.paymentIntents.retrieve(id);
      },
      
      async patch(id, data, params) {
        // Update payment intent
        return stripe.paymentIntents.update(id, data);
      }
    });
  };
}

// Usage
app.configure(stripePlugin({
  apiKey: process.env.STRIPE_API_KEY
}));
```

## Plugin Composition

### Composing Multiple Plugins

```javascript
// Create a composed plugin
function createAppPlugin(options = {}) {
  return function(app) {
    // Configure multiple plugins
    app.configure(loggerPlugin({
      level: options.logLevel || 'info'
    }));
    
    app.configure(mongoosePlugin({
      uri: options.mongoUri || 'mongodb://localhost:27017/myapp'
    }));
    
    app.configure(authenticationPlugin({
      secret: options.secret || 'default-secret'
    }));
    
    app.configure(validationPlugin());
    
    // Add custom configuration
    if (options.services) {
      for (const [path, service] of Object.entries(options.services)) {
        app.service(path, service);
      }
    }
  };
}

// Usage
app.configure(createAppPlugin({
  logLevel: 'debug',
  mongoUri: 'mongodb://localhost:27017/myapp',
  secret: 'my-secret',
  services: {
    users: {
      async find() { /* ... */ }
    }
  }
}));
```

### Plugin Dependencies

```javascript
// Create a plugin with dependencies
function paymentPlugin(options = {}) {
  return function(app) {
    // Check for required plugins
    if (!app.stripe) {
      throw new Error('Stripe plugin is required');
    }
    
    if (!app.hooks || !app.hooks.authenticate) {
      throw new Error('Authentication plugin is required');
    }
    
    // Configure the payment service
    app.service('payments', {
      async create(data, params) {
        // Create payment
        const payment = await app.stripe.paymentIntents.create({
          amount: data.amount,
          currency: data.currency
        });
        
        return payment;
      }
    });
    
    // Add hooks
    app.service('payments').hooks({
      before: {
        all: [app.hooks.authenticate]
      }
    });
  };
}

// Usage with dependencies
app.configure(stripePlugin({
  apiKey: process.env.STRIPE_API_KEY
}));

app.configure(authenticationPlugin({
  secret: 'my-secret'
}));

app.configure(paymentPlugin());
```

## Plugin Lifecycle

### Plugin Initialization and Teardown

```javascript
// Create a plugin with lifecycle hooks
function databasePlugin(options = {}) {
  return async function(app) {
    // Default options
    const opts = {
      uri: 'mongodb://localhost:27017/myapp',
      ...options
    };
    
    let client;
    
    // Initialize function
    async function initialize() {
      app.logger.info('Initializing database connection');
      
      // Connect to database
      client = await connectToDatabase(opts.uri);
      
      // Add database to app
      app.db = client.db();
    }
    
    // Teardown function
    async function teardown() {
      app.logger.info('Closing database connection');
      
      // Close connection
      if (client) {
        await client.close();
      }
    }
    
    // Register initialization
    app.registerInitializer('database', initialize);
    
    // Register teardown
    app.registerTeardown('database', teardown);
  };
}

// Application with lifecycle management
const app = createApp();

// Configure plugins
app.configure(loggerPlugin());
app.configure(databasePlugin());

// Initialize all plugins
await app.initialize();

// Start the server
await app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.teardown();
  process.exit(0);
});
```

## Plugin Best Practices

### Error Handling

```javascript
// Plugin with proper error handling
function robustPlugin(options = {}) {
  return async function(app) {
    try {
      // Initialize resources
      const resource = await initializeResource();
      
      // Add to app
      app.resource = resource;
      
      // Handle errors in async operations
      resource.on('error', (error) => {
        app.logger.error('Resource error:', error);
        app.emit('resource.error', error);
      });
      
      // Register teardown
      app.registerTeardown('resource', async () => {
        try {
          await resource.close();
        } catch (error) {
          app.logger.error('Error closing resource:', error);
        }
      });
    } catch (error) {
      app.logger.error('Failed to initialize plugin:', error);
      throw error; // Re-throw to prevent app from starting with broken plugin
    }
  };
}
```

### Configuration Validation

```javascript
// Plugin with configuration validation
function validatedPlugin(options = {}) {
  return function(app) {
    // Define schema
    const schema = {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string' },
        timeout: { type: 'number', minimum: 100, maximum: 30000 }
      }
    };
    
    // Validate options
    const valid = validateSchema(schema, options);
    
    if (!valid) {
      throw new Error('Invalid plugin configuration');
    }
    
    // Use validated options
    const opts = {
      timeout: 5000, // Default
      ...options
    };
    
    // Configure plugin
    // ...
  };
}
```

### Plugin Documentation

```javascript
/**
 * Authentication plugin for ScorpionJS
 * 
 * @param {Object} options - Plugin options
 * @param {string} options.secret - Secret key for JWT
 * @param {string} options.userService - User service path (default: 'users')
 * @param {number} options.expiresIn - Token expiration in seconds (default: 86400)
 * @returns {Function} - Configure function for ScorpionJS
 * 
 * @example
 * ```javascript
 * app.configure(authentication({
 *   secret: 'your-secret-key',
 *   userService: 'users',
 *   expiresIn: 3600 // 1 hour
 * }));
 * ```
 */
function authentication(options = {}) {
  return function(app) {
    // Plugin implementation
  };
}
```

## Publishing Plugins

### Plugin Package Structure

```
scorpionjs-authentication/
├── package.json
├── README.md
├── LICENSE
├── src/
│   ├── index.js        # Main entry point
│   ├── strategies/     # Authentication strategies
│   ├── hooks/          # Authentication hooks
│   └── utils/          # Utility functions
├── test/
│   └── index.test.js   # Tests
└── example/
    └── app.js          # Example usage
```

### Package.json for Plugins

```json
{
  "name": "scorpionjs-authentication",
  "version": "1.0.0",
  "description": "Authentication plugin for ScorpionJS",
  "main": "lib/index.js",
  "module": "lib/index.esm.js",
  "types": "lib/index.d.ts",
  "files": [
    "lib",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "rollup -c",
    "test": "jest",
    "lint": "eslint src"
  },
  "keywords": [
    "scorpionjs",
    "plugin",
    "authentication"
  ],
  "author": "Your Name",
  "license": "MIT",
  "peerDependencies": {
    "scorpionjs": "^1.0.0"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "scorpionjs": "^1.0.0",
    "jest": "^29.0.0",
    "rollup": "^3.0.0"
  }
}
```

### Plugin Export Pattern

```javascript
// src/index.js

// Import components
import { createAuthService } from './services';
import { authenticate, authorize } from './hooks';
import { verifyToken, hashPassword } from './utils';

// Export plugin
export default function authentication(options = {}) {
  return function(app) {
    // Plugin implementation
  };
}

// Export components for individual use
export {
  createAuthService,
  authenticate,
  authorize,
  verifyToken,
  hashPassword
};
```

## Conclusion

The ScorpionJS plugin system provides a powerful way to extend the framework with additional functionality. By following the patterns and best practices outlined in this documentation, you can create plugins that are robust, reusable, and easy to maintain.

For more examples of plugins, check out the official ScorpionJS plugin repository or the community plugins directory.
