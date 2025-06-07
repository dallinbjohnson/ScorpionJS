# Plugins API - Part 1: Introduction and Basics

ScorpionJS provides a powerful plugin system that allows you to extend the framework with additional functionality. This document provides detailed API documentation for creating and using plugins in ScorpionJS.

## Introduction to Plugins

Plugins in ScorpionJS are modular pieces of code that can extend the core functionality of the framework. They can add new features, modify existing behavior, or integrate with external systems. The plugin system is based on the concept of "configure functions" that can be registered with the application.

## Basic Plugin Usage

### Using Plugins

```javascript
import { createApp } from 'scorpionjs';
import authentication from 'scorpionjs-authentication';
import mongodb from 'scorpionjs-mongodb';
import swagger from 'scorpionjs-swagger';

const app = createApp();

// Use plugins
app.configure(authentication({
  secret: 'your-secret-key'
}));

app.configure(mongodb({
  url: 'mongodb://localhost:27017/myapp'
}));

app.configure(swagger({
  docsPath: '/docs',
  uiPath: '/docs-ui'
}));

// Start the server
app.listen(3000);
```

### Plugin Order

The order in which plugins are configured can be important:

```javascript
// Correct order: database before services
app.configure(mongodb({ url: 'mongodb://localhost:27017/myapp' }));
app.configure(services());

// Correct order: authentication before protected services
app.configure(authentication({ secret: 'your-secret-key' }));
app.configure(protectedServices());
```

## Creating Basic Plugins

### Simple Plugin

```javascript
// logger-plugin.js
export default function loggerPlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      level: 'info',
      ...options
    };
    
    // Add logger to the app
    app.logger = {
      info: (message) => console.log(`[INFO] ${message}`),
      error: (message) => console.error(`[ERROR] ${message}`),
      debug: (message) => opts.level === 'debug' ? console.log(`[DEBUG] ${message}`) : null
    };
    
    // Log when the app starts
    app.hooks({
      setup: {
        after: [
          () => app.logger.info('Application started')
        ]
      }
    });
  };
}

// Usage
import loggerPlugin from './logger-plugin';

app.configure(loggerPlugin({
  level: 'debug'
}));
```

### Plugin with Setup and Teardown

```javascript
// monitoring-plugin.js
export default function monitoringPlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      interval: 60000, // 1 minute
      ...options
    };
    
    let intervalId;
    
    // Setup function
    function startMonitoring() {
      app.logger.info('Starting monitoring');
      
      intervalId = setInterval(() => {
        const stats = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        };
        
        app.emit('monitoring.stats', stats);
      }, opts.interval);
    }
    
    // Teardown function
    function stopMonitoring() {
      app.logger.info('Stopping monitoring');
      
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
    
    // Register setup and teardown
    app.on('setup', startMonitoring);
    app.on('teardown', stopMonitoring);
    
    // Add monitoring API
    app.monitoring = {
      getStats: () => ({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      })
    };
  };
}

// Usage
import monitoringPlugin from './monitoring-plugin';

app.configure(monitoringPlugin({
  interval: 30000 // 30 seconds
}));
```

## Plugin Configuration

### Configuration Options

```javascript
// cache-plugin.js
export default function cachePlugin(options = {}) {
  return function(app) {
    // Default options with deep merge
    const opts = {
      adapter: 'memory',
      ttl: 60, // 1 minute
      max: 1000,
      ...options,
      // Deep merge for nested options
      adapterOptions: {
        host: 'localhost',
        port: 6379,
        ...(options.adapterOptions || {})
      }
    };
    
    // Create cache instance based on adapter
    let cache;
    
    switch (opts.adapter) {
      case 'redis':
        cache = createRedisCache(opts.adapterOptions);
        break;
      case 'memory':
      default:
        cache = createMemoryCache(opts.max);
        break;
    }
    
    // Add cache to the app
    app.cache = {
      async get(key) {
        return cache.get(key);
      },
      async set(key, value, ttl = opts.ttl) {
        return cache.set(key, value, ttl);
      },
      async del(key) {
        return cache.del(key);
      },
      async clear() {
        return cache.clear();
      }
    };
  };
}
```

### Environment-specific Configuration

```javascript
// Configure plugin based on environment
const env = process.env.NODE_ENV || 'development';

app.configure(cachePlugin({
  adapter: env === 'production' ? 'redis' : 'memory',
  ttl: env === 'production' ? 300 : 60,
  adapterOptions: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
}));
```
