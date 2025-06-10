// src/hooks.ts

import * as http from 'http';
import { IScorpionApp, Service, HookContext, HookObject, StandardHookFunction, AroundHookFunction, NextFunction } from './types.js';
// import { ScorpionApp } from './app.js'; // No longer needed directly, use IScorpionApp
import { ScorpionError, NotFound } from './errors.js';

// Type guard to check if a function is an AroundHookFunction
function isAroundHookFunction<A extends IScorpionApp<any>, S extends Service<A> | undefined>(
  fn: StandardHookFunction<A, S> | AroundHookFunction<A, S>
): fn is AroundHookFunction<A, S> {
  // AroundHookFunction expects two arguments (context, next)
  // StandardHookFunction expects one argument (context)
  return fn.length === 2;
}

// Helper function for pattern matching (simple glob-like or RegExp)
function matchesPattern(text: string, pattern?: string | RegExp): boolean {
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

export async function runHooks<A extends IScorpionApp<any>, Svc extends Service<A> | undefined = undefined>(
  initialContext: HookContext<A, Svc>,
  globalHooks: HookObject<A, Service<A> | undefined>[],
  interceptorGlobalHooks: HookObject<A, Service<A> | undefined>[],
  applicableServiceHooks: HookObject<A, Svc>[]
): Promise<HookContext<A, Svc>> {
  let currentContext: HookContext<A, Svc> = initialContext;
  const { servicePath, method } = initialContext;

  // 1. Filter global hooks by type and pattern
  const applicableGlobalBeforeHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableGlobalAfterHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableGlobalErrorHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableGlobalAroundHooks: HookObject<A, Service<A> | undefined>[] = [];

  globalHooks.forEach((hook: HookObject<A, Service<A> | undefined>) => {
    if (matchesPattern(servicePath || '', hook.servicePathPattern) && matchesPattern(method || '', hook.methodPattern)) {
      if (hook.type === 'before') applicableGlobalBeforeHooks.push(hook);
      else if (hook.type === 'after') applicableGlobalAfterHooks.push(hook);
      else if (hook.type === 'error') applicableGlobalErrorHooks.push(hook);
      else if (hook.type === 'around') applicableGlobalAroundHooks.push(hook);
    }
  });

  // 2. Filter service-specific hooks by type and pattern
  const applicableServiceBeforeHooks: HookObject<A, Svc>[] = [];
  const applicableServiceAfterHooks: HookObject<A, Svc>[] = [];
  const applicableServiceErrorHooks: HookObject<A, Svc>[] = [];
  const applicableServiceAroundHooks: HookObject<A, Svc>[] = [];

  applicableServiceHooks.forEach(hook => {
    if (matchesPattern(method || '', hook.methodPattern)) {
      if (hook.type === 'before') applicableServiceBeforeHooks.push(hook);
      else if (hook.type === 'after') applicableServiceAfterHooks.push(hook);
      else if (hook.type === 'error') applicableServiceErrorHooks.push(hook);
      else if (hook.type === 'around') applicableServiceAroundHooks.push(hook);
    }
  });

  // Filter interceptor global hooks by type and pattern
  const applicableInterceptorBeforeHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableInterceptorAfterHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableInterceptorErrorHooks: HookObject<A, Service<A> | undefined>[] = [];
  const applicableInterceptorAroundHooks: HookObject<A, Service<A> | undefined>[] = [];

  interceptorGlobalHooks.forEach((hook: HookObject<A, Service<A> | undefined>) => {
    if (matchesPattern(servicePath || '', hook.servicePathPattern) && matchesPattern(method || '', hook.methodPattern)) {
      if (hook.type === 'before') applicableInterceptorBeforeHooks.push(hook);
      else if (hook.type === 'after') applicableInterceptorAfterHooks.push(hook);
      else if (hook.type === 'error') applicableInterceptorErrorHooks.push(hook);
      else if (hook.type === 'around') applicableInterceptorAroundHooks.push(hook);
    }
  });

  // Function to execute the main service method
  const callServiceMethod = async (contextForServiceCall: HookContext<A, Svc>): Promise<HookContext<A, Svc>> => {
    let operationContext = { ...contextForServiceCall }; // Work on a copy
    if (!operationContext.error && operationContext.servicePath && operationContext.method) {
      const service = operationContext.service; // Svc can be undefined here
      const serviceMethod = (service as any)?.[operationContext.method] as Function;
      if (service && operationContext.method && typeof serviceMethod === 'function') {
        try {
          const args: any[] = [];
          const httpMethod = (operationContext.params.req as http.IncomingMessage)?.method?.toUpperCase();
          if (operationContext.id !== undefined && operationContext.id !== null) args.push(operationContext.id);
          if ((httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH') && operationContext.data !== undefined) args.push(operationContext.data);
          args.push(operationContext.params);
          operationContext.result = await serviceMethod.apply(service, args);
        } catch (err: any) {
          operationContext.error = err;
        }
      } else {
        operationContext.error = new NotFound(`Service method ${operationContext.servicePath}.${operationContext.method} not found or not a function.`);
      }
    }
    return operationContext;
  };

  // New: Execute Around Hooks with (context, next)
  const allAroundHooksCombined: (HookObject<A, Service<A> | undefined> | HookObject<A, Svc>)[] = [
    ...applicableGlobalAroundHooks,
    ...applicableServiceAroundHooks,
    ...applicableInterceptorAroundHooks
  ];

  const executeAroundChain = async (chainInitialContext: HookContext<A, Service<A> | undefined>): Promise<HookContext<A, Service<A> | undefined>> => {
    // Dispatch and nextCallback will operate with HookContext<A, Service<A>> for broader compatibility with all around hooks.
    const dispatch = async function dispatch(index: number, contextForDispatchInput: HookContext<A, Service<A> | undefined>): Promise<HookContext<A, Service<A> | undefined>> {
      if (index >= allAroundHooksCombined.length) {
        // Before calling service method, ensure context is Svc compatible.
        // contextForDispatch is Service<A> here, callServiceMethod expects Svc.
        return callServiceMethod(contextForDispatchInput as HookContext<A, Svc>);
      }

      const hookObject = allAroundHooksCombined[index];
      const hookFn = hookObject.fn;
      // Create a new context for this specific hook invocation.
      // It starts based on contextForDispatchInput and its type is initially 'around'.
      let currentHookProcessingContext: HookContext<A, Service<A> | undefined> = {
        ...contextForDispatchInput,
        type: 'around' as const, // Initial type for this hook's processing
      };

      const nextCallback: NextFunction<A, Service<A> | undefined> = async (modifiedContext?: HookContext<A, Service<A> | undefined>) => {
        // If hook provides modified context, use it for the rest of the chain, otherwise use the current one.
        return dispatch(index + 1, modifiedContext || currentHookProcessingContext);
      };

      // Assuming hookFn is AroundHookFunction because it's from allAroundHooksCombined (filtered for 'around' type)
      try {
        // The type assertion here helps TypeScript understand the signature for the call.
        // It's a union of AroundHookFunction for global/interceptor services and service-specific Svc.
        // hookFn is AroundHookFunction<A, Svc> | AroundHookFunction<A, Service<A>>
        // currentHookProcessingContext is HookContext<A, Service<A>> & { type: 'around' }
        // nextCallback is NextFunction<A, Service<A>>
        // Using 'as any' for hookFn call temporarily to bypass complex type interaction for around hooks.
        // The hook function is responsible for the control flow.
        // It must call `await nextCallback(...)` if it wants the chain to continue.
        // Its return value becomes the result of this `dispatch` call.
        return await (hookFn as any)(
          currentHookProcessingContext,
          nextCallback
        );
      } catch (err: any) {
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
    return dispatch(0, chainInitialContext as HookContext<A, Service<A> | undefined>) as Promise<HookContext<A, Svc>>;
  };

  // --- Main Execution Flow ---

  // Stage 1: Regular Global 'before' hooks
  currentContext.type = 'before';
  for (const hook of applicableGlobalBeforeHooks) {
    if (currentContext.error) break;
    const hookFnInstance = hook.fn;
    if (isAroundHookFunction(hookFnInstance)) {
      console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'before' global hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
      continue;
    }
    try {
      const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
      if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult } as HookContext<A, Svc>;
    } catch (err: any) {
      currentContext.error = err;
    }
  }

  // Stage 2: Service-specific 'before' hooks
  if (!currentContext.error) {
    currentContext.type = 'before';
    for (const hook of applicableServiceBeforeHooks) {
      if (currentContext.error) break;
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) {
        console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'before' service hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
        continue;
      }
      try {
        // Service-specific hooks take HookContext<A, Svc>. currentContext is already this type.
        const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Svc>)(currentContext);
        if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult };
      } catch (err: any) {
        currentContext.error = err;
      }
    }
  }

  // Stage 3: Interceptor Global 'before' hooks
  if (!currentContext.error) {
    currentContext.type = 'before';
    for (const hook of applicableInterceptorBeforeHooks) {
      if (currentContext.error) break;
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) {
        console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'before' interceptor hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
        continue;
      }
      try {
        // Global/Interceptor hooks take HookContext<A, Service<A>>. currentContext is HookContext<A, Svc> which is assignable.
        const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
        if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult } as HookContext<A, Svc>;
      } catch (err: any) {
        currentContext.error = err;
      }
    }
  }

  // Stage 4: Execute 'around' chain (Regular Global -> Service-specific -> Interceptor Global -> Service Method)
  if (!currentContext.error) {
    currentContext = await executeAroundChain(currentContext as HookContext<A, Service<A> | undefined>) as HookContext<A, Svc>;
  }

  // Stage 5: 'after' hooks (LIFO: Interceptor -> Service -> Global)
  // These run only if no error has occurred up to this point from before/around/service method.
  // If an 'after' hook itself throws, it will set currentContext.error, which is then handled by Stage 6.
  if (!currentContext.error) {
    currentContext.type = 'after';

    // Interceptor Global 'after' hooks
    for (const hook of applicableInterceptorAfterHooks.slice().reverse()) {
      if (currentContext.error) break; // Stop if an earlier after-hook in this stage caused an error
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) {
        console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'after' interceptor hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
        continue;
      }
      try {
        const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
        if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult } as HookContext<A, Svc>;
      } catch (err: any) {
        currentContext.error = err;
      }
    }

    // Service-specific 'after' hooks
    if (!currentContext.error) {
      for (const hook of applicableServiceAfterHooks.slice().reverse()) {
        if (currentContext.error) break;
        const hookFnInstance = hook.fn;
        if (isAroundHookFunction(hookFnInstance)) {
          console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'after' service hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
          continue;
        }
        try {
          // Service-specific hooks take HookContext<A, Svc>. currentContext is already this type.
          const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Svc>)(currentContext);
          if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult };
        } catch (err: any) {
          currentContext.error = err;
        }
      }
    }

    // Regular Global 'after' hooks
    if (!currentContext.error) {
      for (const hook of applicableGlobalAfterHooks.slice().reverse()) {
        if (currentContext.error) break;
        const hookFnInstance = hook.fn;
        if (isAroundHookFunction(hookFnInstance)) {
          console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'after' global hooks. Skipping. Service: ${servicePath}, Method: ${method}`);
          continue;
        }
        try {
          const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
          if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult } as HookContext<A, Svc>;
        } catch (err: any) {
          currentContext.error = err;
        }
      }
    }
  }

  // Stage 6: 'error' hooks (LIFO: Interceptor -> Service -> Global)
  // This block runs if an error occurred at any point: before, around, service method, or in 'after' hooks.
  if (currentContext.error) {
    currentContext.type = 'error';
    // Error hooks run: Interceptor -> Service -> Global (LIFO relative to their 'before' counterparts)
    for (const hook of applicableInterceptorErrorHooks.slice().reverse()) {
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) { console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'error' interceptor hooks. Skipping. Service: ${servicePath}, Method: ${method}`); continue; }
      try { 
        const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
        if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult } as HookContext<A, Svc>;
      } catch (e) { console.error('[ScorpionJS] Error in interceptor error hook itself:', e); /* Error in error hook; suppress */ }
    }
    for (const hook of applicableServiceErrorHooks.slice().reverse()) {
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) { console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'error' service hooks. Skipping. Service: ${servicePath}, Method: ${method}`); continue; }
      try { 
        const hookCallResult = await (hookFnInstance as StandardHookFunction<A, Svc>)(currentContext);
        if (hookCallResult !== undefined && hookCallResult !== null) currentContext = { ...currentContext, ...hookCallResult };
      } catch (e) { console.error('[ScorpionJS] Error in service error hook itself:', e); /* Error in error hook; suppress */ }
    }
    for (const hook of applicableGlobalErrorHooks.slice().reverse()) {
      const hookFnInstance = hook.fn;
      if (isAroundHookFunction(hookFnInstance)) { console.warn(`[ScorpionJS] Misplaced AroundHookFunction in 'error' global hooks. Skipping. Service: ${servicePath}, Method: ${method}`); continue; }
      try { 
        const result = await (hookFnInstance as StandardHookFunction<A, Service<A> | undefined>)(currentContext as HookContext<A, Service<A> | undefined>);
        if (result !== undefined && result !== null) currentContext = { ...currentContext, ...result } as HookContext<A, Svc>; 
      } catch (e) { console.error('[ScorpionJS] Error in global error hook itself:', e); /* Error in error hook; suppress */ }
    }
  }

  return currentContext;
}
