# Services API

Services are the heart of a ScorpionJS application, encapsulating business logic and data manipulation. They are designed to be protocol-agnostic and universally accessible. A core principle is that **all service methods (standard and custom) should seamlessly support RESTful HTTP, WebSockets, and data streaming (including JSON streaming formats like NDJSON)**. You define your service logic once, and ScorpionJS aims to make it available across these interaction models without requiring method-specific transport code.

The core of a ScorpionJS service is an object or a class instance that implements methods. These methods contain the business logic for your service. There's no fundamental difference in how you define a standard method (like `find` or `create`) versus a custom method specific to your service's needs—they are all simply functions on your service object/class.

Certain method names, known as **Standard Methods**, have conventional meanings and are automatically mapped by the [Router API](./router.md) to standard RESTful endpoints and WebSocket events. Any other methods you define are considered **Custom Methods**, which can also be routed and called similarly.

### Implementing Service Methods

You can implement service methods using either a plain JavaScript object or a class.

**1. Basic Service Object**

A plain object where each property is an asynchronous function representing a service method.

```javascript
const messageService = {
  // Standard method
  async find(params) {
    console.log('Finding messages with params:', params);
    return [{ id: 1, text: 'Hello world' }];
  },
  // Standard method
  async get(id, params) {
    console.log(`Getting message ${id} with params:`, params);
    return { id, text: 'A specific message' };
  },
  // Standard method
  async create(data, params) {
    console.log('Creating message with data:', data, 'and params:', params);
    return { id: Date.now(), ...data };
  },
  // ... other standard methods like update, patch, remove ...

  // Custom method
  async markAsRead(id, data, params) { // `data` might be optional or unused
    console.log(`Marking message ${id} as read. Additional data:`, data, 'Params:', params);
    // Perform logic, e.g., update a 'read' flag in the database
    return { id, status: 'marked as read' };
  }
};

app.use('messages', messageService);
```

Services can be registered at any point during the application's lifecycle, not just at startup. This allows for dynamic application composition, for example, when loading plugins that provide their own services.

**2. Service Class**

Using a class can be beneficial for organizing more complex services, managing internal state, or leveraging inheritance.

```javascript
class MessageService {
  constructor(internalConfig) { // e.g., specific settings for this service instance
    this.messages = [];
    this.internalConfig = internalConfig; // Store internal config passed to constructor
    // console.log('MessageService instantiated with internalConfig:', internalConfig);
  }

  // Standard method
  async find(params) {
    // Example: apply query from params
    if (params.query && params.query.unread) {
      return this.messages.filter(m => !m.read);
    }
    return this.messages;
  }

  // Standard method
  async get(id, params) {
    const message = this.messages.find(m => m.id === parseInt(id));
    if (!message) throw new Error('Message not found');
    return message;
  }
  
  // Standard method
  async create(data, params) {
    const message = {
      id: Date.now(),
      text: data.text,
      read: false,
      createdAt: new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  }

  // ... other standard methods like update, patch, remove ...

  // Custom method
  async archive(id, data, params) {
    console.log(`Archiving message ${id}. Additional data:`, data, 'Params:', params);
    const message = this.messages.find(m => m.id === parseInt(id));
    if (!message) throw new Error('Message not found for archiving');
    message.archived = true;
    // Perform actual archiving logic
    return { ...message, status: 'archived' };
  }
}

app.use('messages', new MessageService({ customInternalSetting: 'hello from constructor' }));

// Note: Options passed directly to 'new MessageService()' as above are for the service's own constructor (internalConfig).
// For framework-level service options (e.g., custom validators, schemas for validation), you would provide them as a third argument to app.use().
// See the 'Service Options' section directly below for detailed examples of this pattern (e.g., app.use('path', new ServiceClass(), { validator: myValidator })).
```
Both approaches are equally valid. The choice depends on your preference and the complexity of the service.

### Service Options

When registering a service using `app.use()`, you can provide an optional third argument for service-specific options. This argument is an object containing configurations specific to that service instance. This is the primary way to provide service-level settings like custom validators, schemas for validation, or other metadata that the service or its hooks might use.

Key options include:

*   `validator`: An instance of a validator (e.g., a wrapper around Ajv or Zod) to be used specifically for this service, overriding any app-level default validator.
*   `schemas`: An object mapping service method names (e.g., 'create', 'find', 'all') to their respective data or query validation schemas. These schemas are then used by validation hooks like `validateData` or `validateQuery`.
*   `events`: An array of custom event names that this service might emit, in addition to standard CRUD events.
*   Any other properties added to this options object will be available on `context.service._options` within hooks and the service methods themselves.

**Example:**

```javascript
// Assuming you have a validator instance and schema definitions
// const myServiceValidator = new MyCustomValidator();
// const createDataSchema = { /* ... schema for create data ... */ };
// const findQuerySchema = { /* ... schema for find query params ... */ };

class MyDataService {
  async create(data, params) {
    // ... creation logic
    return data;
  }
  async find(params) {
    // ... find logic
    return [];
  }
}

app.use('my-data', new MyDataService(), {
  validator: myServiceValidator, // This service will use its own validator
  schemas: {
    create: createDataSchema,    // Schema for the 'create' method's data
    find: findQuerySchema,       // Schema for the 'find' method's query parameters
    // 'all': generalSchema     // Optionally, a schema for all methods if not specified
  },
  customOption: 'someValue'      // This will be available as context.service._options.customOption
});

// Now, when 'my-data' service's 'create' method is called,
// if a validation hook is in place, it can use 'myServiceValidator'
// and 'createDataSchema' from context.service._options.
```

This mechanism allows for fine-grained control over service behavior and integrates tightly with the hook system, especially for features like schema validation.

### Unregistering Services (`app.unservice`)

ScorpionJS allows for the dynamic unregistration of services using the `app.unuse(path)` method. This is crucial for scenarios like plugin unloading, hot-swapping service implementations, or reconfiguring an application at runtime without a full restart.

When a service is unregistered, ScorpionJS performs the following actions:

*   **Removal from Registry:** The service instance is removed from the application's internal service registry, making it no longer accessible via `app.service(path)`.
*   **Route Teardown:** All routes (e.g., REST endpoints, WebSocket event handlers) that were automatically created for this service by the framework's routers are removed.
*   **Hook Detachment:** Any service-specific hooks that were registered for this particular service instance are detached. Global hooks and hooks for other services remain unaffected.
*   **Event Listener Cleanup:** Service-specific event listeners (e.g., for standard service events like `created`, `updated`) are cleaned up to prevent memory leaks or unintended behavior.
*   **Service Teardown (Optional Convention):** If the service instance being unregistered has a method named `teardown` (e.g., `async teardown(app)`), ScorpionJS will attempt to call it. This provides a hook for the service to perform any custom cleanup logic it requires, such as closing database connections, releasing file handles, clearing intervals or timeouts, or unsubscribing from external message queues. The `app` instance is passed to `teardown` in case the service needs it for its cleanup operations.

**Example:**

```javascript
// Assume a service 'myDynamicService' is registered earlier
// app.service('myDynamicService', new MyDynamicService());

// Later, to unregister it:
const unregisteredService = app.unuse('myDynamicService');

if (unregisteredService) {
  console.log(`Service 'myDynamicService' has been unregistered.`);
  // unregisteredService is the instance that was removed
  // If it had a teardown method, it would have been called before this.
} else {
  console.log(`Service 'myDynamicService' not found or already unregistered.`);
}
```

The `app.unuse(path)` method returns the service instance that was removed if successful, or `undefined` if no service was found registered at the given path.

This dynamic registration and unregistration capability is fundamental to ScorpionJS's design for building flexible and adaptable applications.

## Service Method Categories

While all methods are defined similarly on your service object/class, they generally fall into two categories based on their naming and conventional usage:

### Standard Methods
These are a set of conventionally named methods that ScorpionJS recognizes for common CRUD (Create, Read, Update, Delete) operations. In line with ScorpionJS's core principles, they are designed for universal access via REST, WebSockets, and streaming. They have default mappings in the [Router API](./router.md), and all are asynchronous.

Below are the details for each standard service method:

### `find(params)`

Retrieves a list of resources, optionally filtered by `params.query`.

**Server-side Example:**
```javascript
app.service('messages').find({
  query: { 
    read: false, 
    $limit: 10, 
    $skip: 0, 
    $sort: { createdAt: -1 },
    $select: ['text', 'userId']
  }
});
```

**Client-side Example:**
```javascript
client.service('messages').find({
  query: { read: false, $limit: 10 }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | `Object` | An object containing parameters for the method. |
| `params.query` | `Object` | An object containing query parameters for filtering, pagination, sorting, and field selection. Common properties include: |
| `params.query.$limit` | `Number` | (Optional) The maximum number of results to return. |
| `params.query.$skip` | `Number` | (Optional) The number of results to skip (for pagination). |
| `params.query.$sort` | `Object` | (Optional) An object defining the sort order. Keys are field names, values are `1` for ascending or `-1` for descending (e.g., `{ createdAt: -1 }`). |
| `params.query.$select` | `Array<String>` | (Optional) An array of field names to include in the results. If omitted, all fields are typically returned. |
| `params.provider` | `String` | (Set by framework) Indicates the transport used (e.g., 'rest', 'socketio', 'primus'). Can be used to vary behavior. |
| `params.user` | `Object` | (If authentication is used) The authenticated user object. |
| `...` | `any` | Other custom properties passed through hooks or from the client. |

### `get(id, params)`

Retrieves a single resource by its ID.

**Server-side Example:**
```javascript
app.service('messages').get(1, {
  query: { $select: ['text', 'createdAt'] } 
});
```

**Client-side Example:**
```javascript
client.service('messages').get(1);
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `String` or `Number` | The ID of the resource to retrieve. |
| `params` | `Object` | An object containing parameters for the method (see `find` for common `params` properties like `query.$select`, `provider`, `user`). |

### `create(data, params)`

Creates a new resource with the given `data`.

**Server-side Example:**
```javascript
app.service('messages').create({
  text: 'Hello, ScorpionJS!',
  userId: 'user123'
});
```

**Client-side Example:**
```javascript
client.service('messages').create({
  text: 'Hello from client!'
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `Object` | The data for the new resource. For multiple creations, this can be an array of objects. |
| `params` | `Object` | An object containing parameters for the method (see `find` for common `params` properties). |

### `update(id, data, params)`

Completely replaces a resource identified by `id` with the new `data`. If the resource does not exist, it may create it, depending on the service's configuration (upsert behavior).

**Server-side Example:**
```javascript
app.service('messages').update('msg1', {
  text: 'Updated message content completely.',
  read: true
});
```

**Client-side Example:**
```javascript
client.service('messages').update('msg1', {
  text: 'This is the new content.'
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `String` or `Number` | The ID of the resource to update. Can be `null` for multi-updates if supported by the adapter. |
| `data` | `Object` | The new data for the resource. |
| `params` | `Object` | An object containing parameters for the method (see `find` for common `params` properties). `params.query` can be used for multi-updates if supported. |

### `patch(id, data, params)`

Merges the existing resource identified by `id` with the new `data`. It only changes the fields provided in `data`.

**Server-side Example:**
```javascript
app.service('messages').patch('msg1', {
  read: true,
  flagged: false
});
```

**Client-side Example:**
```javascript
client.service('messages').patch('msg1', {
  read: true
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `String` or `Number` | The ID of the resource to patch. Can be `null` for multi-patches if supported by the adapter. |
| `data` | `Object` | The data to merge with the existing resource. |
| `params` | `Object` | An object containing parameters for the method (see `find` for common `params` properties). `params.query` can be used for multi-patches if supported. |

### `remove(id, params)`

Removes a resource identified by `id`.

**Server-side Example:**
```javascript
app.service('messages').remove('msg1');
```

**Client-side Example:**
```javascript
client.service('messages').remove('msg1');
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `String` or `Number` | The ID of the resource to remove. Can be `null` for multi-removes if supported by the adapter. |
| `params` | `Object` | An object containing parameters for the method (see `find` for common `params` properties). `params.query` can be used for multi-removes if supported. |



Retrieves a list of resources.

```javascript
// Server
app.service('messages').find({
  query: { read: false, $limit: 10 }
});

// Client
client.service('messages').find({
  query: { read: false, $limit: 10 }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | Object | Parameters object |
| `params.query` | Object | Query parameters |
| `params.query.$limit` | Number | Maximum number of results |
| `params.query.$skip` | Number | Number of results to skip |
| `params.query.$sort` | Object | Sorting parameters |
| `params.query.$select` | Array | Fields to include |

### get(id, params)

Retrieves a single resource by ID.

```javascript
// Server
app.service('messages').get(1, {
  query: { $select: ['text', 'createdAt'] }
});

// Client
client.service('messages').get(1, {
  query: { $select: ['text', 'createdAt'] }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String/Number | ID of the resource to retrieve |
| `params` | Object | Parameters object |
| `params.query` | Object | Query parameters |
| `params.query.$select` | Array | Fields to include |

### create(data, params)

Creates a new resource.

```javascript
// Server
app.service('messages').create({
  text: 'Hello, world!'
});

// Client
client.service('messages').create({
  text: 'Hello, world!'
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | Object | Data for the new resource |
| `params` | Object | Parameters object |

### update(id, data, params)

Replaces a resource by ID.

```javascript
// Server
app.service('messages').update(1, {
  text: 'Updated message'
});

// Client
client.service('messages').update(1, {
  text: 'Updated message'
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String/Number | ID of the resource to update |
| `data` | Object | New data for the resource |
| `params` | Object | Parameters object |

### patch(id, data, params)

Updates parts of a resource by ID.

```javascript
// Server
app.service('messages').patch(1, {
  read: true
});

// Client
client.service('messages').patch(1, {
  read: true
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String/Number | ID of the resource to patch |
| `data` | Object | Data to merge with the resource |
| `params` | Object | Parameters object |

### remove(id, params)

Removes a resource by ID.

```javascript
// Server
app.service('messages').remove(1);

// Client
client.service('messages').remove(1);
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String/Number | ID of the resource to remove |
| `params` | Object | Parameters object |

### Custom Methods

Beyond the standard CRUD methods, ScorpionJS services fully support custom methods. These allow you to define any specific logic or operations relevant to your service, and they are treated as first-class citizens by the framework.

Custom methods integrate seamlessly with ScorpionJS's [Router API](./router.md) and are accessible via both RESTful HTTP requests and WebSocket events, just like standard methods. Hooks also apply to custom methods consistently, allowing for uniform middleware application.

### Custom Methods

Beyond the standard CRUD methods, ScorpionJS services fully support custom methods. These allow you to define any specific logic or operations relevant to your service. Like standard methods, custom methods are treated as first-class citizens, designed for universal access via REST, WebSockets, and streaming, and are fully compatible with the framework's routing and hook systems.

#### Defining Custom Methods

As shown in the "Defining Service Logic and Methods" section, custom methods are defined directly on your service object or class, alongside standard methods. There is no special syntax for defining them; they are simply asynchronous functions. Here are a few examples to illustrate their flexibility:

```javascript
// services/task-service.js
class TaskService {
  constructor(options) {
    this.tasks = [{ id: 1, text: 'Initial task', status: 'pending', assigneeId: null }];
    this.nextId = 2;
  }

  async find(params) { /* ... */ }
  async get(id, params) { /* ... */ }
  async create(data, params) { /* ... */ }
  async update(id, data, params) { /* ... */ }
  async patch(id, data, params) { /* ... */ }
  async remove(id, params) { /* ... */ }

  // Custom method: Assign a task to a user
  async assignTask(taskId, userId, params) {
    console.log(`Assigning task ${taskId} to user ${userId} by ${params.user?.email || 'system'}`);
    const task = this.tasks.find(t => t.id === parseInt(taskId));
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`); // Or use a ScorpionJS error class
    }
    task.assigneeId = userId;
    task.status = 'assigned';
    // Optionally, emit an event
    // this.emit('taskAssigned', { taskId, userId, task });
    return task;
  }

  // Custom method: Get tasks by status
  async getTasksByStatus(status, params) {
    const { priority } = params.query || {}; // Example of using params.query
    let filteredTasks = this.tasks.filter(t => t.status === status);
    if (priority) {
      filteredTasks = filteredTasks.filter(t => t.priority === priority);
    }
    return filteredTasks;
  }

  // Custom method: Send a batch of notifications (no ID needed in path)
  async sendNotifications(notificationList, params) {
    console.log(`Sending ${notificationList.length} notifications.`);
    // ... logic to send notifications ...
    // Example: notificationList = [{ userId: 'user1', message: 'Hello' }, { userId: 'user2', message: 'Hi' }]
    return { success: true, count: notificationList.length };
  }
}

// Registering the service
// app.use('tasks', new TaskService());
```

**Calling Custom Methods (Server-Side):**

```javascript
// Assuming 'app' is your ScorpionJS application instance

// Assign a task
app.service('tasks').assignTask(1, 'user456', { user: { email: 'admin@example.com' } });

// Get pending tasks with high priority
app.service('tasks').getTasksByStatus('pending', { query: { priority: 'high' } });

// Send batch notifications
app.service('tasks').sendNotifications([
  { userId: 'user1', message: 'Reminder: Meeting at 3 PM' },
  { userId: 'user2', message: 'Your report is due tomorrow' }
]);
```

These methods would then be accessible via REST and WebSockets based on the routing conventions or explicit mappings defined (see "Controlling HTTP/Socket Mapping for Service Methods" below).

**Example (reiteration from earlier):**

```javascript
// Using a service class
class TaskService {
  // ... standard methods like find, get, create ...

  async approve(id, data, params) {
    // Logic to approve a task
    console.log(`Approving task ${id} with data:`, data);
    return { id, status: 'approved', comment: data.comment };
  }

  async getSummary(params) {
    // Logic to get a summary of tasks
    return { totalTasks: 100, pendingTasks: 20 }; // Placeholder
  }
}

// Using a service object
const userService = {
  // ... standard methods ...
  async sendPasswordResetEmail(data, params) {
    const { email } = data;
    console.log(`Sending password reset to ${email}`);
    return { message: 'Password reset email sent.' };
  }
};
```

#### Controlling HTTP/Socket Mapping for Service Methods

ScorpionJS establishes sensible default conventions for how service methods are exposed via HTTP and WebSockets. For example, a standard `find` method typically maps to `GET /service-name`, and a `create` method to `POST /service-name`. Custom methods also receive default mappings (e.g., `POST /service-name/custom-method`).

However, for maximum flexibility, you may need more precise control over the HTTP verb (GET, POST, PUT, DELETE, PATCH, etc.), the exact URL path, and corresponding WebSocket event patterns for *any* service method, including overriding the defaults for standard methods. This ensures that the API presented to clients can be tailored precisely to your needs, regardless of the method's internal name or conventional role.

Ideally, ScorpionJS provides a declarative way to specify these mappings as part of your service definition or registration. This keeps the routing configuration closely tied to the service logic itself.

**Conceptual Mechanisms for Explicit Mapping:**

The exact API for this is a design choice for the ScorpionJS framework. Here are some conceptual ways this could be achieved:

1.  **Via Service Registration Options:**
    You might provide routing hints when registering the service:
    ```javascript
    // Conceptual example
    app.use('tasks', new TaskService(), {
      // Options to map specific custom methods to HTTP verbs/paths
      customRoutes: {
        // Example: Override standard 'create' and map a custom 'approve' method
        // maps tasks.create(data, params) to POST /tasks/new-task (overriding default /tasks)
        create: { verb: 'POST', path: '/new-task' }, 
        // maps tasks.approve(id, data, params) to PUT /tasks/:id/approve-action
        approve: { verb: 'PUT', path: '/:id/approve-action' },
        // maps tasks.getSummary(params) to GET /tasks/summary-report
        getSummary: { verb: 'GET', path: '/summary-report' }
      }
    });
    ```

2.  **Via Static Properties or Metadata on Service Methods:**
    If using classes, static properties or decorators (if supported) could define routing metadata:
    ```javascript
    // Conceptual example with static properties
    class TaskService {
      // Standard method with overridden route
      async create(data, params) { /* ... */ }
      static create_config = { http: { verb: 'POST', path: '/new-task' } };

      // Custom method
      async approve(id, data, params) { /* ... */ }
      static approve_config = { http: { verb: 'PUT', path: '/:id/approve-action' } };

      async getSummary(params) { /* ... */ }
      static getSummary_config = { http: { verb: 'GET', path: '/summary-report' } };
    }
    ```

**If Explicit Mapping is Not Directly Supported by the Service System:**

If ScorpionJS relies primarily on conventions for service methods (both standard and custom) and doesn't offer a direct declarative way to customize their HTTP verb/path mappings, you would need to adhere to the framework's established conventions. Significant deviations from these conventions for any service method might not be directly supported without such a declarative mapping feature.

Clear documentation on the chosen mechanism (or limitations) within ScorpionJS for such mappings is crucial for developers.

### Working with Streams

ScorpionJS services can also handle streaming data, which is essential for use cases like file uploads and downloads, or real-time data feeds that are too large or continuous to fit into a single request/response payload. Both Node.js `Readable` and `Writable` streams are commonly used.

#### Producing Streams (e.g., File Downloads)

A service method can return a `Readable` stream. The underlying HTTP/Socket adapter is responsible for piping this stream to the client correctly.

```javascript
// services/file-service.js
import fs from 'fs';
import path from 'path';

class FileService {
  // ... other methods ...

  // Custom method to download a file
  async download(fileName, params) {
    // Ensure `params.user` has permission, etc.
    const filePath = path.join(__dirname, 'uploads', fileName); // Ensure this path is secure

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found'); // Use a ScorpionJS error for proper status codes
    }

    // Return a readable stream
    const stream = fs.createReadStream(filePath);
    
    // It's often useful to provide metadata for the router/transport adapter
    // This might be set on params or returned alongside the stream if the framework supports it
    // For example, params.streamMetadata = { contentType: 'application/octet-stream', fileName: fileName };
    // Or the service method could return an object: { stream, metadata }
    // The exact mechanism depends on how ScorpionJS router/adapters handle stream metadata.
    
    // For now, we assume the router can infer or be configured for common stream types,
    // or that metadata is passed via params if needed by a hook or adapter.
    return stream; 
  }
}

// app.use('files', new FileService());
```
When a client requests this `download` method (e.g., via `GET /files/download?fileName=report.pdf` if routed appropriately), the framework would pipe the returned stream.

#### Consuming Streams (e.g., File Uploads)

For consuming streams, like file uploads, the incoming stream is typically made available on the `params` object or a dedicated `context.stream` property by the transport adapter (e.g., when using `multipart/form-data` for HTTP).

```javascript
// services/file-service.js
import fs from 'fs';
import path from 'path';
import { Writable } from 'stream'; // Or a more specific stream like a file writer

class FileService {
  // ... other methods ...

  // Custom method to upload a file
  // The `data` might contain metadata, and `params.stream` (or similar) would be the readable stream
  async upload(data, params) {
    const { fileName, /* other metadata */ } = data;
    const incomingStream = params.stream; // This is a conceptual example; actual property may vary

    if (!incomingStream) {
      throw new Error('No upload stream found.');
    }

    const filePath = path.join(__dirname, 'uploads', fileName); // Ensure this path is secure

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      incomingStream.pipe(writer);
      writer.on('finish', () => resolve({ message: 'File uploaded successfully', fileName }));
      writer.on('error', reject);
      incomingStream.on('error', reject); // Also handle errors on the source stream
    });
  }
}

// app.use('files', new FileService());
```
In this conceptual example, `params.stream` would be a `Readable` stream representing the uploaded file data. The service method then pipes it to a `Writable` stream (e.g., a file). The exact way to access the incoming stream and its metadata will depend on the HTTP body parser and WebSocket handling in ScorpionJS.

**Note on WebSockets:** While WebSockets can transmit binary data and thus support streaming, large file transfers are often handled via HTTP (multipart or direct stream) due to specific protocol advantages. However, sequences of messages over WebSockets inherently form a stream of data.

Clear documentation from ScorpionJS on how stream metadata (like content type, filename for downloads) is handled and how incoming streams are exposed to service methods is crucial.

**JSON Streaming (e.g., NDJSON):**

For methods that return arrays of JSON objects (like a `find` method), ScorpionJS can also support streaming these results as [Newline Delimited JSON (NDJSON)](http://ndjson.org/). This is particularly useful for large datasets, allowing the client to process each JSON object as it arrives, rather than waiting for the entire collection.

*   **Producing NDJSON**: A service method returning an array could be automatically converted to an NDJSON stream by the router/adapter if the client requests it (e.g., via an `Accept: application/x-ndjson` header) or if configured for a specific route.
*   **Consuming NDJSON**: Similarly, a service method could be designed to accept an incoming NDJSON stream for batch operations, processing each object as it's received.

The framework would handle the serialization/deserialization of individual JSON objects in the stream.

#### Accessing Custom Methods

Custom methods are typically exposed by the router under the service's path. Conventions include:

- For methods acting on a specific resource: `POST /<service-path>/:id/<custom-method-name>`
- For methods acting generally on the service: `POST /<service-path>/<custom-method-name>` or `GET /<service-path>/<custom-method-name>` if idempotent and fetching data.

**Example Calls:**

```javascript
// Server-side or client-side (if client library supports custom methods)

// Calling 'approve' on the 'tasks' service
app.service('tasks').approve('task-123', { comment: 'Approved by admin' }, { user: { id: 'adminUser' } });
// Via REST: POST /tasks/task-123/approve with JSON body { "comment": "Approved by admin" }
// Via WebSocket: { type: "call", path: "tasks", method: "approve", id: "task-123", data: { "comment": "Approved by admin" } }

// Calling 'getSummary' on the 'tasks' service
app.service('tasks').getSummary({});
// Via REST: GET /tasks/summary
// Via WebSocket: { type: "call", path: "tasks", method: "getSummary" }

// Calling 'sendPasswordResetEmail' on the 'users' service
app.service('users').sendPasswordResetEmail({ email: 'user@example.com' });
// Via REST: POST /users/sendPasswordResetEmail with JSON body { "email": "user@example.com" }
// Via WebSocket: { type: "call", path: "users", method: "sendPasswordResetEmail", data: { "email": "user@example.com" } }
```

Refer to the [Router API](./router.md) documentation for more details on how custom method routes are established and can be customized.

## Events

### Emitting Events

```javascript
// Server
app.service('messages').emit('custom-event', {
  message: 'Something happened!'
});
```

### Listening to Events

```javascript
// Server
app.service('messages').on('created', (message, context) => {
  console.log('New message created:', message);
});

// Client
client.service('messages').on('created', message => {
  console.log('New message received:', message);
});
```

## Service Context

The service context object is passed to hooks and contains information about the current request.

| Property | Type | Description |
|----------|------|-------------|
| `app` | Object | The ScorpionJS application |
| `service` | Object | The service this hook is being called on |
| `path` | String | The service path |
| `method` | String | The service method |
| `type` | String | The hook type ('before', 'after', or 'error') |
| `params` | Object | The service method parameters |
| `id` | String/Number | The resource ID (for get, update, patch, remove) |
| `data` | Object | The request data (for create, update, patch) |
| `result` | Any | The result (in after hooks) |
| `error` | Error | The error (in error hooks) |
