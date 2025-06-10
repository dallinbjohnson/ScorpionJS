import * as http from 'http';
import { IScorpionApp, Service, ServiceOptions, Params, HookContext, HookObject, HookType, HooksApiConfig, StandardHookFunction, AroundHookFunction } from './types.js';
export interface ExecuteServiceCallOptions<A extends IScorpionApp<any>, Svc extends Service<A>> {
    servicePath: string;
    method: keyof Svc | string;
    params?: Params;
    data?: any;
    id?: string | number | null;
}
export declare class ScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, Service<any>>> implements IScorpionApp<AppServices> {
    _isScorpionAppBrand: never;
    private _services;
    get services(): AppServices;
    private router;
    private globalHooks;
    private interceptorGlobalHooks;
    private serviceHooks;
    constructor();
    /**
     * Registers a service on a given path.
     *
     * @param path The path to register the service on (e.g., 'messages').
     * @param service The service object or class instance.
     * @param options Additional options for the service.
     * @returns The ScorpionApp instance for chaining.
     */
    service<SvcType extends Service<this>>(path: string, service: SvcType, options?: ServiceOptions<this, SvcType>): this;
    /**
     * Adds a global hook to the application.
     * This method is kept for backward compatibility.
     * For new hook registrations, prefer using the `app.hooks()` method with a configuration object.
     *
     * @param hookInput The hook function to execute or a HookObject.
     * @param options Options for the hook, such as type, servicePathPattern, and methodPattern.
     *                These options are ignored if a HookObject is passed as the first argument.
     *                If only a function is passed, it defaults to a 'before' hook with '*' patterns.
     * @returns The ScorpionApp instance for chaining.
     */
    addHook(hookInput: (StandardHookFunction<this, Service<this> | undefined> | AroundHookFunction<this, Service<this> | undefined>) | HookObject<this, Service<this> | undefined>, options?: {
        type?: HookType;
        servicePathPattern?: string;
        methodPattern?: string;
    }): this;
    /**
     * Registers hooks globally using a structured configuration object.
     *
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    hooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
    /**
     * Registers hooks for services matching a path pattern using a structured configuration object.
     *
     * @param pathPattern A glob-like pattern for service paths (e.g., '/api/v1/*', 'users').
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    hooks(pathPattern: string, config: HooksApiConfig<this, Service<this>>): this;
    /**
     * Retrieves a registered service by its path.
     *
     * @param path The path of the service to retrieve.
     * @returns The service instance.
     */
    getService<Svc extends Service>(path: string): Svc | undefined;
    interceptorHooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
    interceptorHooks(pathPattern: string, config: HooksApiConfig<this, Service<this> | undefined>): this;
    private _processHookConfig;
    private parseRequestBody;
    listen(port: number, callback?: () => void): http.Server;
    executeServiceCall<Svc extends Service<this>>(options: ExecuteServiceCallOptions<this, Svc>): Promise<HookContext<this, Svc>>;
    private executeHooks;
}
/**
 * Creates a new ScorpionJS application instance.
 */
export declare const createApp: () => ScorpionApp<any>;
