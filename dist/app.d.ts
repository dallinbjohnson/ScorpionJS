import * as http from 'http';
import { EventEmitter } from "events";
import { IScorpionAppInternal, ExecuteServiceCallOptions, RegisteredService, Service, ServiceOptions, ScorpionRouteData, HookContext, HooksApiConfig, ScorpionConfig } from "./types.js";
import { createRouter } from "rou3";
export declare class ScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, Service<any>>> extends EventEmitter implements IScorpionAppInternal<AppServices> {
    private httpServer?;
    private wsServer?;
    _isScorpionAppBrand: never;
    private _services;
    private _rawServices;
    get services(): AppServices;
    private readonly _router;
    private globalHooks;
    private interceptorGlobalHooks;
    private serviceHooks;
    private serviceEventListeners;
    private _config;
    constructor(config?: ScorpionConfig);
    /**
     * Returns the internal router instance.
     * This is used by transports to register routes.
     */
    getRouter(): ReturnType<typeof createRouter<ScorpionRouteData>>;
    private _getAllMethodNames;
    /**
     * Loads configuration from various sources and merges them with the provided config.
     * Priority order (highest to lowest):
     * 1. Programmatically provided config (passed to createApp or constructor)
     * 2. Environment variables
     * 3. Configuration files (scorpion.config.json)
     * 4. Default configuration
     *
     * @param config The configuration object provided programmatically
     * @returns The merged configuration object
     */
    private _loadConfig;
    /**
     * Deep merges multiple objects, with later objects taking precedence.
     *
     * @param objects The objects to merge
     * @returns The merged object
     */
    private _deepMerge;
    /**
     * Gets a configuration value at the specified path.
     *
     * @param path The dot-notation path to the configuration value
     * @returns The configuration value or undefined if not found
     */
    private _getConfigValue;
    /**
     * Sets a configuration value at the specified path.
     *
     * @param path The dot-notation path to set the value at
     * @param value The value to set
     */
    private _setConfigValue;
    /**
     * Retrieves a service registered at the given path.
     * Throws an error if the service doesn't exist.
     *
     * The returned service is guaranteed to have hooks, emit, on, and off methods
     * as they are added during registration via app.use().
     *
     * @param path The path of the service to retrieve (e.g., 'messages').
     * @returns The registered service instance with guaranteed hooks method.
     */
    service<SvcType extends Service<this> = Service<this>>(path: string): RegisteredService<this, SvcType>;
    /**
     * Registers a service on a given path.
     *
     * @param path The path to register the service on (e.g., 'messages').
     * @param service The service object or class instance.
     * @param options Additional options for the service (e.g., schemas, custom routing, validator). Hooks should be configured using `app.service(path).hooks(...)`.
     * @returns The ScorpionApp instance for chaining.
     */
    use<SvcType extends Service<this>>(path: string, service: SvcType, // service is now non-optional for registration
    options?: ServiceOptions<this, SvcType>): this;
    /**
     * Unregister (unuse) a service from the application.
     * This removes the service from the registry, cleans up any hooks associated with it,
     * removes all routes that were created for it, and cleans up any event listeners.
     * If the service has a teardown method, it will be called to allow for custom cleanup.
     *
     * The following cleanup operations are performed:
     * - All HTTP routes (standard and custom) are removed
     * - Service-specific hooks are detached
     * - Global hooks targeting this service are filtered out
     * - All event listeners registered by this service are removed
     * - The service's teardown() method is called if it exists
     *
     * @param path The path of the service to unuse
     * @returns The removed service instance
     * @throws Error if the service is not found.
     */
    unuse<Svc extends Service<this> = Service<this>>(path: string): Svc;
    /**
     * Registers global hooks using a structured configuration object.
     *
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    hooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
    /**
     * Registers hooks for services matching a path pattern using a structured configuration object.
     *
     * @param pathPattern A glob-like pattern for service paths (e.g., '/api/v1/*', 'users') or RegExp.
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    hooks(pathPattern: string | RegExp, config: HooksApiConfig<this, Service<this>>): this;
    /**
     * Registers global interceptor hooks using a structured configuration object.
     * Interceptor hooks run between standard global hooks and service-specific hooks.
     *
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    interceptorHooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
    /**
     * Registers interceptor hooks for services matching a path pattern.
     *
     * @param pathPattern A glob-like pattern for service paths.
     * @param config The hook configuration object.
     * @returns The ScorpionApp instance for chaining.
     */
    interceptorHooks(pathPattern: string, config: HooksApiConfig<this, Service<this> | undefined>): this;
    private _processHookConfig;
    /**
     * Helper method to check if a path matches a pattern (string glob or RegExp)
     */
    private _matchesPattern;
    /**
     * Gets a configuration value at the specified path.
     *
     * @param path The dot-notation path to the configuration value.
     * @returns The configuration value at the specified path.
     */
    get<T = any>(path: string): T | undefined;
    /**
     * Sets a configuration value at the specified path.
     *
     * @param path The dot-notation path to set the configuration value at.
     * @param value The value to set.
     * @returns The ScorpionApp instance for chaining.
     */
    set<T = any>(path: string, value: T): this;
    /**
     * Configures the application with a plugin function.
     *
     * @param fn The plugin function to apply.
     * @returns The ScorpionApp instance for chaining.
     */
    configure(fn: (app: this) => void): this;
    listen(port?: number, host?: string): Promise<http.Server | undefined>;
    /**
     * Execute a service method with all applicable hooks.
     *
     * @param options Options for the service call including path, method, params, data, and id
     * @returns The final hook context after all hooks have executed
     */
    executeServiceCall<Svc extends Service<this>>(options: ExecuteServiceCallOptions<this, Svc>): Promise<HookContext<this, Svc>>;
    /**
     * Execute all applicable hooks for a given context.
     * Delegates to the runHooks function from hooks.ts.
     *
     * @param initialContext The initial hook context
     * @param globalHooks Global hooks to apply
     * @param interceptorHooks Interceptor hooks to apply
     * @param serviceHooks Service-specific hooks to apply
     * @returns The final hook context after all hooks have executed
     */
    private executeHooks;
    /**
     * Publish an event with data and optional context using the app's custom event signature.
     * This is distinct from the standard EventEmitter.emit method.
     *
     * @param event The event name
     * @param data The event data
     * @param context Optional context information
     * @returns The app instance for chaining
     */
    publish(event: string, data: any, context?: any): this;
    /**
     * Helper method to build a route path from a service path and segment.
     * Normalizes paths and handles special cases.
     *
     * @param path The base service path
     * @param segment The path segment to append (if any)
     * @returns The normalized full route path
     */
    private _buildRoutePath;
    /**
     * Helper method to check if a path matches a pattern.
     * Supports simple glob-style pattern matching with * wildcard.
     *
     * @param path The path to check
     * @param pattern The pattern to match against
     * @returns True if the path matches the pattern
     */
    private _isPathMatch;
}
/**
 * Creates a new ScorpionJS application instance.
 *
 * @param config Configuration options for the ScorpionJS application
 */
export declare const createApp: (config?: ScorpionConfig) => ScorpionApp<any>;
