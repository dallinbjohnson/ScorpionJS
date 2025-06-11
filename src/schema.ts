// src/schema.ts

import { HookContext, Service, IScorpionApp, Params } from './types.js';
import { BadRequest } from './errors.js';

/**
 * Schema definition interface for service data validation
 */
export interface Schema {
  // The schema definition (could be JSON Schema, Zod schema, etc.)
  definition: any;
  // Optional custom validation function
  // Returns validation result with optional errors and potentially transformed data
  validate?: (data: any, options?: SchemaOptions) => { 
    valid: boolean; 
    errors?: any; 
    data?: any;  // Transformed data (useful for libraries that modify data during validation)
  };
  // Optional schema options
  options?: SchemaOptions;
}

/**
 * Options for schema validation
 */
export interface SchemaOptions {
  // Whether to strip additional properties not in the schema
  stripAdditional?: boolean;
  // Whether to coerce types (e.g., string to number)
  coerceTypes?: boolean;
  // Custom error messages
  messages?: Record<string, string>;
  // Rules for selecting schema based on context
  contextRules?: Array<{
    condition: (context: HookContext) => boolean;
    schema: any;
  }>;
  // Library-specific options (for Ajv, Zod, etc.)
  libraryOptions?: Record<string, any>;
  // Whether to apply defaults from schema
  useDefaults?: boolean;
  // Whether to throw on the first error or collect all errors
  allErrors?: boolean;
}

/**
 * Dynamic schema configuration for selecting schemas based on a data field
 */
export interface DynamicSchemaConfig {
  field: string; // The field to check for determining schema
  schemas: Record<string, Schema>; // Map of field value to schema
}

/**
 * Service schema configuration
 */
export interface ServiceSchemas<T = any> {
  // Schemas for standard methods
  find?: Schema;
  get?: Schema;
  create?: Schema;
  update?: Schema;
  patch?: Schema;
  remove?: Schema;
  // Schemas for query parameters
  query?: Schema;
  // Dynamic schema selection based on a field in the data
  dynamicSchemas?: DynamicSchemaConfig;
  // Custom method schemas
  [method: string]: Schema | DynamicSchemaConfig | undefined;
}

/**
 * Default validator using JSON Schema
 * This is a simple implementation that can be replaced with more robust libraries
 */
export function defaultValidator(schema: any, data: any, options?: SchemaOptions): { valid: boolean; errors?: any; data?: any } {
  // This is a placeholder for a real JSON Schema validator
  // In a real implementation, you would use a library like Ajv, Zod, etc.
  console.warn('[ScorpionJS] Using default validator, which is not suitable for production. Please use a proper validation library.');
  
  try {
    // Very basic validation - just check if required properties exist
    if (schema.required && Array.isArray(schema.required)) {
      for (const prop of schema.required) {
        if (data[prop] === undefined) {
          return {
            valid: false,
            errors: {
              message: `Missing required property: ${prop}`,
              path: prop
            }
          };
        }
      }
    }
    
    // Check property types if specified
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries<any>(schema.properties)) {
        if (data[prop] !== undefined) {
          const type = propSchema.type;
          if (type && !validateType(data[prop], type)) {
            return {
              valid: false,
              errors: {
                message: `Invalid type for property ${prop}: expected ${type}`,
                path: prop
              }
            };
          }
        }
      }
    }
    
    // Return the validated data, potentially with transformations
    // In this simple implementation, we just return the original data
    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      errors: {
        message: 'Validation error',
        error
      }
    };
  }
}

/**
 * Helper function to validate a value against a JSON Schema type
 */
function validateType(value: any, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  
  for (const t of types) {
    switch (t) {
      case 'string':
        if (typeof value === 'string') return true;
        break;
      case 'number':
        if (typeof value === 'number' && !isNaN(value)) return true;
        break;
      case 'integer':
        if (Number.isInteger(value)) return true;
        break;
      case 'boolean':
        if (typeof value === 'boolean') return true;
        break;
      case 'array':
        if (Array.isArray(value)) return true;
        break;
      case 'object':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) return true;
        break;
      case 'null':
        if (value === null) return true;
        break;
    }
  }
  
  return false;
}

/**
 * Hook factory to validate request data against a schema
 * 
 * @param schema The schema to validate against
 * @param options Additional validation options
 * @returns A before hook function that validates the request data
 */
export function validateData<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(
  schema: Schema | any,
  options: SchemaOptions = {}
) {
  // If schema is not a Schema object, convert it to one
  const schemaObj: Schema = typeof schema === 'object' && 'definition' in schema
    ? schema
    : { definition: schema, options };
  
  return async function validateDataHook(context: HookContext<A, S>): Promise<HookContext<A, S>> {
    // --- Start diagnostic logs for validator selection ---
    const servicePathForLog = context?.path || 'unknown-service';
    const serviceOptionsForLog = context.service?._options; // Changed to _options
    const serviceValidatorObjForLog = serviceOptionsForLog?.validator;
    const appInstanceForLog = context.app;
    const appLevelValidatorObjForLog = appInstanceForLog?.get('validator');

    console.log(`[DEBUG validateData for ${servicePathForLog}] Validator selection debug info (at start of hook):`);
    console.log(`  - context.service exists: ${!!context.service}`);
    console.log(`  - context.service._options exists: ${!!serviceOptionsForLog}`); // Changed to _options
    console.log(`  - context.service._options.validator exists: ${!!serviceValidatorObjForLog}`); // Changed to _options
    if (serviceValidatorObjForLog) {
      console.log(`  - typeof context.service._options.validator.validate: ${typeof (serviceValidatorObjForLog as any).validate}`); // Changed to _options
    }
    console.log(`  - context.app exists: ${!!appInstanceForLog}`);
    console.log(`  - app.get('validator') exists: ${!!appLevelValidatorObjForLog}`);
    if (appLevelValidatorObjForLog) {
      console.log(`  - typeof app.get('validator').validate: ${typeof (appLevelValidatorObjForLog as any).validate}`);
    }
    console.log(`  - schemaObj.validate exists: ${!!schemaObj.validate}`);
    if (schemaObj.validate) {
      console.log(`  - typeof schemaObj.validate: ${typeof schemaObj.validate}`);
    }
    // --- End diagnostic logs ---

    if (!context.data) {
      return context;
    }

    // Check for dynamic schema selection based on context
    let finalSchema = schemaObj.definition;
    if (schemaObj.options?.contextRules) {
      for (const rule of schemaObj.options.contextRules) {
        if (rule.condition(context as any)) {
          finalSchema = rule.schema;
          break;
        }
      }
    }
    
    // Check for service-specific validator
    let validator;
    
    // First check if the service has a validator
    if (context.service?._options?.validator?.validate) { // Changed to _options
      validator = (data: any, options?: SchemaOptions) => {
        return context.service!._options!.validator!.validate(finalSchema, data, options || schemaObj.options); // Changed to _options
      };
    } 
    // Then check if the app has a validator
    else if (context.app?.get('validator')?.validate) {
      validator = (data: any, options?: SchemaOptions) => {
        return context.app!.get('validator').validate(finalSchema, data, options || schemaObj.options);
      };
    } 
    // Fall back to schema-specific validator or default validator
    else {
      validator = schemaObj.validate || ((data: any, options?: SchemaOptions) => {
        return defaultValidator(finalSchema, data, options || schemaObj.options);
      });
    }
    
    const finalOptions = schemaObj.options;
    const validationResult = validator(context.data, finalOptions);
    // console.log('[validateData] Validation Result:', validationResult); // Original log, can be noisy, let's keep it commented for now unless needed

    if (!validationResult.valid) {
      throw new BadRequest('Validation error', {
        errors: validationResult.errors,
        schema: finalSchema
      });
    }
    // If the validator returned transformed data, update the context
    if (validationResult.data !== undefined) {
      context.data = validationResult.data;
    }
    
    return context;
  };
}

/**
 * Hook factory to validate query parameters against a schema
 * 
 * @param schema The schema to validate against
 * @param options Additional validation options
 * @returns A before hook function that validates the query parameters
 */
export function validateQuery<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(
  schema: Schema | any,
  options: SchemaOptions = {}
) {
  // If schema is not a Schema object, convert it to one
  const schemaObj: Schema = typeof schema === 'object' && 'definition' in schema
    ? schema
    : { definition: schema, options };
  
  return async function validateQueryHook(context: HookContext<A, S>): Promise<HookContext<A, S>> {
    if (!context.params?.query) {
      return context;
    }

    // Check for dynamic schema selection based on context
    let finalSchema = schemaObj.definition;
    if (schemaObj.options?.contextRules) {
      for (const rule of schemaObj.options.contextRules) {
        if (rule.condition(context as any)) {
          finalSchema = rule.schema;
          break;
        }
      }
    }
    
    // Check for service-specific validator
    let validator;
    
    // First check if the service has a validator
    if (context.service?._options?.validator?.validate) { // Changed to _options
      validator = (data: any, options?: SchemaOptions) => {
        return context.service!._options!.validator!.validate(finalSchema, data, options || schemaObj.options); // Changed to _options
      };
    } 
    // Then check if the app has a validator
    else if (context.app?.get('validator')?.validate) {
      validator = (data: any, options?: SchemaOptions) => {
        return context.app!.get('validator').validate(finalSchema, data, options || schemaObj.options);
      };
    } 
    // Fall back to schema-specific validator or default validator
    else {
      validator = schemaObj.validate || ((data: any, options?: SchemaOptions) => {
        return defaultValidator(finalSchema, data, options || schemaObj.options);
      });
    }
    
    const result = validator(context.params.query, schemaObj.options);
    console.log('[validateQuery] Validation Result:', result);
    
    if (!result.valid) {
      throw new BadRequest('Query validation error', {
        errors: result.errors,
        schema: finalSchema
      });
    }
    
    // If the validator returned transformed data, update the context
    if (result.data !== undefined) {
      context.params.query = result.data;
    }
    
    return context;
  };
}

/**
 * Hook factory to validate both data and query parameters based on service schemas
 * 
 * @param schemas The service schemas configuration
 * @returns A before hook function that validates both data and query parameters
 */
export function validateSchema<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(
  schemas: ServiceSchemas
) {
  return async function validateSchemaHook(context: HookContext<A, S>): Promise<HookContext<A, S>> {
    const { method } = context;
    
    if (!method) {
      return context;
    }
    
    // Validate query parameters if a query schema is defined
    if (schemas.query && context.params?.query) {
      const queryValidator = validateQuery(schemas.query);
      await queryValidator(context as any);
    }
    
    // Get the appropriate schema for the method
    let methodSchema = schemas[method as keyof ServiceSchemas] as Schema | undefined;
    
    // Check for dynamic schema selection based on a field in the data
    if (!methodSchema && schemas.dynamicSchemas && context.data) {
      const { field, schemas: dynamicSchemas } = schemas.dynamicSchemas;
      const fieldValue = context.data[field];
      
      if (fieldValue && dynamicSchemas[fieldValue]) {
        methodSchema = dynamicSchemas[fieldValue];
      }
    }
    
    // Validate data if a schema is defined for this method and we have data
    if (methodSchema && context.data) {
      const dataValidator = validateData(methodSchema);
      await dataValidator(context as any);
    }
    
    return context;
  };
}

/**
 * Extend the ServiceOptions interface to include schemas
 */
declare module './types.js' {
  interface ServiceOptions<A extends IScorpionApp<any> = IScorpionApp<any>, Svc extends Service<A> = Service<A>> {
    schemas?: ServiceSchemas;
  }
}

/**
 * Register schemas for a service
 * This function updates the service options with the provided schemas
 * 
 * @param service The service to register schemas for
 * @param schemas The schemas to register
 */
export function registerSchemas<A extends IScorpionApp<any> = IScorpionApp<any>, Svc extends Service<A> = Service<A>>(
  service: Svc,
  schemas: ServiceSchemas
): void {
  // Store schemas on the service for introspection
  (service as any)._schemas = schemas;
}
