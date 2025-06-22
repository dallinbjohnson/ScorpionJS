// src/schema.ts
import { BadRequest } from './errors.js';
/**
 * Default validator using JSON Schema
 * This is a simple implementation that can be replaced with more robust libraries
 */
export function defaultValidator(schema, data, options) {
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
            for (const [prop, propSchema] of Object.entries(schema.properties)) {
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
    }
    catch (error) {
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
function validateType(value, type) {
    const types = Array.isArray(type) ? type : [type];
    for (const t of types) {
        switch (t) {
            case 'string':
                if (typeof value === 'string')
                    return true;
                break;
            case 'number':
                if (typeof value === 'number' && !isNaN(value))
                    return true;
                break;
            case 'integer':
                if (Number.isInteger(value))
                    return true;
                break;
            case 'boolean':
                if (typeof value === 'boolean')
                    return true;
                break;
            case 'array':
                if (Array.isArray(value))
                    return true;
                break;
            case 'object':
                if (typeof value === 'object' && value !== null && !Array.isArray(value))
                    return true;
                break;
            case 'null':
                if (value === null)
                    return true;
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
export function validateData(schema, options = {}) {
    const schemaObj = typeof schema === 'object' && 'definition' in schema
        ? schema
        : { definition: schema, options };
    return async function validateDataHook(context) {
        if (!context.data) {
            return context;
        }
        // Determine the correct schema to use
        let finalSchema = schemaObj.definition;
        if (schemaObj.options?.contextRules) {
            for (const rule of schemaObj.options.contextRules) {
                if (rule.condition(context)) {
                    finalSchema = rule.schema;
                    break;
                }
            }
        }
        // Validator selection logic:
        // 1. Service-specific validator
        // 2. App-level validator
        // 3. Default validator
        const validator = context.service?._options?.validator || context.app.get('validator');
        const validationFn = validator?.validate || defaultValidator;
        const finalOptions = schemaObj.options;
        const validationResult = validationFn(finalSchema, context.data, finalOptions);
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
export function validateQuery(schema, options = {}) {
    const schemaObj = typeof schema === 'object' && 'definition' in schema
        ? schema
        : { definition: schema, options };
    return async function validateQueryHook(context) {
        if (!context.params?.query) {
            return context;
        }
        // Determine the correct schema to use
        let finalSchema = schemaObj.definition;
        if (schemaObj.options?.contextRules) {
            for (const rule of schemaObj.options.contextRules) {
                if (rule.condition(context)) {
                    finalSchema = rule.schema;
                    break;
                }
            }
        }
        // Validator selection logic:
        // 1. Service-specific validator
        // 2. App-level validator
        // 3. Default validator
        const validator = context.service?._options?.validator || context.app.get('validator');
        const validationFn = validator?.validate || defaultValidator;
        const finalOptions = schemaObj.options;
        const validationResult = validationFn(finalSchema, context.params.query, finalOptions);
        if (!validationResult.valid) {
            throw new BadRequest('Query validation error', {
                errors: validationResult.errors,
                schema: finalSchema
            });
        }
        // If the validator returned transformed data, update the context
        if (validationResult.data !== undefined) {
            context.params.query = validationResult.data;
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
export function validateSchema(schemas) {
    return async function validateSchemaHook(context) {
        const { method } = context;
        if (!method) {
            return context;
        }
        // Validate query parameters if a query schema is defined
        if (schemas.query && context.params?.query) {
            const queryValidator = validateQuery(schemas.query);
            await queryValidator(context);
        }
        // Get the appropriate schema for the method
        let methodSchema = schemas[method];
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
            await dataValidator(context);
        }
        return context;
    };
}
/**
 * Register schemas for a service
 * This function updates the service options with the provided schemas
 *
 * @param service The service to register schemas for
 * @param schemas The schemas to register
 */
export function registerSchemas(service, schemas) {
    // Store schemas on the service for introspection
    service._schemas = schemas;
}
//# sourceMappingURL=schema.js.map