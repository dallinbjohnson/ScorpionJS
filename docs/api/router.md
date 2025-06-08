# Router API

ScorpionJS features a powerful and flexible routing system inspired by the speed and adaptability of Hono, combined with the real-time capabilities of FeathersJS. The ScorpionJS Router is responsible for mapping incoming HTTP requests and WebSocket messages to the appropriate [service methods](./services.md). It forms the bridge between the network layer and your application logic. A core design principle is that **all service methods (standard and custom) are intended to be universally accessible via RESTful HTTP, WebSockets, and data streaming (including JSON streaming formats like NDJSON)**. The router's mechanisms for path matching, parameter extraction, and method invocation are designed to support this universal accessibility consistently. It seamlessly handles both standard RESTful API patterns and real-time communication via WebSockets, often over the same endpoint definitions.

## Overview

The router is designed to be highly performant and easy to use, allowing you to define clear and expressive routes for your services.

## Key Features

- **High-Performance Engine**: Built for speed and low overhead, ensuring your application can handle a high volume of requests.
- **Flexible Path Matching**: Supports static paths, dynamic path parameters (e.g., `/users/:id`), and wildcard matching (e.g., `/files/*`).
- **HTTP Method Handling**: Explicitly route standard HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`) to service methods or custom handlers.
- **Service-to-Route Mapping**: Automatically maps registered services to conventional RESTful routes (e.g., a `users` service gets routes like `GET /users`, `POST /users`, `GET /users/:id`). This can be customized.
- **Custom Route Handlers**: Define routes that bypass standard service methods and execute custom handler functions, which can still leverage the hook context and ScorpionJS utilities.
- **Real-time / REST Interchangeability (FeathersJS-inspired)**:
    - Service methods (e.g., `find`, `get`, `create`, `update`, `patch`, `remove`) are accessible via both REST HTTP requests and WebSocket events using a consistent interface.
    - A single service definition can power both a traditional API and a real-time application.
    - WebSocket events for service methods often mirror RESTful patterns (e.g., a `messages::created` event corresponds to a `POST /messages` request).
- **Middleware Integration (Hooks)**:
    - Tightly integrated with the [Hooks API](./hooks.md).
    - Hooks can be applied globally, per-service, or based on specific route patterns (e.g., `app.hooks('POST:/api/payments/*', { ... })`), allowing fine-grained control over request processing.
- **Route Grouping & Namespacing**: Organize routes into groups with shared prefixes or middleware.
- **Multi-Runtime Compatibility**: Designed to work consistently across various JavaScript runtimes supported by ScorpionJS (Node.js, Deno, Bun, etc.), similar to Hono's philosophy.

## Integrating with Services

ScorpionJS services automatically expose standard RESTful and WebSocket endpoints. For example, a service registered as `app.service('tasks')` would typically respond to:

- `GET /tasks` (maps to `tasks.find()`)
- `POST /tasks` (maps to `tasks.create()`)
- `GET /tasks/:id` (maps to `tasks.get(id)`)
- `PUT /tasks/:id` (maps to `tasks.update(id, data)`)
- `PATCH /tasks/:id` (maps to `tasks.patch(id, data)`)
- `DELETE /tasks/:id` (maps to `tasks.remove(id)`)

And corresponding WebSocket events. The router manages this mapping.

**Custom service methods** are also seamlessly integrated. By convention, they can be exposed under the service path, often as `POST` requests for actions or `GET` for custom queries, potentially including an `id` if relevant:

- `POST /tasks/:id/approve` (could map to `tasks.approve(id, data, params)`)
- `GET /tasks/summary` (could map to `tasks.summary(params)`)

Hooks apply to these custom method routes just as they do to standard methods, ensuring consistent middleware application.

### Route Specificity and Conflict Resolution

ScorpionJS's router is designed to intelligently map incoming requests to the correct service method, even when dealing with a mix of standard methods, custom methods, and path parameters. This is achieved by adhering to principles of route specificity:

1.  **Static vs. Dynamic Segments**: Literal (static) path segments are generally prioritized over dynamic (parameterized) segments at the same level of the path. 
    *   For example, if you have a custom method routed to `GET /tasks/summary` and the standard `get` method routed to `GET /tasks/:id`, a request to `GET /tasks/summary` will correctly match the custom method, not the `get` method with `id` being "summary".

2.  **Number of Segments and Specificity**: Routes with more literal segments or a more defined structure are typically considered more specific.
    *   For example, a custom method explicitly mapped to `POST /tasks/:id/approve` is more specific than a hypothetical broader pattern like `POST /tasks/:id` that might accept any action as a sub-path (which isn't a standard ScorpionJS pattern but illustrates the point).

3.  **HTTP Method Matching**: The HTTP verb (GET, POST, PUT, etc.) is a primary differentiator. Two routes with the same path but different HTTP methods are distinct (e.g., `GET /tasks/:id` vs. `PUT /tasks/:id`).

4.  **Explicit Mappings Take Precedence**: If you use the mechanisms described in [Services API - Controlling HTTP/Socket Mapping for Service Methods](./services.md#controlling-httpsocket-mapping-for-service-methods) to explicitly define the HTTP verb and path for a service method (standard or custom), these explicit definitions will generally take precedence over purely conventional routing if a conflict in pattern arises. The router will prioritize these declared intentions.

5.  **Wildcard Routes (`*` and `**`)**: ScorpionJS may support wildcard matching in route paths (e.g., `/files/*` to match one additional segment, or `/assets/**` to match any number of subsequent segments). 
    *   Wildcard routes are generally less specific than static routes or routes with a fixed number of parameterized segments. For example, `GET /files/image.png` would match before `GET /files/*`.
    *   A single asterisk (`*`) typically matches any characters within a single path segment.
    *   A double asterisk (`**`) or a trailing asterisk (`*` at the end of a path like `/prefix/*`) often matches anything to the end of the path across multiple segments.
    *   The value captured by the wildcard is usually available in `context.params` (e.g., `context.params.wildcard`, `context.params[0]`, or similar, depending on the router's implementation).
    *   Use cases include serving static files from a directory, catch-all routes for a specific path prefix, or proxying.

6.  **Order of Registration & Advanced Disambiguation (e.g., Headers)**: 
    *   **Order of Registration**: While modern routers often use sophisticated matching trees that make registration order less critical for basic RESTful patterns, in very complex or ambiguous scenarios (which should generally be avoided through clear API design), the order in which services or explicit routes are registered *could* theoretically play a role if two patterns are truly indistinguishable in specificity. ScorpionJS aims to minimize this reliance through clear specificity rules.
    *   **Header-Based Disambiguation (Advanced)**: For exceptionally rare cases where two routes might share an identical path and HTTP method, and specificity rules based on path structure are insufficient, ScorpionJS *could* potentially support disambiguation based on request headers. This might involve: 
        *   A specific custom header like `X-SERVICE-METHOD: methodName` (e.g., `X-SERVICE-METHOD: customActionV1` vs. `X-SERVICE-METHOD: customActionV2`) to explicitly target a service method when path and HTTP verb are identical.
        *   Standard headers like `Accept` (e.g., `Accept: application/vnd.myapi.v1+json` vs. `Accept: application/vnd.myapi.v2+json`) for API versioning or representation variants.
        *   A `Version` header.
    This is an advanced mechanism. The primary approach should always be to design clear, unambiguous route paths and leverage HTTP methods and explicit mappings effectively. Relying heavily on headers for fundamental routing distinctions can make APIs harder to understand and use.

**Developer Best Practices:**

*   **Avoid Ambiguity**: When naming custom methods that will be conventionally routed or when defining explicit routes, be mindful of standard method patterns. For example, avoid a custom method named `get` on a service if you intend it to behave differently from the standard `get(id)`.
*   **Use Explicit Mapping for Clarity**: If a custom method's desired route might seem ambiguous with standard patterns (e.g., a custom `GET /tasks/:customParam` where `:customParam` is not an ID for the main resource), consider using explicit mapping to clearly define its path and distinguish it.

By following these principles, ScorpionJS strives to ensure that your service methods are reliably and predictably mapped, whether they are standard CRUD operations or specialized custom actions, and whether they include path parameters or not.

## Real-time Considerations

When a client connects via WebSockets, the router helps translate WebSocket messages into service method calls. For example, a WebSocket message like:

```json
{
  "type": "call",
  "path": "messages",
  "method": "create",
  "data": { "text": "Hello from WebSocket!" }
}
```

Would be routed to the `create` method of the `messages` service.

Similarly, a custom method call via WebSocket might look like:

```json
{
  "type": "call",
  "path": "tasks",
  "method": "approve",
  "id": "some-task-id",
  "data": { "comment": "Looks good!" }
}
```
This would be routed to the `approve` method of the `tasks` service, with `some-task-id` available as `id` and the data payload passed accordingly. Real-time events emitted by services (e.g., `messages.created`) are also managed and can be broadcast to subscribed clients.

The router ensures that hooks and service logic are applied consistently, regardless of whether the request originated from HTTP or a WebSocket connection.

### WebSocket Integration

ScorpionJS provides out-of-the-box WebSocket integration, mirroring the REST API. When a service is registered, its methods are also made available over WebSockets. Clients can call service methods by sending a message with a specific structure:

```json
// Example WebSocket message to call a service method
{
  "type": "call",         // Indicates a service method call
  "path": "service-name",  // The registered path of the service
  "method": "methodName",  // The name of the service method to call (e.g., "find", "create", "myCustomMethod")
  "id": "optional-id",   // Optional: The ID for methods like get, update, patch, remove, or custom methods needing an ID
  "data": {},             // Optional: The payload for methods like create, update, patch, or custom methods
  "params": {}            // Optional: Additional parameters, including query for find
}
```

The framework handles the routing of this message to the `service-name.methodName()` call, passing `id`, `data`, and `params` appropriately. Responses and errors are sent back over the WebSocket connection.

Service events (created, updated, patched, removed, and custom events) are also broadcasted over WebSockets to subscribed clients, enabling real-time updates.

### Nested Routes

ScorpionJS supports nested routes, enabling you to model hierarchical relationships in your API (e.g., `/users/:userId/posts/:postId`). This is achieved by registering services with paths that reflect the desired nested structure. Parameters from parent routes are automatically made available to the methods of nested services.

**Example: User Posts**

Consider a scenario where you want to manage posts belonging to specific users. You would have a `users` service and a `posts` service nested under it.

**1. Service Definitions (Conceptual)**

First, define your services. The `PostsService` will need access to `userId` from the parent route.

```javascript
// services/users.js (Simplified)
class UsersService {
  async get(id, params) {
    // Logic to fetch user by id
    console.log(`Fetching user ${id}`);
    return { id, name: `User ${id}`, email: `user${id}@example.com` };
  }
  // ... other standard methods (find, create, update, patch, remove)
}

// services/posts.js (Simplified)
class PostsService {
  async find(params) {
    const userId = params.route.userId; // Access userId from the parent route
    console.log(`Fetching posts for user ${userId} with query:`, params.query);
    // Logic to fetch posts for the user
    return [
      { id: 'post1', userId, title: 'First Post', content: '...' },
      { id: 'post2', userId, title: 'Second Post', content: '...' }
    ];
  }

  async get(id, params) {
    const userId = params.route.userId;
    console.log(`Fetching post ${id} for user ${userId}`);
    // Logic to fetch a specific post by id for the user
    return { id, userId, title: `Post ${id} Details`, content: '...' };
  }

  async create(data, params) {
    const userId = params.route.userId;
    console.log(`Creating post for user ${userId} with data:`, data);
    // Logic to create a new post for the user
    return { id: 'newPostId', userId, ...data };
  }

  // ... other standard methods (update, patch, remove) and custom methods
}
```

**2. Service Registration**

Register the services with the application. The path for the `PostsService` includes the parent route parameter `:userId`.

```javascript
// app.js or similar setup file
const app = new Scorpion(); // Assuming Scorpion is your app instance

app.service('users', new UsersService());
// Register PostsService nested under users, using the :userId parameter from the parent path
app.service('users/:userId/posts', new PostsService());

// The router will now handle routes like:
// /users/:userId
// /users/:userId/posts
// /users/:userId/posts/:postId
```

**3. Accessing Parent Route Parameters**

When a request comes in for a nested route like `/users/123/posts/abc`, the `PostsService` methods will receive `params.route.userId` with the value `'123'`. The `id` parameter for `get`, `update`, `patch`, or `remove` methods will be `'abc'`.

```javascript
// Inside PostsService.get(id, params):
// id will be 'abc'
// params.route.userId will be '123'
```

**4. Example Usage**

**HTTP Requests:**

*   `GET /users/123/posts`: Calls `postsService.find({ query: {}, route: { userId: '123' } })`.
*   `GET /users/123/posts?published=true`: Calls `postsService.find({ query: { published: 'true' }, route: { userId: '123' } })`.
*   `GET /users/123/posts/abc`: Calls `postsService.get('abc', { route: { userId: '123' } })`.
*   `POST /users/123/posts` with JSON body `{ "title": "My New Post" }`: Calls `postsService.create({ title: "My New Post" }, { route: { userId: '123' } })`.

**WebSocket Messages:**

*   To list all posts for user `123`:
    ```json
    {
      "type": "call",
      "path": "users/123/posts",
      "method": "find"
    }
    ```
*   To get post `abc` for user `123`:
    ```json
    {
      "type": "call",
      "path": "users/123/posts",
      "method": "get",
      "id": "abc"
    }
    ```
*   To create a new post for user `123`:
    ```json
    {
      "type": "call",
      "path": "users/123/posts",
      "method": "create",
      "data": { "title": "Another Post", "content": "Content here." }
    }
    ```

This approach ensures that nested resources are managed logically within their parent context, and the routing parameters are seamlessly passed down.

### Stream Handling

The router, in conjunction with the underlying HTTP/WebSocket adapters, facilitates streaming data to and from service methods. This is crucial for handling large files or continuous data feeds, including JSON streaming (e.g., NDJSON for array results from methods like `find`).

**1. Streaming Responses (e.g., File Downloads):**

If a [service method](./services.md#producing-streams-eg-file-downloads) returns a `Readable` stream, the router and transport adapter will pipe this stream to the client. 

For HTTP, this typically involves setting appropriate headers like `Content-Type` and `Content-Disposition`. The service method might need to provide this metadata (e.g., by setting properties on `params.streamMetadata` or returning an object like `{ stream, metadata }`) if the framework doesn't infer it.

**Example HTTP Request:**
`GET /files/download?fileName=report.pdf` might trigger a service method that returns a file stream.

**2. Streaming Requests (e.g., File Uploads):**

When a client uploads a stream (e.g., via HTTP `multipart/form-data` or a direct stream `POST`/`PUT`), the router and body parsing middleware make this stream available to the [service method](./services.md#consuming-streams-eg-file-uploads), often via `params.stream` or `context.stream`.

**Example HTTP Request:**
`POST /files/upload` with a file in the body.

**3. WebSockets and Streams:**

While WebSockets can transmit binary data and sequences of messages (which form a logical stream), large file transfers are often still preferred over HTTP. However, for other types of real-time data streams (e.g., logs, metrics, continuous updates), WebSockets are ideal. ScorpionJS would manage the flow of these messages to and from the relevant service methods.

The specific mechanisms for metadata exchange (like content type, filename), stream handling nuances (backpressure, error handling), and negotiation for stream types (e.g., requesting NDJSON via `Accept` headers) depend on the framework's adapters and configuration.
