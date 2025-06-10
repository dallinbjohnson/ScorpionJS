// src/app.ts
import * as http from 'http';
import { URL } from 'url';
import { runHooks } from './hooks.js';
import { ScorpionError, NotFound, BadRequest } from './errors.js';
import { createRouter, addRoute, findRoute } from 'rou3';
export class ScorpionApp {
    _isScorpionAppBrand;
    // A registry for all services, mapping a path to a service instance.
    _services = {};
    get services() {
        return this._services;
    }
    router;
    globalHooks = [];
    interceptorGlobalHooks = []; // For hooks that run between global/service-specific layers
    serviceHooks = {};
    constructor() {
        this.router = createRouter();
    }
    /**
     * Registers a service on a given path.
     *
     * @param path The path to register the service on (e.g., 'messages').
     * @param service The service object or class instance.
     * @param options Additional options for the service.
     * @returns The ScorpionApp instance for chaining.
     */
    service(path, service, options) {
        if (this._services[path]) {
            throw new Error(`Service on path '${path}' is already registered.`);
        }
        console.log(`Registering service on path '${path}'`);
        this._services[path] = service;
        // Register routes for all service methods (standard and custom)
        for (const methodName in service) {
            if (typeof service[methodName] === 'function') {
                const methodOptions = options?.methods?.[methodName];
                let httpMethod;
                let routePathSegment;
                // Determine HTTP method
                if (methodOptions?.httpMethod) {
                    httpMethod = methodOptions.httpMethod;
                }
                else {
                    // Default HTTP methods for standard service methods
                    switch (methodName) {
                        case 'find':
                        case 'get':
                            httpMethod = 'GET';
                            break;
                        case 'create':
                            httpMethod = 'POST';
                            break;
                        case 'update':
                            httpMethod = 'PUT';
                            break;
                        case 'patch':
                            httpMethod = 'PATCH';
                            break;
                        case 'remove':
                            httpMethod = 'DELETE';
                            break;
                        default: httpMethod = 'POST'; // Default for custom methods
                    }
                }
                // Determine route path segment
                if (methodOptions?.path !== undefined) {
                    routePathSegment = methodOptions.path.startsWith('/') ? methodOptions.path : `/${methodOptions.path}`;
                }
                else {
                    // Default paths for standard methods
                    if (['get', 'update', 'patch', 'remove'].includes(methodName)) {
                        routePathSegment = `/:id`;
                    }
                    else if (methodName === 'find' || methodName === 'create') {
                        routePathSegment = ''; // Base path for find/create
                    }
                    else {
                        // Default for custom methods: /servicePath/methodName
                        // To make it distinct, ensure custom methods don't clash with /:id by default
                        routePathSegment = `/${methodName}`;
                    }
                }
                // Construct the full route path
                // If routePathSegment is just "/", treat it as the base path for the service.
                // If methodOptions.path was an empty string for a non-standard method, it means base path.
                let fullRoutePath = `/${path}`;
                if (routePathSegment && routePathSegment !== '/') {
                    fullRoutePath += routePathSegment.startsWith('/') ? routePathSegment : `/${routePathSegment}`;
                }
                else if (routePathSegment === '/' && methodName !== 'find' && methodName !== 'create') {
                    // if path is explicitly '/' for a method that isn't find/create, it means service base + method name
                    // This case is a bit ambiguous, let's assume if path is '/' it means service base path
                    // and the method is identified by HTTP verb. For custom methods, this might be less clear.
                    // For now, if path is '/' for custom method, it will be /servicePath
                    // This logic might need refinement based on desired behavior for custom methods + path: '/'
                }
                else if (routePathSegment === '' && (methodName === 'find' || methodName === 'create')) {
                    // This is fine, already /servicePath
                }
                else if (routePathSegment === '' && !(['find', 'get', 'create', 'update', 'patch', 'remove'].includes(methodName))) {
                    // Custom method with empty path override means /servicePath
                }
                // Prevent double slashes if path was empty and segment starts with /
                fullRoutePath = fullRoutePath.replace(/\/\//g, '/');
                if (fullRoutePath !== '/' && fullRoutePath.endsWith('/')) {
                    fullRoutePath = fullRoutePath.slice(0, -1); // Remove trailing slash unless it's the root
                }
                if (fullRoutePath === '')
                    fullRoutePath = '/'; // Ensure root path is at least '/'
                console.log(`  Adding route: ${httpMethod} ${fullRoutePath} -> ${path}.${methodName}`);
                addRoute(this.router, httpMethod, fullRoutePath, { servicePath: path, methodName });
            }
        }
        // Process and store service-specific hooks from HooksApiConfig
        if (options?.hooks) {
            if (!this.serviceHooks[path]) {
                this.serviceHooks[path] = [];
            }
            const serviceHooksForPath = this.serviceHooks[path]; // This is HookObject<this, Service<this>>[]
            const actualConfig = options.hooks;
            const hookTypesToProcess = ['before', 'after', 'error', 'around'];
            for (const hookType of hookTypesToProcess) {
                const methodConfig = actualConfig[hookType];
                if (methodConfig) {
                    for (const methodName in methodConfig) {
                        if (Object.prototype.hasOwnProperty.call(methodConfig, methodName)) {
                            const configEntry = methodConfig[methodName];
                            if (configEntry) {
                                const fns = Array.isArray(configEntry) ? configEntry : [configEntry];
                                for (const fn of fns) {
                                    if (typeof fn !== 'function') {
                                        console.warn(`[ScorpionApp.service] Expected a hook function for service '${path}', ${hookType}.${methodName}, but got ${typeof fn}. Skipping.`);
                                        continue;
                                    }
                                    const hookObject = {
                                        type: hookType,
                                        fn: fn,
                                        servicePathPattern: path, // Exact match for service-specific hooks
                                        methodPattern: methodName === 'all' ? '*' : methodName,
                                    };
                                    serviceHooksForPath.push(hookObject);
                                }
                            }
                        }
                    }
                }
            }
        }
        return this;
    }
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
    addHook(hookInput, options) {
        if (typeof hookInput === 'function') {
            const type = options?.type || 'before';
            const servicePathPattern = options?.servicePathPattern || '*';
            const methodPattern = options?.methodPattern || '*';
            const newHook = {
                fn: hookInput,
                type: type,
                servicePathPattern: servicePathPattern,
                methodPattern: methodPattern
            };
            this.globalHooks.push(newHook);
        }
        else {
            // hookInput is HookObject<this, Service<this> | undefined>
            this.globalHooks.push(hookInput);
        }
        return this;
    }
    hooks(arg1, arg2) {
        if (typeof arg1 === 'string') {
            // Service-specific hooks
            const servicePathPattern = arg1;
            const config = arg2;
            if (!config) {
                console.warn(`[ScorpionApp.hooks] Error: Configuration object missing for path pattern '${servicePathPattern}'.`);
                return this;
            }
            if (!this.serviceHooks[servicePathPattern]) {
                this.serviceHooks[servicePathPattern] = [];
            }
            this._processHookConfig(config, servicePathPattern, this.serviceHooks[servicePathPattern]);
        }
        else {
            // Global hooks
            const config = arg1;
            const servicePathPattern = '*';
            if (!config) {
                console.warn('[ScorpionApp.hooks] Error: Global hook configuration object is undefined.');
                return this;
            }
            this._processHookConfig(config, servicePathPattern, this.globalHooks);
        }
        return this;
    }
    /**
     * Retrieves a registered service by its path.
     *
     * @param path The path of the service to retrieve.
     * @returns The service instance.
     */
    getService(path) {
        const service = this._services[path];
        if (!service) {
            throw new Error(`Service on path '${path}' not found.`);
        }
        return service;
    }
    interceptorHooks(arg1, arg2) {
        let servicePathPattern = '*';
        let configToProcess;
        if (typeof arg1 === 'string') {
            servicePathPattern = arg1;
            if (!arg2) {
                console.warn(`[ScorpionApp.interceptorHooks] Configuration object missing for pattern '${servicePathPattern}'.`);
                return this;
            }
            configToProcess = arg2;
        }
        else {
            configToProcess = arg1;
        }
        if (!configToProcess) {
            console.warn('[ScorpionApp.interceptorHooks] Hook configuration object is undefined.');
            return this;
        }
        this._processHookConfig(configToProcess, servicePathPattern, this.interceptorGlobalHooks);
        return this;
    }
    _processHookConfig(config, servicePathPattern, hooksArray) {
        const hookTypesToProcess = ['before', 'after', 'error', 'around'];
        for (const hookType of hookTypesToProcess) {
            const methodConfig = config[hookType];
            if (methodConfig) {
                for (const methodName in methodConfig) {
                    if (Object.prototype.hasOwnProperty.call(methodConfig, methodName)) {
                        const configEntry = methodConfig[methodName];
                        if (configEntry) {
                            const fns = Array.isArray(configEntry) ? configEntry : [configEntry];
                            for (const fn of fns) {
                                if (typeof fn !== 'function') {
                                    console.warn(`[ScorpionApp.hooks] Expected a hook function for ${hookType}.${methodName}, but got ${typeof fn}. Skipping.`);
                                    continue;
                                }
                                const hookObject = {
                                    type: hookType,
                                    fn: fn, // fn is already StandardHookFunction or AroundHookFunction
                                    servicePathPattern: servicePathPattern,
                                    methodPattern: methodName === 'all' ? '*' : methodName,
                                };
                                hooksArray.push(hookObject);
                            }
                        }
                    }
                }
            }
        }
    }
    // Basic request body parser for JSON
    async parseRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                if (!body) {
                    return resolve({});
                }
                try {
                    resolve(JSON.parse(body));
                }
                catch (error) {
                    reject(new BadRequest('Invalid JSON in request body'));
                }
            });
            req.on('error', (err) => {
                reject(new BadRequest('Error reading request body'));
            });
        });
    }
    listen(port, callback) {
        const server = http.createServer(async (req, res) => {
            const { method, url } = req;
            if (!method || !url) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Bad Request' }));
                return;
            }
            const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
            const reqPath = parsedUrl.pathname;
            const queryParams = {};
            parsedUrl.searchParams.forEach((value, key) => {
                const existing = queryParams[key];
                if (existing) {
                    if (Array.isArray(existing)) {
                        existing.push(value);
                    }
                    else {
                        queryParams[key] = [existing, value];
                    }
                }
                else {
                    queryParams[key] = value;
                }
            });
            const routeMatch = findRoute(this.router, method, reqPath);
            if (!routeMatch) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: `Cannot ${method} ${reqPath}` }));
                return;
            }
            const { servicePath, methodName } = routeMatch.data; // data is ScorpionRouteData
            const service = this.getService(servicePath);
            const routeParams = routeMatch.params || {}; // params is Record<string, string> | undefined
            const params = { route: routeParams, query: queryParams };
            try {
                let result;
                let data;
                if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
                    data = await this.parseRequestBody(req);
                }
                const serviceMethodExists = typeof service[methodName] === 'function';
                if (!serviceMethodExists) {
                    throw new NotFound(`Method '${methodName}' not implemented on service '${servicePath}'`);
                }
                // 'service' is already defined from: const service = this.getService(servicePath);
                // Prepare initial HookContext
                const initialContext = {
                    app: this,
                    service: service, // Use the specifically typed service instance
                    servicePath,
                    method: methodName,
                    type: 'before', // Initial phase before any hooks run for the method
                    params: {
                        ...params, // existing route & query params
                        req, // Pass the raw request object for potential use in hooks
                        res, // Pass the raw response object for potential use in hooks (e.g. setting headers early)
                    },
                    id: routeParams?.id,
                    data,
                    // result, error, statusCode will be populated by hooks or service method
                };
                const globalHooksForCall = this.globalHooks;
                const interceptorHooksForCall = (this.interceptorGlobalHooks || []);
                const specificServiceHooks = (this.serviceHooks[servicePath] || []);
                const finalContext = await this.executeHooks(initialContext, globalHooksForCall, interceptorHooksForCall, specificServiceHooks);
                if (finalContext.error) {
                    // Error handling logic will use finalContext.error and finalContext.statusCode
                    // This will be refined when error hooks are fully implemented
                    let statusCode = finalContext.statusCode || 500;
                    let errorMessage = 'Internal Server Error';
                    let errorName = 'Error';
                    let errorData = undefined;
                    if (finalContext.error instanceof ScorpionError) {
                        statusCode = finalContext.error.code;
                        errorMessage = finalContext.error.message;
                        errorName = finalContext.error.name;
                        errorData = finalContext.error.data;
                    }
                    else if (finalContext.error instanceof Error) {
                        errorMessage = finalContext.error.message;
                        errorName = finalContext.error.name;
                    }
                    // Ensure statusCode from context takes precedence if set by a hook
                    statusCode = finalContext.statusCode || statusCode;
                    console.error(`Error processing ${method} ${reqPath} for ${servicePath}.${methodName}:`, finalContext.error);
                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ name: errorName, message: errorMessage, code: statusCode, data: errorData }));
                    return; // Stop further processing for this request
                }
                // Send successful response using finalContext.result
                // Hooks might have modified the result or status code
                const responseStatusCode = finalContext.statusCode || 200;
                result = finalContext.result;
                res.writeHead(responseStatusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            }
            catch (error) { // This catch block should ideally not be hit if executeHooks handles all errors
                let statusCode = 500;
                let message = 'Internal Server Error';
                let errorName = 'Error';
                if (error instanceof ScorpionError) {
                    statusCode = error.code;
                    message = error.message;
                    errorName = error.name;
                }
                else if (error instanceof Error) {
                    console.error(`Unhandled error processing ${method} ${reqPath}:`, error);
                    message = error.message;
                    errorName = error.name;
                }
                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ name: errorName, message, code: statusCode }));
            }
        });
        server.listen(port, () => {
            console.log(`ScorpionJS application listening on port ${port}`);
            if (callback) {
                callback();
            }
        });
        return server;
    }
    async executeServiceCall(options) {
        const { servicePath, method, params = {}, data, id } = options;
        const serviceInstance = this._services[servicePath];
        if (!serviceInstance) {
            const errorContext = {
                app: this,
                service: undefined,
                servicePath: servicePath,
                method: method,
                type: 'error',
                params: { ...params },
                data: data,
                id: id,
                result: undefined,
                error: new NotFound(`Service on path '${servicePath}' not found.`),
            };
            const globalHooksForCall = this.globalHooks; // Type: HookObject<this, Service<this>>[]
            const interceptorHooksForCall = this.interceptorGlobalHooks || []; // Type: HookObject<this, Service<this>>[]
            // No service-specific hooks apply if the service is not found.
            return runHooks(errorContext, globalHooksForCall, interceptorHooksForCall, []);
        }
        if (typeof serviceInstance.setup === 'function') {
            serviceInstance.setup(this, servicePath);
        }
        else {
            serviceInstance.app = this;
        }
        const initialContext = {
            app: this,
            service: serviceInstance,
            servicePath: servicePath,
            method: method,
            type: 'before',
            params: { ...params },
            data: data,
            id: id,
            result: undefined,
            error: undefined,
        };
        const applicableGlobalHooks = this.globalHooks;
        const applicableInterceptorHooks = this.interceptorGlobalHooks || [];
        const applicableServiceHooks = this.serviceHooks[servicePath] || []; // This is HookObject<this, Service<this>>[]
        const contextToUse = initialContext;
        // Call the unified hook execution logic
        const finalContext = await this.executeHooks(contextToUse, applicableGlobalHooks, // Pass as HookObject<this, Service<this> | undefined>[]
        applicableInterceptorHooks, // Pass as HookObject<this, Service<this> | undefined>[]
        // Cast HookObject<this, Service<this>>[] to HookObject<this, Svc>[] for executeHooks.
        // This is considered safe because hooks for a general Service<this> can operate on a specific Svc context.
        applicableServiceHooks);
        return finalContext;
    }
    async executeHooks(initialContext, globalHooks, interceptorHooks, serviceHooks) {
        // Delegate to the runHooks function from hooks.ts
        // The `initialContext.app` will be `this` (ScorpionApp instance)
        // The `initialContext.service` is already populated before this call
        return runHooks(initialContext, globalHooks, interceptorHooks, serviceHooks);
    }
}
/**
 * Creates a new ScorpionJS application instance.
 */
export const createApp = () => {
    return new ScorpionApp();
};
