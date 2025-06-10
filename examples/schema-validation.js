// examples/schema-validation.js

import { createApp } from '../src/index.js';

// Create a new ScorpionJS application
const app = createApp();

// Define a simple JSON Schema for a user
const userSchema = {
  definition: {
    type: 'object',
    required: ['username', 'email'],
    properties: {
      username: { type: 'string', minLength: 3 },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 18 },
      role: { type: 'string', enum: ['user', 'admin'] }
    }
  }
};

// Define a query schema
const userQuerySchema = {
  definition: {
    type: 'object',
    properties: {
      role: { type: 'string' },
      minAge: { type: 'integer', minimum: 0 }
    }
  }
};

// Define dynamic schemas based on user type
const dynamicUserSchemas = {
  field: 'type',
  schemas: {
    'personal': {
      definition: {
        type: 'object',
        required: ['username', 'email', 'firstName', 'lastName'],
        properties: {
          username: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          age: { type: 'integer', minimum: 18 }
        }
      }
    },
    'business': {
      definition: {
        type: 'object',
        required: ['username', 'email', 'companyName', 'industry'],
        properties: {
          username: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          companyName: { type: 'string' },
          industry: { type: 'string' },
          employees: { type: 'integer', minimum: 1 }
        }
      }
    }
  }
};

// Create a simple in-memory users service
const usersService = {
  users: [],
  
  async find(params) {
    console.log('Finding users with params:', params);
    return this.users;
  },
  
  async get(id) {
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    return user;
  },
  
  async create(data) {
    console.log('Creating user:', data);
    const id = Date.now().toString();
    const newUser = { id, ...data };
    this.users.push(newUser);
    return newUser;
  },
  
  async update(id, data) {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }
    const updatedUser = { ...this.users[index], ...data };
    this.users[index] = updatedUser;
    return updatedUser;
  }
};

// Register the users service with schemas
app.service('users', usersService, {
  schemas: {
    // Standard method schemas
    find: userQuerySchema,
    create: userSchema,
    update: userSchema,
    // Dynamic schemas based on the 'type' field
    dynamicSchemas: dynamicUserSchemas,
    // Query schema for all methods
    query: userQuerySchema
  }
});

// Apply schema validation hooks manually
// This is the recommended way to use schema validation
import { validateSchema } from '../src/schema.js';

// Apply validation hooks to the users service
app.service('users').hooks({
  before: {
    all: [
      // Use validateSchema to validate both data and query parameters
      validateSchema(app.service('users').schemas)
    ]
  }
});

// Start the server
const server = app.listen(3030);
console.log('Server started on http://localhost:3030');

// Example of how to use the service with validation
async function runExamples() {
  try {
    // This should pass validation
    const validUser = await app.service('users').create({
      username: 'johndoe',
      email: 'john@example.com',
      age: 25,
      role: 'user'
    });
    console.log('Valid user created:', validUser);
    
    // This should fail validation (missing required email)
    try {
      await app.service('users').create({
        username: 'baduser'
      });
    } catch (error) {
      console.error('Validation error as expected:', error.message);
    }
    
    // Test dynamic schema with personal user type
    const personalUser = await app.service('users').create({
      type: 'personal',
      username: 'janedoe',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      age: 30
    });
    console.log('Personal user created:', personalUser);
    
    // Test dynamic schema with business user type
    const businessUser = await app.service('users').create({
      type: 'business',
      username: 'acmecorp',
      email: 'info@acme.com',
      companyName: 'ACME Corporation',
      industry: 'Technology',
      employees: 500
    });
    console.log('Business user created:', businessUser);
    
    // Test query validation
    const users = await app.service('users').find({
      query: { role: 'user', minAge: 20 }
    });
    console.log('Found users:', users);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Close the server after examples run
    server.close();
  }
}

// Run the examples
runExamples();
