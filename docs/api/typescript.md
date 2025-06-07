# TypeScript Support in ScorpionJS

> Documentation for ScorpionJS v1.0.0

ScorpionJS provides first-class TypeScript support, enabling you to build type-safe applications with improved developer experience, better tooling, and fewer runtime errors.

---

## Table of Contents
- [Getting Started](#getting-started)
- [Type Definitions](#type-definitions)
- [Application Types](#application-types)
- [Service Types](#service-types)
- [Hook Types](#hook-types)
- [Plugin Types](#plugin-types)
- [Client Types](#client-types)
- [Extending Types](#extending-types)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Getting Started

To use ScorpionJS with TypeScript, install the necessary dependencies:

```bash
npm install typescript @types/node --save-dev
```

Create a `tsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Type Definitions

ScorpionJS includes TypeScript definitions for all core components:

```typescript
import { 
  Application,
  Service,
  Hook,
  HookContext,
  Plugin,
  ServiceParams,
  Paginated
} from 'scorpionjs';
```

---

## Application Types

Create a typed application instance:

```typescript
import { createApp, Application } from 'scorpionjs';

const app: Application = createApp({
  name: 'my-app',
  version: '1.0.0'
});

// Type checking for configuration
app.set('port', 3000); // OK
app.set('port', '3000'); // Type error: Expected number
```

---

## Service Types

Define interfaces for your service data:

```typescript
// Define your data model
interface User {
  id?: string;
  email: string;
  password?: string;
  name: string;
  role: 'user' | 'admin';
  createdAt?: Date;
}

// Create a typed service
import { Service, ServiceMethods, ServiceParams } from 'scorpionjs';

class UserService implements ServiceMethods<User> {
  async find(params?: ServiceParams): Promise<User[]> {
    // Implementation
    return [];
  }
  
  async get(id: string, params?: ServiceParams): Promise<User> {
    // Implementation
    return {
      id,
      email: 'user@example.com',
      name: 'Test User',
      role: 'user'
    };
  }
  
  async create(data: Partial<User>, params?: ServiceParams): Promise<User> {
    // Implementation
    return {
      id: '123',
      ...data,
      role: data.role || 'user',
      createdAt: new Date()
    } as User;
  }
  
  // Other methods: update, patch, remove
}

// Register the service
app.service<User>('users', new UserService());

// Get a typed service
const userService = app.service<User>('users');

// Type-safe service calls
const user = await userService.get('123');
console.log(user.name); // Type-safe property access
```

---

## Hook Types

Create typed hooks with proper context typing:

```typescript
import { Hook, HookContext } from 'scorpionjs';

// Define a custom context with user information
interface AuthContext extends HookContext {
  params: {
    user?: {
      id: string;
      role: string;
    };
    [key: string]: any;
  };
}

// Create a typed hook
const authenticate: Hook<AuthContext> = async (context) => {
  // Type-safe access to user
  if (!context.params.user) {
    throw new Error('Not authenticated');
  }
  
  return context;
};

// Use the typed hook
app.service('messages').hooks({
  before: {
    all: [authenticate]
  }
});
```

---

## Plugin Types

Create typed plugins:

```typescript
import { Application, Plugin } from 'scorpionjs';

// Define plugin options
interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  prefix?: string;
}

// Create a typed plugin
const loggerPlugin = (options: LoggerOptions = {}): Plugin => {
  return (app: Application) => {
    // Plugin implementation
  };
};

// Use the plugin with type checking
app.configure(loggerPlugin({ level: 'debug' })); // OK
app.configure(loggerPlugin({ level: 'trace' })); // Type error: Invalid level
```

---

## Client Types

Use types with the client:

```typescript
import { createClient, Client } from 'scorpionjs-client';

interface User {
  id: string;
  name: string;
}

const client: Client = createClient('http://localhost:3000');
const userService = client.service<User>('users');

// Type-safe client calls
const users = await userService.find();
console.log(users[0].name); // Type-safe property access
```

---

## Extending Types

Extend ScorpionJS types to add custom properties:

```typescript
// Add custom properties to the Application interface
declare module 'scorpionjs' {
  interface Application {
    logger: {
      info(message: string): void;
      error(message: string): void;
    };
    metrics: {
      increment(key: string): void;
      timing(key: string, value: number): void;
    };
  }
}

// Now you can use these properties with type safety
app.logger.info('Server started');
app.metrics.increment('api.requests');
```

---

## Best Practices

1. **Define clear interfaces** for your data models
2. **Use strict mode** in your tsconfig.json
3. **Avoid `any`** - use proper types or generics
4. **Create type guards** for runtime type checking
5. **Use discriminated unions** for complex state handling
6. **Document your types** with JSDoc comments

---

## Examples

### Complete Service with TypeScript

```typescript
// src/services/messages.ts
import { 
  Application, 
  Service, 
  ServiceMethods, 
  ServiceParams, 
  Paginated,
  HookContext
} from 'scorpionjs';

// Data model
export interface Message {
  id?: string;
  text: string;
  userId: string;
  createdAt?: Date;
}

// Query parameters
export interface MessageQuery {
  userId?: string;
  $limit?: number;
  $skip?: number;
  $sort?: {
    createdAt?: 1 | -1;
  };
}

// Extended params with query typing
export interface MessageParams extends ServiceParams {
  query?: MessageQuery;
}

// Service implementation
export class MessageService implements ServiceMethods<Message, MessageParams> {
  private messages: Message[] = [];
  
  async find(params?: MessageParams): Promise<Message[] | Paginated<Message>> {
    let results = [...this.messages];
    
    // Filter by userId if provided
    if (params?.query?.userId) {
      results = results.filter(m => m.userId === params.query.userId);
    }
    
    // Sort if requested
    if (params?.query?.$sort?.createdAt) {
      results.sort((a, b) => {
        const aDate = a.createdAt || new Date(0);
        const bDate = b.createdAt || new Date(0);
        return params.query.$sort.createdAt === 1 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      });
    }
    
    // Pagination
    const limit = params?.query?.$limit || 10;
    const skip = params?.query?.$skip || 0;
    const paginatedResults = results.slice(skip, skip + limit);
    
    if (params?.paginate) {
      return {
        total: results.length,
        limit,
        skip,
        data: paginatedResults
      };
    }
    
    return paginatedResults;
  }
  
  async get(id: string, params?: MessageParams): Promise<Message> {
    const message = this.messages.find(m => m.id === id);
    if (!message) {
      throw new Error(`Message with ID ${id} not found`);
    }
    return message;
  }
  
  async create(data: Partial<Message>, params?: MessageParams): Promise<Message> {
    const message: Message = {
      id: String(Date.now()),
      text: data.text,
      userId: data.userId,
      createdAt: new Date()
    };
    
    this.messages.push(message);
    return message;
  }
  
  // Implement other methods: update, patch, remove
}

// Service registration
export default function(app: Application): void {
  app.service<Message, MessageParams>('messages', new MessageService());
}
```

---

## Further Reading
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Services API](./services.md)
- [Hooks API](./hooks.md)
- [Plugins & Extensions](./plugins.md)
