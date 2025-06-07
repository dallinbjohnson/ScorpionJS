# Deployment Guide for ScorpionJS

This guide covers best practices and strategies for deploying ScorpionJS applications across Node.js, Deno, Cloudflare Workers, Bun, and serverless platforms. It also includes environment management, CI/CD, and production tips.

---

## Deployment Targets

### Node.js
- Use a process manager (e.g., PM2, systemd, Docker) for reliability.
- Example start script:

```json
// package.json
"scripts": {
  "start": "node src/app.js"
}
```

### Deno
- Use the `deno run` command with appropriate permissions.
- Example:

```sh
deno run --allow-net --allow-env src/app.ts
```

### Cloudflare Workers
- Use the official Wrangler CLI for deployment.
- Example config:

```toml
# wrangler.toml
name = "scorpionjs-app"
type = "javascript"
account_id = "..."
workers_dev = true
route = ""
zone_id = ""
```

### Bun
- Use the `bun` CLI for fast startup:

```sh
bun run src/app.js
```

### Serverless (AWS Lambda, Vercel, Netlify)
- Use a serverless adapter plugin or export a handler compatible with the platform.
- Example for AWS Lambda:

```javascript
exports.handler = async (event, context) => {
  // ...
};
```

---

## Environment Management
- Use `.env` files for local development.
- Use environment variables for secrets and config in production.
- Example:

```env
NODE_ENV=production
PORT=8080
JWT_SECRET=supersecret
```

See: [Configuration API](./configuration.md), [Security](./security.md)

---

## CI/CD Recommendations
- Use GitHub Actions, GitLab CI, or similar for automated testing and deployment.
- Example GitHub Actions workflow:

```yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run build
      # Add deployment step here
```

---

## Production Readiness Checklist
- [ ] Use HTTPS and secure headers
- [ ] Set up logging and monitoring
- [ ] Enable rate limiting and security plugins
- [ ] Audit dependencies for vulnerabilities
- [ ] Configure environment variables securely
- [ ] Enable automatic restarts (PM2, Docker, etc.)
- [ ] Test error handling and fallback logic

---

## Further Reading
- [Configuration API](./configuration.md)
- [Security](./security.md)
- [Error Handling](./error-handling.md)
- [Migration Guide](./migration.md)
