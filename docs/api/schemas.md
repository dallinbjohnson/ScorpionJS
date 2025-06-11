# Schema Validation

ScorpionJS provides a flexible schema validation system that allows you to define and enforce data structures for your service methods. This helps ensure data integrity and provides a way to document your API's expected inputs and outputs. Validation is typically integrated into the request lifecycle via hooks, ensuring data integrity before it reaches your service methods.

## Schema Definition

Schemas in ScorpionJS follow a simple structure that can be extended to work with various validation libraries:

```typescript
interface Schema {
  definition: any;            // The actual schema definition (format depends on validator)
  options?: SchemaOptions;    // Optional configuration for this schema
}

interface SchemaOptions {
  strict?: boolean;           // If true, unknown properties will be rejected
  additionalProperties?: boolean; // If false, unknown properties will be rejected
  coerce?: boolean;           // If true, attempt to coerce values to the correct type
  [key: string]: any;         // Additional options for the validator
}
```

## Service Schemas

You can define schemas for your service methods when registering a service:

```typescript
app.use('users', usersService, {
  schemas: {
    // Method-specific schemas
    find: querySchema,        // Schema for the query parameters in find()
    get: idSchema,            // Schema for the id parameter in get()
    create: createSchema,     // Schema for the data in create()
    update: updateSchema,     // Schema for the data in update()
    patch: patchSchema,       // Schema for the data in patch()
    remove: removeSchema,     // Schema for the id in remove()
    
    // Custom method schemas
    customMethod: customSchema,
    
    // Global query schema (applied to all methods)
    query: globalQuerySchema,
    
    // Dynamic schemas (selected based on a field value)
    dynamicSchemas: {
      field: 'type',          // Field to use for schema selection
      schemas: {
        'type1': schema1,     // Schema to use when field value is 'type1'
        'type2': schema2      // Schema to use when field value is 'type2'
      }
    }
  }
});
```

## Validation Hooks

When schemas are provided during service registration, they are registered on the service for introspection purposes but validation hooks are not automatically applied. You need to explicitly apply validation hooks to enforce schema validation:

```typescript
import { validateData, validateQuery, validateSchema } from 'scorpionjs';

// Validate request data against a schema
app.service('users').hooks({
  before: {
    create: [validateData(createSchema)],
    update: [validateData(updateSchema)]
  }
});

// Validate query parameters
app.service('users').hooks({
  before: {
    find: [validateQuery(querySchema)]
  }
});

// Validate both data and query using service schemas
app.service('users').hooks({
  before: {
    all: [validateSchema({
      create: createSchema,
      find: querySchema,
      query: globalQuerySchema
    })]
  }
});
```

## Dynamic Schema Selection

You can select schemas dynamically based on the request context or a field in the data:

```typescript
// Based on a field in the data
const userSchemas = {
  dynamicSchemas: {
    field: 'type',
    schemas: {
      'personal': personalUserSchema,
      'business': businessUserSchema
    }
  }
};

// Based on the context
const contextBasedSchema = {
  options: {
    selector: (context) => {
      if (context.params.provider === 'rest') {
        return 'restSchema';
      } else {
        return 'socketSchema';
      }
    },
    schemas: {
      'restSchema': restSchema,
      'socketSchema': socketSchema
    }
  }
};
```

## Custom Validators

ScorpionJS includes a simple default validator that checks for required properties and basic type validation. For production use, it's recommended to replace this with a more robust validation library like [Ajv](https://ajv.js.org/), [Zod](https://github.com/colinhacks/zod), or [TypeBox](https://github.com/sinclairzx81/typebox).

### Application-Level Validator

You can customize the validation function by setting it in your application configuration:

```typescript
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });

const app = createApp({
  validator: {
    validate: (schema, data, options = {}) => {
      const validate = ajv.compile(schema.definition);
      const valid = validate(data);
      
      if (!valid) {
        return {
          valid: false,
          errors: validate.errors
        };
      }
      
      return {
        valid: true,
        data // May include transformed data
      };
    }
  }
});
```

### Service-Specific Validators

You can also specify different validators for different services, which is useful when you have services with varying validation needs or when you want to use different validation libraries for different parts of your application:

```typescript
// Register a service with a custom validator
app.use('users', usersService, {
  schemas: {
    create: userSchema,
    update: userSchema
  },
  // Service-specific validator using Zod
  validator: {
    validate: (schema, data, options) => {
      // Zod-specific validation logic
      const result = schema.safeParse(data);
      return {
        valid: result.success,
        errors: result.success ? undefined : result.error.format(),
        data: result.success ? result.data : undefined
      };
    }
  }
});

// Another service with a different validator
app.use('products', productsService, {
  schemas: {
    create: productSchema
  },
  // Service-specific validator using Ajv
  validator: {
    validate: (schema, data, options) => {
      // Ajv-specific validation logic
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);
      const valid = validate(data);
      return {
        valid,
        errors: valid ? undefined : validate.errors,
        data
      };
    }
  }
});
```

### Validator Priority

When validating data, ScorpionJS looks for validators in the following order:

1. Service-specific validator (from service options)
2. Application-level validator (from app configuration)
3. Schema-specific validator (from the schema itself)
4. Default validator (built-in simple validator)

## Schema Introspection

Schemas are attached to service instances for introspection, which can be useful for documentation and client SDK generation:

```typescript
// Get all schemas for a service
const schemas = app.service('users').schemas;

// Check if a service has schemas
if (app.service('users').schemas) {
  // Service has schemas
}
```

## Example

Here's a complete example of using schema validation:

```javascript
// Define schemas
const userSchema = {
  definition: {
    type: 'object',
    required: ['username', 'email'],
    properties: {
      username: { type: 'string', minLength: 3 },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 18 }
    }
  }
};

const userQuerySchema = {
  definition: {
    type: 'object',
    properties: {
      role: { type: 'string' },
      minAge: { type: 'integer', minimum: 0 }
    }
  }
};

// Register service with schemas
app.service('users', usersService, {
  schemas: {
    create: userSchema,
    update: userSchema,
    find: userQuerySchema,
    query: userQuerySchema
  }
});

// The validation happens automatically during service method calls
const user = await app.service('users').create({
  username: 'johndoe',
  email: 'john@example.com',
  age: 25
});
```

For more advanced examples, see the [schema validation example](/examples/schema-validation.js) in the examples directory.
