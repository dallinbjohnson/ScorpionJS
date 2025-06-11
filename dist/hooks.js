// src/hooks.ts
// import { ScorpionApp } from './app.js'; // No longer needed directly, use IScorpionApp
import { NotFound } from './errors.js';
// Type guard to check if a function is an AroundHookFunction
function isAroundHookFunction(fn) {
    // AroundHookFunction expects two arguments (context, next)
    // StandardHookFunction expects one argument (context)
    return fn.length === 2;
}
// Helper function for pattern matching (simple glob-like or RegExp)
function matchesPattern(text, pattern) {
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
 * Helper function to filter hooks by type and pattern
 */
function filterHooksByType(hooks, path, method, checkServicePath = true) {
    const beforeHooks = [];
    const afterHooks = [];
    const errorHooks = [];
    const aroundHooks = [];
    hooks.forEach(hook => {
        // For service hooks, we don't need to check path (it's implicit)
        const pathMatches = !checkServicePath || matchesPattern(path || '', hook.servicePathPattern);
        const methodMatches = matchesPattern(method || '', hook.methodPattern);
        if (pathMatches && methodMatches) {
            if (hook.type === 'before')
                beforeHooks.push(hook);
            else if (hook.type === 'after')
                afterHooks.push(hook);
            else if (hook.type === 'error')
                errorHooks.push(hook);
            else if (hook.type === 'around')
                aroundHooks.push(hook);
        }
    });
    return { beforeHooks, afterHooks, errorHooks, aroundHooks };
}
/**
 * Helper function to execute standard hooks (before, after, error)
 */
async function executeStandardHooks(hooks, context, hookType, path, method, suppressErrorLogging = false) {
    // Create a new context with the correct hook type
    let currentContext = { ...context };
    currentContext.type = hookType;
    // For after and error hooks, we process them in reverse order (LIFO)
    const hooksToProcess = hookType === 'error' || hookType === 'after' ? hooks.slice().reverse() : hooks;
    for (const hook of hooksToProcess) {
        // For error hooks, we continue even if there's an error
        // For before/after hooks, we break the chain on error
        if (currentContext.error && hookType !== 'error')
            break;
        const hookFn = hook.fn;
        if (isAroundHookFunction(hookFn)) {
            console.warn(`[ScorpionJS] Misplaced AroundHookFunction in '${hookType}' hooks. Skipping. Service: ${path}, Method: ${method}`);
            continue;
        }
        try {
            // We need to cast the hook function and context to compatible types
            const hookResult = await hookFn(currentContext);
            if (hookResult !== undefined && hookResult !== null) {
                currentContext = { ...currentContext, ...hookResult };
            }
        }
        catch (err) {
            if (hookType === 'error' && suppressErrorLogging) {
                console.error('[ScorpionJS] Error in error hook itself:', err);
                // Suppress errors in error hooks to prevent cascading
            }
            else {
                currentContext.error = err;
            }
        }
    }
    return currentContext;
}
export async function runHooks(initialContext, globalHooks, interceptorGlobalHooks, applicableServiceHooks) {
    let currentContext = initialContext;
    const { path, method } = initialContext;
    // 1. Filter hooks by type and pattern
    const { beforeHooks: applicableGlobalBeforeHooks, afterHooks: applicableGlobalAfterHooks, errorHooks: applicableGlobalErrorHooks, aroundHooks: applicableGlobalAroundHooks } = filterHooksByType(globalHooks, path, method);
    const { beforeHooks: applicableServiceBeforeHooks, afterHooks: applicableServiceAfterHooks, errorHooks: applicableServiceErrorHooks, aroundHooks: applicableServiceAroundHooks } = filterHooksByType(applicableServiceHooks, path, method, false);
    const { beforeHooks: applicableInterceptorBeforeHooks, afterHooks: applicableInterceptorAfterHooks, errorHooks: applicableInterceptorErrorHooks, aroundHooks: applicableInterceptorAroundHooks } = filterHooksByType(interceptorGlobalHooks, path, method);
    // Function to execute the main service method
    const callServiceMethod = async (contextForServiceCall) => {
        let operationContext = { ...contextForServiceCall }; // Work on a copy
        if (!operationContext.error && operationContext.path && operationContext.method) {
            const service = operationContext.service;
            const rawService = operationContext._rawService || service;
            const serviceMethod = rawService?.[operationContext.method];
            if (service && operationContext.method && typeof serviceMethod === 'function') {
                try {
                    const methodName = operationContext.method;
                    const args = [];
                    // Reconstruct arguments based on standard service method signatures
                    switch (methodName) {
                        case 'find':
                            args.push(operationContext.params);
                            break;
                        case 'get':
                        case 'remove':
                            args.push(operationContext.id);
                            args.push(operationContext.params);
                            break;
                        case 'create':
                            args.push(operationContext.data);
                            args.push(operationContext.params);
                            break;
                        case 'update':
                        case 'patch':
                            args.push(operationContext.id);
                            args.push(operationContext.data);
                            args.push(operationContext.params);
                            break;
                        default:
                            // Basic support for custom methods. Assumes a signature of (id, data, params)
                            // but only includes what's available in the context.
                            if (operationContext.id !== undefined && operationContext.id !== null) {
                                args.push(operationContext.id);
                            }
                            if (operationContext.data !== undefined) {
                                args.push(operationContext.data);
                            }
                            args.push(operationContext.params);
                            break;
                    }
                    operationContext.result = await serviceMethod.apply(rawService, args);
                }
                catch (err) {
                    operationContext.error = err;
                }
            }
            else {
                operationContext.error = new NotFound(`Service method ${operationContext.path}.${operationContext.method} not found or not a function.`);
            }
        }
        return operationContext;
    };
    // New: Execute Around Hooks with (context, next)
    const allAroundHooksCombined = [
        ...applicableGlobalAroundHooks,
        ...applicableServiceAroundHooks,
        ...applicableInterceptorAroundHooks
    ];
    // Type-safe helper function to call around hooks with appropriate context and next function
    function callAroundHook(hookFn, context, next) {
        // This function provides a type-safe boundary between the different hook function types
        // It ensures that the hook function receives the context and next function with compatible types
        return hookFn(context, next);
    }
    const executeAroundChain = async (chainInitialContext) => {
        // Dispatch and nextCallback will operate with HookContext<A, Service<A>> for broader compatibility with all around hooks.
        const dispatch = async function dispatch(index, contextForDispatchInput) {
            if (index >= allAroundHooksCombined.length) {
                // Before calling service method, ensure context is Svc compatible.
                // contextForDispatch is Service<A> here, callServiceMethod expects Svc.
                return callServiceMethod(contextForDispatchInput);
            }
            const hookObject = allAroundHooksCombined[index];
            const hookFn = hookObject.fn;
            // Create a new context for this specific hook invocation.
            // It starts based on contextForDispatchInput and its type is initially 'around'.
            let currentHookProcessingContext = {
                ...contextForDispatchInput,
                type: 'around', // Initial type for this hook's processing
            };
            const nextCallback = async (modifiedContext) => {
                // If hook provides modified context, use it for the rest of the chain, otherwise use the current one.
                return dispatch(index + 1, modifiedContext || currentHookProcessingContext);
            };
            // Assuming hookFn is AroundHookFunction because it's from allAroundHooksCombined (filtered for 'around' type)
            try {
                // Use our type-safe helper to call the hook function with appropriate types
                // This eliminates the need for the 'as any' cast while maintaining type safety
                return await callAroundHook(hookFn, currentHookProcessingContext, nextCallback);
            }
            catch (err) {
                // This error is from the current hook `hookFn` itself, or an error propagated from `await nextCallback()`
                // that `hookFn` didn't catch.
                currentHookProcessingContext.error = err;
                currentHookProcessingContext.type = 'error'; // Ensure type is error
                // Do not proceed further down the 'around' chain for normal execution.
                // The main runHooks flow will handle error hooks based on this context.
                return currentHookProcessingContext;
            }
        };
        // Initial call to dispatch: chainInitialContext (Svc) is assignable to Service<A> for contextForDispatch.
        return dispatch(0, chainInitialContext);
    };
    // --- Main Execution Flow ---
    // Stage 1: Execute Regular Global 'before' hooks
    if (!currentContext.error) {
        currentContext = await executeStandardHooks(applicableGlobalBeforeHooks, currentContext, 'before', path, method);
    }
    // Stage 2: Execute Service-specific 'before' hooks
    if (!currentContext.error) {
        currentContext = await executeStandardHooks(applicableServiceBeforeHooks, currentContext, 'before', path, method);
    }
    // Stage 3: Execute Interceptor Global 'before' hooks
    if (!currentContext.error) {
        currentContext = await executeStandardHooks(applicableInterceptorBeforeHooks, currentContext, 'before', path, method);
    }
    // Stage 4: Execute 'around' chain (Regular Global -> Service-specific -> Interceptor Global -> Service Method)
    if (!currentContext.error) {
        currentContext = await executeAroundChain(currentContext);
    }
    // Stage 5: 'after' hooks (LIFO: Interceptor -> Service -> Global)
    // These run only if no error has occurred up to this point from before/around/service method.
    // If an 'after' hook itself throws, it will set currentContext.error, which is then handled by Stage 6.
    if (!currentContext.error) {
        // Execute Interceptor Global 'after' hooks
        currentContext = await executeStandardHooks(applicableInterceptorAfterHooks, currentContext, 'after', path, method);
        // Execute Service-specific 'after' hooks
        if (!currentContext.error) {
            currentContext = await executeStandardHooks(applicableServiceAfterHooks, currentContext, 'after', path, method);
        }
        // Execute Regular Global 'after' hooks
        if (!currentContext.error) {
            currentContext = await executeStandardHooks(applicableGlobalAfterHooks, currentContext, 'after', path, method);
        }
    }
    // Stage 6: 'error' hooks (LIFO: Interceptor -> Service -> Global)
    // This block runs if an error occurred at any point: before, around, service method, or in 'after' hooks.
    if (currentContext.error) {
        // Execute Interceptor error hooks
        currentContext = await executeStandardHooks(applicableInterceptorErrorHooks, currentContext, 'error', path, method, true // Suppress error logging for error hooks
        );
        // Execute Service-specific error hooks
        currentContext = await executeStandardHooks(applicableServiceErrorHooks, currentContext, 'error', path, method, true // Suppress error logging for error hooks
        );
        // Execute Regular Global error hooks
        currentContext = await executeStandardHooks(applicableGlobalErrorHooks, currentContext, 'error', path, method, true // Suppress error logging for error hooks
        );
    }
    return currentContext;
}
