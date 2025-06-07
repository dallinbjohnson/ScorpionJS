# Streams API

ScorpionJS provides native support for handling data streams, inspired by Moleculer. This document provides detailed API documentation for working with streams in ScorpionJS.

## Introduction to Streams

Streams are a powerful way to handle large amounts of data or real-time data flows. ScorpionJS supports Node.js streams across its service layer, allowing you to efficiently process large files, real-time data, and more.

## Basic Stream Usage

### Returning Streams from Services

```javascript
import { createApp } from 'scorpionjs';
import fs from 'fs';
import path from 'path';

const app = createApp();

app.service('files', {
  async get(id, params) {
    // Return a readable stream
    return fs.createReadStream(path.join('./uploads', id));
  }
});

// Start the server
app.listen(3000);
```

### Consuming Streams

```javascript
// Server-side consumption
const fileStream = await app.service('files').get('large-file.pdf');
fileStream.pipe(fs.createWriteStream('./downloaded-file.pdf'));

// Client-side consumption
const client = createClient('http://localhost:3000');
const fileStream = await client.service('files').get('large-file.pdf', { stream: true });
fileStream.pipe(fs.createWriteStream('./downloaded-file.pdf'));
```

## Stream Detection

ScorpionJS automatically detects if a service method returns a stream:

```javascript
app.service('data', {
  async get(id) {
    if (id === 'stream') {
      // Return a stream
      return fs.createReadStream('./data.txt');
    } else {
      // Return regular data
      return { id, content: 'Regular data' };
    }
  }
});
```

## Stream Parameters

You can pass stream options in the params object:

```javascript
// Client requesting a stream
const stream = await client.service('files').get('large-file.pdf', {
  stream: true,
  highWaterMark: 64 * 1024 // 64KB chunks
});
```

## Stream Transformations

### Transform Streams in Services

```javascript
import { createApp } from 'scorpionjs';
import fs from 'fs';
import { Transform } from 'stream';
import csv from 'csv-parser';

const app = createApp();

app.service('csv', {
  async get(id, params) {
    // Create a readable stream
    const fileStream = fs.createReadStream(`./data/${id}.csv`);
    
    // Parse CSV
    const csvStream = fileStream.pipe(csv());
    
    // Transform data
    const transform = new Transform({
      objectMode: true,
      transform(data, encoding, callback) {
        // Transform each row
        callback(null, {
          name: data.name.toUpperCase(),
          age: parseInt(data.age),
          email: data.email
        });
      }
    });
    
    // Return the transformed stream
    return csvStream.pipe(transform);
  }
});
```

### Stream Processing Hooks

```javascript
import { createApp } from 'scorpionjs';
import { Transform } from 'stream';
import zlib from 'zlib';

const app = createApp();

// Register a service
app.service('files', {
  async get(id) {
    return fs.createReadStream(`./files/${id}`);
  }
});

// Add a stream processing hook
app.service('files').hooks({
  after: {
    get: [
      async context => {
        // Check if result is a stream
        if (context.result && typeof context.result.pipe === 'function') {
          // Check if compression was requested
          if (context.params.compress) {
            // Compress the stream
            context.result = context.result.pipe(zlib.createGzip());
          }
        }
        return context;
      }
    ]
  }
});

// Usage
const compressedStream = await app.service('files').get('large-file.txt', {
  compress: true
});
```

## Stream Error Handling

```javascript
app.service('files').hooks({
  error: {
    get: [
      async context => {
        // Clean up any stream resources
        if (context.result && typeof context.result.destroy === 'function') {
          context.result.destroy();
        }
        return context;
      }
    ]
  }
});

// Client-side error handling
try {
  const stream = await client.service('files').get('non-existent-file.txt');
  stream.pipe(fs.createWriteStream('./output.txt'));
  
  stream.on('error', error => {
    console.error('Stream error:', error);
  });
} catch (error) {
  console.error('Service error:', error);
}
```

## Uploading Streams

### Service Implementation

```javascript
import { createApp } from 'scorpionjs';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = createApp();

app.service('uploads', {
  async create(data, params) {
    // Check if data is a stream
    if (data && typeof data.pipe === 'function') {
      const id = uuidv4();
      const filePath = path.join('./uploads', id);
      
      // Create a writable stream
      const writeStream = fs.createWriteStream(filePath);
      
      // Return a promise that resolves when the upload is complete
      return new Promise((resolve, reject) => {
        data.pipe(writeStream)
          .on('finish', () => {
            resolve({ id, size: writeStream.bytesWritten });
          })
          .on('error', error => {
            reject(error);
          });
        
        // Handle errors on the readable stream
        data.on('error', error => {
          writeStream.destroy();
          reject(error);
        });
      });
    } else {
      throw new Error('Expected a stream');
    }
  }
});
```

### Client-side Upload

```javascript
import fs from 'fs';

// Create a readable stream
const readStream = fs.createReadStream('./file-to-upload.pdf');

// Upload the stream
const result = await client.service('uploads').create(readStream);
console.log('Uploaded file ID:', result.id);
```

## Bidirectional Streams

ScorpionJS supports bidirectional streams for real-time communication:

```javascript
import { createApp } from 'scorpionjs';
import { Duplex } from 'stream';

const app = createApp();

app.service('chat', {
  async get(id, params) {
    // Create a duplex stream for chat
    const chatStream = new Duplex({
      objectMode: true,
      
      // Handle incoming messages
      write(chunk, encoding, callback) {
        // Broadcast the message to all connected clients
        this.push({
          type: 'message',
          user: params.user?.id || 'anonymous',
          content: chunk.content,
          timestamp: new Date()
        });
        callback();
      },
      
      // Not used for this example
      read(size) {}
    });
    
    // Add the stream to a room
    const room = this.rooms.get(id) || new Set();
    room.add(chatStream);
    this.rooms.set(id, room);
    
    // Handle stream end
    chatStream.on('end', () => {
      const room = this.rooms.get(id);
      if (room) {
        room.delete(chatStream);
        if (room.size === 0) {
          this.rooms.delete(id);
        }
      }
    });
    
    // Send a welcome message
    chatStream.push({
      type: 'system',
      content: 'Welcome to the chat!',
      timestamp: new Date()
    });
    
    return chatStream;
  },
  
  setup(app) {
    this.rooms = new Map();
  }
});
```

### Client-side Usage

```javascript
// Get the chat stream
const chatStream = await client.service('chat').get('room-123', { stream: true });

// Listen for messages
chatStream.on('data', message => {
  console.log(`${message.user}: ${message.content}`);
});

// Send messages
chatStream.write({ content: 'Hello, everyone!' });

// Close the connection
chatStream.end();
```

## Stream Pagination

ScorpionJS supports paginated streams for large datasets:

```javascript
import { createApp } from 'scorpionjs';
import { Readable } from 'stream';

const app = createApp();

app.service('logs', {
  async find(params) {
    const query = params.query || {};
    const pageSize = query.$limit || 100;
    let page = 0;
    
    // Create a readable stream in object mode
    const stream = new Readable({
      objectMode: true,
      async read() {
        try {
          // Fetch the next page of logs
          const logs = await database.getLogs({
            skip: page * pageSize,
            limit: pageSize,
            filter: query.filter
          });
          
          // If we have logs, push them to the stream
          if (logs.length > 0) {
            for (const log of logs) {
              this.push(log);
            }
            page++;
          } else {
            // No more logs, end the stream
            this.push(null);
          }
        } catch (error) {
          this.destroy(error);
        }
      }
    });
    
    return stream;
  }
});
```

### Client-side Consumption

```javascript
// Get a stream of logs
const logStream = await client.service('logs').find({
  query: {
    filter: { level: 'error' },
    $limit: 50
  },
  stream: true
});

// Process logs as they arrive
logStream.on('data', log => {
  console.log(`[${log.timestamp}] ${log.level}: ${log.message}`);
});

logStream.on('end', () => {
  console.log('All logs processed');
});
```

## Stream Buffering and Backpressure

ScorpionJS respects stream backpressure to prevent memory issues:

```javascript
app.service('largeData', {
  async find(params) {
    const source = getDataSource(); // Some large data source
    
    // Create a transform stream with backpressure handling
    const stream = new Transform({
      objectMode: true,
      highWaterMark: 10, // Buffer only 10 objects
      transform(chunk, encoding, callback) {
        // Process the chunk
        const processed = processChunk(chunk);
        callback(null, processed);
      }
    });
    
    // Pipe with backpressure handling
    source.pipe(stream);
    
    return stream;
  }
});
```

## Stream Events

ScorpionJS emits events for stream lifecycle:

```javascript
app.on('stream.created', ({ service, method, stream }) => {
  console.log(`Stream created for ${service}.${method}`);
});

app.on('stream.closed', ({ service, method, bytesTransferred }) => {
  console.log(`Stream closed for ${service}.${method}, transferred ${bytesTransferred} bytes`);
});

app.on('stream.error', ({ service, method, error }) => {
  console.error(`Stream error in ${service}.${method}:`, error);
});
```

## Advanced Stream Patterns

### Stream Multiplexing

```javascript
import { createApp } from 'scorpionjs';
import { PassThrough } from 'stream';

const app = createApp();

app.service('broadcast', {
  async create(data, params) {
    const channel = data.channel;
    
    // Get or create channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    
    // Create a new stream for this client
    const stream = new PassThrough({ objectMode: true });
    
    // Add to channel subscribers
    this.channels.get(channel).add(stream);
    
    // Remove from channel when stream ends
    stream.on('end', () => {
      const subscribers = this.channels.get(channel);
      if (subscribers) {
        subscribers.delete(stream);
        if (subscribers.size === 0) {
          this.channels.delete(channel);
        }
      }
    });
    
    return stream;
  },
  
  async publish(channel, message) {
    const subscribers = this.channels.get(channel);
    
    if (subscribers) {
      for (const stream of subscribers) {
        stream.write(message);
      }
    }
    
    return { channel, subscribers: subscribers ? subscribers.size : 0 };
  },
  
  setup(app) {
    this.channels = new Map();
    this.app = app;
  }
});
```

### Stream Joining

```javascript
import { createApp } from 'scorpionjs';
import { Transform } from 'stream';
import { merge } from 'stream-combiner';

const app = createApp();

app.service('analytics', {
  async find(params) {
    // Get multiple data streams
    const userStream = this.app.service('users').find({ stream: true });
    const orderStream = this.app.service('orders').find({ stream: true });
    const productStream = this.app.service('products').find({ stream: true });
    
    // Create a transform to join the data
    const joinTransform = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // Process and join data from different streams
        // This is a simplified example
        this.buffer.push(chunk);
        callback();
      },
      flush(callback) {
        // Process any remaining data
        for (const item of this.buffer) {
          this.push(item);
        }
        callback();
      }
    });
    
    joinTransform.buffer = [];
    
    // Merge the streams
    return merge(userStream, orderStream, productStream)
      .pipe(joinTransform);
  }
});
```

## Cross-Runtime Stream Support

ScorpionJS provides stream support across different JavaScript runtimes:

### Node.js

```javascript
// Full stream support with Node.js streams
```

### Cloudflare Workers

```javascript
// Using Web Streams API
app.service('files', {
  async get(id) {
    const response = await fetch(`https://storage.example.com/${id}`);
    return response.body; // Web Stream
  }
});
```

### Deno

```javascript
// Using Deno streams
app.service('files', {
  async get(id) {
    const file = await Deno.open(`./files/${id}`);
    return file.readable; // Deno stream
  }
});
```

### Browser

```javascript
// Using Web Streams API in the browser
const fileStream = await client.service('files').get('document.pdf', { stream: true });

// Create a download link
const url = URL.createObjectURL(new Blob([]));
const link = document.createElement('a');
link.href = url;
link.download = 'document.pdf';

// Pipe the stream to the blob
const writer = new WritableStream({
  write(chunk) {
    // Append chunk to blob
  },
  close() {
    // Trigger download
    link.click();
    URL.revokeObjectURL(url);
  }
});

fileStream.pipeTo(writer);
```
