# Security Best Practices in ScorpionJS

Securing your ScorpionJS application is critical for protecting user data, preventing abuse, and ensuring reliability. This guide covers essential security practices for authentication, authorization, rate limiting, secrets management, and more.

---

## Authentication & Authorization
- Use strong authentication plugins (e.g., JWT, OAuth2).
- Store passwords securely (bcrypt, argon2, scrypt).
- Use authorization hooks to restrict access by role or permission.

```javascript
app.service('messages').hooks({
  before: {
    create: [app.hooks.authenticate, app.hooks.authorize('admin')]
  }
});
```

See: [Plugins & Extensions](./plugins.md), [Hooks API](./hooks.md)

---

## Rate Limiting & Brute-force Protection
- Implement rate limiting on authentication and sensitive endpoints.
- Use plugins like `express-rate-limit` or custom middleware.

```javascript
import rateLimit from 'express-rate-limit';
app.configure(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

---

## Secrets Management
- Store secrets (API keys, JWT secrets, DB passwords) in environment variables.
- Never commit secrets to version control.
- Use `.env` files for local development and a secrets manager in production.

```env
# .env
JWT_SECRET=supersecret
DB_PASSWORD=strongpassword
```

See: [Configuration API](./configuration.md)

---

## Input Validation & Sanitization
- Always validate and sanitize user input to prevent injection attacks.
- Use schema validation hooks and plugins.

```javascript
app.service('users').hooks({
  before: {
    create: [app.hooks.validateData(userSchema), app.hooks.sanitizeData(['admin'])]
  }
});
```

See: [Schema Validation API](./schema-validation.md), [Hooks API](./hooks.md)

---

## Transport Security
- Always use HTTPS in production.
- Set appropriate CORS policies.

```javascript
app.configure(cors({
  origin: 'https://yourdomain.com',
  methods: ['GET', 'POST'],
  credentials: true
}));
```

- Use secure cookies for authentication tokens.

---

## Production Deployment Recommendations
- Run your app with least-privilege permissions.
- Keep dependencies up to date.
- Enable logging and monitoring for suspicious activity.
- Regularly audit your code and dependencies for vulnerabilities.
- Use a web application firewall (WAF) if possible.

---

## Further Reading
- [Configuration API](./configuration.md)
- [Plugins & Extensions](./plugins.md)
- [Error Handling](./error-handling.md)
- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
