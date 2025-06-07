# Configuration API

ScorpionJS provides a flexible configuration system that allows you to customize the behavior of your application. This document provides detailed API documentation for configuring ScorpionJS applications.

## Basic Configuration

When creating a ScorpionJS application, you can provide configuration options:

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  // Basic configuration
  name: 'my-app',
  version: '1.0.0',
  description: 'My ScorpionJS application',
  
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Logging
  logger: {
    level: 'info',
    pretty: true
  }
});
```

## Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | String | `'scorpion-app'` | Name of the application |
| `version` | String | `'0.1.0'` | Version of the application |
| `description` | String | `''` | Description of the application |
| `env` | String | `'development'` | Environment (development, production, test) |
| `nodeID` | String | Auto-generated | Unique identifier for this node |
| `debug` | Boolean | `false` | Enable debug mode |

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

ScorpionJS provides methods to load configuration from different sources:

```javascript
import { createApp, loadConfig } from 'scorpionjs';

// Load from file
const config = loadConfig('./config.json');

// Load from environment variables
const envConfig = loadConfig({
  source: 'env',
  prefix: 'SCORPION_'
});

// Load from multiple sources with merging
const mergedConfig = loadConfig([
  './config.json',
  './config.local.json',
  { source: 'env', prefix: 'SCORPION_' }
]);

// Create app with loaded config
const app = createApp(mergedConfig);
```

### Configuration Files

ScorpionJS supports different configuration file formats:

**JSON**

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "logger": {
    "level": "info"
  },
  "transports": {
    "rest": {
      "port": 3000
    }
  }
}
```

**JavaScript**

```javascript
// config.js
module.exports = {
  name: 'my-app',
  version: '1.0.0',
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  },
  transports: {
    rest: {
      port: process.env.PORT || 3000
    }
  }
};
```

**YAML**

```yaml
# config.yaml
name: my-app
version: 1.0.0
logger:
  level: info
transports:
  rest:
    port: 3000
```

### Environment-specific Configuration

ScorpionJS supports environment-specific configuration:

```javascript
import { createApp, loadConfig } from 'scorpionjs';

// Load base config
const baseConfig = loadConfig('./config.json');

// Load environment-specific config
const env = process.env.NODE_ENV || 'development';
const envConfig = loadConfig(`./config.${env}.json`);

// Merge configs
const config = {
  ...baseConfig,
  ...envConfig,
  env
};

// Create app with merged config
const app = createApp(config);
```

## Runtime Configuration

### Getting Configuration

```javascript
// Get the entire configuration
const config = app.get('config');

// Get a specific configuration value
const port = app.get('transports.rest.port');
const logLevel = app.get('logger.level');
```

### Setting Configuration

```javascript
// Set a configuration value
app.set('logger.level', 'debug');

// Set multiple configuration values
app.set({
  'logger.level': 'debug',
  'transports.rest.port': 4000
});
```

### Configuration Hooks

```javascript
// Hook that runs when configuration changes
app.hooks({
  configChanged: {
    'logger.level': async (newValue, oldValue, app) => {
      console.log(`Log level changed from ${oldValue} to ${newValue}`);
      // Update logger
      app.logger.level = newValue;
    }
  }
});
```

## Configuration Plugins

ScorpionJS supports configuration plugins:

```javascript
import { createApp } from 'scorpionjs';
import configRedis from 'scorpionjs-config-redis';

const app = createApp();

// Use Redis for distributed configuration
app.configure(configRedis({
  host: 'localhost',
  port: 6379,
  keyPrefix: 'config:',
  watchChanges: true
}));

// Configuration will be loaded from Redis and changes will be watched
```

## Secrets Management

ScorpionJS provides secure secrets management:

```javascript
import { createApp } from 'scorpionjs';
import secrets from 'scorpionjs-secrets';

const app = createApp();

// Configure secrets manager
app.configure(secrets({
  provider: 'vault',  // 'vault', 'aws-secrets-manager', 'env', etc.
  options: {
    address: 'http://localhost:8200',
    token: process.env.VAULT_TOKEN,
    path: 'secret/my-app'
  }
}));

// Access secrets
const dbPassword = await app.secrets.get('db.password');

// Use secrets in configuration
app.set('database.password', await app.secrets.get('db.password'));
```

## Configuration Validation

ScorpionJS can validate your configuration:

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
app.service('users', {
  // Service-specific configuration
  config: {
    pagination: {
      default: 10,
      max: 100
    },
    roles: ['user', 'admin', 'guest']
  },
  
  async find(params) {
    // Access service configuration
    const limit = params.query.$limit || this.config.pagination.default;
    
    // Implementation
  }
});
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
app.service('users', {
  config: usersServiceConfig,
  
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
