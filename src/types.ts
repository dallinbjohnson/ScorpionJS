// src/types.ts
import { ScorpionError } from './errors.js';

/**
 * Configuration options for creating a ScorpionJS application
 */
export interface ScorpionConfig {
  // Environment settings
  env?: string;
  // Server configuration
  server?: {
    port?: number;
    host?: string;
    cors?: boolean | Record<string, any>;
    bodyParser?: boolean | Record<string, any>;
  };
  // Authentication configuration
  auth?: Record<string, any>;
  // Database configuration
  database?: Record<string, any>;
  // Custom configuration
  [key: string]: any;
}

/**
 * Base interface for a Scorpion application instance.
 * Used to break circular dependencies for type information.
 */
export interface IScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, any>> {
  services: AppServices;
  _isScorpionAppBrand: never; // Ensures nominal typing if structural typing becomes an issue
  
  // Configuration methods
  get<T = any>(path: string): T;
  set<T = any>(path: string, value: T): this;
}


/**
 * Represents the parameters for a service method call.
 * It's a flexible object that can hold any parameter.
 * We will expand this with properties like `query`, `provider`, etc.
 */
export interface Params {
  route?: Record<string, string>; // Parameters extracted from the route path, e.g., /users/:id
  query?: Record<string, string | string[]>; // Parsed query string parameters
  [key: string]: any; // Allow other custom parameters
}

/**
 * Defines the standard methods for a ScorpionJS service.
 * A service does not have to implement all of them.
 */
export interface ServiceMethods<A extends IScorpionApp<any> = IScorpionApp<any>, T = any, D = Partial<T>> {
  find(params?: Params): Promise<T[] | any>;
  get(id: string | number, params?: Params): Promise<T | any>;
  create(data: D, params?: Params): Promise<T | any>;
  update(id: string | number, data: D, params?: Params): Promise<T | any>;
  patch(id: string | number, data: Partial<D>, params?: Params): Promise<T | any>;
  remove(id: string | number, params?: Params): Promise<T | any>;
}

/**
 * A generic service interface that includes standard methods
 * and allows for any number of custom methods.
 * All standard methods are optional to allow for more focused services.
 */
export interface Service<A extends IScorpionApp<any> = IScorpionApp<any>, T = any, D = Partial<T>> {
  app?: A; // Services often have a reference to the app
  setup?(app: A, path: string): void; // Optional setup method
  teardown?(): void; // Optional teardown method for cleanup during unregistration
  
  // Event methods
  emit?(event: string, data: any, context?: any): this;
  on?(event: string, listener: (...args: any[]) => void): this;
  off?(event: string, listener: (...args: any[]) => void): this;
  
  // Hook configuration method for registering service-specific hooks
  hooks?(config: HooksApiConfig<any, any>): this;
  
  // Standard methods - all optional
  find?(params?: Params): Promise<T[] | any>;
  get?(id: string | number, params?: Params): Promise<T | any>;
  create?(data: D, params?: Params): Promise<T | any>;
  update?(id: string | number, data: D, params?: Params): Promise<T | any>;
  patch?(id: string | number, data: Partial<D>, params?: Params): Promise<T | any>;
  remove?(id: string | number, params?: Params): Promise<T | any>;
  
  // Allow custom methods
  [key: string]: any;
}

/**
 * Options that can be passed when registering a service.
 * For now, it's a placeholder for future options like schemas.
 */
export interface MethodRoutingOptions {
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | (string & {}); // Allow standard methods or any string
  path?: string; // Relative to service base path, e.g., '/:id/archive' or 'custom-action'
}

export type HookType = 'before' | 'after' | 'error' | 'around';

// Function type for the 'next' callback in around hooks
export type NextFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = 
  (context?: HookContext<A, S>) => Promise<HookContext<A, S>>;

// Specific function type for 'around' hooks
export type AroundHookFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = 
  (context: HookContext<A, S>, next: NextFunction<A, S>) => Promise<any> | any;

// General hook function for before, after, error
export type StandardHookFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = 
  (context: HookContext<A, S>) => Promise<HookContext<A, S> | void> | HookContext<A, S> | void;

// --- Hook Configuration Types ---
export type StandardHookMethodConfigEntry<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = 
  | StandardHookFunction<A, S>
  | StandardHookFunction<A, S>[];

export type AroundHookMethodConfigEntry<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = 
  | AroundHookFunction<A, S>
  | AroundHookFunction<A, S>[];

// Generic config for before, after, error hooks
export interface StandardHookMethodConfig<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
  all?: StandardHookMethodConfigEntry<A, S>;
  find?: StandardHookMethodConfigEntry<A, S>;
  get?: StandardHookMethodConfigEntry<A, S>;
  create?: StandardHookMethodConfigEntry<A, S>;
  update?: StandardHookMethodConfigEntry<A, S>;
  patch?: StandardHookMethodConfigEntry<A, S>;
  remove?: StandardHookMethodConfigEntry<A, S>;
  [customMethod: string]: StandardHookMethodConfigEntry<A, S> | undefined;
}

// Specific config for around hooks
export interface AroundHookMethodConfig<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
  all?: AroundHookMethodConfigEntry<A, S>;
  find?: AroundHookMethodConfigEntry<A, S>;
  get?: AroundHookMethodConfigEntry<A, S>;
  create?: AroundHookMethodConfigEntry<A, S>;
  update?: AroundHookMethodConfigEntry<A, S>;
  patch?: AroundHookMethodConfigEntry<A, S>;
  remove?: AroundHookMethodConfigEntry<A, S>;
  [customMethod: string]: AroundHookMethodConfigEntry<A, S> | undefined;
}

export interface HooksApiConfig<
  A extends IScorpionApp<any> = IScorpionApp<any>,
  S extends Service<A> | undefined = undefined
> {
  around?: AroundHookMethodConfig<A, S>;
  before?: StandardHookMethodConfig<A, S>;
  after?: StandardHookMethodConfig<A, S>;
  error?: StandardHookMethodConfig<A, S>;
}
// --- End Hook Configuration Types ---

export interface HookContext<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
  app: A; 
  service?: S; 
  servicePath?: string; 
  method?: string; 
  type: HookType; 
  params: Params; 
  id?: string | number | null; 
  data?: any; 
  result?: any; 
  error?: Error | ScorpionError | null; 
  statusCode?: number; 
  // dispatch and around.setup/runSecondPart are removed as 'next' handles this for around hooks
}

// HookObject's 'fn' property needs to accommodate both types of hook functions.
export interface HookObject<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
  fn: StandardHookFunction<A, S> | AroundHookFunction<A, S>; // Union type
  type: HookType;
  servicePathPattern?: string | RegExp; // Glob-like pattern or RegExp for service path matching
  methodPattern?: string | RegExp;    // Glob-like pattern or RegExp for method name matching
}

export interface ServiceOptions<A extends IScorpionApp<any> = IScorpionApp<any>, Svc extends Service<A> = Service<A>> {
  methods?: {
    [methodName: string]: MethodRoutingOptions;
  };
  // Service-specific validator
  validator?: {
    validate: (schema: any, data: any, options?: any) => { 
      valid: boolean; 
      errors?: any; 
      data?: any; 
    };
  };
}

/**
 * Data associated with a route in the router.
 */
export interface ScorpionRouteData {
  servicePath: string;
  methodName: string;
}
