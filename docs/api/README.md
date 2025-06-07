# API Reference

This section provides detailed documentation for the ScorpionJS API.

## Table of Contents

- [Application](#application)
- [Services](#services)
- [Hooks](#hooks)
- [Schema Validation](#schema-validation)
- [Transports](#transports)
- [Fault Tolerance](#fault-tolerance)
- [Service Discovery](#service-discovery)
- [Streams](#streams)
- [Client](#client)
- [Errors](#errors)

## Application

The Application is the main entry point for ScorpionJS.

### createApp(options)

Creates a new ScorpionJS application.

```javascript
import { createApp } from 'scorpionjs';

const app = createApp({
  // Configuration options
});
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `transports` | Object | Configure transport mechanisms (REST, WebSockets) |
| `circuitBreaker` | Object | Circuit breaker configuration |
| `bulkhead` | Object | Bulkhead configuration |
| `retry` | Object | Retry configuration |
| `timeout` | Object | Timeout configuration |
| `discovery` | Object | Service discovery configuration |
| `logger` | Object | Logger configuration |

### app.service(path, service)

Registers a service at the specified path.

```javascript
app.service('messages', {
  async find(params) {
    return [];
  }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | String | The path to register the service under |
| `service` | Object | The service object or class |

### app.hooks(hooks)

Registers global hooks for all services.

```javascript
app.hooks({
  before: {
    all: [
      async context => {
        // Do something before all service methods
        return context;
      }
    ]
  }
});
```

### app.listen(port)

Starts the server on the specified port.

```javascript
app.listen(3000).then(() => {
  console.log('Server running at http://localhost:3000');
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `port` | Number | The port to listen on |

### app.configure(callback)

Configures the application with the provided callback.

```javascript
app.configure(app => {
  // Configure the application
  app.service('messages', { /* ... */ });
});
```
