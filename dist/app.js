// src/app.ts
import * as fs from 'fs';
import * as path from 'path';
import { NotFound } from './errors.js';
import { startRestServer } from './rest.js';
import { startWebSocketServer } from './websocket.js';
import { EventEmitter } from "events";
import { runHooks } from './hooks.js';
import { createRouter, addRoute, removeRoute } from "rou3";
import { registerSchemas } from "./schema.js";
export class ScorpionApp extends EventEmitter {
    httpServer;
    wsServer; // WebSocket server instance
    _isScorpionAppBrand;
    // A registry for all services, mapping a path to a service instance.
    _services = {};
    _rawServices = {};
    get services() {
        return this._services;
    }
    _router;
    globalHooks = [];
    interceptorGlobalHooks = []; // For hooks that run between global/service-specific layers
    serviceHooks = {};
    // Event system
    serviceEventListeners = {};
    // Configuration system
    _config = {};
    constructor(config = {}) {
        super(); // Call EventEmitter constructor
        this._router = createRouter();
        this._config = this._loadConfig(config);
    }
    /**
     * Returns the internal router instance.
     * This is used by transports to register routes.
     */
    getRouter() {
        return this._router;
    }
    _getAllMethodNames(obj) {
        const methods = new Set();
        let current = obj;
        do {
            Object.getOwnPropertyNames(current).forEach((name) => {
                // Check if the property is a function and not an ES6 class constructor
                if (typeof current[name] === "function" && name !== "constructor") {
                    methods.add(name);
                }
            });
            current = Object.getPrototypeOf(current);
            // Stop when we reach the Object prototype or null (for objects created with Object.create(null))
        } while (current && current !== Object.prototype && current !== null);
        return Array.from(methods);
    }
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
    _loadConfig(config) {
        // Start with default configuration
        const defaultConfig = {
            env: process.env.NODE_ENV || "development",
            rest: {
                enabled: true,
                port: 3030,
                host: "localhost",
                basePath: "/",
                cors: {
                    origin: "*",
                    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
                    credentials: true,
                    optionsSuccessStatus: 204,
                },
                bodyParser: {
                    json: { limit: "1mb" },
                    urlencoded: { extended: true, limit: "1mb" },
                },
                compression: {
                    threshold: "1kb",
                },
            },
            websocket: {
                enabled: true,
                port: 3030, // Default to same port as REST, can be overridden
                host: "localhost",
                path: "/scorpion", // Default WebSocket path
                cors: {
                    origin: "*", // Typically, WebSocket CORS is handled by the HTTP upgrade request
                },
                serverOptions: {
                // Defaults for 'ws' library
                // perMessageDeflate: {
                //   zlibDeflateOptions: {
                //     chunkSize: 1024,
                //     memLevel: 7,
                //     level: 3
                //   },
                //   zlibInflateOptions: {
                //     chunkSize: 10 * 1024
                //   },
                //   clientNoContextTakeover: true, // Defaults to negotiated value.
                //   serverNoContextTakeover: true, // Defaults to negotiated value.
                //   serverMaxWindowBits: 10, // Defaults to negotiated value.
                //   concurrencyLimit: 10, // Limits zlib concurrency for perf.
                //   threshold: 1024 // Size (in bytes) below which messages
                // }
                },
            },
            logging: {
                level: process.env.NODE_ENV === "production" ? "info" : "debug",
                prettyPrint: process.env.NODE_ENV !== "production",
                transports: [],
            },
            validation: {
                defaultProvider: "zod", // Assuming Zod might be a primary choice
                providerOptions: {},
                strict: true,
            },
            faultTolerance: {
                circuitBreaker: {
                    enabled: false,
                    timeout: 30000, // 30 seconds
                    errorThresholdPercentage: 50,
                    resetTimeout: 30000, // 30 seconds
                },
                timeout: {
                    enabled: false,
                    default: 5000, // 5 seconds global timeout for service calls
                },
                retries: {
                    enabled: false,
                    defaultAttempts: 3,
                    backoffStrategy: "fixed",
                    defaultDelay: 1000, // 1 second
                },
                bulkhead: {
                    enabled: false,
                    maxConcurrent: 10,
                    maxQueue: 10,
                },
            },
            serviceDiscovery: {
                enabled: false,
                strategy: "static", // No dynamic discovery by default
                options: {},
            },
            i18n: {
                defaultLocale: "en",
                locales: ["en"],
                directory: "./locales",
                parserOptions: {},
            },
        };
        // Try to load configuration from file
        let fileConfig = {};
        try {
            // Look for config file in current working directory
            const configPath = path.join(process.cwd(), "scorpion.config.json");
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, "utf8");
                fileConfig = JSON.parse(configContent);
                console.log(`[ScorpionApp] Loaded configuration from ${configPath}`);
            }
        }
        catch (error) {
            console.warn("[ScorpionApp] Error loading configuration file:", error);
        }
        // Load environment-specific configuration if available
        const env = process.env.NODE_ENV || "development";
        let envConfig = {};
        try {
            const envConfigPath = path.join(process.cwd(), `scorpion.${env}.config.json`);
            if (fs.existsSync(envConfigPath)) {
                const envConfigContent = fs.readFileSync(envConfigPath, "utf8");
                envConfig = JSON.parse(envConfigContent);
                console.log(`[ScorpionApp] Loaded ${env} configuration from ${envConfigPath}`);
            }
        }
        catch (error) {
            console.warn(`[ScorpionApp] Error loading ${env} configuration file:`, error);
        }
        // Load environment variables with SCORPION_ prefix
        const envVarConfig = {};
        Object.keys(process.env).forEach((key) => {
            if (key.startsWith("SCORPION_")) {
                const configKey = key.substring(9).toLowerCase().split("_"); // Fix: 9 characters to remove 'SCORPION_'
                let current = envVarConfig;
                // Handle nested properties (e.g., SCORPION_SERVER_PORT)
                for (let i = 0; i < configKey.length - 1; i++) {
                    const segment = configKey[i];
                    current[segment] = current[segment] || {};
                    current = current[segment];
                }
                // Set the value, attempting to parse it as JSON if possible
                const value = process.env[key];
                try {
                    // Try to parse as JSON for objects, arrays, booleans, and numbers
                    current[configKey[configKey.length - 1]] = JSON.parse(value);
                }
                catch (e) {
                    // If parsing fails, use the raw string value
                    current[configKey[configKey.length - 1]] = value;
                }
            }
        });
        // Debug logging for environment variables
        console.log("[ScorpionApp] Environment variables config:", JSON.stringify(envVarConfig, null, 2));
        // Merge configurations with correct precedence
        // (default < file < env-specific file < env vars < programmatic config)
        return this._deepMerge(defaultConfig, fileConfig, envConfig, envVarConfig, config);
    }
    /**
     * Deep merges multiple objects, with later objects taking precedence.
     *
     * @param objects The objects to merge
     * @returns The merged object
     */
    _deepMerge(...objects) {
        const result = {};
        for (const obj of objects) {
            if (!obj)
                continue;
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    if (typeof obj[key] === "object" &&
                        obj[key] !== null &&
                        !Array.isArray(obj[key])) {
                        result[key] = this._deepMerge(result[key] || {}, obj[key]);
                    }
                    else {
                        result[key] = obj[key];
                    }
                }
            }
        }
        return result;
    }
    /**
     * Gets a configuration value at the specified path.
     *
     * @param path The dot-notation path to the configuration value
     * @returns The configuration value or undefined if not found
     */
    _getConfigValue(path) {
        const parts = path.split(".");
        let current = this._config;
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }
    /**
     * Sets a configuration value at the specified path.
     *
     * @param path The dot-notation path to set the value at
     * @param value The value to set
     */
    _setConfigValue(path, value) {
        const parts = path.split(".");
        let current = this._config;
        // Navigate to the parent of the property to set
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current) || current[part] === null) {
                current[part] = {};
            }
            else if (typeof current[part] !== "object") {
                // If the current path is not an object, make it one
                current[part] = {};
            }
            current = current[part];
        }
        // Set the value on the parent
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }
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
    service(path) {
        const service = this._services[path];
        if (!service) {
            throw new Error(`Service on path '${path}' not found.`);
        }
        // TypeScript's control flow analysis doesn't always work with Record types
        // We know the service exists after the check, so we can safely assert the type
        return service;
    }
    /**
     * Registers a service on a given path.
     *
     * @param path The path to register the service on (e.g., 'messages').
     * @param service The service object or class instance.
     * @param options Additional options for the service (e.g., schemas, custom routing, validator). Hooks should be configured using `app.service(path).hooks(...)`.
     * @returns The ScorpionApp instance for chaining.
     */
    use(path, service, // service is now non-optional for registration
    options) {
        // This 'use' method is purely for registration.
        if (this._services[path]) {
            throw new Error(`Service on path '${path}' is already registered.`);
        }
        this._rawServices[path] = service;
        if (!service) {
            throw new Error(`Cannot register undefined service at path '${path}'.`);
        }
        console.log(`Registering service on path '${path}'`);
        // Create a proxy for the service to wrap method calls with hooks
        const serviceProxy = new Proxy(service, {
            get: (target, prop, receiver) => {
                const originalValue = Reflect.get(target, prop, receiver);
                // Only proxy function properties that aren't special methods we've added
                if (typeof originalValue === "function" &&
                    !["setup", "emit", "on", "off", "hooks"].includes(prop.toString())) {
                    // Return a function that wraps the original method with hooks
                    return async (...args) => {
                        // Prepare parameters for executeServiceCall
                        let id = undefined;
                        let data = undefined;
                        let params = {};
                        // Extract parameters based on method signature
                        const methodName = prop.toString();
                        if (["get", "update", "patch", "remove"].includes(methodName)) {
                            // Methods that take (id, [data], params)
                            if (args.length > 0)
                                id = args[0];
                            if (args.length > 1 && ["update", "patch"].includes(methodName))
                                data = args[1];
                            if (args.length > 0)
                                params = args[args.length - 1] || {};
                        }
                        else if (methodName === "create") {
                            // create(data, params)
                            if (args.length > 0)
                                data = args[0];
                            if (args.length > 1)
                                params = args[1] || {};
                        }
                        else if (methodName === "find") {
                            // find(params)
                            if (args.length > 0)
                                params = args[0] || {};
                        }
                        else {
                            // Custom methods - try to infer parameters
                            if (args.length > 0) {
                                // If the last argument is an object and not null, treat it as params
                                const lastArg = args[args.length - 1];
                                if (lastArg &&
                                    typeof lastArg === "object" &&
                                    !Array.isArray(lastArg)) {
                                    params = lastArg;
                                    // If there are more args, the first one might be an ID and the second might be data
                                    if (args.length > 1) {
                                        id = args[0];
                                        if (args.length > 2)
                                            data = args[1];
                                    }
                                }
                                else {
                                    // If only one arg and it's not an object, treat it as data
                                    data = args[0];
                                }
                            }
                        }
                        // Execute the service call with hooks
                        const result = await this.executeServiceCall({
                            path: path,
                            method: methodName,
                            id,
                            data,
                            params,
                        });
                        // TODO: Add any other necessary setup or teardown logic here
                        // Return the result or throw the error
                        if (result.error) {
                            throw result.error;
                        }
                        return result.result;
                    };
                }
                // Return the original value for non-function properties or special methods
                return originalValue;
            },
        });
        // Attach the registration options to the service proxy itself
        if (options) {
            serviceProxy._options = options;
        }
        // Initialize service event listeners array
        this.serviceEventListeners[path] = [];
        // Always attach the app instance to the service
        serviceProxy.app = this;
        // Perform service setup if the method exists
        if (typeof serviceProxy.setup === "function") {
            serviceProxy.setup(path);
        }
        // Add emit method to the service
        serviceProxy.emit = (event, data, context) => {
            const fullEvent = `${path} ${event}`;
            const serviceContext = {
                service: serviceProxy, // Use serviceProxy instead of service
                path,
                ...context,
            };
            // Emit on the service-specific event
            this.emit(fullEvent, data, serviceContext);
            return serviceProxy; // Return serviceProxy instead of service
        };
        // Add on method to the service
        serviceProxy.on = (event, listener) => {
            const fullEvent = `${path} ${event}`;
            this.on(fullEvent, listener);
            // Track this listener for cleanup
            this.serviceEventListeners[path].push({
                event: fullEvent,
                listener,
            });
            return serviceProxy; // Return serviceProxy instead of service
        };
        // Add off method to the service
        serviceProxy.off = (event, listener) => {
            const fullEvent = `${path} ${event}`;
            this.off(fullEvent, listener);
            // Remove from tracked listeners
            const listeners = this.serviceEventListeners[path];
            const index = listeners.findIndex((l) => l.event === fullEvent && l.listener === listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            return serviceProxy; // Return serviceProxy instead of service
        };
        // Add hooks method to the service to match documentation
        serviceProxy.hooks = (config) => {
            if (!this.serviceHooks[path]) {
                this.serviceHooks[path] = [];
            }
            // Process hooks configuration for this service
            this._processHookConfig(config, path, // Exact match for service-specific hooks
            this.serviceHooks[path], `[Service.hooks] service '${path}'` // Context for error messages
            );
            return serviceProxy; // Ensure hooks method returns the service proxy for chaining/type compatibility
        }; // End of serviceProxy.hooks definition
        // Register routes for all service methods (standard and custom)
        // Use actualService to get all methods, including those from the prototype chain
        const actualService = service; // Use the original service instance passed to app.use
        const allMethodNames = this._getAllMethodNames(actualService);
        for (const methodName of allMethodNames) {
            if (typeof serviceProxy[methodName] === "function" &&
                !["constructor", "setup", "emit", "on", "off", "hooks"].includes(methodName)) {
                const methodOptions = options?.methods?.[methodName];
                let httpMethod;
                let routePathSegment;
                // ...
                // Determine HTTP method
                if (methodOptions?.httpMethod) {
                    httpMethod = methodOptions.httpMethod;
                }
                else {
                    // Default HTTP methods for standard service methods
                    switch (methodName) {
                        case "find":
                        case "get":
                            httpMethod = "GET";
                            break;
                        case "create":
                            httpMethod = "POST";
                            break;
                        case "update":
                            httpMethod = "PUT";
                            break;
                        case "patch":
                            httpMethod = "PATCH";
                            break;
                        case "remove":
                            httpMethod = "DELETE";
                            break;
                        default:
                            httpMethod = "POST"; // Default for custom methods
                    }
                }
                // Determine route path segment based on method type or explicit configuration
                if (methodOptions?.path !== undefined) {
                    // Use explicitly configured path
                    routePathSegment = methodOptions.path;
                }
                else {
                    // Use default path based on method type
                    if (["get", "update", "patch", "remove"].includes(methodName)) {
                        routePathSegment = ":id"; // ID-based methods
                    }
                    else if (methodName === "find" || methodName === "create") {
                        routePathSegment = ""; // Base path for find/create
                    }
                    else {
                        routePathSegment = methodName; // Custom methods use method name
                    }
                }
                // Construct the full route path using the class method
                const fullRoutePath = this._buildRoutePath(path, routePathSegment);
                console.log(`  Adding route: ${httpMethod} ${fullRoutePath} -> ${path}.${methodName}`);
                addRoute(this._router, httpMethod, fullRoutePath, {
                    httpMethod,
                    servicePath: path,
                    serviceMethodName: methodName,
                    service: serviceProxy,
                });
            }
        }
        // Register schemas if provided (for introspection only)
        if (options?.schemas) {
            console.log(`  Registering schemas for service '${path}'`);
            // Register schemas on the service for introspection
            // Developers need to manually apply validation hooks in their service configuration
            if (serviceProxy) {
                registerSchemas(serviceProxy, options.schemas);
            }
        }
        // Store the proxy in the service registry
        this._services[path] = serviceProxy;
        return this;
    }
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
    unuse(path) {
        // Check if the service exists
        if (!this._services[path]) {
            throw new Error(`Service on path '${path}' not found.`);
        }
        console.log(`Unregistering service on path '${path}'`);
        // Get the service instance before removing it
        const service = this._services[path];
        const rawService = this._rawServices[path];
        // Allow service to clean up if it has a teardown method
        // Teardown should be called on the raw service instance.
        if (rawService && typeof rawService.teardown === "function") {
            try {
                rawService.teardown();
            }
            catch (error) {
                console.error(`Error during teardown of service '${path}':`, error);
            }
        }
        // We'll use the _buildRoutePath method for route path construction
        // Remove all routes associated with this service
        // Standard methods
        const standardMethods = [
            { name: "find", httpMethod: "GET", segment: "" },
            { name: "get", httpMethod: "GET", segment: ":id" },
            { name: "create", httpMethod: "POST", segment: "" },
            { name: "update", httpMethod: "PUT", segment: ":id" },
            { name: "patch", httpMethod: "PATCH", segment: ":id" },
            { name: "remove", httpMethod: "DELETE", segment: ":id" },
        ];
        // Remove standard method routes
        for (const method of standardMethods) {
            if (typeof service[method.name] === "function") {
                const fullRoutePath = this._buildRoutePath(path, method.segment);
                console.log(`Removing route: ${method.httpMethod} ${fullRoutePath}`);
                removeRoute(this._router, method.httpMethod, fullRoutePath);
            }
        }
        // Remove custom method routes
        for (const methodName in service) {
            if (typeof service[methodName] === "function" &&
                !methodName.startsWith("_") &&
                !standardMethods.some((m) => m.name === methodName)) {
                const fullRoutePath = this._buildRoutePath(path, methodName);
                console.log(`Removing route: POST ${fullRoutePath}`);
                removeRoute(this._router, "POST", fullRoutePath);
            }
        }
        // Remove service-specific hooks
        delete this.serviceHooks[path];
        // Clean up service-specific event listeners
        if (this.serviceEventListeners[path]) {
            console.log(`Cleaning up event listeners for service '${path}'`);
            for (const { event, listener } of this.serviceEventListeners[path]) {
                this.off(event, listener);
            }
            delete this.serviceEventListeners[path];
        }
        // Store the raw service instance to be returned
        const removedService = rawService;
        // Remove the service from the registry
        delete this._services[path];
        delete this._rawServices[path];
        // Filter out any interceptor hooks that specifically target this service
        this.interceptorGlobalHooks = this.interceptorGlobalHooks.filter((hook) => {
            // Keep hooks with wildcard pattern
            if (hook.servicePathPattern === "*")
                return true;
            // Keep hooks that don't match this service path
            if (hook.servicePathPattern &&
                typeof hook.servicePathPattern === "string") {
                return !this._isPathMatch(path, hook.servicePathPattern);
            }
            // Default to keeping the hook if we can't determine
            return true;
        });
        // Return the removed service instance
        return removedService;
    }
    hooks(arg1, arg2) {
        // Determine if this is a global hook registration or a path-specific hook registration
        const isGlobalHookRegistration = typeof arg1 !== "string" && !(arg1 instanceof RegExp);
        // Extract parameters based on call pattern
        const servicePathPattern = isGlobalHookRegistration ? "*" : arg1;
        // Validate configuration
        if (isGlobalHookRegistration) {
            // Global hooks case
            const config = arg1;
            if (!config) {
                console.warn("[ScorpionApp.hooks] Error: Global hook configuration object is undefined.");
                return this;
            }
            // Process global hooks with explicit typing
            this._processHookConfig(config, servicePathPattern, this.globalHooks, "[ScorpionApp.hooks] Global");
        }
        else {
            // Service-specific hooks case
            const config = arg2;
            if (!config) {
                console.warn(`[ScorpionApp.hooks] Error: Configuration object missing for path pattern '${servicePathPattern}'.`);
                return this;
            }
            // Process service-specific hooks
            const patternKey = servicePathPattern.toString();
            if (!this.serviceHooks[patternKey]) {
                this.serviceHooks[patternKey] = [];
            }
            this._processHookConfig(config, servicePathPattern, this.serviceHooks[patternKey], `[ScorpionApp.hooks] Service '${patternKey}'`);
        }
        return this;
    }
    interceptorHooks(arg1, arg2) {
        // Determine if this is a global interceptor registration or a path-specific registration
        const isGlobalRegistration = typeof arg1 !== "string" && !(arg1 instanceof RegExp);
        // Extract parameters based on call pattern
        const servicePathPattern = isGlobalRegistration ? "*" : arg1;
        const config = isGlobalRegistration ? arg1 : arg2;
        // Validate configuration
        if (!config) {
            const errorMsg = isGlobalRegistration
                ? "[ScorpionApp.interceptorHooks] Hook configuration object is undefined."
                : `[ScorpionApp.interceptorHooks] Configuration object missing for pattern '${servicePathPattern.toString()}'.`;
            console.warn(errorMsg);
            return this;
        }
        // Process interceptor hooks
        this._processHookConfig(config, servicePathPattern, this.interceptorGlobalHooks, "[ScorpionApp.interceptorHooks]");
        return this;
    }
    _processHookConfig(config, servicePathPattern, hooksArray, errorContext = "[ScorpionApp.hooks]") {
        const hookTypesToProcess = [
            "before",
            "after",
            "error",
            "around",
        ];
        for (const hookType of hookTypesToProcess) {
            const methodConfig = config[hookType];
            if (methodConfig) {
                for (const methodName in methodConfig) {
                    if (Object.prototype.hasOwnProperty.call(methodConfig, methodName)) {
                        const configEntry = methodConfig[methodName];
                        if (configEntry) {
                            const fns = Array.isArray(configEntry)
                                ? configEntry
                                : [configEntry];
                            for (const fn of fns) {
                                if (typeof fn !== "function") {
                                    console.warn(`${errorContext} Expected a hook function for ${hookType}.${methodName}, but got ${typeof fn}. Skipping.`);
                                    continue;
                                }
                                const hookObject = {
                                    type: hookType,
                                    fn: fn, // fn is already StandardHookFunction or AroundHookFunction
                                    servicePathPattern: servicePathPattern,
                                    methodPattern: methodName === "all" ? "*" : methodName,
                                };
                                hooksArray.push(hookObject);
                            }
                        }
                    }
                }
            }
        }
    }
    /**
     * Helper method to check if a path matches a pattern (string glob or RegExp)
     */
    _matchesPattern(text, pattern) {
        if (pattern === undefined || pattern === null || pattern === '*') {
            return true; // No pattern or wildcard '*' matches everything
        }
        if (pattern instanceof RegExp) {
            return pattern.test(text);
        }
        // Simple glob to RegExp conversion (handles '*' only)
        const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        return regex.test(text);
    }
    /**
     * Gets a configuration value at the specified path.
     *
     * @param path The dot-notation path to the configuration value.
     * @returns The configuration value at the specified path.
     */
    get(path) {
        return this._getConfigValue(path);
    }
    /**
     * Sets a configuration value at the specified path.
     *
     * @param path The dot-notation path to set the configuration value at.
     * @param value The value to set.
     * @returns The ScorpionApp instance for chaining.
     */
    set(path, value) {
        this._setConfigValue(path, value);
        return this;
    }
    /**
     * Configures the application with a plugin function.
     *
     * @param fn The plugin function to apply.
     * @returns The ScorpionApp instance for chaining.
     */
    configure(fn) {
        fn(this);
        return this;
    }
    async listen(port, host) {
        const internalApp = this;
        // Start REST server if enabled
        if (this.get("rest.enabled")) {
            const restPort = port !== undefined
                ? port
                : this.get("rest.port") || 0;
            const restHost = host !== undefined
                ? host
                : this.get("rest.host") || "localhost";
            try {
                this.httpServer = await startRestServer(internalApp, restPort, restHost);
            }
            catch (error) {
                console.error("[ScorpionApp] Error during app.listen while starting REST server:", error);
                this.httpServer = undefined;
            }
        }
        else {
            console.warn("[ScorpionApp] REST transport not configured.");
        }
        // Start WebSocket server if enabled
        if (this.get("websocket.enabled")) {
            const wsConfig = this.get("websocket") || {};
            try {
                this.wsServer = await startWebSocketServer(internalApp, wsConfig);
                console.log("[ScorpionApp] WebSocket server started successfully");
            }
            catch (error) {
                console.error("[ScorpionApp] Error during app.listen while starting WebSocket server:", error);
                this.wsServer = undefined;
            }
        }
        else {
            console.log("[ScorpionApp] WebSocket transport not enabled");
        }
        return this.httpServer;
    }
    /**
     * Execute a service method with all applicable hooks.
     *
     * @param options Options for the service call including path, method, params, data, and id
     * @returns The final hook context after all hooks have executed
     */
    async executeServiceCall(options) {
        const { path, method, params = {}, data, id } = options;
        const serviceInstance = this._services[path];
        // Handle case where service is not found
        if (!serviceInstance) {
            // Create error context and run only global and interceptor hooks
            const errorContext = {
                app: this,
                service: undefined,
                path,
                method: method,
                type: "error",
                params: { ...params },
                data,
                id,
                result: undefined,
                error: new NotFound(`Service on path '${path}' not found.`),
            };
            // Run hooks with empty service-specific hooks array
            return runHooks(errorContext, this.globalHooks, this.interceptorGlobalHooks || [], []);
        }
        // Create initial context for hook execution
        const rawService = this._rawServices[path];
        const initialContext = {
            app: this,
            service: serviceInstance,
            _rawService: rawService,
            path,
            method: method,
            type: "before",
            params: { ...params },
            data,
            id,
            result: undefined,
            error: undefined,
        };
        // Get applicable hooks for this service call
        const serviceHooks = [];
        // Check exact match first
        if (this.serviceHooks[path]) {
            serviceHooks.push(...this.serviceHooks[path]);
        }
        // Check pattern matches
        for (const [patternKey, hooks] of Object.entries(this.serviceHooks)) {
            if (patternKey !== path) { // Skip exact matches (already added above)
                // Try to parse as RegExp if it looks like one
                let pattern = patternKey;
                if (patternKey.startsWith('/') && patternKey.includes('/')) {
                    try {
                        // Extract RegExp from string representation
                        const match = patternKey.match(/^\/(.*)\/([gimuy]*)$/);
                        if (match) {
                            pattern = new RegExp(match[1], match[2]);
                        }
                    }
                    catch (e) {
                        // If parsing fails, treat as string pattern
                    }
                }
                // Use the same matching logic as in hooks.ts
                const matches = this._matchesPattern(path, pattern);
                if (matches) {
                    serviceHooks.push(...hooks);
                }
            }
        }
        // Execute all hooks
        const finalContext = await this.executeHooks(initialContext, this.globalHooks, this.interceptorGlobalHooks || [], serviceHooks);
        // If the call was successful, emit an event
        if (!finalContext.error && finalContext.result) {
            const standardMethodEvents = {
                create: "created",
                update: "updated",
                patch: "patched",
                remove: "removed",
            };
            // Create event context
            const eventContext = {
                service: serviceInstance,
                method: method,
                path: path,
                result: finalContext.result,
                params: finalContext.params,
            };
            // For standard methods, use the predefined event name
            const standardEventName = standardMethodEvents[method];
            // For custom methods, use the method name with 'ed' suffix as event name if it's a string
            // Otherwise, don't generate an automatic event name
            const customEventName = typeof method === "string" ? `${method}ed` : undefined;
            // Determine which event name to use
            const eventName = standardEventName || customEventName;
            // The event data is the result of the method call
            const eventData = finalContext.result;
            // Emit event on the service if it has an emit method
            if (typeof serviceInstance.emit === "function" && eventName) {
                console.log(`Emitting event: ${eventName}`);
                serviceInstance.emit(eventName, eventData, eventContext);
            }
        }
        // Return the final context
        return finalContext;
    }
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
    async executeHooks(initialContext, globalHooks, interceptorHooks, serviceHooks) {
        return runHooks(initialContext, globalHooks, interceptorHooks, serviceHooks);
    }
    /**
     * Publish an event with data and optional context using the app's custom event signature.
     * This is distinct from the standard EventEmitter.emit method.
     *
     * @param event The event name
     * @param data The event data
     * @param context Optional context information
     * @returns The app instance for chaining
     */
    publish(event, data, context) {
        this.emit(event, data, context);
        return this;
    }
    /**
     * Helper method to build a route path from a service path and segment.
     * Normalizes paths and handles special cases.
     *
     * @param path The base service path
     * @param segment The path segment to append (if any)
     * @returns The normalized full route path
     */
    _buildRoutePath(path, segment) {
        // Normalize segments
        const normalizedServicePath = path.startsWith("/") ? path : `/${path}`;
        const normalizedSegment = segment
            ? segment.startsWith("/")
                ? segment
                : `/${segment}`
            : "";
        // Combine and clean up the path
        let result = `${normalizedServicePath}${normalizedSegment}`;
        result = result.replace(/\/\//g, "/"); // Remove double slashes
        // Handle trailing slashes and empty paths
        if (result !== "/" && result.endsWith("/")) {
            result = result.slice(0, -1);
        }
        return result || "/";
    }
    /**
     * Helper method to check if a path matches a pattern.
     * Supports simple glob-style pattern matching with * wildcard.
     *
     * @param path The path to check
     * @param pattern The pattern to match against
     * @returns True if the path matches the pattern
     */
    _isPathMatch(path, pattern) {
        if (pattern === "*")
            return true;
        if (pattern === path)
            return true;
        if (pattern.includes("*")) {
            const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        }
        return false;
    }
}
/**
 * Creates a new ScorpionJS application instance.
 *
 * @param config Configuration options for the ScorpionJS application
 */
export const createApp = (config = {}) => {
    return new ScorpionApp(config);
};
//# sourceMappingURL=app.js.map