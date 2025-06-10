// examples/ajv-validation.js

import { createApp } from '../src/index.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Create and configure Ajv instance
const ajv = new Ajv({
  allErrors: true,           // Return all errors, not just the first one
  removeAdditional: 'all',   // Remove additional properties not in schema
  coerceTypes: true,         // Coerce data types when possible
  useDefaults: true          // Apply default values from schema
});

// Add string formats like 'email', 'date', 'uri', etc.
addFormats(ajv);

// Create a custom validator function using Ajv
const ajvValidator = (schema, data, options = {}) => {
  // Compile the schema (ajv caches compiled schemas for reuse)
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid) {
    return {
      valid: false,
      errors: validate.errors
    };
  }
  
  return {
    valid: true,
    // Return the data as it may have been modified (defaults, removed properties)
    data
  };
};

// Create app with custom validator
const app = createApp({
  validator: {
    validate: ajvValidator
  }
});

// Define a user schema using JSON Schema format (compatible with Ajv)
const userSchema = {
  definition: {
    type: 'object',
    required: ['username', 'email'],
    properties: {
      username: { type: 'string', minLength: 3 },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 18, default: 18 },
      role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
      settings: {
        type: 'object',
        properties: {
          theme: { type: 'string', default: 'light' },
          notifications: { type: 'boolean', default: true }
        }
      }
    },
    additionalProperties: false
  },
  options: {
    useDefaults: true,
    allErrors: true
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
    create: userSchema,
    update: userSchema,
    find: userQuerySchema,
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
      // The validator will use our custom Ajv validator since we configured it at the app level
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
    // This should pass validation and apply defaults
    const validUser = await app.service('users').create({
      username: 'johndoe',
      email: 'john@example.com'
    });
    console.log('Valid user created with defaults applied:', validUser);
    // Notice that age=18, role='user', and settings.theme='light' are applied as defaults
    
    // This should fail validation (invalid email format)
    try {
      await app.service('users').create({
        username: 'baduser',
        email: 'not-an-email'
      });
    } catch (error) {
      console.error('Validation error as expected:', error.message);
      console.error('Validation errors:', error.errors);
    }
    
    // This should fail validation (additional property not in schema)
    try {
      await app.service('users').create({
        username: 'extraprops',
        email: 'extra@example.com',
        extraProp: 'This should be removed'
      });
    } catch (error) {
      console.error('Validation error for additional properties:', error.message);
    }
    
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
