import { HookContext, Service, IScorpionApp } from './types.js';
/**
 * Schema definition interface for service data validation
 */
export interface Schema {
    definition: any;
    validate?: (data: any, options?: SchemaOptions) => {
        valid: boolean;
        errors?: any;
        data?: any;
    };
    options?: SchemaOptions;
}
/**
 * Options for schema validation
 */
export interface SchemaOptions {
    stripAdditional?: boolean;
    coerceTypes?: boolean;
    messages?: Record<string, string>;
    contextRules?: Array<{
        condition: (context: HookContext) => boolean;
        schema: any;
    }>;
    libraryOptions?: Record<string, any>;
    useDefaults?: boolean;
    allErrors?: boolean;
}
/**
 * Dynamic schema configuration for selecting schemas based on a data field
 */
export interface DynamicSchemaConfig {
    field: string;
    schemas: Record<string, Schema>;
}
/**
 * Service schema configuration
 */
export interface ServiceSchemas<T = any> {
    find?: Schema;
    get?: Schema;
    create?: Schema;
    update?: Schema;
    patch?: Schema;
    remove?: Schema;
    query?: Schema;
    dynamicSchemas?: DynamicSchemaConfig;
    [method: string]: Schema | DynamicSchemaConfig | undefined;
}
/**
 * Default validator using JSON Schema
 * This is a simple implementation that can be replaced with more robust libraries
 */
export declare function defaultValidator(schema: any, data: any, options?: SchemaOptions): {
    valid: boolean;
    errors?: any;
    data?: any;
};
/**
 * Hook factory to validate request data against a schema
 *
 * @param schema The schema to validate against
 * @param options Additional validation options
 * @returns A before hook function that validates the request data
 */
export declare function validateData<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(schema: Schema | any, options?: SchemaOptions): (context: HookContext<A, S>) => Promise<HookContext<A, S>>;
/**
 * Hook factory to validate query parameters against a schema
 *
 * @param schema The schema to validate against
 * @param options Additional validation options
 * @returns A before hook function that validates the query parameters
 */
export declare function validateQuery<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(schema: Schema | any, options?: SchemaOptions): (context: HookContext<A, S>) => Promise<HookContext<A, S>>;
/**
 * Hook factory to validate both data and query parameters based on service schemas
 *
 * @param schemas The service schemas configuration
 * @returns A before hook function that validates both data and query parameters
 */
export declare function validateSchema<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined>(schemas: ServiceSchemas): (context: HookContext<A, S>) => Promise<HookContext<A, S>>;
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
export declare function registerSchemas<A extends IScorpionApp<any> = IScorpionApp<any>, Svc extends Service<A> = Service<A>>(service: Svc, schemas: ServiceSchemas): void;
