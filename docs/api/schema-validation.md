# Schema Validation API

ScorpionJS provides built-in schema validation using JSON Schema and TypeScript. This document provides detailed API documentation for configuring and using schema validation in ScorpionJS.

## JSON Schema Validation

Validation is most commonly performed in hooks. See [Hooks API](./hooks.md) for how to use validation hooks.

Reusable validation logic can be shared via plugins. See [Plugins & Extensions](./plugins.md).

Validation options can be set globally or per-service. See [Configuration API](./configuration.md) for details.

### Basic Schema Configuration

```javascript
import { createApp } from 'scorpionjs';

const app = createApp();

// Define a schema for the messages service
const messageSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    id: { type: 'number' },
    text: { type: 'string', minLength: 1, maxLength: 1000 },
    userId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

// Register a service with schema validation
app.service('messages', {
  schema: {
    create: messageSchema,
    update: messageSchema,
    patch: {
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1, maxLength: 1000 }
      }
    },
    query: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  },
  
  async find(params) {
    // The params.query has been validated against the query schema
    return [];
  },
  
  async create(data, params) {
    // The data has been validated against the create schema
    return { ...data, id: Date.now() };
  }
});
```

### Method-specific Schemas

You can define different schemas for different service methods:

```javascript
app.service('users', {
  schema: {
    // Schema for create method
    create: {
      type: 'object',
      required: ['email', 'password', 'name'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' }
      }
    },
    
    // Schema for update method
    update: {
      type: 'object',
      required: ['email', 'name'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string' }
      }
    },
    
    // Schema for patch method
    patch: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        password: { type: 'string', minLength: 8 }
      },
      additionalProperties: false
    },
    
    // Schema for query parameters
    query: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  }
});
```

### Custom Methods Schema

You can also define schemas for custom methods:

```javascript
app.service('payments', {
  schema: {
    // Standard method schemas
    create: { /* ... */ },
    
    // Custom method schemas
    processPayment: {
      type: 'object',
      required: ['amount', 'currency'],
      properties: {
        amount: { type: 'number', minimum: 0.01 },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
        description: { type: 'string' }
      }
    },
    
    refund: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', minimum: 0.01 },
        reason: { type: 'string' }
      }
    }
  },
  
  async processPayment(data, params) {
    // data has been validated against the processPayment schema
    return {
      transactionId: `tx-${Date.now()}`,
      status: 'completed',
      ...data
    };
  },
  
  async refund(id, data, params) {
    // data has been validated against the refund schema
    return {
      transactionId: id,
      status: 'refunded',
      ...data
    };
  }
});
```

### Schema Validation Options

You can configure schema validation options:

```javascript
app.service('messages', {
  schema: {
    create: messageSchema,
    update: messageSchema,
    patch: patchSchema,
    query: querySchema,
    
    // Validation options
    options: {
      allErrors: true,         // Return all errors, not just the first one
      removeAdditional: true,  // Remove additional properties
      useDefaults: true,       // Apply default values
      coerceTypes: true        // Coerce data types
    }
  }
});
```

### Schema Reuse

You can reuse schemas across services:

```javascript
// Define shared schemas
const schemas = {
  id: { type: 'number' },
  
  email: { 
    type: 'string', 
    format: 'email' 
  },
  
  password: { 
    type: 'string', 
    minLength: 8,
    maxLength: 100
  },
  
  pagination: {
    type: 'object',
    properties: {
      $limit: { type: 'number', minimum: 1, maximum: 100 },
      $skip: { type: 'number', minimum: 0 }
    }
  }
};

// Use shared schemas in services
app.service('users', {
  schema: {
    create: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        id: schemas.id,
        email: schemas.email,
        password: schemas.password
      }
    },
    query: {
      type: 'object',
      properties: {
        email: schemas.email,
        ...schemas.pagination.properties
      }
    }
  }
});
```

## TypeScript Integration

ScorpionJS provides TypeScript support for schema validation:

### Defining Types

```typescript
// Define your types
interface User {
  id?: number;
  email: string;
  password: string;
  name?: string;
}

interface UserQuery {
  email?: string;
  $limit?: number;
  $skip?: number;
}

// Define a service that uses these types
import { createApp, Service } from 'scorpionjs';

class UserService implements Service<User, UserQuery> {
  private users: User[] = [];
  
  async find(params: { query: UserQuery }): Promise<User[]> {
    let users = [...this.users];
    
    // Apply query filters
    if (params.query.email) {
      users = users.filter(user => user.email === params.query.email);
    }
    
    // Apply pagination
    const limit = params.query.$limit || 10;
    const skip = params.query.$skip || 0;
    
    return users.slice(skip, skip + limit);
  }
  
  async get(id: number): Promise<User> {
    const user = this.users.find(user => user.id === id);
    if (!user) throw new Error('User not found');
    return user;
  }
  
  async create(data: User): Promise<User> {
    const user = { ...data, id: Date.now() };
    this.users.push(user);
    return user;
  }
  
  // Other methods...
}

const app = createApp();
app.service('users', new UserService());
```

### Using TypeScript with JSON Schema

You can combine TypeScript with JSON Schema for runtime validation:

```typescript
import { createApp, Service } from 'scorpionjs';

// Define your types
interface User {
  id?: number;
  email: string;
  password: string;
  name?: string;
}

interface UserQuery {
  email?: string;
  $limit?: number;
  $skip?: number;
}

// Create a service class
class UserService implements Service<User, UserQuery> {
  private users: User[] = [];
  
  // Define JSON Schema for runtime validation
  schema = {
    create: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' }
      }
    },
    query: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 },
        $skip: { type: 'number', minimum: 0 }
      }
    }
  };
  
  async find(params: { query: UserQuery }): Promise<User[]> {
    // Implementation
    return this.users;
  }
  
  async create(data: User): Promise<User> {
    // Implementation
    const user = { ...data, id: Date.now() };
    this.users.push(user);
    return user;
  }
  
  // Other methods...
}

const app = createApp();
app.service('users', new UserService());
```

### TypeScript Decorators

ScorpionJS provides decorators for schema validation:

```typescript
import { createApp, Service, validate } from 'scorpionjs';

class UserService {
  private users = [];
  
  @validate({
    query: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  })
  async find(params) {
    // params.query has been validated
    return this.users;
  }
  
  @validate({
    data: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' }
      }
    }
  })
  async create(data, params) {
    // data has been validated
    const user = { ...data, id: Date.now() };
    this.users.push(user);
    return user;
  }
}

const app = createApp();
app.service('users', new UserService());
```

## Swagger/OpenAPI Integration

ScorpionJS can automatically generate Swagger/OpenAPI documentation from your schemas:

```javascript
import { createApp } from 'scorpionjs';
import swagger from 'scorpionjs-swagger';

const app = createApp();

// Register services with schemas
app.service('users', {
  schema: {
    create: { /* ... */ },
    update: { /* ... */ },
    patch: { /* ... */ },
    query: { /* ... */ }
  }
});

app.service('messages', {
  schema: {
    create: { /* ... */ },
    update: { /* ... */ },
    patch: { /* ... */ },
    query: { /* ... */ }
  }
});

// Configure Swagger
app.configure(swagger({
  docsPath: '/docs',
  uiPath: '/docs-ui',
  info: {
    title: 'My API',
    description: 'API documentation',
    version: '1.0.0'
  }
}));

// Start the server
app.listen(3000).then(() => {
  console.log('Swagger UI available at http://localhost:3000/docs-ui');
});
```

## Error Handling

Schema validation errors are returned with detailed information:

```javascript
try {
  await app.service('users').create({
    // Missing required email field
    password: '123'
  });
} catch (error) {
  console.error(error.name); // 'ValidationError'
  console.error(error.message); // 'data should have required property "email"'
  console.error(error.errors); // Detailed validation errors
}
```

## Custom Validators

You can add custom validators to your schemas:

```javascript
import { createApp, addValidator } from 'scorpionjs';

// Add a custom validator
addValidator('isUniqueEmail', async (value, { service }) => {
  const users = await service.find({ query: { email: value } });
  return users.length === 0;
});

const app = createApp();

// Use the custom validator
app.service('users', {
  schema: {
    create: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { 
          type: 'string', 
          format: 'email',
          isUniqueEmail: true
        },
        password: { type: 'string', minLength: 8 }
      }
    }
  }
});
```

## Advanced Schema Features

### Conditional Validation

```javascript
app.service('payments', {
  schema: {
    create: {
      type: 'object',
      required: ['amount', 'method'],
      properties: {
        amount: { type: 'number', minimum: 0.01 },
        method: { type: 'string', enum: ['credit_card', 'bank_transfer', 'paypal'] },
        
        // Credit card fields
        cardNumber: { type: 'string' },
        cardExpiry: { type: 'string' },
        cardCVC: { type: 'string' },
        
        // Bank transfer fields
        accountNumber: { type: 'string' },
        routingNumber: { type: 'string' },
        
        // PayPal fields
        paypalEmail: { type: 'string', format: 'email' }
      },
      
      // Conditional validation
      allOf: [
        {
          if: {
            properties: { method: { enum: ['credit_card'] } }
          },
          then: {
            required: ['cardNumber', 'cardExpiry', 'cardCVC']
          }
        },
        {
          if: {
            properties: { method: { enum: ['bank_transfer'] } }
          },
          then: {
            required: ['accountNumber', 'routingNumber']
          }
        },
        {
          if: {
            properties: { method: { enum: ['paypal'] } }
          },
          then: {
            required: ['paypalEmail']
          }
        }
      ]
    }
  }
});
```

### Dynamic Schemas

```javascript
app.service('dynamicService', {
  async setup(app) {
    // Fetch schema from database or external source
    const schema = await app.service('schemas').get('dynamicService');
    
    // Set the schema dynamically
    this.schema = schema;
  }
});
```

### Schema Composition

```javascript
// Base schema
const basePersonSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' }
  }
};

// Extended schema for users
const userSchema = {
  ...basePersonSchema,
  required: ['name', 'email', 'password'],
  properties: {
    ...basePersonSchema.properties,
    password: { type: 'string', minLength: 8 },
    role: { type: 'string', enum: ['user', 'admin'] }
  }
};

// Extended schema for customers
const customerSchema = {
  ...basePersonSchema,
  required: ['name', 'email', 'company'],
  properties: {
    ...basePersonSchema.properties,
    company: { type: 'string' },
    subscription: { type: 'string', enum: ['free', 'basic', 'premium'] }
  }
};

// Use the schemas
app.service('users', {
  schema: {
    create: userSchema,
    update: userSchema
  }
});

app.service('customers', {
  schema: {
    create: customerSchema,
    update: customerSchema
  }
});
```
