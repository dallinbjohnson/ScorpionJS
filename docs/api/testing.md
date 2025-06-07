# Testing ScorpionJS Applications

Testing is essential for building robust, maintainable applications with ScorpionJS. This guide covers best practices, patterns, and example setups for testing services, hooks, plugins, and integrations.

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

## Coverage and Best Practices
- Aim for high coverage on services, hooks, and plugins.
- Test both success and error cases.
- Use `beforeEach`/`afterEach` to isolate state.
- Group tests by feature or module.
- Use descriptive test names.

---

## Further Reading
- [Hooks API](./hooks.md)
- [Plugins & Extensions](./plugins.md)
- [Error Handling](./error-handling.md)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
