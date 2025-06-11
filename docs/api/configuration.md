# Configuration API

ScorpionJS provides a flexible configuration system that allows you to customize the behavior of your application. This document provides detailed API documentation for configuring ScorpionJS applications.

## Basic Configuration

When creating a ScorpionJS application, you can provide configuration options:

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  // Environment
  env: 'production',
  
  // Server configuration
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: {
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
    }
  },
  
  // Database configuration
  database: {
    client: 'pg',
    connection: {
      host: 'localhost',
      user: 'postgres',
      password: 'secret',
      database: 'my_app'
    }
  }
});
```

## Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `env` | String | `process.env.NODE_ENV || 'development'` | Environment (development, production, test) |

### Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server.port` | Number | `3030` | Port for the HTTP server |
| `server.host` | String | `'localhost'` | Host for the HTTP server |
| `server.cors` | Boolean/Object | `true` | CORS configuration (true for defaults, object for custom settings) |

### Logging Options

```javascript
const app = createApp({
  logger: {
    level: 'info',           // Log level (trace, debug, info, warn, error, fatal)
    pretty: true,            // Pretty-print logs (colored, formatted)
    timestamp: true,         // Include timestamps
    colors: true,            // Use colors in output
    file: './logs/app.log',  // Log to file
    redact: ['password'],    // Fields to redact from logs
    serializers: {           // Custom serializers
      req: (req) => ({ method: req.method, url: req.url })
    }
  }
});
```

### Transport Options

```javascript
const app = createApp({
  transports: {
    rest: {
      enabled: true,
      port: 3000,
      host: 'localhost',
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
      },
      bodyParser: {
        json: { limit: '1mb' },
        urlencoded: { extended: true }
      },
      compression: true
    },
    
    socket: {
      enabled: true,
      port: 3000,  // Can share port with REST
      path: '/socket',
      pingInterval: 10000,
      pingTimeout: 5000,
      maxHttpBufferSize: 1e6
    }
  }
});
```

### Service Discovery Options

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
    },
    heartbeatInterval: 5000,
    heartbeatTimeout: 15000
  }
});
```

### Fault Tolerance Options

```javascript
const app = createApp({
  faultTolerance: {
    circuitBreaker: {
      enabled: true,
      threshold: 0.5,         // Error threshold (50%)
      minRequests: 20,        // Minimum requests before tripping
      windowTime: 60000,      // Time window in ms (1 minute)
      halfOpenAfter: 10000    // Time to half-open state in ms
    },
    
    bulkhead: {
      enabled: true,
      concurrency: 10,        // Max concurrent executions
      maxQueueSize: 100       // Max queue size
    },
    
    retry: {
      enabled: true,
      retries: 3,             // Number of retries
      delay: 1000,            // Delay between retries in ms
      factor: 2,              // Exponential backoff factor
      maxDelay: 30000         // Maximum delay in ms
    },
    
    timeout: {
      enabled: true,
      duration: 5000          // Timeout in ms
    },
    
    fallback: {
      enabled: true
      // Fallbacks are defined per service
    }
  }
});
```

### Authentication Options

```javascript
const app = createApp({
  authentication: {
    secret: 'your-secret-key',
    jwt: {
      algorithm: 'HS256',
      expiresIn: '1d'
    },
    strategies: ['jwt', 'local'],
    entity: 'user',
    entityId: 'id',
    service: 'users'
  }
});
```

### Schema Validation Options

```javascript
const app = createApp({
  validation: {
    coerceTypes: true,         // Coerce data types
    removeAdditional: true,    // Remove additional properties
    useDefaults: true,         // Apply default values
    allErrors: true            // Return all errors
  }
});
```

### Cache Options

```javascript
const app = createApp({
  cache: {
    enabled: true,
    adapter: 'memory',         // 'memory', 'redis', or custom
    ttl: 60,                   // Time to live in seconds
    max: 1000,                 // Max items in cache
    options: {
      // Adapter-specific options
      host: 'localhost',
      port: 6379
    }
  }
});
```

## Configuration Methods

### Loading Configuration

ScorpionJS automatically loads configuration from multiple sources with the following precedence (highest to lowest):

1. Configuration object passed to `createApp()` or the constructor
2. Environment variables with `SCORPION_` prefix
3. Environment-specific configuration file (`scorpion.{env}.config.json`)
4. Default configuration file (`scorpion.config.json`)
5. Default values built into the framework

```javascript
import { createApp } from 'scorpionjs';

// Configuration will be automatically loaded from all sources
const app = createApp({
  // These values will override any from other sources
  server: {
    port: 8080
  }
});
```

### Configuration Files

ScorpionJS looks for configuration files in the current working directory:

**JSON Format**

`scorpion.config.json`:
```json
{
  "env": "development",
  "server": {
    "port": 3030,
    "host": "localhost",
    "cors": true
  },
  "database": {
    "client": "sqlite3",
    "connection": {
      "filename": "./dev.sqlite3"
    }
  }
}
```

### Environment-specific Configuration

ScorpionJS automatically loads environment-specific configuration files. For example, if `NODE_ENV=production`, it will look for `scorpion.production.config.json`:

```json
{
  "server": {
    "port": 80,
    "host": "0.0.0.0"
  },
  "database": {
    "client": "pg",
    "connection": {
      "host": "db.example.com",
      "user": "app",
      "password": "${DB_PASSWORD}",
      "database": "production_db"
    }
  }
}
```

### Environment Variables

ScorpionJS automatically loads configuration from environment variables with the `SCORPION_` prefix. Environment variables are converted to nested configuration properties using underscores as separators:

```bash
# These environment variables:
SCORPION_SERVER_PORT=8080
SCORPION_SERVER_HOST=0.0.0.0
SCORPION_DATABASE_CLIENT=pg
SCORPION_DATABASE_CONNECTION_HOST=db.example.com

# Will be converted to this configuration:
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "database": {
    "client": "pg",
    "connection": {
      "host": "db.example.com"
    }
  }
}
```

Values are automatically parsed as JSON if possible, so you can use `SCORPION_SERVER_CORS=true` or `SCORPION_SERVER_PORT=8080` and they will be converted to boolean and number types respectively.

## Runtime Configuration

### Getting Configuration

```javascript
// Get a specific configuration value using dot notation
const port = app.get('server.port');
const dbClient = app.get('database.client');

// Get a nested configuration object
const serverConfig = app.get('server');
console.log(serverConfig.port); // 3030

// Get a value with a default if not found
const timeout = app.get('server.timeout') || 5000;
```

### Setting Configuration

```javascript
// Set a configuration value using dot notation
app.set('server.port', 8080);

// Set a nested configuration object
app.set('database', {
  client: 'mysql',
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'secret',
    database: 'my_app'
  }
});

// Chain multiple set operations
app.set('server.port', 8080)
   .set('server.host', '0.0.0.0');
```

### Using Configuration in Services

Services can access the application configuration through the `app` reference:

```javascript
class MyService {
  setup(app) {
    this.app = app;
    this.dbClient = app.get('database.client');
    this.serverPort = app.get('server.port');
  }
  
  async find(params) {
    // Use configuration values
    const pageSize = this.app.get('pagination.defaultSize') || 10;
    // ...
  }
}
```

## Configuration in Plugins

Plugins can access and modify the application configuration:

```javascript
// my-plugin.js
export default function myPlugin(options = {}) {
  return function(app) {
    // Get existing configuration
    const serverPort = app.get('server.port');
    
    // Set new configuration values
    app.set('myPlugin', {
      enabled: options.enabled !== false,
      timeout: options.timeout || 5000
    });
    
    // Use configuration values
    console.log(`Plugin initialized with port ${serverPort}`);
  };
}

// Using the plugin
import { createApp } from 'scorpionjs';
import myPlugin from './my-plugin';

const app = createApp();
app.configure(myPlugin({ timeout: 10000 }));
```

## Configuration Best Practices

### Sensitive Information

Never store sensitive information like passwords or API keys directly in your configuration files. Instead:

1. Use environment variables (`SCORPION_DATABASE_PASSWORD=secret`)
2. Use separate environment-specific configuration files that are not committed to version control
3. Consider using a secrets management solution

### Default Values

Always provide sensible defaults in your code when accessing configuration:

```javascript
// Good: Provides a default value
const timeout = app.get('server.timeout') || 5000;

// Better: Destructuring with defaults
const { port = 3030, host = 'localhost' } = app.get('server') || {};
```

### Configuration Structure

Organize your configuration in logical groups:

```javascript
// Good structure
const app = createApp({
  server: { /* server config */ },
  database: { /* database config */ },
  auth: { /* authentication config */ },
  email: { /* email service config */ }
});
```

## Future Enhancements

The following configuration features are planned for future releases:

1. Schema validation for configuration
2. Configuration watchers for real-time updates
3. Distributed configuration with external stores (Redis, etcd, etc.)
4. Secrets management integration

```javascript
import { createApp, validateConfig } from 'scorpionjs';

// Define configuration schema
const configSchema = {
  type: 'object',
  required: ['name', 'transports'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    transports: {
      type: 'object',
      properties: {
        rest: {
          type: 'object',
          properties: {
            port: { type: 'number', minimum: 1, maximum: 65535 }
          }
        }
      }
    }
  }
};

// Load and validate configuration
const config = validateConfig(loadConfig('./config.json'), configSchema);

// Create app with validated config
const app = createApp(config);
```

## Service-specific Configuration

Services can have their own configuration:

```javascript
app.use('users',
  { // Service implementation
    async find(params) {
      // Access framework and custom configuration from this.options
      const limit = params.query.$limit || this.options.pagination.default;
      const roles = this.options.config.roles;
      
      // Implementation
      console.log(`Fetching with limit: ${limit}, allowed roles: ${roles.join(', ')}`);
    }
  },
  { // Service options
    pagination: {
      default: 10,
      max: 100
    },
    config: {
      // Custom configuration for this service
      roles: ['user', 'admin', 'guest']
    }
  }
);
```

## Configuration Inheritance

ScorpionJS supports configuration inheritance:

```javascript
// Base configuration
const baseConfig = {
  logger: {
    level: 'info'
  },
  transports: {
    rest: {
      cors: {
        origin: '*'
      }
    }
  }
};

// Service-specific configuration
const usersServiceConfig = {
  pagination: {
    default: 10,
    max: 100
  }
};

// Create app with base configuration
const app = createApp(baseConfig);

// Register service with inherited configuration
app.use('users', { 
  
  async find(params) {
    // Access combined configuration
    console.log(this.app.get('logger.level')); // 'info' (from base config)
    console.log(this.config.pagination.default); // 10 (from service config)
  }
});
```

## Dynamic Configuration

ScorpionJS supports dynamic configuration that can change at runtime:

```javascript
import { createApp } from 'scorpionjs';
import configWatcher from 'scorpionjs-config-watcher';

const app = createApp();

// Watch for configuration file changes
app.configure(configWatcher({
  files: ['./config.json'],
  interval: 5000  // Check every 5 seconds
}));

// Listen for configuration changes
app.on('config.changed', (path, newValue, oldValue) => {
  console.log(`Configuration changed: ${path}`);
});
```

## Configuration API Reference

### createApp(config)

Creates a new ScorpionJS application with the provided configuration.

```javascript
const app = createApp({
  name: 'my-app',
  // Other configuration options
});
```

### app.get(path)

Gets a configuration value at the specified path.

```javascript
const port = app.get('transports.rest.port');
```

### app.set(path, value)

Sets a configuration value at the specified path.

```javascript
app.set('logger.level', 'debug');
```

### app.has(path)

Checks if a configuration value exists at the specified path.

```javascript
if (app.has('transports.socket')) {
  // Socket transport is configured
}
```

### app.unset(path)

Removes a configuration value at the specified path.

```javascript
app.unset('transports.socket');
```

### loadConfig(source)

Loads configuration from the specified source.

```javascript
const config = loadConfig('./config.json');
```

### validateConfig(config, schema)

Validates configuration against a JSON schema.

```javascript
const validatedConfig = validateConfig(config, schema);
```

## Best Practices

1. **Use environment variables for sensitive information**:
   ```javascript
   const app = createApp({
     database: {
       password: process.env.DB_PASSWORD
     }
   });
   ```

2. **Use different configurations for different environments**:
   ```javascript
   const env = process.env.NODE_ENV || 'development';
   const config = loadConfig(`./config.${env}.json`);
   ```

3. **Validate your configuration**:
   ```javascript
   const validatedConfig = validateConfig(config, schema);
   ```

4. **Use secrets management for sensitive data**:
   ```javascript
   const dbPassword = await app.secrets.get('db.password');
   ```

5. **Centralize configuration for distributed services**:
   ```javascript
   app.configure(configRedis({
     host: 'localhost',
     port: 6379
   }));
   ```
