// src/app.ts

import * as http from 'http';
import { URL } from 'url';
import { EventEmitter } from 'events';
import { IScorpionApp, Service, ServiceOptions, Params, ScorpionRouteData, HookContext, HookObject, HookType, HooksApiConfig, StandardHookFunction, AroundHookFunction, NextFunction, StandardHookMethodConfig, AroundHookMethodConfig, StandardHookMethodConfigEntry, AroundHookMethodConfigEntry } from './types.js';
import { runHooks } from './hooks.js';
import { ScorpionError, NotFound, BadRequest } from './errors.js';
import { createRouter, addRoute, findRoute, removeRoute } from 'rou3';

// Interface for executeServiceCall options
export interface ExecuteServiceCallOptions<A extends IScorpionApp<any>, Svc extends Service<A>> {
  servicePath: string;
  method: keyof Svc | string; // Allow string for custom methods not strictly in Svc type
  params?: Params;
  data?: any;
  id?: string | number | null;
  // Potentially other context properties like 'user', 'provider' if needed in future
}

export class ScorpionApp<AppServices extends Record<string, Service<any>> = Record<string, Service<any>>> implements IScorpionApp<AppServices> {
  _isScorpionAppBrand!: never;
  // A registry for all services, mapping a path to a service instance.
  private _services: Record<string, Service<this>> = {};

  public get services(): AppServices {
    return this._services as AppServices;
  }
  private router: ReturnType<typeof createRouter<ScorpionRouteData>>;
  private globalHooks: HookObject<this, Service<this> | undefined>[] = [];
  private interceptorGlobalHooks: HookObject<this, Service<this> | undefined>[] = []; // For hooks that run between global/service-specific layers
  private serviceHooks: Record<string, HookObject<this, Service<this>>[]> = {};
  
  // Event system
  private eventEmitter: EventEmitter = new EventEmitter();
  private serviceEventListeners: Record<string, Array<{event: string, listener: (...args: any[]) => void}>> = {};

  constructor() {
    this.router = createRouter<ScorpionRouteData>();
  }

  /**
   * Registers a service on a given path.
   *
   * @param path The path to register the service on (e.g., 'messages').
   * @param service The service object or class instance.
   * @param options Additional options for the service.
   * @returns The ScorpionApp instance for chaining.
   */
  public service<SvcType extends Service<this>>(
    path: string,
    service: SvcType,
    options?: ServiceOptions<this, SvcType>
  ): this {
    if (this._services[path]) {
      throw new Error(`Service on path '${path}' is already registered.`);
    }

    console.log(`Registering service on path '${path}'`);
    this._services[path] = service;
  
    // Initialize service event listeners array
    this.serviceEventListeners[path] = [];
  
    // Add service-specific event methods
    const serviceObj = service as any;
  
    // Add emit method to the service
    serviceObj.emit = (event: string, data: any, context?: any) => {
      const fullEvent = `${path} ${event}`;
      const serviceContext = {
        service,
        path,
        ...context
      };
      
      // Emit on the service-specific event
      this.eventEmitter.emit(fullEvent, data, serviceContext);
      
      // Also emit on the app with the full event name
      this.eventEmitter.emit(fullEvent, data, serviceContext);
      
      return service;
    };
  
    // Add on method to the service
    serviceObj.on = (event: string, listener: (...args: any[]) => void) => {
      const fullEvent = `${path} ${event}`;
      this.eventEmitter.on(fullEvent, listener);
      
      // Track this listener for cleanup
      this.serviceEventListeners[path].push({
        event: fullEvent,
        listener
      });
      
      return service;
    };
  
    // Add off method to the service
    serviceObj.off = (event: string, listener: (...args: any[]) => void) => {
      const fullEvent = `${path} ${event}`;
      this.eventEmitter.off(fullEvent, listener);
      
      // Remove from tracked listeners
      const listeners = this.serviceEventListeners[path];
      const index = listeners.findIndex(l => l.event === fullEvent && l.listener === listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      return service;
    };

    // Register routes for all service methods (standard and custom)
    for (const methodName in service) {
      if (typeof (service as any)[methodName] === 'function') {
        const methodOptions = options?.methods?.[methodName];
        let httpMethod: string;
        let routePathSegment: string;

        // Determine HTTP method
        if (methodOptions?.httpMethod) {
          httpMethod = methodOptions.httpMethod;
        } else {
          // Default HTTP methods for standard service methods
          switch (methodName) {
            case 'find': case 'get': httpMethod = 'GET'; break;
            case 'create': httpMethod = 'POST'; break;
            case 'update': httpMethod = 'PUT'; break;
            case 'patch': httpMethod = 'PATCH'; break;
            case 'remove': httpMethod = 'DELETE'; break;
            default: httpMethod = 'POST'; // Default for custom methods
          }
        }

        // Determine route path segment based on method type or explicit configuration
        if (methodOptions?.path !== undefined) {
          // Use explicitly configured path
          routePathSegment = methodOptions.path;
        } else {
          // Use default path based on method type
          if (['get', 'update', 'patch', 'remove'].includes(methodName)) {
            routePathSegment = ':id'; // ID-based methods
          } else if (methodName === 'find' || methodName === 'create') {
            routePathSegment = ''; // Base path for find/create
          } else {
            routePathSegment = methodName; // Custom methods use method name
          }
        }
        
        // Construct the full route path using the class method
        const fullRoutePath = this._buildRoutePath(path, routePathSegment);


        console.log(`  Adding route: ${httpMethod} ${fullRoutePath} -> ${path}.${methodName}`);
        addRoute(this.router, httpMethod, fullRoutePath, { servicePath: path, methodName });
      }
    }

    // Process and store service-specific hooks from HooksApiConfig
    if (options?.hooks) {
      if (!this.serviceHooks[path]) {
        this.serviceHooks[path] = [];
      }
      
      // Process hooks configuration for this service
      // Use type assertion to handle the generic variance issue
      this._processHookConfig(
        options.hooks as unknown as HooksApiConfig<this, Service<this>>,
        path, // Exact match for service-specific hooks
        this.serviceHooks[path],
        `[ScorpionApp.service] service '${path}'` // Context for error messages
      );
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
  public addHook(
    hookInput: (StandardHookFunction<this, Service<this> | undefined> | AroundHookFunction<this, Service<this> | undefined>) | HookObject<this, Service<this> | undefined>,
    options?: { type?: HookType; servicePathPattern?: string; methodPattern?: string }
  ): this {
    if (typeof hookInput === 'function') {
      const type = options?.type || 'before';
      const servicePathPattern = options?.servicePathPattern || '*';
      const methodPattern = options?.methodPattern || '*';

      const newHook: HookObject<this, Service<this> | undefined> = {
        fn: hookInput,
        type: type,
        servicePathPattern: servicePathPattern,
        methodPattern: methodPattern
      };
      this.globalHooks.push(newHook);
    } else {
      // hookInput is HookObject<this, Service<this> | undefined>
      this.globalHooks.push(hookInput);
    }
    return this;
  }

  /**
   * Registers hooks globally using a structured configuration object.
   *
   * @param config The hook configuration object.
   * @returns The ScorpionApp instance for chaining.
   */
  /**
   * Registers global hooks using a structured configuration object.
   *
   * @param config The hook configuration object.
   * @returns The ScorpionApp instance for chaining.
   */
  public hooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
  /**
   * Registers hooks for services matching a path pattern using a structured configuration object.
   *
   * @param pathPattern A glob-like pattern for service paths (e.g., '/api/v1/*', 'users').
   * @param config The hook configuration object.
   * @returns The ScorpionApp instance for chaining.
   */
  public hooks(pathPattern: string, config: HooksApiConfig<this, Service<this>>): this;
  public hooks(arg1: string | HooksApiConfig<this, Service<this> | undefined>, arg2?: HooksApiConfig<this, Service<this>>): this {
    // Determine if this is a global hook registration or a path-specific hook registration
    const isGlobalHookRegistration = typeof arg1 !== 'string';
    
    // Extract parameters based on call pattern
    const servicePathPattern = isGlobalHookRegistration ? '*' : arg1;
    
    // Validate configuration
    if (isGlobalHookRegistration) {
      // Global hooks case
      const config = arg1 as HooksApiConfig<this, Service<this> | undefined>;
      
      if (!config) {
        console.warn('[ScorpionApp.hooks] Error: Global hook configuration object is undefined.');
        return this;
      }
      
      // Process global hooks with explicit typing
      this._processHookConfig<Service<this> | undefined>(
        config,
        servicePathPattern,
        this.globalHooks,
        '[ScorpionApp.hooks] Global'
      );
    } else {
      // Service-specific hooks case
      const config = arg2 as HooksApiConfig<this, Service<this>>;
      
      if (!config) {
        console.warn(`[ScorpionApp.hooks] Error: Configuration object missing for path pattern '${servicePathPattern}'.`);
        return this;
      }
      
      // Process service-specific hooks
      if (!this.serviceHooks[servicePathPattern]) {
        this.serviceHooks[servicePathPattern] = [];
      }
      
      this._processHookConfig<Service<this>>(
        config,
        servicePathPattern,
        this.serviceHooks[servicePathPattern],
        `[ScorpionApp.hooks] Service '${servicePathPattern}'`
      );
    }
    
    return this;
  }

  /**
   * Retrieves a registered service by its path.
   *
   * @param path The path of the service to retrieve.
   * @returns The service instance.
   */
  public getService<Svc extends Service>(path: string): Svc | undefined {
    const service = this._services[path] as Svc | undefined;
    if (!service) {
      throw new Error(`Service on path '${path}' not found.`);
    }
    return service;
  }

  /**
   * Registers global interceptor hooks using a structured configuration object.
   * Interceptor hooks run between standard global hooks and service-specific hooks.
   *
   * @param config The hook configuration object.
   * @returns The ScorpionApp instance for chaining.
   */
  public interceptorHooks(config: HooksApiConfig<this, Service<this> | undefined>): this;
  /**
   * Registers interceptor hooks for services matching a path pattern.
   *
   * @param pathPattern A glob-like pattern for service paths.
   * @param config The hook configuration object.
   * @returns The ScorpionApp instance for chaining.
   */
  public interceptorHooks(pathPattern: string, config: HooksApiConfig<this, Service<this> | undefined>): this;
  public interceptorHooks(arg1: string | HooksApiConfig<this, Service<this> | undefined>, arg2?: HooksApiConfig<this, Service<this> | undefined>): this {
    // Determine if this is a global interceptor registration or a path-specific registration
    const isGlobalRegistration = typeof arg1 !== 'string';
    
    // Extract parameters based on call pattern
    const servicePathPattern = isGlobalRegistration ? '*' : arg1;
    const config = isGlobalRegistration ? arg1 : arg2;
    
    // Validate configuration
    if (!config) {
      const errorMsg = isGlobalRegistration
        ? '[ScorpionApp.interceptorHooks] Hook configuration object is undefined.'
        : `[ScorpionApp.interceptorHooks] Configuration object missing for pattern '${servicePathPattern}'.`;
      console.warn(errorMsg);
      return this;
    }

    // Process interceptor hooks
    this._processHookConfig<Service<this> | undefined>(
      config,
      servicePathPattern,
      this.interceptorGlobalHooks,
      '[ScorpionApp.interceptorHooks]'
    );
    return this;
  }

  private _processHookConfig<Svc extends Service<this> | undefined>(
    config: HooksApiConfig<this, Svc>,
    servicePathPattern: string,
    hooksArray: HookObject<this, Svc>[],
    errorContext: string = '[ScorpionApp.hooks]'
  ): void {
    const hookTypesToProcess: HookType[] = ['before', 'after', 'error', 'around'];

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
                  console.warn(`${errorContext} Expected a hook function for ${hookType}.${methodName}, but got ${typeof fn}. Skipping.`);
                  continue;
                }
                const hookObject: HookObject<this, Svc> = {
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
  private async parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { // Explicitly type chunk
        body += chunk.toString();
      });
      req.on('end', () => {
        if (!body) {
          return resolve({});
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new BadRequest('Invalid JSON in request body'));
        }
      });
      req.on('error', (err: Error) => { // Explicitly type err
        reject(new BadRequest('Error reading request body'));
      });
    });
  }

  /**
   * Start the HTTP server and listen on the specified port.
   * 
   * @param port The port number to listen on
   * @param callback Optional callback to run when the server starts
   * @returns The HTTP server instance
   */
  public listen(port: number, callback?: () => void): http.Server {
    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        await this._handleHttpRequest(req, res);
      } catch (error: any) {
        // This catch block is a last resort if _handleHttpRequest throws
        this._sendErrorResponse(res, error);
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
  
  /**
   * Handle an incoming HTTP request by routing it to the appropriate service method.
   * 
   * @param req The HTTP request object
   * @param res The HTTP response object
   */
  private async _handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Validate request basics
    const { method, url } = req;
    if (!method || !url) {
      throw new BadRequest('Invalid request: missing method or URL');
    }

    // Parse URL and extract query parameters
    const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const reqPath = parsedUrl.pathname;
    const queryParams = this._parseQueryParams(parsedUrl);
    
    // Find matching route
    const routeMatch = findRoute(this.router, method, reqPath);
    if (!routeMatch) {
      throw new NotFound(`Cannot ${method} ${reqPath}`);
    }

    // Get service and method information
    const { servicePath, methodName } = routeMatch.data;
    const service = this.getService<Service<this>>(servicePath);
    const routeParams = routeMatch.params || {};
    const params: Params = { route: routeParams, query: queryParams };

    // Parse request body for methods that may contain it
    let data: any;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      data = await this.parseRequestBody(req);
    }

    // Verify service method exists
    if (typeof (service as any)[methodName] !== 'function') {
      throw new NotFound(`Method '${methodName}' not implemented on service '${servicePath}'`);
    }

    // Prepare initial context for hook execution
    const initialContext: HookContext<this, typeof service> = {
      app: this,
      service,
      servicePath,
      method: methodName,
      type: 'before',
      params: {
        ...params,
        req,
        res,
      },
      id: routeParams?.id,
      data,
    };

    // Get applicable hooks
    const globalHooks = this.globalHooks;
    const interceptorHooks = this.interceptorGlobalHooks || [];
    const serviceHooks = this.serviceHooks[servicePath] || [];
    
    // Execute hooks and service method
    const finalContext = await this.executeHooks(
      initialContext, 
      globalHooks, 
      interceptorHooks, 
      serviceHooks as HookObject<this, typeof service>[]
    );

    // Handle errors if any occurred during hook execution
    if (finalContext.error) {
      this._sendErrorResponse(res, finalContext.error, finalContext.statusCode);
      return;
    }

    // Send successful response
    const statusCode = finalContext.statusCode || 200;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(finalContext.result));
  }
  
  /**
   * Parse query parameters from a URL.
   * 
   * @param parsedUrl The parsed URL object
   * @returns Record of query parameters, handling arrays of values
   */
  private _parseQueryParams(parsedUrl: URL): Record<string, string | string[]> {
    const queryParams: Record<string, string | string[]> = {};
    
    parsedUrl.searchParams.forEach((value: string, key: string) => {
      const existing = queryParams[key];
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          queryParams[key] = [existing, value];
        }
      } else {
        queryParams[key] = value;
      }
    });
    
    return queryParams;
  }
  
  /**
   * Send an error response with appropriate status code and error details.
   * 
   * @param res The HTTP response object
   * @param error The error that occurred
   * @param statusCodeOverride Optional status code to override the error's code
   */
  private _sendErrorResponse(
    res: http.ServerResponse, 
    error: any, 
    statusCodeOverride?: number
  ): void {
    let statusCode = statusCodeOverride || 500;
    let message = 'Internal Server Error';
    let errorName = 'Error';
    let errorData: any;
    
    if (error instanceof ScorpionError) {
      statusCode = statusCodeOverride || error.code;
      message = error.message;
      errorName = error.name;
      errorData = error.data;
    } else if (error instanceof Error) {
      message = error.message;
      errorName = error.name;
      console.error(`Unhandled error:`, error);
    }
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      name: errorName, 
      message, 
      code: statusCode,
      data: errorData
    }));
  }


/**
 * Execute a service method with all applicable hooks.
 * 
 * @param options Options for the service call including path, method, params, data, and id
 * @returns The final hook context after all hooks have executed
 */
public async executeServiceCall<Svc extends Service<this>>(
  options: ExecuteServiceCallOptions<this, Svc>
): Promise<HookContext<this, Svc>> {
  const { servicePath, method, params = {}, data, id } = options;
  const serviceInstance = this._services[servicePath] as Svc | undefined;

  // Handle case where service is not found
  if (!serviceInstance) {
    // Create error context and run only global and interceptor hooks
    const errorContext: HookContext<this, Svc> = {
      app: this,
      service: undefined as any,
      servicePath,
      method: method as string,
      type: 'error',
      params: { ...params },
      data,
      id,
      result: undefined,
      error: new NotFound(`Service on path '${servicePath}' not found.`),
    };
    
    // Run hooks with empty service-specific hooks array
    return runHooks(
      errorContext, 
      this.globalHooks, 
      this.interceptorGlobalHooks || [], 
      []
    );
  }

  // Setup service instance if not already done
  this._setupServiceInstance(serviceInstance, servicePath);
  
  // Create initial context for hook execution
  const initialContext: HookContext<this, Svc> = {
    app: this,
    service: serviceInstance,
    servicePath,
    method: method as string,
    type: 'before',
    params: { ...params },
    data,
    id,
    result: undefined,
    error: undefined,
  };

  // Get applicable hooks for this service call
  const serviceHooks = this.serviceHooks[servicePath] || [];

  // Execute all hooks
  const finalContext = await this.executeHooks(
    initialContext,
    this.globalHooks,
    this.interceptorGlobalHooks || [],
    serviceHooks as unknown as HookObject<this, Svc>[]
  );
  
  // If the call was successful, emit an event
  if (!finalContext.error && finalContext.result) {
    const standardMethodEvents: Record<string, string> = {
      'create': 'created',
      'update': 'updated',
      'patch': 'patched',
      'remove': 'removed'
    };
    
    // Create event context
    const eventContext = {
      service: serviceInstance,
      method: method as string,
      path: servicePath,
      result: finalContext.result,
      params: finalContext.params
    };
    
    // For standard methods, use the predefined event name
    const standardEventName = standardMethodEvents[method as string];
    
    // For custom methods, use the method name with 'ed' suffix as event name if it's a string
    // Otherwise, don't generate an automatic event name
    const customEventName = typeof method === 'string' ? `${method}ed` : undefined;
    
    // Determine which event name to use
    const eventName = standardEventName || customEventName;
    
    // The event data is the result of the method call
    const eventData = finalContext.result;
    
    // Emit event on the service if it has an emit method
    if (typeof (serviceInstance as any).emit === 'function' && eventName) {
      console.log(`Emitting event: ${eventName}`);
      (serviceInstance as any).emit(eventName, eventData, eventContext);
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
private async executeHooks<Svc extends Service<this> | undefined>(
  initialContext: HookContext<this, Svc>,
  globalHooks: HookObject<this, Service<this> | undefined>[],
  interceptorHooks: HookObject<this, Service<this> | undefined>[],
  serviceHooks: HookObject<this, Svc>[]
): Promise<HookContext<this, Svc>> {
  return runHooks(initialContext, globalHooks, interceptorHooks, serviceHooks);
}

/**
 * Setup a service instance by calling its setup method or setting its app property.
 * 
 * @param serviceInstance The service instance to setup
 * @param servicePath The path of the service
 */
private _setupServiceInstance<Svc extends Service<this>>(
  serviceInstance: Svc,
  servicePath: string
): void {
  if (typeof (serviceInstance as any).setup === 'function') {
    (serviceInstance as any).setup(this, servicePath);
  } else {
    (serviceInstance as any).app = this;
  }
}

/**
 * Unregister a service from the application.
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
 * @param path The path of the service to unregister
 * @returns The removed service instance
 * @throws Error if the service is not found.
 */
public unservice<Svc extends Service<this> = Service<this>>(path: string): Svc {
  // Check if the service exists
  if (!this._services[path]) {
    throw new Error(`Service on path '${path}' not found.`);
  }

  console.log(`Unregistering service on path '${path}'`);
  
  // Get the service instance before removing it
  const service = this._services[path];
  
  // Allow service to clean up if it has a teardown method
  if (typeof (service as any).teardown === 'function') {
    try {
      (service as any).teardown();
    } catch (error) {
      console.error(`Error during teardown of service '${path}':`, error);
    }
  }
  
  // We'll use the _buildRoutePath method for route path construction
  
  // Remove all routes associated with this service
  // Standard methods
  const standardMethods = [
    { name: 'find', httpMethod: 'GET', segment: '' },
    { name: 'get', httpMethod: 'GET', segment: ':id' },
    { name: 'create', httpMethod: 'POST', segment: '' },
    { name: 'update', httpMethod: 'PUT', segment: ':id' },
    { name: 'patch', httpMethod: 'PATCH', segment: ':id' },
    { name: 'remove', httpMethod: 'DELETE', segment: ':id' }
  ];
  
  // Remove standard method routes
  for (const method of standardMethods) {
    if (typeof (service as any)[method.name] === 'function') {
      const fullRoutePath = this._buildRoutePath(path, method.segment);
      console.log(`Removing route: ${method.httpMethod} ${fullRoutePath}`);
      removeRoute(this.router, method.httpMethod, fullRoutePath);
    }
  }
  
  // Remove custom method routes
  for (const methodName in service) {
    if (typeof (service as any)[methodName] === 'function' && 
        !methodName.startsWith('_') && 
        !standardMethods.some(m => m.name === methodName)) {
      const fullRoutePath = this._buildRoutePath(path, methodName);
      console.log(`Removing route: POST ${fullRoutePath}`);
      removeRoute(this.router, 'POST', fullRoutePath);
    }
  }
  
  // Remove service-specific hooks
  delete this.serviceHooks[path];
  
  // Clean up service-specific event listeners
  if (this.serviceEventListeners[path]) {
    console.log(`Cleaning up event listeners for service '${path}'`);
    for (const { event, listener } of this.serviceEventListeners[path]) {
      this.eventEmitter.off(event, listener);
    }
    delete this.serviceEventListeners[path];
  }
  
  // Store the service instance before removing it from the registry
  const removedService = service;
  
  // Remove the service from the registry
  delete this._services[path];
  
  // Filter out any global or interceptor hooks that specifically target this service
  this.globalHooks = this.globalHooks.filter(hook => {
    // Keep hooks with wildcard pattern
    if (hook.servicePathPattern === '*') return true;
    
    // Keep hooks that don't match this service path
    if (hook.servicePathPattern && typeof hook.servicePathPattern === 'string') {
      return !this._isPathMatch(path, hook.servicePathPattern);
    }
    
    // Default to keeping the hook if we can't determine
    return true;
  });
  
  this.interceptorGlobalHooks = this.interceptorGlobalHooks.filter(hook => {
    // Keep hooks with wildcard pattern
    if (hook.servicePathPattern === '*') return true;
    
    // Keep hooks that don't match this service path
    if (hook.servicePathPattern && typeof hook.servicePathPattern === 'string') {
      return !this._isPathMatch(path, hook.servicePathPattern);
    }
    
    // Default to keeping the hook if we can't determine
    return true;
  });
  
  // Return the removed service instance
  return removedService as Svc;
}

/**
 * Emit an event with data and optional context.
 * 
 * @param event The event name
 * @param data The event data
 * @param context Optional context information
 * @returns The app instance for chaining
 */
public emit(event: string, data: any, context?: any): this {
  this.eventEmitter.emit(event, data, context);
  return this;
}

/**
 * Register an event listener.
 * 
 * @param event The event name or pattern to listen for
 * @param listener The callback function to execute when the event is emitted
 * @returns The app instance for chaining
 */
public on(event: string, listener: (data: any, context?: any) => void): this {
  this.eventEmitter.on(event, listener);
  return this;
}

/**
 * Remove an event listener.
 * 
 * @param event The event name
 * @param listener The listener function to remove
 * @returns The app instance for chaining
 */
public off(event: string, listener: (data: any, context?: any) => void): this {
  this.eventEmitter.off(event, listener);
  return this;
}

/**
 * Helper method to build a route path from a service path and segment.
 * Normalizes paths and handles special cases.
 * 
 * @param servicePath The base service path
 * @param segment The path segment to append (if any)
 * @returns The normalized full route path
 */
private _buildRoutePath(servicePath: string, segment: string): string {
  // Normalize segments
  const normalizedServicePath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
  const normalizedSegment = segment ? 
    (segment.startsWith('/') ? segment : `/${segment}`) : '';
  
  // Combine and clean up the path
  let result = `${normalizedServicePath}${normalizedSegment}`;
  result = result.replace(/\/\//g, '/'); // Remove double slashes
  
  // Handle trailing slashes and empty paths
  if (result !== '/' && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result || '/';
}

/**
 * Helper method to check if a path matches a pattern.
 * Supports simple glob-style pattern matching with * wildcard.
 * 
 * @param path The path to check
 * @param pattern The pattern to match against
 * @returns True if the path matches the pattern
 */
private _isPathMatch(path: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === path) return true;
  
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
  
  return false;
}
}

/**
 * Creates a new ScorpionJS application instance.
 */
export const createApp = (): ScorpionApp<any> => {
  return new ScorpionApp();
};
