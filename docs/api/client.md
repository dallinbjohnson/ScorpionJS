# Client API

ScorpionJS provides a client library that makes it easy to interact with ScorpionJS services from both the browser and Node.js. This document provides detailed API documentation for using the ScorpionJS client.

## Installation

```bash
npm install scorpionjs-client
```

## Creating a Client

### Browser

```javascript
import { createClient } from 'scorpionjs/client';

// Create a client that connects to a ScorpionJS server
const client = createClient('http://localhost:3000');
```

### Node.js

```javascript
import { createClient } from 'scorpionjs/client';

// Create a client that connects to a ScorpionJS server
const client = createClient('http://localhost:3000');
```

### Configuration Options

```javascript
const client = createClient('http://localhost:3000', {
  // Transport options
  transport: 'socket', // 'rest', 'socket', or 'auto'
  
  // Socket options (when using socket transport)
  socket: {
    path: '/socket',
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  },
  
  // REST options (when using REST transport)
  rest: {
    headers: {
      'Accept': 'application/json'
    },
    fetch: window.fetch.bind(window) // Custom fetch implementation
  },
  
  // Authentication options
  auth: {
    storage: localStorage, // Where to store the JWT token
    storageKey: 'scorpionjs-jwt', // Key to use in storage
    path: 'authentication', // Authentication service path
    jwtStrategy: 'jwt', // JWT strategy name
    header: 'Authorization', // HTTP header for JWT
    scheme: 'Bearer' // Auth scheme for JWT
  }
});
```

## Using Services

### Accessing a Service

```javascript
// Get a reference to a service
const messagesService = client.service('messages');
```

### Standard Service Methods

```javascript
// Find - get a list of messages
const messages = await messagesService.find({
  query: {
    read: false,
    $limit: 10,
    $sort: { createdAt: -1 }
  }
});

// Get - get a single message by ID
const message = await messagesService.get(1);

// Create - create a new message
const newMessage = await messagesService.create({
  text: 'Hello, world!'
});

// Update - replace a message
const updatedMessage = await messagesService.update(1, {
  text: 'Updated message'
});

// Patch - update parts of a message
const patchedMessage = await messagesService.patch(1, {
  read: true
});

// Remove - delete a message
const removedMessage = await messagesService.remove(1);
```

### Custom Methods

```javascript
// Call a custom method
const result = await client.service('payments').processPayment({
  amount: 100,
  currency: 'USD'
});
```

## Real-time Events

### Listening to Service Events

```javascript
// Listen for when a new message is created
messagesService.on('created', message => {
  console.log('New message created:', message);
});

// Listen for when a message is updated
messagesService.on('updated', message => {
  console.log('Message updated:', message);
});

// Listen for when a message is patched
messagesService.on('patched', message => {
  console.log('Message patched:', message);
});

// Listen for when a message is removed
messagesService.on('removed', message => {
  console.log('Message removed:', message);
});
```

### Custom Events

```javascript
// Listen for a custom event
client.service('notifications').on('newFeature', notification => {
  console.log('New feature notification:', notification);
});
```

### Removing Event Listeners

```javascript
// Create a handler function
const messageHandler = message => {
  console.log('New message:', message);
};

// Add the event listener
messagesService.on('created', messageHandler);

// Remove the event listener
messagesService.off('created', messageHandler);

// Remove all listeners for an event
messagesService.removeAllListeners('created');
```

## Authentication

### Authenticating with the Client

```javascript
// Authenticate with email and password
const { user, token } = await client.authenticate({
  strategy: 'local',
  email: 'user@example.com',
  password: 'password123'
});

console.log('Authenticated user:', user);
```

### Using JWT Authentication

```javascript
// Authenticate with JWT
await client.authenticate({
  strategy: 'jwt',
  token: 'your-jwt-token'
});
```

### Reauthenticating

```javascript
// Reauthenticate with stored token
try {
  const { user } = await client.reAuthenticate();
  console.log('Reauthenticated user:', user);
} catch (error) {
  console.error('Failed to reauthenticate:', error);
}
```

### Logging Out

```javascript
await client.logout();
console.log('Logged out');
```

### Authentication State

```javascript
// Check if the client is authenticated
if (client.authenticated) {
  console.log('Client is authenticated');
}

// Get the current user
const user = client.user;
console.log('Current user:', user);

// Get the authentication token
const token = client.token;
console.log('Authentication token:', token);
```

## Error Handling

```javascript
try {
  await messagesService.get(999);
} catch (error) {
  console.error('Error code:', error.code);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  
  if (error.name === 'NotFound') {
    console.log('Message not found');
  } else if (error.name === 'Forbidden') {
    console.log('Not allowed to access this message');
  }
}
```

## Offline Support

ScorpionJS client includes basic offline support:

```javascript
import { createClient } from 'scorpionjs/client';

const client = createClient('http://localhost:3000', {
  offline: {
    enabled: true,
    storage: localStorage, // Where to store offline data
    storageKey: 'scorpionjs-offline', // Key to use in storage
    maxQueue: 100 // Maximum number of queued operations
  }
});

// Operations are queued when offline and sent when back online
await messagesService.create({ text: 'This will be queued if offline' });

// Listen for offline/online events
client.on('offline', () => {
  console.log('Client is offline');
});

client.on('online', () => {
  console.log('Client is back online');
});

client.on('offline:queue', operation => {
  console.log('Operation queued:', operation);
});

client.on('offline:send', operation => {
  console.log('Queued operation sent:', operation);
});
```

## Reactive Data Binding

ScorpionJS client can be integrated with reactive frameworks:

### React Integration

```javascript
import { useEffect, useState } from 'react';
import { createClient } from 'scorpionjs/client';

const client = createClient('http://localhost:3000');

function MessageList() {
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    // Load initial messages
    client.service('messages').find()
      .then(result => setMessages(result))
      .catch(error => console.error('Error loading messages:', error));
    
    // Listen for real-time events
    const messagesService = client.service('messages');
    
    const onCreated = message => {
      setMessages(prevMessages => [...prevMessages, message]);
    };
    
    const onRemoved = removedMessage => {
      setMessages(prevMessages => 
        prevMessages.filter(message => message.id !== removedMessage.id)
      );
    };
    
    messagesService.on('created', onCreated);
    messagesService.on('removed', onRemoved);
    
    // Clean up event listeners
    return () => {
      messagesService.off('created', onCreated);
      messagesService.off('removed', onRemoved);
    };
  }, []);
  
  return (
    <ul>
      {messages.map(message => (
        <li key={message.id}>{message.text}</li>
      ))}
    </ul>
  );
}
```

### Vue Integration

```javascript
import { createApp } from 'vue';
import { createClient } from 'scorpionjs/client';

const client = createClient('http://localhost:3000');

createApp({
  data() {
    return {
      messages: []
    };
  },
  
  created() {
    // Load initial messages
    client.service('messages').find()
      .then(result => this.messages = result)
      .catch(error => console.error('Error loading messages:', error));
    
    // Listen for real-time events
    const messagesService = client.service('messages');
    
    messagesService.on('created', message => {
      this.messages.push(message);
    });
    
    messagesService.on('removed', removedMessage => {
      const index = this.messages.findIndex(
        message => message.id === removedMessage.id
      );
      if (index !== -1) {
        this.messages.splice(index, 1);
      }
    });
  },
  
  template: `
    <ul>
      <li v-for="message in messages" :key="message.id">
        {{ message.text }}
      </li>
    </ul>
  `
}).mount('#app');
```

## Advanced Usage

### Custom Service Methods

```javascript
// Define a custom method on the client
client.service('payments').customMethod = function(data) {
  return this.request({
    method: 'POST',
    path: `${this.path}/custom-method`,
    data
  });
};

// Use the custom method
const result = await client.service('payments').customMethod({
  amount: 100
});
```

### Request Interceptors

```javascript
// Add a request interceptor
client.interceptors.request.use(config => {
  console.log('Request:', config);
  
  // Add custom headers
  config.headers = {
    ...config.headers,
    'X-Custom-Header': 'value'
  };
  
  return config;
});

// Add a response interceptor
client.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('Error:', error);
    return Promise.reject(error);
  }
);
```

### Connection Management

```javascript
// Manually connect
client.connect();

// Manually disconnect
client.disconnect();

// Check connection status
console.log('Connected:', client.connected);

// Listen for connection events
client.on('connect', () => {
  console.log('Client connected');
});

client.on('disconnect', () => {
  console.log('Client disconnected');
});

client.on('error', error => {
  console.error('Connection error:', error);
});
```
