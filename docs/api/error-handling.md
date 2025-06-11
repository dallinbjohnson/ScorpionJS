# Error Handling in ScorpionJS

> Documentation for ScorpionJS v1.0.0

Robust error handling is essential for building reliable applications. ScorpionJS provides flexible mechanisms for catching, propagating, and responding to errors in services, hooks, plugins, and transports.

---

## Table of Contents
- [Error Propagation](#error-propagation)
- [Custom Error Classes](#custom-error-classes)
- [Error Hooks](#error-hooks)
- [Handling Errors in Services](#handling-errors-in-services)
- [Handling Errors in Plugins](#handling-errors-in-plugins)
- [Error Handling in Testing](#error-handling-in-testing)
- [Debugging and Logging](#debugging-and-logging)
- [Troubleshooting Common Errors](#troubleshooting-common-errors)
- [Best Practices](#best-practices)
- [Further Reading](#further-reading)

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

### TypeScript Support

With TypeScript, you can create more robust error classes:

```typescript
// src/errors/AppError.ts
export interface ErrorDetails {
  code: number;
  data?: Record<string, any>;
}

export class AppError extends Error {
  code: number;
  data?: Record<string, any>;

  constructor(message: string, details: ErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.code = details.code;
    this.data = details.data;
    
    // Maintains proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', data?: Record<string, any>) {
    super(message, { code: 400, data });
  }
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
app.use('users', {
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

## Troubleshooting Common Errors

### Authentication Errors

| Error | Possible Cause | Solution |
|-------|---------------|----------|
| `NotAuthenticated` | Missing or invalid JWT token | Check that you're including the token in the Authorization header |
| `Forbidden` | User doesn't have required permissions | Verify user roles and permissions |

### Database Errors

| Error | Possible Cause | Solution |
|-------|---------------|----------|
| `ConnectionError` | Database connection failed | Check database credentials and network connectivity |
| `DuplicateKey` | Unique constraint violation | Ensure the data doesn't conflict with existing records |

### Transport Errors

| Error | Possible Cause | Solution |
|-------|---------------|----------|
| `SocketTimeout` | WebSocket connection timed out | Check network stability and increase timeout settings |
| `InvalidRequest` | Malformed request data | Validate request format before sending |

### Performance Considerations

When handling errors at scale:

- Use error sampling for high-volume errors
- Consider using a centralized error tracking service
- Implement circuit breakers for failing dependencies (see [Fault Tolerance](./fault-tolerance.md))

## Further Reading
- [Hooks API](./hooks.md)
- [Testing](./testing.md)
- [Plugins & Extensions](./plugins.md)
- [Fault Tolerance](./fault-tolerance.md)
- [Node.js Error Handling](https://nodejs.org/api/errors.html)
- [Error Handling in Async/Await](https://javascript.info/async-await#error-handling)
