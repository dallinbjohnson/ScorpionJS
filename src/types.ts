// src/types.ts
import * as http from 'http';
import { Readable, Writable } from "stream";
import { createRouter } from "rou3";
import { ScorpionError } from './errors.js';
import { ParsedQs } from 'qs';

/**
 * Configuration options for creating a ScorpionJS application
 */
export interface CorsOptions {
  origin?: string | string[] | boolean | RegExp | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export interface BodyParserJsonOptions {
  limit?: string | number; // e.g., '100kb', '1mb'
  strict?: boolean;
  reviver?: (key: string, value: any) => any;
  type?: string | string[] | ((req: any) => boolean);
  encoding?: BufferEncoding; // Added for specifying buffer encoding
}

export interface BodyParserUrlencodedOptions {
  extended?: boolean;
  limit?: string | number;
  parameterLimit?: number;
  type?: string | string[] | ((req: any) => boolean);
  allowPrototypes?: boolean; // Added for qs.parse option
}

export interface BodyParserTextOptions {
  limit?: string | number;
  defaultCharset?: string;
  type?: string | string[] | ((req: any) => boolean);
}

export interface BodyParserRawOptions {
  limit?: string | number;
  type?: string | string[] | ((req: any) => boolean);
}

export interface BodyParserOptions {
  json?: boolean | BodyParserJsonOptions;
  urlencoded?: boolean | BodyParserUrlencodedOptions;
  text?: boolean | BodyParserTextOptions;
  raw?: boolean | BodyParserRawOptions;
}

export interface CompressionOptions {
  threshold?: string | number; // e.g., '1kb' or 1024 bytes
  level?: number; // Compression level (0-9 for gzip/deflate)
  filter?: (req: any, res: any) => boolean; // Function to decide if response should be compressed
  // Add other options from 'compression' library if needed, e.g., memLevel, strategy
}

export interface ScorpionConfig {
  // Environment settings
  env?: string;
  // Server configuration
  server?: {
    port?: number;
    host?: string;
    cors?: boolean | CorsOptions;
    bodyParser?: boolean | BodyParserOptions;
    compression?: boolean | CompressionOptions;
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
export interface ExecuteServiceCallOptions<A extends IScorpionApp<any>, Svc extends Service<A>> {
  path: string;
  method: keyof Svc | string;
  params?: Params;
  data?: any;
  id?: string | number | null;
}

export interface IScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, any>> {
  services: AppServices;
  _isScorpionAppBrand: never; // Ensures nominal typing if structural typing becomes an issue

  // Configuration methods
  get<T = any>(path: string): T | undefined;
  set<T = any>(path: string, value: T): this;

  // Service registration
  use<S extends Service<any>>(path: string, service: S, options?: ServiceOptions): this;
  service(path: string): RegisteredService<any, any, any>;

  // Server methods
  listen(port?: number, host?: string, callback?: () => void): Promise<http.Server | undefined>;

  // Hook registration
  hooks(config: HooksApiConfig<any, any>): this;
  hooks(pathPattern: string, config: HooksApiConfig<any, any>): this;

  // Service unregistration
  unuse(path: string): Service<any> | undefined;

  // Direct service call execution for testing/internal use
  executeServiceCall<Svc extends Service<any>>(
    options: ExecuteServiceCallOptions<this, Svc>
  ): Promise<any>;

  // Standard EventEmitter methods needed for app/transport interaction
  emit(event: string | symbol, ...args: any[]): boolean;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
}

/**
 * Internal interface for ScorpionApp, exposing methods needed by rest.ts
 * but not part of the public IScorpionApp API.
 */
export interface IScorpionAppInternal<AppServices extends Record<string, Service<any>> = Record<string, any>>
  extends IScorpionApp<AppServices> {
  // Re-declaring to try and fix type errors, should be inherited
  emit(event: string | symbol, ...args: any[]): boolean;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  getRouter(): ReturnType<typeof createRouter<ScorpionRouteData>>;
}

/**
 * Represents the parameters for a service method call.
 * It's a flexible object that can hold any parameter.
 * We will expand this with properties like `query`, `provider`, etc.
 */
export interface Params {
  route?: Record<string, string>; // Parameters extracted from the route path, e.g., /users/:id
  query?: ParsedQs; // Parsed query string parameters
  provider?: string; // e.g., 'rest', 'websocket'
  headers?: http.IncomingHttpHeaders;
  connection?: any; // Information about the connection
  user?: any; // Authenticated user
  payload?: any; // Request body
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
  readonly app?: A; // Services often have a reference to the app
  setup?(path: string): void; // Optional setup method
  teardown?(): void; // Optional teardown method for cleanup during unregistration
  
  // Event methods
  emit?(event: string, data: any, context?: any): this;
  on?(event: string, listener: (...args: any[]) => void): this;
  off?(event: string, listener: (...args: any[]) => void): this;
  
  // Hook configuration method for registering service-specific hooks
  hooks?(config: HooksApiConfig<IScorpionApp<any>, Service<IScorpionApp<any>>>): this;
  
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
 * Represents a service that has been registered with the app via app.use().
 * This extends the base Service interface but guarantees that certain methods
 * like hooks() are always available, as they are added during registration.
 */
export interface RegisteredService<A extends IScorpionApp<any> = IScorpionApp<any>, T = any, D = Partial<T>> extends Service<A, T, D> {
  // These methods are guaranteed to exist after service registration
  hooks(config: HooksApiConfig<IScorpionApp<any>, Service<IScorpionApp<any>>>): this;
  emit(event: string, data: any, context?: any): this;
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
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
  app: IScorpionApp<any>; // The app instance, typed broadly for covariance in HookContext
  service?: RegisteredService<A, any, any>; // The proxied, registered service instance
  _rawService?: S; // The raw, un-proxied service instance
  path: string; // Path of the service being called
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
  httpMethod: string; // e.g., 'GET', 'POST'
  servicePath: string; // e.g., 'messages'
  serviceMethodName: string; // e.g., 'find', 'create', 'customMethod'
  service: Service<any>;
  allowStream?: boolean;
}
