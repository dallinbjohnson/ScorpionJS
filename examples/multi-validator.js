// Example showing how to use different validators for different services
import { createApp } from '../src/app.js';
import { validateSchema } from '../src/schema.js';
import Ajv from 'ajv';
import { z } from 'zod';
import { BadRequest } from '../src/errors.js';

// Create the app with a default validator
const app = createApp();

// Define an Ajv validator function
const ajvValidator = (schema, data, options = {}) => {
  try {
    const ajv = new Ajv({
      allErrors: true,
      useDefaults: options.useDefaults ?? true,
      removeAdditional: options.removeAdditional ?? true,
      coerceTypes: options.coerceTypes ?? true
    });
    
    // Add formats if needed
    ajv.addFormat('email', /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
    
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
      data // Return the data which may have been modified by useDefaults or removeAdditional
    };
  } catch (error) {
    return {
      valid: false,
      errors: error
    };
  }
};

// Define a Zod validator function
const zodValidator = (schema, data, options = {}) => {
  try {
    const parseResult = schema.safeParse(data);
    
    if (!parseResult.success) {
      return {
        valid: false,
        errors: parseResult.error.format()
      };
    }
    
    return {
      valid: true,
      data: parseResult.data // Return the parsed data which may include defaults and transformations
    };
  } catch (error) {
    return {
      valid: false,
      errors: error
    };
  }
};

// Define a product schema using JSON Schema (for Ajv)
const productSchema = {
  definition: {
    type: 'object',
    required: ['name', 'price'],
    properties: {
      name: { type: 'string', minLength: 2 },
      price: { type: 'number', minimum: 0 },
      description: { type: 'string' },
      inStock: { type: 'boolean', default: true },
      category: { type: 'string', enum: ['electronics', 'books', 'clothing'] }
    },
    additionalProperties: false
  }
};

// Define a user schema using Zod
const userSchema = {
  definition: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().int().min(18).default(18),
    role: z.enum(['user', 'admin']).default('user'),
    settings: z.object({
      theme: z.enum(['light', 'dark']).default('light'),
      notifications: z.boolean().default(true)
    }).default({})
  }).strict()
};

// Create simple in-memory services
const productsService = {
  async find(params) {
    return [{ id: 1, name: 'Product 1', price: 99.99, inStock: true }];
  },
  async create(data, params) {
    console.log('Creating product:', data);
    return { ...data, id: Date.now() };
  }
};

const usersService = {
  async find(params) {
    return [{ id: 1, username: 'user1', email: 'user1@example.com', role: 'user' }];
  },
  async create(data, params) {
    console.log('Creating user:', data);
    return { ...data, id: Date.now() };
  }
};

// Register services with their schemas
app.service('products', productsService, {
  schemas: {
    create: productSchema,
    update: productSchema
  },
  // Service-specific validator using Ajv
  validator: {
    validate: ajvValidator
  }
});

app.service('users', usersService, {
  schemas: {
    create: userSchema,
    update: userSchema
  },
  // Service-specific validator using Zod
  validator: {
    validate: zodValidator
  }
});

// Apply validation hooks manually to both services
app.service('products').hooks({
  before: {
    create: [
      validateSchema(app.service('products').schemas)
    ]
  }
});

app.service('users').hooks({
  before: {
    create: [
      validateSchema(app.service('users').schemas)
    ]
  }
});

// Start the server
const server = app.listen(3030);
console.log('Server started on http://localhost:3030');

// Example usage
async function testValidation() {
  try {
    // Test product creation with Ajv validation
    console.log('\n--- Testing product creation (Ajv validation) ---');
    const product = await app.service('products').create({
      name: 'Laptop',
      price: '1299.99', // String will be coerced to number by Ajv
      category: 'electronics'
    });
    console.log('Product created successfully:', product);
    
    // Test user creation with Zod validation
    console.log('\n--- Testing user creation (Zod validation) ---');
    const user = await app.service('users').create({
      username: 'johndoe',
      email: 'john@example.com',
      age: 25
    });
    console.log('User created successfully:', user);
    
    // Test invalid product (will fail Ajv validation)
    console.log('\n--- Testing invalid product ---');
    try {
      await app.service('products').create({
        name: 'X', // Too short
        price: -10, // Negative price
        category: 'invalid' // Not in enum
      });
    } catch (error) {
      console.error('Product validation failed as expected:', error.message);
      console.error('Validation errors:', JSON.stringify(error.data?.errors, null, 2));
    }
    
    // Test invalid user (will fail Zod validation)
    console.log('\n--- Testing invalid user ---');
    try {
      await app.service('users').create({
        username: 'ab', // Too short
        email: 'not-an-email',
        age: 16 // Too young
      });
    } catch (error) {
      console.error('User validation failed as expected:', error.message);
      console.error('Validation errors:', JSON.stringify(error.data?.errors, null, 2));
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Close the server
    server.close();
  }
}

// Run the test
testValidation();
