# ScorpionJS Development Roadmap

This document outlines the step-by-step plan for developing the ScorpionJS framework.

## Developer Perspective from Docs:
A developer using ScorpionJS would expect:
*   **Simplicity and Power:** An easy way to create services (e.g., using `app.use()` to register them) that are instantly available via multiple transports (REST, WebSockets).
*   **Flexibility through Hooks:** Granular control over request/response lifecycle using a comprehensive hook system (before, after, error, around, interceptor).
*   **Scalability:** Features like service discovery for building distributed systems.
*   **Performance:** Options to use Wasm for CPU-intensive tasks.
*   **Security:** Tools for sandboxing untrusted code.
*   **Modern JavaScript:** Support for async/await, modern module syntax.
*   **Multi-Runtime:** Write code once and deploy it across various JavaScript environments.
*   **Real-time Capabilities:** Built-in support for real-time updates via WebSockets.
*   **Streaming:** Efficient handling of large datasets or files over REST and WebSockets.

## Development Plan

- [x] **Phase 1: Core Framework & Service Layer**

    - [x] **1. Project Setup & Core Definitions:**
        *   [x] Set up the project with TypeScript (recommended for a framework for type safety) or JavaScript, including a build process, linter, and testing framework.
        *   [x] Define core interfaces and types: `ScorpionApp`, `Service`, `HookContext`, `HookFunction`, `AroundHookFunction`, `NextFunction`, `PluginFunction`.
        *   [x] Implement the basic `createApp(options)` function.
        *   [x] Implement basic plugin system (`app.configure(pluginFunction)`).

    - [x] **2. Basic Configuration System:**
        *   [x] Implement loading of configuration (e.g., from `createApp` options, environment variables, files).
        *   [x] Support for default and environment-specific configurations.
        *   [x] Mechanism for services/plugins to access configuration.

    - [x] **3. Dynamic Service Registration, Unregistration, and Invocation:**
        *   [x] Implement `app.use('serviceName', serviceInstance, serviceOptions)` for adding/registering services.
        *   [x] Implement `app.unuse('serviceName')` to remove a service and its associated resources (routes, hooks, event listeners).
        *   [x] Develop a dynamic internal mechanism to dispatch calls to service methods, capable of handling runtime service changes.
        *   [x] Implement event emission for both standard and custom service methods.
        *   [x] Allow per-service configuration via `serviceOptions`.

    - [x] **4. Runtime Abstraction Layer (Initial - HTTP):**
        *   [x] Design a lightweight adapter interface for HTTP requests/responses.
        *   [x] Implement an initial adapter for Node.js.
        *   [x] Implement `app.listen(port)`.

    - [x] **5. Core Hooks Engine:**
        *   [x] Implement the `runHooks` internal function.
        *   [x] Support `before`, `after`, and `error` hooks with correct LIFO/FIFO ordering.
        *   [x] Implement `around` hooks with the `(context, next)` signature.
        *   [x] Provide `app.hooks({...})` (global) and `service.hooks({...})` (service-specific).
        *   [x] *Design consideration: Ensure the engine is extensible for future Interceptor hooks and pattern-based hooks, and that internal hook management supports dynamic association/disassociation of hooks with services.*

    - [x] **6. Initial `HookContext` Design:**
        *   [x] Define the structure of `HookContext` (`app`, `service`, `method`, `type`, `path`, `params`, `data`, `result`, `error`, `config`, etc.).

    - [x] **7. Schema Definition & Basic Validation Utilities:**
        *   [x] Establish conventions for defining service data/query schemas (e.g., JSON Schema).
        *   [x] Implement basic validation hook utilities (e.g., `validateData(schema)`, `validateQuery(schema)`), ensuring they are highly configurable.
        *   [x] Mechanism for services to register their schemas for tooling/metadata.
        *   [x] *Support for dynamic schema selection based on context (e.g., request headers, user roles).*
        *   [x] *Support for dynamic schema selection based on a specific field within the request data (e.g., a `type` field determining the rest of the schema).*
        *   [x] *Deep integration with service registration for automatic schema exposure and validation during transport mapping.*
        *   [x] Support for per-service validators to allow different validation libraries (Ajv, Zod, TypeBox) for different services.

- [ ] **Phase 2: Transports, Logging & Advanced Hooks**

    - [ ] **8. REST Transport Implementation:**
        *   Integrate the HTTP runtime adapter.
        *   [x] Map standard and custom service methods to RESTful routes.
        *   Implement request processing (body parsing, query params) and response handling.
        *   [x] Integrate schema validation hooks for request data/query.
        *   Add REST transport configuration (port, host, CORS, body parser options, compression).
        *   [x] *Ensure transport can dynamically add/remove routes when services are registered/unregistered.*
        *   *Advanced routing capabilities: support for nested routes, path parameter constraints, route specificity, and conflict resolution strategies.*

    - [x] **9. Event System Core Implementation:**
        *   [x] Implement core EventEmitter-based event system for services.
        *   [x] Support for standard service events (`created`, `updated`, `patched`, `removed`).
        *   [x] Support for custom events with service.emit().
        *   [x] Support automatic event emission for all service methods with consistent naming conventions.
        *   [x] Support manual custom event emission from within service methods.
        *   [x] Implement event listener registration (service.on()) and cleanup.
        *   [x] Ensure proper event listener cleanup during service unregistration.
        *   [x] Support for event context with additional information.
        *   [x] Automatic event emission for standard and custom methods in executeServiceCall.

    - [ ] **10. WebSocket Transport & Real-time Communication:**
        *   Integrate a cross-runtime WebSocket solution (e.g., `crossws`).
        *   Implement WebSocket transport for service method calls.
        *   [ ] Implement real-time event broadcasting to WebSocket clients.
        *   Add WebSocket transport configuration (port, host, CORS, authentication).
        *   *Ensure transport can dynamically add/remove event listeners when services are registered/unregistered.*
        *   *Support for message routing, event filtering, and client-specific event channels.*
        *   Implement client-side event subscription.
        *   *Advanced message routing: pattern-based event handlers, namespace support for targeted communication.*

    - [ ] **11. Comprehensive Logging System:**
        *   Implement a configurable logger (levels: trace, debug, info, warn, error, fatal).
        *   Support for structured logging (JSON), pretty printing, timestamps, colors.
        *   Allow log output to console and files.
        *   Implement log redaction and custom serializers.
        *   Integrate logger into `HookContext` and core framework.

    - [x] **11. Advanced Hook Features:**
        *   [x] Implement pattern-based hooks (e.g., `app.hooks('/api/secure/*', {...})`).
        *   [x] Implement Interceptor Hooks (`app.interceptorHooks({...})`) and integrate into the `runHooks` execution flow as per documentation (global, service, interceptor layers).

    - [ ] **12. Streaming Support:**
        *   Enhance `HookContext` for streaming (`context.stream`, `context.isStream`).
        *   Implement NDJSON and file streaming for REST transport (request and response).
        *   Design and implement streaming for WebSocket transport (binary, text, object streams).
        *   Allow services to return and accept streams.

- [ ] **Phase 3: Distributed Features, Authentication & Extensibility**

    - [ ] **13. Service Discovery Core:**
        *   Define a `DiscoveryStrategy` interface.
        *   Implement `LocalDiscovery` (for single-node deployments).
        *   Modify service calling mechanism to use the discovery strategy.
        *   Implement basic node and service registration/deregistration events for discovery.

    - [ ] **14. Additional Service Discovery Strategies:**
        *   Implement `RedisDiscovery` strategy (using a Redis backend).
        *   Allow custom discovery strategies to be plugged in.
        *   Implement heartbeat mechanisms and offline node detection.

    - [ ] **15. Authentication Framework:**
        *   Define core authentication concepts (`AuthenticationService`, strategies).
        *   Implement JWT authentication strategy (generation, verification).
        *   Implement Local (username/password) authentication strategy.
        *   Provide `app.authenticate(strategy, options)` method.
        *   Integrate authentication into `HookContext` (`context.params.user`, `context.params.authenticated`).
        *   Develop hooks for protecting services/methods (e.g., `authenticate('jwt')`).
        *   Configuration for authentication (secret, JWT options, service paths).

    - [ ] **16. Advanced Event System:**
        *   Implement Event Channels for targeted real-time communication (e.g., `app.channel('authenticated').join(...)`, `service.publish(...)`).
        *   Develop a distributed event bus adapter (e.g., using Redis pub/sub) to propagate events across nodes.
        *   *Event system should handle dynamic registration/unregistration of service event listeners and channel associations.*

    - [ ] **17. Wasm Integration Utilities:**
        *   Develop `loadWasmModule` utility.
        *   Provide guidance/helpers for data marshalling between JS and Wasm.
        *   Support service `setup` method for Wasm module loading and initialization.

    - [ ] **18. Code Sandboxing:**
        *   Integrate an isolate-based library (e.g., `isolated-vm` or a multi-runtime compatible alternative like `near-membrane`).
        *   Create a `Sandbox` API for executing untrusted code.
        *   Implement resource limiting (CPU, memory) and secure inter-context communication.

    - [ ] **19. Job Queues & Task Scheduling:**
        *   Define a `JobQueueAdapter` interface and core job processing logic.
        *   Implement adapters for popular queueing systems (e.g., BullMQ, Agenda.js; consider RabbitMQ, Kafka for advanced scenarios).
        *   Features: job definition, persistent jobs, delayed jobs, cron-like scheduling, automatic retries with backoff, concurrency control.
        *   Support for job progress tracking and events.
        *   Ensure user context (authentication, locale) can be propagated to job handlers.
        *   (Optional) Basic Admin UI integration for job monitoring and management.

- [ ] **Phase 4: Polish, Ecosystem & Multi-Runtime Expansion**

    - [x] **20. Fault Tolerance Primitives & Advanced Error Handling:**
            *   [x] Implement robust error handling with a hierarchy of custom error classes (`ScorpionError`, `NotAuthenticated`, `Forbidden`, `NotFound`, `BadRequest`, `ServiceUnavailable`, etc.).
        *   Implement and integrate core fault tolerance patterns:
            *   Retries (with configurable strategies like exponential backoff).
            *   Timeouts (for service calls and operations).
            *   Circuit Breakers (to prevent cascading failures).
            *   Bulkhead (to isolate resources per service/operation).
            *   Fallbacks (to provide alternative responses during failures).
        *   Allow global and per-service/method configuration for all fault tolerance patterns.
        *   Implement event hooks for fault tolerance state changes (e.g., circuit open/closed, retry attempts).
        *   Develop centralized error handling mechanisms, including error propagation strategies across transports and services.
        *   Provide guidance on plugin-specific error handling and best practices for debugging.

    - [ ] **20. Caching Framework:**
        *   Define a caching abstraction layer and `CacheAdapter` interface.
        *   Implement `MemoryCacheAdapter`.
        *   Implement `RedisCacheAdapter`.
        *   Provide utilities/hooks for service method response caching.
        *   Configuration for caching (TTL, max items, adapter options).

    - [ ] **21. Observability Features:**
        *   Metrics: Implement core metrics collection (request counts, latency, error rates).
        *   Metrics: Provide Prometheus exporter/integration.
        *   Distributed Tracing: Integrate OpenTelemetry for automatic and manual span creation.
        *   Ensure trace context propagation across services and transports.

    - [ ] **23. SSR & SSG Support:**
        *   Provide utilities and integration patterns for Server-Side Rendering (SSR) and Static Site Generation (SSG).
        *   Support for popular frontend frameworks (e.g., React, Vue, Svelte) via adapters or examples.
        *   Mechanisms for data hydration and state transfer.
        *   Integration with ScorpionJS routing and services for data fetching.
        *   Guidance on performance optimizations for rendered pages.

    - [ ] **24. Database & ORM Integration:**
        *   Maintain a data-agnostic core, providing official adapters and integration patterns for popular ORMs and databases.
        *   Supported ORMs: Prisma, TypeORM, Sequelize, Mongoose, Knex.js.
        *   Supported Databases: PostgreSQL, MySQL, SQLite, MongoDB, Redis (as a data store).
        *   Guidance on transaction management, schema migrations, and connection pooling within ScorpionJS services.
        *   Examples of using ORM features like relations, validation, and hooks within service logic.

    - [ ] **25. Admin Dashboard Plugin (`scorpionjs-admin`):**
        *   Develop an extensible admin dashboard plugin.
        *   Features:
            *   Service listing and management (view schemas, methods, invoke methods for debugging).
            *   Real-time monitoring (metrics display, event logs).
            *   User management (if authentication is integrated).
            *   Configuration management interface.
            *   Plugin architecture for adding custom admin panels/widgets.

    - [ ] **26. Internationalization (i18n) Support:**
        *   Implement core i18n capabilities.
        *   Locale detection (from headers, query params, user preferences).
        *   Translation string management (e.g., using JSON files, ICU message format).
        *   Pluralization and number/date/currency formatting based on locale.
        *   Integration with templating engines for SSR/SSG.
        *   Localization of error messages and validation feedback.
        *   Hooks/utilities for services to access and use i18n features.

    - [ ] **27. Security Hardening & Best Practices:**
        *   (Extends Item 15 - Authentication Framework in Phase 3)
        *   Implement rate limiting mechanisms (global, per-service, per-IP/user).
        *   Provide clear guidance and tools for secrets management (API keys, database credentials).
        *   Enhance input validation with sanitization options and best practices.
        *   Recommendations for Transport Layer Security (TLS/SSL) configuration.
        *   Security checklists for production deployments (e.g., disabling debug modes, secure HTTP headers).
        *   Regular review and alignment with OWASP guidelines and common web vulnerabilities.

    - [ ] **22. GraphQL Transport/Plugin:**
        *   Develop a `scorpionjs-graphql` plugin.
        *   Support automatic schema generation from services and their registered schemas.
        *   Allow custom resolvers that can call service methods.
        *   Implement GraphQL Subscriptions over WebSockets using the event system.

    - [ ] **23. Multi-Runtime Support Expansion & Testing:**
        *   Develop and thoroughly test runtime adapters for Deno, Bun, Cloudflare Workers, etc.
        *   Ensure core features, transports, and key plugins work consistently across all supported runtimes.

    - [ ] **24. JavaScript Client Library (`scorpionjs-client`):**
        *   Develop a client library for browser and Node.js.
        *   Support for REST and WebSocket transports.
        *   API for calling service methods and custom methods.
        *   Real-time event handling (`service.on('event', ...)`).
        *   Client-side authentication (`client.authenticate(...)`).

    - [ ] **25. CLI Tool (`scorpionjs-cli`):**
        *   Develop CLI for project scaffolding (TypeScript/JavaScript options).
        *   Commands for generating services, hooks, plugins, schemas.
        *   (Optional) Application management commands (start, stop, inspect).

    - [ ] **26. Comprehensive Documentation & Examples:**
        *   Write detailed guides, API references for all features and plugins.
        *   Create example applications showcasing different use cases and integrations.
        *   Ensure documentation covers multi-runtime specifics.

    - [ ] **27. Rigorous Testing:**
        *   Extensive unit tests for all core components and utilities.
        *   Integration tests for services, hooks, transports, and plugins.
        *   End-to-end tests for common application scenarios.
        *   Performance and benchmark tests.
        *   *Guidance on recommended testing libraries and tools (e.g., Jest, Vitest, Playwright for E2E).*
        *   *Detailed strategies for unit, integration, and end-to-end testing of services, hooks, plugins, and transports.*
        *   *Best practices for mocking and stubbing dependencies in a service-oriented architecture.*
        *   *Ensuring test coverage for multi-runtime compatibility.*
        *   Test across all supported JavaScript runtimes and against the client library.
