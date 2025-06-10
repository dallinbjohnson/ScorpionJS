// examples/zod-validation.js

import { createApp } from '../src/index.js';
import { z } from 'zod';

// Create a custom validator function using Zod
const zodValidator = (schema, data, options = {}) => {
  try {
    // Parse and validate data with Zod
    const result = schema.safeParse(data);
    
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.format()
      };
    }
    
    return {
      valid: true,
      // Return the parsed and validated data
      data: result.data
    };
  } catch (error) {
    return {
      valid: false,
      errors: error
    };
  }
};

// Create app with custom validator
const app = createApp({
  validator: {
    validate: zodValidator
  }
});

// Define a user schema using Zod
const userSchema = {
  // Use Zod schema as the definition
  definition: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().int().min(18).default(18),
    role: z.enum(['user', 'admin']).default('user'),
    settings: z.object({
      theme: z.enum(['light', 'dark']).default('light'),
      notifications: z.boolean().default(true)
    }).default({})
  }).strict(), // Strict mode rejects additional properties
  options: {
    useDefaults: true
  }
};

// Define a query schema
const userQuerySchema = {
  definition: z.object({
    role: z.string().optional(),
    minAge: z.number().int().min(0).optional()
  })
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
      // The validator will use our custom Zod validator since we configured it at the app level
      validateSchema(app.service('users').schemas)
    ]
  }
});

// Start the server
const server = app.listen(3031);
console.log('Server started on http://localhost:3031');

// Example of how to use the service with validation
async function runExamples() {
  try {
    // This should pass validation and apply defaults
    const validUser = await app.service('users').create({
      username: 'johndoe',
      email: 'john@example.com'
    });
    console.log('Valid user created with defaults applied:', validUser);
    // Notice that age=18, role='user', and settings are applied as defaults
    
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
    
    // This should fail validation (additional property not in schema due to strict mode)
    try {
      await app.service('users').create({
        username: 'extraprops',
        email: 'extra@example.com',
        extraProp: 'This should be rejected in strict mode'
      });
    } catch (error) {
      console.error('Validation error for additional properties:', error.message);
    }
    
    // Test type coercion - Zod can coerce string numbers to actual numbers
    try {
      const coercedUser = await app.service('users').create({
        username: 'coerced',
        email: 'coerced@example.com',
        age: '25' // This string will be coerced to a number
      });
      console.log('User with coerced age:', coercedUser);
    } catch (error) {
      console.error('Unexpected coercion error:', error.message);
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
