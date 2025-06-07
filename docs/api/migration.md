# Migration Guide to ScorpionJS

This guide helps you migrate your applications from FeathersJS, Hono, or Moleculer to ScorpionJS. It highlights key differences, provides migration strategies, and offers practical code examples.

---

## Overview: Key Differences & Similarities

| Feature                | ScorpionJS         | FeathersJS       | Hono           | Moleculer      |
|------------------------|--------------------|------------------|----------------|---------------|
| Services               | Yes                | Yes              | No             | Yes           |
| Hooks                  | Yes (global/pattern/service) | Yes      | Yes (middleware) | Yes (middlewares) |
| Transports             | REST, WebSocket, custom, multi-runtime | REST, WebSocket | HTTP, custom  | REST, NATS, MQTT, custom |
| Schema Validation      | JSON Schema, TypeBox, custom | Yup, AJV | Zod, custom    | Validator, custom |
| Fault Tolerance        | Circuit breaker, retry, bulkhead, fallback | No | No | Yes           |
| Service Discovery      | Yes (multiple backends) | No | No | Yes           |
| Events                 | Distributed, client, custom | Yes | No | Yes           |
| Plugins/Extensions     | Yes                | Yes              | Yes            | Yes           |
| Multi-runtime Support  | Node, Deno, Bun, Cloudflare, Lambda | Node | Deno, Bun, Cloudflare | Node         |

---

## Migrating from FeathersJS

### Services
**FeathersJS:**
```javascript
app.use('/messages', {
  async find() { /* ... */ },
  async create(data) { /* ... */ }
});
```
**ScorpionJS:**
```javascript
app.service('messages', {
  async find(params) { /* ... */ },
  async create(data, params) { /* ... */ }
});
```

### Hooks
- ScorpionJS hooks are similar but support global, service, and pattern-based hooks.
- Register hooks using `app.hooks()` or `service.hooks()`.

### Events
- ScorpionJS supports distributed and client events out of the box.

### Authentication
- Use ScorpionJS plugins for JWT, OAuth2, etc.

---

## Migrating from Hono

### Middleware
- Hono uses middleware for request/response processing.
- ScorpionJS uses hooks (before, after, error) for service methods.

**Hono:**
```javascript
app.use('*', logger());
```
**ScorpionJS:**
```javascript
app.hooks({
  before: {
    all: [loggerHook]
  }
});
```

### Routing
- Hono is routing-centric; ScorpionJS is service-centric but supports custom routes via plugins.

---

## Migrating from Moleculer

### Services
- Moleculer services map closely to ScorpionJS services.
- ScorpionJS supports Moleculer-style fault tolerance and service discovery.

**Moleculer:**
```javascript
broker.createService({
  name: 'users',
  actions: {
    find(ctx) { /* ... */ },
    create(ctx) { /* ... */ }
  }
});
```
**ScorpionJS:**
```javascript
app.service('users', {
  async find(params) { /* ... */ },
  async create(data, params) { /* ... */ }
});
```

### Fault Tolerance
- ScorpionJS has built-in support for circuit breakers, retries, and bulkheads.

---

## Common Migration Tips
- Use plugins to replicate or extend missing features.
- Refactor middleware to hooks or plugins.
- Use schema validation for all user input.
- Test thoroughly after migration.

---

## Further Reading
- [Services API](./services.md)
- [Hooks API](./hooks.md)
- [Plugins & Extensions](./plugins.md)
- [Configuration API](./configuration.md)
- [Deployment Guide](./deployment.md)
