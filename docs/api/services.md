# Services API

Services are the core building blocks of a ScorpionJS application. This document provides detailed API documentation for working with services.

## Creating Services

### Basic Service Object

```javascript
const messageService = {
  async find(params) {
    return [];
  },
  
  async get(id, params) {
    return { id };
  },
  
  async create(data, params) {
    return data;
  },
  
  async update(id, data, params) {
    return { ...data, id };
  },
  
  async patch(id, data, params) {
    return { ...data, id };
  },
  
  async remove(id, params) {
    return { id };
  }
};

app.service('messages', messageService);
```

### Service Class

```javascript
class MessageService {
  constructor() {
    this.messages = [];
  }
  
  async find(params) {
    return this.messages;
  }
  
  async get(id, params) {
    const message = this.messages.find(m => m.id === parseInt(id));
    if (!message) throw new Error('Message not found');
    return message;
  }
  
  async create(data, params) {
    const message = {
      id: Date.now(),
      text: data.text,
      createdAt: new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  }
  
  async update(id, data, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = {
      id: parseInt(id),
      text: data.text,
      createdAt: this.messages[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    
    this.messages[index] = message;
    return message;
  }
  
  async patch(id, data, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = {
      ...this.messages[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    this.messages[index] = message;
    return message;
  }
  
  async remove(id, params) {
    const index = this.messages.findIndex(m => m.id === parseInt(id));
    if (index === -1) throw new Error('Message not found');
    
    const message = this.messages[index];
    this.messages.splice(index, 1);
    return message;
  }
}

app.service('messages', new MessageService());
```

## Standard Service Methods

### find(params)

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

## Custom Methods

### Defining Custom Methods

```javascript
const paymentService = {
  async processPayment(data, params) {
    // Process payment logic
    return {
      transactionId: `tx-${Date.now()}`,
      status: 'completed',
      amount: data.amount
    };
  }
};

app.service('payments', paymentService);

// Register custom methods
app.service('payments').methods({
  processPayment: {
    http: { method: 'POST', path: '/process' }
  }
});
```

### Calling Custom Methods

```javascript
// Server
app.service('payments').processPayment({
  amount: 100,
  currency: 'USD'
});

// Client
client.service('payments').processPayment({
  amount: 100,
  currency: 'USD'
});
```

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
