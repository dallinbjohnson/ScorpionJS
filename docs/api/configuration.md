# Configuration API

ScorpionJS provides a flexible configuration system that allows you to customize the behavior of your application. This document provides detailed API documentation for configuring ScorpionJS applications.

## Configuration Loading

ScorpionJS automatically loads configuration from multiple sources with the following precedence (highest to lowest):

1.  **Programmatic Configuration**: Object passed to `createApp()` or the `ScorpionApp` constructor.
2.  **Environment Variables**: Variables prefixed with `SCORPION_`. For nested properties, use double underscores (e.g., `SCORPION_REST__PORT=8080` maps to `config.rest.port`).
3.  **Environment-Specific Configuration File**: `scorpion.{env}.config.json` (e.g., `scorpion.production.config.json`).
4.  **Default Configuration File**: `scorpion.config.json`.
5.  **Internal Default Values**: Predefined defaults within the framework.

## Core Configuration (`ScorpionConfig`)

The main configuration object can have the following top-level properties:

```typescript
interface ScorpionConfig {
  env?: string;
  rest?: RestTransportConfig;
  websocket?: WebSocketTransportConfig;
  logging?: LoggingConfig;
  validation?: SchemaValidationConfig;
  faultTolerance?: FaultToleranceConfig;
  serviceDiscovery?: ServiceDiscoveryConfig;
  i18n?: I18nConfig;
}
```

### `env`

| Option | Type   | Default                             | Description                                  |
| :----- | :----- | :---------------------------------- | :------------------------------------------- |
| `env`  | string | `process.env.NODE_ENV || 'development'` | Application environment (e.g., 'development', 'production', 'test'). |

---

### REST Transport Configuration (`rest`)

Controls the REST API transport layer.

| Option         | Type             | Default                                                 | Description                                                                                                                               |
| :------------- | :--------------- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`      | boolean          | `true`                                                  | Enables or disables the REST transport.                                                                                                   |
| `port`         | number           | `3030`                                                  | Port for the HTTP server.                                                                                                                 |
| `host`         | string           | `'localhost'`                                           | Host for the HTTP server.                                                                                                                 |
| `basePath`     | string           | `/`                                                     | Base path for all REST routes.                                                                                                            |
| `cors`         | CorsOptions      | `{ origin: '*', methods: [...], allowedHeaders: [...] }` | CORS (Cross-Origin Resource Sharing) configuration. See `CorsOptions` below.                                                              |
| `bodyParser`   | BodyParserConfig | `{ json: { limit: '1mb' }, urlencoded: { ... } }`       | Configuration for request body parsing. See `BodyParserConfig` below.                                                                     |
| `compression`  | CompressionConfig| `{ threshold: '1kb' }`                                  | Configuration for response compression. See `CompressionConfig` below.                                                                    |

#### `CorsOptions`

| Option               | Type                        | Default                                                     | Description                                                                                             |
| :------------------- | :-------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `origin`             | string \| boolean \| string[] | `'*'`                                                       | Configures the `Access-Control-Allow-Origin` CORS header.                                               |
| `methods`            | string \| string[]          | `['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`      | Configures the `Access-Control-Allow-Methods` CORS header.                                              |
| `allowedHeaders`     | string \| string[]          | `['Content-Type', 'Authorization', 'X-Requested-With']`     | Configures the `Access-Control-Allow-Headers` CORS header.                                              |
| `exposedHeaders`     | string \| string[]          | `[]`                                                        | Configures the `Access-Control-Expose-Headers` CORS header.                                             |
| `credentials`        | boolean                     | `true`                                                      | Configures the `Access-Control-Allow-Credentials` CORS header.                                          |
| `maxAge`             | number                      |                                                             | Configures the `Access-Control-Max-Age` CORS header.                                                    |
| `preflightContinue`  | boolean                     | `false`                                                     | Pass the CORS preflight response to the next handler.                                                   |
| `optionsSuccessStatus`| number                     | `204`                                                       | Provides a status code to use for successful `OPTIONS` requests, since some legacy browsers choke on `204`. |

#### `BodyParserConfig`

| Option       | Type   | Default                        | Description                                      |
| :----------- | :----- | :----------------------------- | :----------------------------------------------- |
| `json`       | object | `{ limit: '1mb' }`             | Options for `express.json()` middleware.         |
| `urlencoded` | object | `{ extended: true, limit: '1mb' }` | Options for `express.urlencoded()` middleware. |

#### `CompressionConfig`

| Option      | Type             | Default        | Description                                                        |
| :---------- | :--------------- | :------------- | :----------------------------------------------------------------- |
| `threshold` | number \| string | `'1kb'`        | Minimum response size in bytes to apply compression (e.g., `1024` or `'1kb'`). | 
| `options`   | object           | `{}`           | Other options for the `compression` middleware.                    |

---

### WebSocket Transport Configuration (`websocket`)

Controls the WebSocket transport layer.

| Option          | Type                | Default                               | Description                                                                                                                                                              |
| :-------------- | :------------------ | :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`       | boolean             | `true`                                | Enables or disables the WebSocket transport.                                                                                                                             |
| `port`          | number              | `3030`                                | Port for the WebSocket server. Can be the same as REST if sharing the HTTP server.                                                                                       |
| `host`          | string              | `'localhost'`                         | Host for the WebSocket server.                                                                                                                                           |
| `path`          | string              | `'/scorpion'`                         | Path for WebSocket connections (e.g., `/ws`, `/socket.io`).                                                                                                              |
| `cors`          | WsCorsOptions       | `{ origin: '*' }`                     | CORS configuration for the HTTP upgrade request. See `WsCorsOptions` below.                                                                                              | 
| `serverOptions` | object              | `{}`                                  | Options passed directly to the underlying WebSocket server library (e.g., `ws`). Example: `{ perMessageDeflate: false }`.                                                   |

#### `WsCorsOptions`

| Option   | Type    | Default | Description                                                                 |
| :------- | :------ | :------ | :-------------------------------------------------------------------------- |
| `origin` | string  | `'*'`   | Specifies the origin allowed for WebSocket upgrade requests.                |
| `handlePreflightRequest` | `(req, res) => void` | (internal handler) | Optional custom handler for preflight requests if needed. |

---

### Logging Configuration (`logging`)

Configures application-wide logging.

| Option        | Type              | Default                                              | Description                                                                                                                                 |
| :------------ | :---------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `level`       | string            | `'info'` (production) or `'debug'` (development)     | Minimum log level (e.g., 'trace', 'debug', 'info', 'warn', 'error', 'fatal').                                                               |
| `prettyPrint` | boolean \| object | `true` (development) or `false` (production)         | Enables or disables human-readable, colorized log output. Can be an object for `pino-pretty` options.                                       |
| `transports`  | any[]             | `[]`                                                 | Array of custom pino transports (e.g., for sending logs to external services).                                                              |
| `options`     | object            | `{}`                                                 | Additional options passed directly to the Pino logger constructor.                                                                          |

---

### Schema Validation Configuration (`validation`)

Configures data validation throughout the application.

| Option            | Type   | Default     | Description                                                                                              |
| :---------------- | :----- | :---------- | :------------------------------------------------------------------------------------------------------- |
| `defaultProvider` | string | `'zod'`     | Default schema validation library to use (e.g., 'zod', 'ajv', 'joi'). Requires corresponding plugin/adapter. |
| `providerOptions` | object | `{}`        | Options specific to the chosen validation provider.                                                      |
| `strict`          | boolean| `true`      | If `true`, enables strict validation modes (e.g., disallow unknown properties) where supported.          |

---

### Fault Tolerance Configuration (`faultTolerance`)

Configures resilience patterns for service calls. All features are disabled by default.

#### Circuit Breaker (`faultTolerance.circuitBreaker`)

| Option                   | Type    | Default | Description                                                                 |
| :----------------------- | :------ | :------ | :-------------------------------------------------------------------------- |
| `enabled`                | boolean | `false` | Enables the circuit breaker pattern.                                        |
| `timeout`                | number  | `30000` | Milliseconds before a request attempt is considered timed out.                |
| `errorThresholdPercentage`| number | `50`    | Percentage of failed requests to trip the circuit.                          |
| `resetTimeout`           | number  | `30000` | Milliseconds after which the circuit attempts to reset (half-open state).   |

#### Timeout (`faultTolerance.timeout`)

| Option        | Type    | Default | Description                                                              |
| :------------ | :------ | :------ | :----------------------------------------------------------------------- |
| `enabled`     | boolean | `false` | Enables global timeouts for service calls.                               |
| `default`     | number  | `5000`  | Default timeout in milliseconds for service calls if not overridden.     |

#### Retries (`faultTolerance.retries`)

| Option            | Type    | Default   | Description                                                                      |
| :---------------- | :------ | :-------- | :------------------------------------------------------------------------------- |
| `enabled`         | boolean | `false`   | Enables automatic retries for failed service calls.                              |
| `defaultAttempts` | number  | `3`       | Default number of retry attempts.                                                |
| `backoffStrategy` | string  | `'fixed'` | Strategy for delay between retries ('fixed', 'exponential').                     |
| `defaultDelay`    | number  | `1000`    | Default delay in milliseconds for 'fixed' strategy, or initial for 'exponential'. |

#### Bulkhead (`faultTolerance.bulkhead`)

| Option          | Type    | Default | Description                                                              |
| :-------------- | :------ | :------ | :----------------------------------------------------------------------- |
| `enabled`       | boolean | `false` | Enables the bulkhead pattern to limit concurrent calls.                  |
| `maxConcurrent` | number  | `10`    | Maximum number of concurrent executions.                                 |
| `maxQueue`      | number  | `10`    | Maximum number of requests to queue if concurrency limit is reached.     |

---

### Service Discovery Configuration (`serviceDiscovery`)

Configures how services discover each other in a distributed environment.

| Option    | Type   | Default    | Description                                                                                              |
| :-------- | :----- | :--------- | :------------------------------------------------------------------------------------------------------- |
| `enabled` | boolean| `false`    | Enables service discovery.                                                                               |
| `strategy`| string | `'static'` | Discovery strategy (e.g., 'static', 'redis', 'consul'). Requires corresponding plugin/adapter.         |
| `options` | object | `{}`       | Options specific to the chosen discovery strategy (e.g., connection details for Redis).                  |

---

### Internationalization (i18n) Configuration (`i18n`)

Configures internationalization and localization features.

| Option          | Type     | Default       | Description                                                                                             |
| :-------------- | :------- | :------------ | :------------------------------------------------------------------------------------------------------ |
| `defaultLocale` | string   | `'en'`        | The default language/locale for the application.                                                        |
| `locales`       | string[] | `['en']`      | An array of supported locales.                                                                          |
| `directory`     | string   | `'./locales'` | Path to the directory containing locale files (e.g., JSON, YAML).                                       |
| `parserOptions` | object   | `{}`          | Options for the locale file parser (e.g., if using a specific library like `i18next-fs-backend`).       |

## Example: `scorpion.config.json`

```json
{
  "env": "production",
  "rest": {
    "port": 8080,
    "host": "0.0.0.0",
    "cors": {
      "origin": "https://myapp.com"
    }
  },
  "websocket": {
    "port": 8080,
    "path": "/realtime"
  },
  "logging": {
    "level": "warn",
    "prettyPrint": false
  },
  "validation": {
    "strict": false
  },
  "faultTolerance": {
    "timeout": {
      "enabled": true,
      "default": 10000
    }
  },
  "i18n": {
    "defaultLocale": "en-US",
    "locales": ["en-US", "es-ES"],
    "directory": "./config/locales"
  }
}
```

## Accessing Configuration

You can access configuration values within your application using `app.get(path)`:

```javascript
// Get the REST port
const restPort = app.get('rest.port'); // Accesses config.rest.port

// Get the default i18n locale
const defaultLocale = app.get('i18n.defaultLocale');

// Get a nested value
const jsonBodyLimit = app.get('rest.bodyParser.json.limit');

if (app.get('faultTolerance.circuitBreaker.enabled')) {
  // Circuit breaker logic
}
```

The `app.set(path, value)` method can be used to modify configuration at runtime, though this is generally less common for initial setup.

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
