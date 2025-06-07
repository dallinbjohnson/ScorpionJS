# Testing ScorpionJS Applications

> Documentation for ScorpionJS v1.0.0

Testing is essential for building robust, maintainable applications with ScorpionJS. This guide covers best practices, patterns, and example setups for testing services, hooks, plugins, and integrations.

---

## Table of Contents
- [Recommended Test Libraries](#recommended-test-libraries)
- [Example Project Structure](#example-project-structure)
- [Testing Services](#testing-services)
- [Testing Hooks](#testing-hooks)
- [Mocking and Stubbing](#mocking-and-stubbing)
- [Testing Plugins](#testing-plugins)
- [Testing with TypeScript](#testing-with-typescript)
- [Integration Testing](#integration-testing)
- [Performance Testing](#performance-testing)
- [Troubleshooting Tests](#troubleshooting-tests)
- [Coverage and Best Practices](#coverage-and-best-practices)
- [Further Reading](#further-reading)

---

## Recommended Test Libraries
- [Jest](https://jestjs.io/) (most popular)
- [Vitest](https://vitest.dev/) (fast, ESM-first)
- [Mocha](https://mochajs.org/) (classic, flexible)
- [uvu](https://github.com/lukeed/uvu) (ultra-fast, minimal)

---

## Example Project Structure

```
my-app/
├── src/
│   ├── app.js
│   └── services/
├── test/
│   ├── app.test.js
│   └── services.test.js
└── package.json
```

---

## Testing Services

```javascript
// test/services.test.js
import { createApp } from 'scorpionjs';
import messagesService from '../src/services/messages';

describe('Messages Service', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    app.service('messages', messagesService());
  });

  it('creates a message', async () => {
    const result = await app.service('messages').create({ text: 'Hello' });
    expect(result).toHaveProperty('id');
    expect(result.text).toBe('Hello');
  });

  it('finds messages', async () => {
    await app.service('messages').create({ text: 'Test' });
    const results = await app.service('messages').find();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## Testing Hooks

```javascript
// test/hooks.test.js
import { createApp } from 'scorpionjs';
import authenticate from '../src/hooks/authenticate';

describe('Authenticate Hook', () => {
  it('throws if not authenticated', async () => {
    const context = { params: {} };
    await expect(authenticate(context)).rejects.toThrow('Authentication required');
  });

  it('passes with valid token', async () => {
    const context = { params: { headers: { authorization: 'Bearer valid' } } };
    // Mock token verification in your hook for testing
    await expect(authenticate(context)).resolves.toBeDefined();
  });
});
```

---

## Mocking and Stubbing

- Use libraries like [sinon](https://sinonjs.org/) or [jest.fn()](https://jestjs.io/docs/mock-functions) for mocking.
- Mock external services, databases, and transport layers.
- Example:

```javascript
const mockDb = { find: jest.fn().mockResolvedValue([]) };
app.service('users', {
  async find() { return mockDb.find(); }
});
```

---

## Testing Plugins

- Plugins can be tested by creating a fresh app instance and applying the plugin.
- Test plugin side effects (e.g., new methods, service registration).

```javascript
describe('Logger Plugin', () => {
  it('adds logger to app', () => {
    const app = createApp();
    app.configure(loggerPlugin());
    expect(app.logger).toBeDefined();
    expect(typeof app.logger.info).toBe('function');
  });
});
```

---

## Testing with TypeScript

ScorpionJS works seamlessly with TypeScript for type-safe testing.

```typescript
// test/services.test.ts
import { createApp, Service, ServiceParams } from 'scorpionjs';
import { User, UserService } from '../src/services/users';

describe('User Service', () => {
  let app: any;
  let service: Service<User>;

  beforeEach(() => {
    app = createApp();
    app.service('users', new UserService());
    service = app.service('users');
  });

  it('creates a user with proper typing', async () => {
    const params: ServiceParams = { 
      provider: 'rest',
      user: { id: '1', role: 'admin' }
    };
    
    const user: User = await service.create({
      email: 'test@example.com',
      password: 'secret',
      name: 'Test User'
    }, params);
    
    expect(user).toHaveProperty('id');
    expect(user.email).toBe('test@example.com');
  });
});
```

## Integration Testing

Integration tests verify that different parts of your application work together correctly.

```javascript
describe('Authentication Flow', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = createApp();
    // Configure all services and plugins
    app.configure(services);
    app.configure(authentication);
    
    // Start the server
    server = await app.listen(3030);
  });

  afterAll(async () => {
    await server.close();
  });

  it('registers and authenticates a user', async () => {
    // Register a new user
    const user = await app.service('users').create({
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Authenticate the user
    const auth = await app.service('authentication').create({
      strategy: 'local',
      email: 'test@example.com',
      password: 'password123'
    });
    
    expect(auth).toHaveProperty('accessToken');
    expect(auth.user.id).toBe(user.id);
  });
});
```

## Performance Testing

Test your services under load to ensure they perform well at scale.

```javascript
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('handles multiple concurrent requests', async () => {
    const start = performance.now();
    
    // Create 100 concurrent requests
    const requests = Array(100).fill().map(() => 
      app.service('messages').find({ query: { $limit: 10 } })
    );
    
    await Promise.all(requests);
    const end = performance.now();
    
    console.log(`Processed 100 requests in ${end - start}ms`);
    expect(end - start).toBeLessThan(2000); // Should complete in under 2 seconds
  });
});
```

## Troubleshooting Tests

### Common Test Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Tests timeout | Async operations not resolving | Check for unresolved promises or missing `await` keywords |
| Intermittent failures | Race conditions or test isolation issues | Use `beforeEach` to reset state and avoid shared state |
| Memory leaks | Resources not being cleaned up | Ensure all connections are closed in `afterEach`/`afterAll` |

### Debugging Tests

```javascript
// Add this to your test to debug
it('debug a specific test', async () => {
  debugger; // Will pause execution if DevTools is open
  const result = await app.service('users').get('1');
  console.log(JSON.stringify(result, null, 2)); // Pretty print the result
});
```

Run tests in debug mode:
```bash
# For Jest
node --inspect-brk node_modules/.bin/jest --runInBand

# For Vitest
node --inspect-brk node_modules/.bin/vitest run
```

## Coverage and Best Practices
- Aim for high coverage on services, hooks, and plugins.
- Test both success and error cases.
- Use `beforeEach`/`afterEach` to isolate state.
- Group tests by feature or module.
- Use descriptive test names.
- Set up CI/CD pipelines to run tests automatically.
- Use snapshot testing for stable UI components.

---

## Further Reading
- [Hooks API](./hooks.md)
- [Plugins & Extensions](./plugins.md)
- [Error Handling](./error-handling.md)
- [Fault Tolerance](./fault-tolerance.md)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
