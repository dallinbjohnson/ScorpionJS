# Schema Validation API

ScorpionJS facilitates robust schema validation, primarily leveraging JSON Schema and TypeScript. Validation is typically integrated into the request lifecycle via hooks, ensuring data integrity before it reaches your service methods. This document details how to define schemas and apply them using validation hooks.

## JSON Schema Validation with Hooks

Validation is performed using hooks, which apply your defined schemas to incoming data or query parameters. For a comprehensive understanding of hooks, refer to the [Hooks API](./hooks.md).

Reusable validation logic can be encapsulated in plugins. See [Plugins & Extensions](./plugins.md).
Validation options can often be configured globally or passed to validation hooks. See [Configuration API](./configuration.md) for general configuration.

### Defining Schemas and Applying Validation Hooks

1.  **Define Your Schemas**: Schemas are typically defined in dedicated files (e.g., `[service-name].schema.js`) or alongside your service logic.

    ```javascript
    // Example: services/messages/messages.schemas.js
    export const messageCreateSchema = {
      type: 'object',
      required: ['text'],
      properties: {
        id: { type: 'number' },
        text: { type: 'string', minLength: 1, maxLength: 1000 },
        userId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    };

    export const messagePatchSchema = {
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1, maxLength: 1000 }
      }
    };

    export const messageQuerySchema = {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        $limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    };
    ```

2.  **Implement Your Service**: Define your service methods as usual.

    ```javascript
    // Example: services/messages/messages.service.js
    export default {
      async find(params) {
        // params.query has been validated by a hook
        console.log('Finding messages with query:', params.query);
        return [];
      },
      
      async create(data, params) {
        // data has been validated by a hook
        console.log('Creating message with data:', data);
        return { ...data, id: Date.now() };
      }
      // ... other service methods (get, update, patch, remove)
    };
    ```

3.  **Apply Validation Hooks**: Use validation hooks (e.g., `validateData`, `validateQuery` provided by ScorpionJS or a plugin) in your service's hooks file.

    ```javascript
    // Example: services/messages/messages.hooks.js
    import { validateData, validateQuery } from 'scorpionjs-validation-hooks'; // Assuming a validation hook utility
    import { messageCreateSchema, messagePatchSchema, messageQuerySchema } from './messages.schemas';

    export default {
      before: {
        find: [validateQuery(messageQuerySchema)], // Simple usage with one schema
        create: [validateData(messageCreateSchema)], // Simple usage with one schema
        // update: [validateData(messageUpdateSchema)], // Define and use an update schema
        patch: [validateData(messagePatchSchema)]
      }
      // after: { ... },
      // error: { ... }
    };
    ```

    The `validateData` and `validateQuery` hooks can also be used for dynamic schema selection based on request content.

    **Dynamic Schema Selection with `validateData` and `validateQuery`**

    Instead of passing a single schema, you can pass an options object to `validateData` or `validateQuery` to enable dynamic validation. This is useful when an endpoint needs to handle different data structures based on a specific field (e.g., `type`, `version`).

    **Options Object Structure:**

    *   `field` (String): A dot-notation path to the field whose value determines the schema. 
        *   For `validateData`: Path within `context.data` (e.g., `'payload.type'` or `'itemType'`).
        *   For `validateQuery`: Path within `context.params.query` (e.g., `'apiVersion'` or `'format'`).
    *   `schemas` (Object): An object mapping possible values of the `field` to their respective schema objects.
    *   `defaultSchema` (Object, optional): A schema to use if the `field`'s value doesn't match any key in the `schemas` map, or if the `field` is not present. If not provided and no match occurs, a `BadRequest` error is typically thrown.
    *   `validationOptions` (Object, optional): Options to pass to the underlying validation engine (e.g., Ajv options like `{ allErrors: true, coerceTypes: true }`).

    **Example of Dynamic Validation:**

    Consider an `items` service where the `create` method accepts different payload structures based on `data.itemType`:

    ```javascript
    // Schemas (e.g., services/items/items.schemas.js)
    export const itemTypeASchema = { type: 'object', properties: { itemType: { const: 'A' }, nameA: { type: 'string' } }, required: ['itemType', 'nameA'] };
    export const itemTypeBSchema = { type: 'object', properties: { itemType: { const: 'B' }, nameB: { type: 'number' } }, required: ['itemType', 'nameB'] };

    // Hooks (e.g., services/items/items.hooks.js)
    import { validateData } from 'scorpionjs-validation-hooks';
    import { itemTypeASchema, itemTypeBSchema } from './items.schemas';

    export default {
      before: {
        create: [
          validateData({
            field: 'itemType', // Looks for context.data.itemType
            schemas: {
              'A': itemTypeASchema,
              'B': itemTypeBSchema
            },
            // defaultSchema: someGenericItemSchema, // Optional fallback
            validationOptions: { allErrors: true, removeAdditional: 'failing' }
          })
        ]
        // ... other methods and hooks
      }
    };
    ```
    In this example, when a `create` request is made to the `items` service:
    1. The `validateData` hook inspects `context.data.itemType`.
    2. If `itemType` is 'A', `itemTypeASchema` is used for validation.
    3. If `itemType` is 'B', `itemTypeBSchema` is used.
    4. If `itemType` is something else and no `defaultSchema` is provided, an error is thrown.

4.  **Register Service, Schemas (for tooling), and Hooks (for validation)**:
    In your main application setup (`app.js` or similar), you register the service (optionally providing its schemas for tooling) and then apply hooks for runtime validation.

    ```javascript
    import { createApp } from 'scorpionjs';
    import messagesService from './services/messages/messages.service';
    import messagesHooks from './services/messages/messages.hooks';
    // Import the schemas to pass them during service registration
    import { messageCreateSchema, messagePatchSchema, messageQuerySchema /*, other schemas */ } from './services/messages/messages.schemas';

    const app = createApp();

    // Register the service, providing schemas for tooling (e.g., OpenAPI, service discovery)
    // The third argument to app.service() can be an options object.
    app.service('messages', messagesService, {
      // This 'schemas' property is for metadata and tooling.
      // The actual structure (e.g., `options.schemas` or just `schemas` directly)
      // might depend on ScorpionJS conventions or specific middleware needs.
      schemas: {
        create: messageCreateSchema,
        patch: messagePatchSchema,
        query: messageQuerySchema
        // Add other method schemas here if applicable (e.g., update, get, remove)
      }
    });

    // Apply hooks for runtime validation, ideally using the same schema definitions
    app.service('messages').hooks(messagesHooks);
    ```
    This approach ensures that runtime validation is handled by hooks, while schemas are also available directly on the service registration for metadata purposes, facilitating integration with other tools.

### Method-specific Schemas

Define different schemas for various service methods and apply them using corresponding validation hooks.

```javascript
// Example: services/users/users.schemas.js
export const userCreateSchema = {
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: { /* ... */ }
};
export const userUpdateSchema = {
  type: 'object',
  required: ['email', 'name'],
  properties: { /* ... */ }
};
export const userPatchSchema = { /* ... */ };
export const userQuerySchema = { /* ... */ };

// Example: services/users/users.hooks.js
import { validateData, validateQuery } from 'scorpionjs-validation-hooks';
import { userCreateSchema, userUpdateSchema, userPatchSchema, userQuerySchema } from './users.schemas';

export default {
  before: {
    create: [validateData(userCreateSchema)],
    update: [validateData(userUpdateSchema)],
    patch: [validateData(userPatchSchema)],
    find: [validateQuery(userQuerySchema)]
  }
};

// Service registration and hook application follow the pattern shown above.
```

### Custom Methods Schema

Validation for custom service methods is also handled via hooks.

```javascript
// Example: services/payments/payments.schemas.js
export const processPaymentSchema = {
  type: 'object',
  required: ['amount', 'currency'],
  properties: { /* ... */ }
};
export const refundSchema = {
  type: 'object',
  required: ['amount'],
  properties: { /* ... */ }
};

// Example: services/payments/payments.hooks.js
import { validateData } from 'scorpionjs-validation-hooks';
import { processPaymentSchema, refundSchema } from './payments.schemas';

export default {
  before: {
    // Assuming 'processPayment' and 'refund' are custom methods
    processPayment: [validateData(processPaymentSchema)],
    refund: [validateData(refundSchema)] // Note: 'id' for refund is a URL param, data is the body
  }
};

// Service implementation for payments would include:
// async processPayment(data, params) { /* data validated */ }
// async refund(id, data, params) { /* data validated */ }
```

### Schema Validation Options

Validation options (e.g., from Ajv) are typically passed to the validation hook or configured for the validation library instance it uses.

```javascript
// Example: services/messages/messages.hooks.js
import { validateData } from 'scorpionjs-validation-hooks';
import { messageCreateSchema } from './messages.schemas';

const createValidationOptions = {
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true
};

export default {
  before: {
    create: [validateData(messageCreateSchema, createValidationOptions)],
    // ... other methods can use different options or schemas
  }
};
```

### Schema Reuse

You can define shared schemas and import them into your service-specific schema files or directly into hooks.

```javascript
// Example: common/schemas.js (or src/schemas/index.js)
export const idSchema = { type: 'number' };
export const emailSchema = { type: 'string', format: 'email' };
export const passwordSchema = { type: 'string', minLength: 8 };

export const userBaseSchemaProperties = {
  id: idSchema,
  email: emailSchema,
  name: { type: 'string' }
};

// Example: services/users/users.schemas.js
import { userBaseSchemaProperties, passwordSchema } from '../../common/schemas'; // Adjust path as needed

export const userCreateSchema = {
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: {
    ...userBaseSchemaProperties,
    password: passwordSchema
  }
};

// Hooks would then import and use userCreateSchema as usual.

// For OpenAPI/Swagger, you might register these shared schemas globally:
// app.configure(openapi({
//   // ... other OpenAPI config
//   components: {
//     schemas: {
//       id: idSchema, // from common/schemas.js
//       email: emailSchema,
//       UserCreate: userCreateSchema // from users.schemas.js
//     }
//   }
// }));
```

## TypeScript Integration

ScorpionJS allows you to generate TypeScript types from your JSON schemas, providing strong typing for your service data and parameters. This remains valuable even with hook-based validation.

```typescript
import { createApp } from 'scorpionjs';
// Assuming 'schema' utility for type generation is available, e.g., from '@sinclair/typebox'
// or a ScorpionJS utility if it provides one for JSON Schema to TS type.
// For this example, let's imagine a utility or direct use of a library like TypeBox/Zod for schema definition and type inference.

// Example using a library like Zod for schema and type inference:
import { z } from 'zod';

const itemSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  price: z.number(),
  tags: z.array(z.string()).optional()
});

// Infer TypeScript type from the Zod schema
type Item = z.infer<typeof itemSchema>;

// Example usage:
// const newItem: Item = { name: 'Laptop', price: 1200 }; // Valid
// const invalidItem: Item = { name: 'Tablet' }; // Error: price is missing

const app = createApp();

// Register service
app.service('items', {
  async create(data: Item, params) {
    // data is type-checked as Item due to TypeScript.
    // Runtime validation is handled by hooks using itemSchema (or its JSON schema equivalent).
    console.log(data.name, data.price);
    return { ...data, id: Math.random() };
  }
});

// Assuming a validation hook is set up for the 'items' service.
// If using Zod, the hook might use itemSchema.parse or itemSchema.safeParse.
// e.g., in items.hooks.ts:
// import { validateWithZod } from 'scorpionjs-zod-validator-hook'; // Hypothetical hook
// import { itemSchema } from './items.schemas'; // or wherever itemSchema is defined
// export default {
//   before: {
//     create: [validateWithZod(itemSchema)]
//   }
// };
```

## Validation Libraries

ScorpionJS is flexible with validation libraries. While Ajv is a common choice for JSON Schema, you can integrate others like TypeBox, Zod, etc., typically by using or creating appropriate validation hooks.

### Customizing or Using Different Libraries (e.g., Ajv, Zod)

```javascript
import { createApp } from 'scorpionjs';
import Ajv from 'ajv';
import { z } from 'zod';
// import { createAjvValidatorHook, createZodValidatorHook } from 'scorpionjs-validation-hooks';

const app = createApp();

// --- Using a custom Ajv instance --- 
const customAjvInstance = new Ajv({ allErrors: true, coerceTypes: true });
const orderAjvSchema = { /* JSON Schema for orders */ };
// const validateOrderWithCustomAjv = createAjvValidatorHook(orderAjvSchema, customAjvInstance);

// --- Using Zod --- 
const productZodSchema = z.object({ productId: z.string(), name: z.string() });
// const validateProductWithZod = createZodValidatorHook(productZodSchema);

app.service('orders', { /* ... methods ... */ });
// app.service('orders').hooks({ before: { create: [validateOrderWithCustomAjv] } });

app.service('products', { /* ... methods ... */ });
// app.service('products').hooks({ before: { create: [validateProductWithZod] } });

// The actual validation hooks (createAjvValidatorHook, createZodValidatorHook)
// would encapsulate the logic of using the specific library and its options.
```

## Swagger/OpenAPI Integration and Service Discovery

While runtime validation is managed by hooks, providing schemas directly during service registration offers significant benefits for tooling like OpenAPI/Swagger generation and service discovery features. This allows other parts of your system or external tools to understand a service's data structures.

### Providing Schemas for Tooling

When registering a service, you can pass its associated schemas as an option (e.g., within an `options` object passed as the third argument to `app.service()`). This makes them available for metadata purposes without altering the hook-based runtime validation flow.

Refer to step 4 in the "Defining Schemas and Applying Validation Hooks" section for an example of registering a service with a `schemas` property in its options, like so:

```javascript
// app.service('messages', messagesService, {
//   schemas: {
//     create: messageCreateSchema,
//     patch: messagePatchSchema,
//     query: messageQuerySchema
//   }
// });
// app.service('messages').hooks(messagesHooks);
```
By providing schemas this way, OpenAPI generation tools and service discovery mechanisms can easily access them. Runtime validation remains the responsibility of the hooks, ensuring a separation of concerns while maintaining a single source of truth for your data structures (by using the same schema objects for both purposes).

### Enabling OpenAPI with Registered Schemas

When schemas are provided during service registration (e.g., via an `options.schemas` property), OpenAPI middleware can often leverage them directly, simplifying your API documentation setup.

```javascript
import { createApp } from 'scorpionjs';
import { openapi } from 'scorpionjs/middleware'; // Example path

// Import services, their schemas, and hooks
import messagesService from './services/messages/messages.service';
import messagesHooks from './services/messages/messages.hooks';
import { messageCreateSchema, messagePatchSchema, messageQuerySchema } from './services/messages/messages.schemas';

// ... import other services like 'users' and their respective schemas/hooks similarly ...

const app = createApp();

// Register services with their schemas for tooling
app.service('messages', messagesService, {
  schemas: { // This property makes schemas available for OpenAPI etc.
    create: messageCreateSchema,
    patch: messagePatchSchema,
    query: messageQuerySchema
    // Define schemas for other methods like get, update, remove as needed
  }
});
// Runtime validation is still handled by hooks
app.service('messages').hooks(messagesHooks);

// Example for another service:
// import usersService from './services/users/users.service';
// import usersHooks from './services/users/users.hooks';
// import { userCreateSchema, userQuerySchema } from './services/users/users.schemas';
// app.service('users', usersService, {
//   schemas: { create: userCreateSchema, query: userQuerySchema }
// });
// app.service('users').hooks(usersHooks);

// Configure OpenAPI middleware
app.configure(openapi({
  info: {
    title: 'My ScorpionJS API',
    version: '1.0.0',
  },
  docsPath: '/docs',       // Path to serve OpenAPI spec (JSON/YAML)
  uiPath: '/docs-ui',      // Path to serve Swagger UI
  // The OpenAPI middleware might automatically discover schemas from the 'options.schemas'
  // property of registered services. If not, or for more control (e.g., naming),
  // you can still use the components.schemas section.
  components: {
    schemas: {
      // This section can be used for shared/global schemas, or to explicitly
      // name/override schemas if auto-discovery isn't sufficient or desired.
      // For example, if 'messageCreateSchema' is used by the 'messages' service:
      // MessageCreatePayload: messageCreateSchema, // Explicitly naming for OpenAPI
      // If your middleware auto-discovers from service options, this might be minimal.
    }
  },
  // The middleware should ideally be able to associate service methods
  // with their respective schemas provided during registration.
  // Consult your OpenAPI middleware's documentation for specifics on how it
  // discovers and uses schemas attached to service options.
}));

app.listen(3000).then(() => {
  console.log('Swagger UI available at http://localhost:3000/docs-ui');
});
```
This dual approach ensures that your schemas serve both runtime validation (via hooks) and API documentation/discovery (via service registration options), promoting consistency and maintainability.

{{ ... }}

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
