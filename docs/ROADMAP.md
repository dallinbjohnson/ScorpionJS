# ScorpionJS Development Roadmap

This document outlines the step-by-step plan for developing the ScorpionJS framework.

## Developer Perspective from Docs:
A developer using ScorpionJS would expect:
*   **Simplicity and Power:** An easy way to create services (`app.service()`) that are instantly available via multiple transports (REST, WebSockets).
*   **Flexibility through Hooks:** Granular control over request/response lifecycle using a comprehensive hook system (before, after, error, around, interceptor).
*   **Scalability:** Features like service discovery for building distributed systems.
*   **Performance:** Options to use Wasm for CPU-intensive tasks.
*   **Security:** Tools for sandboxing untrusted code.
*   **Modern JavaScript:** Support for async/await, modern module syntax.
*   **Multi-Runtime:** Write code once and deploy it across various JavaScript environments.
*   **Real-time Capabilities:** Built-in support for real-time updates via WebSockets.
*   **Streaming:** Efficient handling of large datasets or files over REST and WebSockets.

## Development Plan

- [ ] **Phase 1: Core Framework & Service Layer**

    - [ ] **1. Project Setup & Core Definitions:**
        *   Set up the project with TypeScript (recommended for a framework for type safety) or JavaScript, including a build process, linter, and testing framework.
        *   Define core interfaces and types: `ScorpionApp`, `Service`, `HookContext`, `HookFunction`, `AroundHookFunction`, `NextFunction`, `PluginFunction`.
        *   Implement the basic `createApp(options)` function.
        *   Implement basic plugin system (`app.configure(pluginFunction)`).

    - [ ] **2. Basic Configuration System:**
        *   Implement loading of configuration (e.g., from `createApp` options, environment variables, files).
        *   Support for default and environment-specific configurations.
        *   Mechanism for services/plugins to access configuration.

    - [ ] **3. Dynamic Service Registration, Unregistration, and Invocation:**
        *   Implement `app.service('serviceName', serviceInstance, serviceOptions)` for adding services.
        *   Implement `app.unservice('serviceName')` to remove a service and its associated resources (routes, hooks, event listeners).
        *   Develop a dynamic internal mechanism to dispatch calls to service methods, capable of handling runtime service changes.
        *   Allow per-service configuration via `serviceOptions`.

    - [ ] **4. Runtime Abstraction Layer (Initial - HTTP):**
        *   Design a lightweight adapter interface for HTTP requests/responses.
        *   Implement an initial adapter for Node.js.
        *   Implement `app.listen(port)`.

    - [ ] **5. Core Hooks Engine:**
        *   Implement the `runHooks` internal function.
        *   Support `before`, `after`, and `error` hooks with correct LIFO/FIFO ordering.
        *   Implement `around` hooks with the `(context, next)` signature.
        *   Provide `app.hooks({...})` (global) and `service.hooks({...})` (service-specific).
        *   *Design consideration: Ensure the engine is extensible for future Interceptor hooks and pattern-based hooks, and that internal hook management supports dynamic association/disassociation of hooks with services.*

    - [ ] **6. Initial `HookContext` Design:**
        *   Define the structure of `HookContext` (`app`, `service`, `method`, `type`, `path`, `params`, `data`, `result`, `error`, `config`, etc.).

    - [ ] **7. Schema Definition & Basic Validation Utilities:**
        *   Establish conventions for defining service data/query schemas (e.g., JSON Schema).
        *   Implement basic validation hook utilities (e.g., `validateData(schema)`, `validateQuery(schema)`).
        *   Mechanism for services to register their schemas for tooling/metadata.

- [ ] **Phase 2: Transports, Logging & Advanced Hooks**

    - [ ] **8. REST Transport Implementation:**
        *   Integrate the HTTP runtime adapter.
        *   Map standard and custom service methods to RESTful routes.
        *   Implement request processing (body parsing, query params) and response handling.
        *   Integrate schema validation hooks for request data/query.
        *   Add REST transport configuration (port, host, CORS, body parser options, compression).
        *   *Ensure transport can dynamically add/remove routes when services are registered/unregistered.*

    - [ ] **9. WebSocket Transport (using `crossws`):**
        *   Integrate `crossws` for WebSocket connections.
        *   Map service method calls to WebSocket events.
        *   Handle message serialization/deserialization.
        *   Implement real-time event publishing for standard service events (`created`, `updated`, etc.).
        *   Integrate schema validation for incoming messages.
        *   Configure WebSocket transport options (path, ping/pong, etc.).
        *   *Ensure transport can dynamically add/remove event mappings when services are registered/unregistered.*

    - [ ] **10. Comprehensive Logging System:**
        *   Implement a configurable logger (levels: trace, debug, info, warn, error, fatal).
        *   Support for structured logging (JSON), pretty printing, timestamps, colors.
        *   Allow log output to console and files.
        *   Implement log redaction and custom serializers.
        *   Integrate logger into `HookContext` and core framework.

    - [ ] **11. Advanced Hook Features:**
        *   Implement pattern-based hooks (e.g., `app.hooks('/api/secure/*', {...})`).
        *   Implement Interceptor Hooks (`app.interceptorHooks({...})`) and integrate into the `runHooks` execution flow as per documentation (global, service, interceptor layers).

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

- [ ] **Phase 4: Polish, Ecosystem & Multi-Runtime Expansion**

    - [ ] **19. Fault Tolerance Primitives:**
        *   Implement robust error handling and custom error classes (`ScorpionError`, `NotAuthenticated`, `Forbidden`, `NotFound`, `BadRequest`, etc.).
        *   Implement and integrate fault tolerance patterns: retries, timeouts, circuit breakers, bulkhead, fallback (configurable globally and per-service).

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
        *   Test across all supported JavaScript runtimes and against the client library.
