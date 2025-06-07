# Plugins & Extensions API

> Documentation for ScorpionJS v1.0.0

ScorpionJS provides a powerful plugin system that lets you extend and customize the framework with new features, integrations, and behaviors. This document covers everything you need to know about plugins and extensions in ScorpionJS.

---

## Table of Contents
1. [Introduction: Plugins vs. Extensions](#introduction-plugins-vs-extensions)
2. [Writing Your First Plugin (Quickstart)](#writing-your-first-plugin-quickstart)
3. [Using Plugins](#using-plugins)
4. [Creating Plugins](#creating-plugins)
5. [Advanced Plugin Development](#advanced-plugin-development)
6. [Service, Hook, and Transport Plugins](#service-hook-and-transport-plugins)
7. [Integration Plugins](#integration-plugins)
8. [Plugin Composition & Dependencies](#plugin-composition--dependencies)
9. [Plugin Lifecycle](#plugin-lifecycle)
10. [Best Practices](#best-practices)
11. [Publishing Plugins](#publishing-plugins)
12. [Community Plugins & Resources](#community-plugins--resources)

---

## Introduction: Plugins vs. Extensions

---

### Plugin Lifecycle Diagram

```mermaid
flowchart TD
    A[App.configure(plugin)] --> B[Plugin Registration]
    B --> C[Initialization]
    C --> D[App Extended]
    D --> E[Teardown (on app close)]
```

---

- **Plugin:** A function that takes the app instance and registers features, services, hooks, or integrations. Plugins can add, modify, or remove framework capabilities.
- **Extension:** (Optional term) Sometimes used for plugins that extend core classes or add new methods. In ScorpionJS, "plugin" and "extension" are often used interchangeably.

---

## Writing Your First Plugin (Quickstart)

```javascript
// my-logger-plugin.js
export default function myLoggerPlugin(options = {}) {
  return function(app) {
    app.logger = {
      info: msg => console.log(`[INFO] ${msg}`),
      error: msg => console.error(`[ERROR] ${msg}`)
    };
  };
}

// Usage in your app
import { createApp } from 'scorpionjs';
import myLoggerPlugin from './my-logger-plugin';

const app = createApp();
app.configure(myLoggerPlugin());
```

---

## Using Plugins

Plugins are registered with the `app.configure()` method. Order matters—configure dependencies first.

```javascript
app.configure(authentication({ secret: 'your-secret' }));
app.configure(mongodb({ url: 'mongodb://localhost:27017/myapp' }));
app.configure(swagger({ docsPath: '/docs' }));
```

---

## Creating Plugins

Plugins are functions that receive the app instance. They can:
- Register services: `app.service('name', { ... })`
- Register hooks: `app.hooks({ ... })`
- Configure transports, integrations, and more

### Example: Plugin with Setup/Teardown

```javascript
export default function monitoringPlugin(options = {}) {
  return function(app) {
    let intervalId;
    function startMonitoring() { /* ... */ }
    function stopMonitoring() { /* ... */ }
    app.on('setup', startMonitoring);
    app.on('teardown', stopMonitoring);
  };
}
```

### TypeScript Plugin Example

```typescript
import { Application, Plugin } from 'scorpionjs';

// Define plugin options interface
export interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  prefix?: string;
  timestamp?: boolean;
}

// Define the logger interface that will be attached to the app
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// Extend the Application type to include our logger
declare module 'scorpionjs' {
  interface Application {
    logger: Logger;
  }
}

// Create the plugin
export default function loggerPlugin(options: LoggerOptions = {}): Plugin {
  const {
    level = 'info',
    prefix = '',
    timestamp = true
  } = options;
  
  return function(app: Application) {
    // Create the logger
    const logger: Logger = {
      debug(message: string, ...args: any[]) {
        if (['debug'].includes(level)) {
          console.debug(`${prefix}${timestamp ? new Date().toISOString() : ''} ${message}`, ...args);
        }
      },
      info(message: string, ...args: any[]) {
        if (['debug', 'info'].includes(level)) {
          console.info(`${prefix}${timestamp ? new Date().toISOString() : ''} ${message}`, ...args);
        }
      },
      warn(message: string, ...args: any[]) {
        if (['debug', 'info', 'warn'].includes(level)) {
          console.warn(`${prefix}${timestamp ? new Date().toISOString() : ''} ${message}`, ...args);
        }
      },
      error(message: string, ...args: any[]) {
        console.error(`${prefix}${timestamp ? new Date().toISOString() : ''} ${message}`, ...args);
      }
    };
    
    // Attach the logger to the app
    app.logger = logger;
    
    // Log when the app starts
    app.on('setup', () => {
      logger.info('Application started');
    });
    
    // Log when the app stops
    app.on('teardown', () => {
      logger.info('Application stopped');
    });
  };
}
```

---

## Advanced Plugin Development

- Plugins can add configuration options ([see Configuration API](./configuration.md)).
- Plugins can register hooks ([see Hooks API](./hooks.md)).
- Plugins can expose or extend services ([see Services API](./services.md)).
- Plugins can add teardown logic for clean shutdowns.
- Plugins can expose new APIs on the app instance.

---

## Service, Hook, and Transport Plugins

- **Service Plugins:** Register reusable services (e.g., `messagesServicePlugin`).
- **Hook Plugins:** Add reusable hooks for authentication, validation, etc.
- **Transport Plugins:** Add new transports (e.g., WebSocket, universal transport).

---

## Integration Plugins

- **Database Plugins:** e.g., MongoDB, PostgreSQL, Redis
- **External API Plugins:** e.g., Stripe, SendGrid
- **Multi-runtime Plugins:** e.g., for Node.js, Deno, Cloudflare Workers

---

## Plugin Composition & Dependencies

- Compose plugins for larger features.
- Check for required plugins and fail gracefully if missing.

---

## Plugin Lifecycle

- Plugins can register initialization and teardown hooks.
- Use `app.registerInitializer()` and `app.registerTeardown()` for async setup/cleanup.

---

## Best Practices

- Validate plugin configuration.
- Handle errors gracefully and document them.
- Document plugin options and usage with JSDoc.
- Provide examples for users.

---

## Publishing Plugins

- Use a clear package structure (`src/`, `test/`, `example/`).
- Add a `README.md` and document all options and usage.
- Use `peerDependencies` for ScorpionJS.
- Publish to npm with a clear name (e.g., `scorpionjs-authentication`).

---

## Troubleshooting Plugins

### Common Plugin Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Plugin not loading | Incorrect registration order | Make sure to register dependency plugins first |
| Configuration errors | Missing or invalid options | Validate options and provide clear error messages |
| Conflicts with other plugins | Multiple plugins modifying the same functionality | Use namespaced properties and check for existing functionality |
| Memory leaks | Resources not being cleaned up | Implement proper teardown handlers |

### Debugging Plugins

```javascript
// Add debug logging to your plugin
export default function debuggablePlugin(options = {}) {
  return function(app) {
    const debug = options.debug || false;
    
    function log(...args) {
      if (debug) console.log('[debuggablePlugin]', ...args);
    }
    
    log('Plugin initialized with options:', options);
    
    // Plugin implementation
    app.on('setup', () => {
      log('App setup event triggered');
    });
  };
}

// Usage
app.configure(debuggablePlugin({ debug: true }));
```

### Plugin Performance Considerations

- Avoid expensive operations during plugin initialization
- Use lazy loading for heavy dependencies
- Consider the impact of your plugin on application startup time
- Profile your plugin under load to identify bottlenecks

---

## Community Plugins & Resources

- Check the [ScorpionJS GitHub](https://github.com/dallinbjohnson/ScorpionJS) for official and community plugins.
- Contribute your own plugin following the best practices above!

---

For more details, see the advanced examples and patterns in the [API Reference](./README.md).
