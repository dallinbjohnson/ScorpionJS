# Introduction to ScorpionJS

ScorpionJS is a powerful, flexible framework for building real-time APIs and microservices, inspired by the best features of FeathersJS, Hono, and Moleculer.

## What is ScorpionJS?

ScorpionJS is a modern, lightweight framework designed to help developers build scalable, real-time applications and APIs that can run across multiple JavaScript runtimes. It combines the real-time capabilities of FeathersJS, the multi-runtime flexibility of Hono, and the fault tolerance features of Moleculer.

## Why ScorpionJS?

- **Multi-Runtime Support**: Write once, run anywhere - Cloudflare Workers, Fastly, Deno, Bun, AWS Lambda, or Node.js
- **Real-Time First**: Built with real-time communication in mind, making it easy to create applications that update in real-time
- **Service-Oriented**: Organize your application as a collection of services that can be distributed across multiple nodes
- **Fault Tolerant**: Built-in mechanisms for handling failures gracefully
- **Developer Experience**: Clean, intuitive API that makes development a joy

## Comparison with Other Frameworks

### ScorpionJS vs FeathersJS

ScorpionJS builds upon FeathersJS's powerful service and hooks system, adding multi-runtime support and enhanced routing capabilities.

### ScorpionJS vs Hono

While Hono excels at providing a fast, flexible router for multiple runtimes, ScorpionJS extends this with a comprehensive service layer and real-time capabilities.

### ScorpionJS vs Moleculer

ScorpionJS incorporates Moleculer's fault tolerance features and service discovery, while adding a more web-focused API and multi-runtime support.

## Quick Start

```bash
npm install scorpionjs
```

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Register a service
app.service('messages', {
  async find() {
    return [{ text: 'Hello ScorpionJS!' }];
  }
});

// Start the server
app.listen(3000).then(() => {
  console.log('Server running at http://localhost:3000');
});
```

## Next Steps

- [Core Concepts](../core-concepts/README.md) - Learn about the fundamental concepts of ScorpionJS
- [Guides](../guides/README.md) - Step-by-step guides for common tasks
- [API Reference](../api/README.md) - Detailed API documentation
