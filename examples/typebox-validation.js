// Example showing how to use TypeBox for schema validation in ScorpionJS
import { createApp } from '../src/app.js';
import { validateSchema } from '../src/schema.js';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { BadRequest } from '../src/errors.js';

// Create the app
const app = createApp();

// Define a TypeBox validator function
const typeboxValidator = (schema, data, options = {}) => {
  try {
    // TypeCompiler creates a validator function from a TypeBox schema
    const validator = TypeCompiler.Compile(schema);
    const valid = validator.Check(data);
    
    if (!valid) {
      // Get detailed error information
      const errors = [...validator.Errors(data)];
      return {
        valid: false,
        errors
      };
    }
    
    // TypeBox doesn't transform data by default, but we can implement
    // functionality like default values if needed
    if (options.useDefaults) {
      const result = applyDefaults(schema, data);
      return {
        valid: true,
        data: result
      };
    }
    
    return {
      valid: true,
      data
    };
  } catch (error) {
    return {
      valid: false,
      errors: error
    };
  }
};

// Helper function to apply default values from schema
function applyDefaults(schema, data) {
  const result = { ...data };
  
  // Apply defaults for properties
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (result[key] === undefined && prop.default !== undefined) {
        result[key] = prop.default;
      }
      
      // Recursively apply defaults to nested objects
      if (prop.type === 'object' && result[key] && prop.properties) {
        result[key] = applyDefaults(prop, result[key]);
      }
    }
  }
  
  return result;
}

// Define an order schema using TypeBox
const orderSchema = {
  definition: Type.Object({
    customer: Type.Object({
      name: Type.String({ minLength: 2 }),
      email: Type.String({ format: 'email' }),
      phone: Type.Optional(Type.String())
    }),
    items: Type.Array(
      Type.Object({
        productId: Type.String(),
        quantity: Type.Integer({ minimum: 1 }),
        price: Type.Number({ minimum: 0 })
      }),
      { minItems: 1 }
    ),
    shipping: Type.Object({
      address: Type.String(),
      city: Type.String(),
      zipCode: Type.String(),
      express: Type.Optional(Type.Boolean({ default: false }))
    }),
    paymentMethod: Type.Union([
      Type.Literal('credit'),
      Type.Literal('debit'),
      Type.Literal('paypal')
    ]),
    notes: Type.Optional(Type.String()),
    status: Type.Enum({ Pending: 'pending', Processing: 'processing', Shipped: 'shipped', Delivered: 'delivered' }, { default: 'pending' })
  }, { additionalProperties: false })
};

// Define a query schema
const orderQuerySchema = {
  definition: Type.Object({
    status: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    minTotal: Type.Optional(Type.Number({ minimum: 0 })),
    fromDate: Type.Optional(Type.String({ format: 'date' }))
  })
};

// Create a simple in-memory orders service
const ordersService = {
  orders: [],
  
  async find(params) {
    return this.orders;
  },
  
  async get(id, params) {
    const order = this.orders.find(order => order.id === id);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  },
  
  async create(data, params) {
    const order = {
      ...data,
      id: `order-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.orders.push(order);
    return order;
  },
  
  async update(id, data, params) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index === -1) {
      throw new Error('Order not found');
    }
    const updatedOrder = { ...data, id };
    this.orders[index] = updatedOrder;
    return updatedOrder;
  },
  
  async patch(id, data, params) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index === -1) {
      throw new Error('Order not found');
    }
    const updatedOrder = { ...this.orders[index], ...data, id };
    this.orders[index] = updatedOrder;
    return updatedOrder;
  },
  
  async remove(id, params) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index === -1) {
      throw new Error('Order not found');
    }
    const removedOrder = this.orders[index];
    this.orders.splice(index, 1);
    return removedOrder;
  }
};

// Register the orders service with schemas and TypeBox validator
app.service('orders', ordersService, {
  schemas: {
    create: orderSchema,
    update: orderSchema,
    patch: Type.Partial(orderSchema.definition), // Use TypeBox's Partial for patch operations
    query: orderQuerySchema
  },
  validator: {
    validate: typeboxValidator
  }
});

// Apply validation hooks manually
app.service('orders').hooks({
  before: {
    all: [
      // Validate both data and query parameters
      validateSchema(app.service('orders').schemas)
    ]
  }
});

// Start the server
const server = app.listen(3032);
console.log('Server started on http://localhost:3032');

// Example usage
async function testTypeBoxValidation() {
  try {
    console.log('\n--- Testing order creation with TypeBox validation ---');
    const order = await app.service('orders').create({
      customer: {
        name: 'John Doe',
        email: 'john@example.com'
      },
      items: [
        {
          productId: 'product-123',
          quantity: 2,
          price: 29.99
        }
      ],
      shipping: {
        address: '123 Main St',
        city: 'Anytown',
        zipCode: '12345'
      },
      paymentMethod: 'credit',
      notes: 'Please deliver to the back door'
    });
    
    console.log('Order created successfully:', JSON.stringify(order, null, 2));
    
    // Test with invalid data
    console.log('\n--- Testing with invalid data ---');
    try {
      await app.service('orders').create({
        customer: {
          name: 'J', // Too short
          email: 'not-an-email' // Invalid email format
        },
        items: [], // Empty array, minimum 1 required
        shipping: {
          address: '123 Main St',
          city: 'Anytown'
          // Missing zipCode
        },
        paymentMethod: 'bitcoin' // Not in the allowed values
      });
    } catch (error) {
      console.error('Validation failed as expected:', error.message);
      console.error('Validation errors:', JSON.stringify(error.data?.errors, null, 2));
    }
    
    // Test query validation
    console.log('\n--- Testing query validation ---');
    try {
      await app.service('orders').find({
        query: {
          status: 'pending',
          minTotal: -50 // Negative number, minimum 0 required
        }
      });
    } catch (error) {
      console.error('Query validation failed as expected:', error.message);
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
testTypeBoxValidation();
