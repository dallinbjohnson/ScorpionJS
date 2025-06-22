import * as http from 'http';
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
    limit?: string | number;
    strict?: boolean;
    reviver?: (key: string, value: any) => any;
    type?: string | string[] | ((req: any) => boolean);
    encoding?: BufferEncoding;
}
export interface BodyParserUrlencodedOptions {
    extended?: boolean;
    limit?: string | number;
    parameterLimit?: number;
    type?: string | string[] | ((req: any) => boolean);
    allowPrototypes?: boolean;
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
    threshold?: string | number;
    level?: number;
    filter?: (req: any, res: any) => boolean;
}
export interface RestTransportConfig {
    enabled?: boolean;
    port?: number;
    host?: string;
    cors?: boolean | CorsOptions;
    bodyParser?: boolean | BodyParserOptions;
    compression?: boolean | CompressionOptions;
    basePath?: string;
}
export interface WebSocketTransportConfig {
    enabled?: boolean;
    port?: number;
    host?: string;
    path?: string;
    cors?: boolean | CorsOptions;
    serverOptions?: Record<string, any>;
}
export interface LoggingConfig {
    level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
    prettyPrint?: boolean | Record<string, any>;
    transports?: Array<{
        type: string;
        options?: Record<string, any>;
    }>;
}
export interface SchemaValidationConfig {
    defaultProvider?: 'zod' | 'ajv' | 'joi' | string;
    providerOptions?: Record<string, any>;
    strict?: boolean;
}
export interface CircuitBreakerConfig {
    enabled?: boolean;
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
}
export interface TimeoutConfig {
    enabled?: boolean;
    default?: number;
}
export interface RetriesConfig {
    enabled?: boolean;
    defaultAttempts?: number;
    backoffStrategy?: string;
    defaultDelay?: number;
}
export interface BulkheadConfig {
    enabled?: boolean;
    maxConcurrent?: number;
    maxQueue?: number;
}
export interface FaultToleranceConfig {
    circuitBreaker?: CircuitBreakerConfig;
    timeout?: TimeoutConfig;
    retries?: RetriesConfig;
    bulkhead?: BulkheadConfig;
}
export interface ServiceDiscoveryConfig {
    enabled?: boolean;
    strategy?: string;
    options?: Record<string, any>;
}
export interface I18nConfig {
    defaultLocale?: string;
    locales?: string[];
    directory?: string;
    parserOptions?: Record<string, any>;
}
export interface ScorpionConfig {
    env?: string;
    rest?: RestTransportConfig;
    websocket?: WebSocketTransportConfig;
    logging?: LoggingConfig;
    validation?: SchemaValidationConfig;
    faultTolerance?: FaultToleranceConfig;
    serviceDiscovery?: ServiceDiscoveryConfig;
    i18n?: I18nConfig;
    auth?: Record<string, any>;
    database?: Record<string, any>;
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
    _isScorpionAppBrand: never;
    get<T = any>(path: string): T | undefined;
    set<T = any>(path: string, value: T): this;
    use<S extends Service<any>>(path: string, service: S, options?: ServiceOptions): this;
    service(path: string): RegisteredService<any, any, any>;
    listen(port?: number, host?: string, callback?: () => void): Promise<http.Server | undefined>;
    hooks(config: HooksApiConfig<any, any>): this;
    hooks(pathPattern: string, config: HooksApiConfig<any, any>): this;
    unuse(path: string): Service<any> | undefined;
    executeServiceCall<Svc extends Service<any>>(options: ExecuteServiceCallOptions<this, Svc>): Promise<any>;
    emit(event: string | symbol, ...args: any[]): boolean;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
}
/**
 * Internal interface for ScorpionApp, exposing methods needed by rest.ts
 * but not part of the public IScorpionApp API.
 */
export interface IScorpionAppInternal<AppServices extends Record<string, Service<any>> = Record<string, any>> extends IScorpionApp<AppServices> {
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
    route?: Record<string, string>;
    query?: ParsedQs;
    provider?: string;
    headers?: http.IncomingHttpHeaders;
    connection?: any;
    user?: any;
    payload?: any;
    [key: string]: any;
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
    readonly app?: A;
    setup?(path: string): void;
    teardown?(): void;
    emit?(event: string, data: any, context?: any): this;
    on?(event: string, listener: (...args: any[]) => void): this;
    off?(event: string, listener: (...args: any[]) => void): this;
    hooks?(config: HooksApiConfig<IScorpionApp<any>, Service<IScorpionApp<any>>>): this;
    find?(params?: Params): Promise<T[] | any>;
    get?(id: string | number, params?: Params): Promise<T | any>;
    create?(data: D, params?: Params): Promise<T | any>;
    update?(id: string | number, data: D, params?: Params): Promise<T | any>;
    patch?(id: string | number, data: Partial<D>, params?: Params): Promise<T | any>;
    remove?(id: string | number, params?: Params): Promise<T | any>;
    [key: string]: any;
}
/**
 * Represents a service that has been registered with the app via app.use().
 * This extends the base Service interface but guarantees that certain methods
 * like hooks() are always available, as they are added during registration.
 */
export interface RegisteredService<A extends IScorpionApp<any> = IScorpionApp<any>, T = any, D = Partial<T>> extends Service<A, T, D> {
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
    httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | (string & {});
    path?: string;
}
export type HookType = 'before' | 'after' | 'error' | 'around';
export type NextFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = (context?: HookContext<A, S>) => Promise<HookContext<A, S>>;
export type AroundHookFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = (context: HookContext<A, S>, next: NextFunction<A, S>) => Promise<any> | any;
export type StandardHookFunction<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = (context: HookContext<A, S>) => Promise<HookContext<A, S> | void> | HookContext<A, S> | void;
export type StandardHookMethodConfigEntry<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = StandardHookFunction<A, S> | StandardHookFunction<A, S>[];
export type AroundHookMethodConfigEntry<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> = AroundHookFunction<A, S> | AroundHookFunction<A, S>[];
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
export interface HooksApiConfig<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
    around?: AroundHookMethodConfig<A, S>;
    before?: StandardHookMethodConfig<A, S>;
    after?: StandardHookMethodConfig<A, S>;
    error?: StandardHookMethodConfig<A, S>;
}
export interface HookContext<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
    app: IScorpionApp<any>;
    service?: RegisteredService<A, any, any>;
    _rawService?: S;
    path: string;
    method?: string;
    type: HookType;
    params: Params;
    id?: string | number | null;
    data?: any;
    result?: any;
    error?: Error | ScorpionError | null;
    statusCode?: number;
}
export interface HookObject<A extends IScorpionApp<any> = IScorpionApp<any>, S extends Service<A> | undefined = undefined> {
    fn: StandardHookFunction<A, S> | AroundHookFunction<A, S>;
    type: HookType;
    servicePathPattern?: string | RegExp;
    methodPattern?: string | RegExp;
}
export interface ServiceOptions<A extends IScorpionApp<any> = IScorpionApp<any>, Svc extends Service<A> = Service<A>> {
    methods?: {
        [methodName: string]: MethodRoutingOptions;
    };
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
    httpMethod: string;
    servicePath: string;
    serviceMethodName: string;
    service: Service<any>;
    allowStream?: boolean;
}
