# Error Handling in ScorpionJS

Robust error handling is essential for building reliable applications. ScorpionJS provides flexible mechanisms for catching, propagating, and responding to errors in services, hooks, plugins, and transports.

---

## Error Propagation
- Errors thrown in services, hooks, or plugins are automatically propagated to the transport layer (REST, WebSocket, etc.).
- By default, errors are serialized and sent to the client with a status code and message.

---

## Custom Error Classes

You can define custom error classes to provide more context or structure:

```javascript
// src/errors/NotAuthenticated.js
export class NotAuthenticated extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'NotAuthenticated';
    this.code = 401;
  }
}

// Usage in a hook
import { NotAuthenticated } from '../errors/NotAuthenticated';

export default async function authenticate(context) {
  if (!context.params.user) {
    throw new NotAuthenticated();
  }
  return context;
}
```

---

## Error Hooks

You can register error hooks globally or per service to handle errors in a centralized way.

```javascript
app.hooks({
  error: {
    all: [async context => {
      // Log the error
      app.logger?.error?.(context.error);
      // Optionally modify the error or context
      if (context.error.code === 401) {
        context.error.message = 'Please log in to continue.';
      }
      return context;
    }]
  }
});
```

---

## Handling Errors in Services

- Throw errors in service methods to return an error to the client.
- Use custom error classes for clarity.

```javascript
app.service('users', {
  async get(id) {
    if (!id) throw new Error('User ID is required');
    // ...
  }
});
```

---

## Handling Errors in Plugins

- Plugins can throw errors during configuration or initialization if required options are missing.

```javascript
export default function myPlugin(options = {}) {
  return function(app) {
    if (!options.apiKey) {
      throw new Error('apiKey is required for myPlugin');
    }
    // ...
  };
}
```

---

## Error Handling in Testing

- Use `expect(...).toThrow()` or `expect(...).rejects.toThrow()` in your tests.

```javascript
it('throws on invalid input', async () => {
  await expect(app.service('users').get()).rejects.toThrow('User ID is required');
});
```

---

## Debugging and Logging

- Use `app.logger` or your own logging solution to log errors.
- Consider integrating with external error reporting tools (Sentry, LogRocket, etc.).

---

## Best Practices
- Always throw `Error` or custom error classes, not strings.
- Include a `code` property for HTTP status codes when relevant.
- Use error hooks for centralized error handling and logging.
- Never leak sensitive information in error messages.
- Document expected errors for your APIs and plugins.

---

## Further Reading
- [Hooks API](./hooks.md)
- [Testing](./testing.md)
- [Plugins & Extensions](./plugins.md)
- [Node.js Error Handling](https://nodejs.org/api/errors.html)
