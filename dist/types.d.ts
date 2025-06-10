import { ScorpionError } from './errors.js';
/**
 * Base interface for a Scorpion application instance.
 * Used to break circular dependencies for type information.
 */
export interface IScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, any>> {
    services: AppServices;
    _isScorpionAppBrand: never;
}
/**
 * Represents the parameters for a service method call.
 * It's a flexible object that can hold any parameter.
 * We will expand this with properties like `query`, `provider`, etc.
 */
export interface Params {
    route?: Record<string, string>;
    query?: Record<string, string | string[]>;
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
 */
export interface Service<A extends IScorpionApp<any> = IScorpionApp<any>, T = any, D = Partial<T>> extends ServiceMethods<A, T, D> {
    app?: A;
    setup?(app: A, path: string): void;
    [key: string]: any;
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
    before?: StandardHookMethodConfig<A, S>;
    after?: StandardHookMethodConfig<A, S>;
    error?: StandardHookMethodConfig<A, S>;
    around?: AroundHookMethodConfig<A, S>;
}
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
    hooks?: HooksApiConfig<A, Svc>;
}
/**
 * Data associated with a route in the router.
 */
export interface ScorpionRouteData {
    servicePath: string;
    methodName: string;
}
