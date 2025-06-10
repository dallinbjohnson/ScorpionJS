import { expect } from 'chai';
import { ScorpionApp } from '../../src/app.js'; // Adjust path as necessary
import { Service, HookContext, Params, NextFunction } from '../../src/types.js'; // Adjust path as necessary

describe('ScorpionJS Hook Execution Order', () => {
  let app: ScorpionApp;

  beforeEach(() => {
    app = new ScorpionApp();
  });

  it('should be a placeholder test', () => {
    expect(true).to.equal(true);
  });

  it('should execute "before" hooks in the correct order (Global -> Service -> Interceptor)', async () => {
    const executionOrder: string[] = [];

    // Mock service
    class TestService implements Service<ScorpionApp> {
      app!: ScorpionApp;
      async find(params: Params) {
        executionOrder.push('serviceMethodFind'); // Be specific for different methods later
        return { id: 1, data: 'test from find' };
      }
      // Add stubs for other standard service methods to satisfy the Service interface
      async get(id: string | number, params: Params) { 
        executionOrder.push('serviceMethodGet');
        return { id, message: 'get stub' }; 
      }
      async create(data: any, params: Params) { 
        executionOrder.push('serviceMethodCreate');
        return { ...data, message: 'create stub' }; 
      }
      async update(id: string | number | null, data: any, params: Params) { 
        executionOrder.push('serviceMethodUpdate');
        return { id, ...data, message: 'update stub' }; 
      }
      async patch(id: string | number | null, data: any, params: Params) { 
        executionOrder.push('serviceMethodPatch');
        return { id, ...data, message: 'patch stub' }; 
      }
      async remove(id: string | number | null, params: Params) { 
        executionOrder.push('serviceMethodRemove');
        return { id, message: 'remove stub' }; 
      }
    }
    const testService = new TestService();
    app.use('test-service', testService);
    app.service('test-service').hooks({
        before: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceBefore');
          }
        }
      });

    // Register global hook
    app.hooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalBefore');
        }
      }
    });

    // Register interceptor hook
    app.interceptorHooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorBefore');
        }
      }
    });

    await app.executeServiceCall<TestService>({
      servicePath: 'test-service',
      method: 'find',
      params: { query: {} }, // Provide a basic params object
    });

    expect(executionOrder).to.deep.equal([
      'globalBefore',
      'serviceBefore',
      'interceptorBefore',
      'serviceMethodFind'
    ]);
  });

  it('should execute "after" hooks in the correct order (Interceptor -> Service -> Global) after the method', async () => {
    const executionOrder: string[] = [];

    class TestService implements Service<ScorpionApp> {
      app!: ScorpionApp;
      async find(params: Params) {
        executionOrder.push('serviceMethodFind');
        return { id: 1, data: 'test from find' };
      }
      async get(id: string | number, params: Params) { executionOrder.push('serviceMethodGet'); return { id, message: 'get stub' }; }
      async create(data: any, params: Params) { executionOrder.push('serviceMethodCreate'); return { ...data, message: 'create stub' }; }
      async update(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodUpdate'); return { id, ...data, message: 'update stub' }; }
      async patch(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodPatch'); return { id, ...data, message: 'patch stub' }; }
      async remove(id: string | number | null, params: Params) { executionOrder.push('serviceMethodRemove'); return { id, message: 'remove stub' }; }
    }
    const testService = new TestService();
    app.use('test-service-after', testService);
    app.service('test-service-after').hooks({
        before: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceBefore');
          }
        },
        after: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceAfter');
          }
        }
      });

    app.hooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalBefore');
        }
      },
      after: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalAfter');
        }
      }
    });

    app.interceptorHooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorBefore');
        }
      },
      after: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorAfter');
        }
      }
    });

    await app.executeServiceCall<TestService>({
      servicePath: 'test-service-after',
      method: 'find',
      params: { query: {} },
    });

    expect(executionOrder).to.deep.equal([
      'globalBefore',
      'serviceBefore',
      'interceptorBefore',
      'serviceMethodFind',
      'interceptorAfter',
      'serviceAfter',
      'globalAfter'
    ]);
  });

  it('should execute "around" hooks in the correct order (Global -> Service -> Interceptor -> Method -> Interceptor -> Service -> Global)', async () => {
    const executionOrder: string[] = [];

    class TestService implements Service<ScorpionApp> {
      app!: ScorpionApp;
      async find(params: Params) {
        executionOrder.push('serviceMethodFind');
        return { id: 1, data: 'test from find' };
      }
      async get(id: string | number, params: Params) { executionOrder.push('serviceMethodGet'); return { id, message: 'get stub' }; }
      async create(data: any, params: Params) { executionOrder.push('serviceMethodCreate'); return { ...data, message: 'create stub' }; }
      async update(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodUpdate'); return { id, ...data, message: 'update stub' }; }
      async patch(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodPatch'); return { id, ...data, message: 'patch stub' }; }
      async remove(id: string | number | null, params: Params) { executionOrder.push('serviceMethodRemove'); return { id, message: 'remove stub' }; }
    }
    const testService = new TestService();
    app.use('test-service-around', testService);
    app.service('test-service-around').hooks({
        around: {
          find: async (context: HookContext<ScorpionApp, TestService>, next: NextFunction<ScorpionApp, TestService>) => {
            executionOrder.push('serviceAroundBefore');
            // Pass the current context to next(), or modify it before passing if needed.
            // The result of next() is the context after downstream hooks/method have run.
            const resultContext = await next(context);
            executionOrder.push('serviceAroundAfter');
            // If the hook wants to modify the result further, it can do so here.
            // For this test, we just return the result from downstream.
            return resultContext;
          }
        }
      });

    app.hooks({
      around: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>, next: NextFunction<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalAroundBefore');
          const resultContext = await next(context);
          executionOrder.push('globalAroundAfter');
          return resultContext;
        }
      }
    });

    app.interceptorHooks({
      around: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>, next: NextFunction<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorAroundBefore');
          const resultContext = await next(context);
          executionOrder.push('interceptorAroundAfter');
          return resultContext;
        }
      }
    });

    await app.executeServiceCall<TestService>({
      servicePath: 'test-service-around',
      method: 'find',
      params: { query: {} },
    });

    expect(executionOrder).to.deep.equal([
      'globalAroundBefore',
      'serviceAroundBefore',
      'interceptorAroundBefore',
      'serviceMethodFind',
      'interceptorAroundAfter',
      'serviceAroundAfter',
      'globalAroundAfter'
    ]);
  });

  it('should execute "error" hooks in the correct order (Interceptor -> Service -> Global) when a service method throws an error', async () => {
    const executionOrder: string[] = [];
    const testError = new Error('Service method failed!');

    class TestService implements Service<ScorpionApp> {
      app!: ScorpionApp;
      async find(params: Params) {
        executionOrder.push('serviceMethodFindAttempt');
        throw testError;
      }
      async get(id: string | number, params: Params) { executionOrder.push('serviceMethodGet'); throw testError; }
      async create(data: any, params: Params) { executionOrder.push('serviceMethodCreate'); throw testError; }
      async update(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodUpdate'); throw testError; }
      async patch(id: string | number | null, data: any, params: Params) { executionOrder.push('serviceMethodPatch'); throw testError; }
      async remove(id: string | number | null, params: Params) { executionOrder.push('serviceMethodRemove'); throw testError; }
    }
    const testService = new TestService();
    app.use('test-service-error', testService);
    app.service('test-service-error').hooks({
        before: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceBefore');
          }
        },
        after: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceAfter'); // Should not run
          }
        },
        error: {
          find: async (context: HookContext<ScorpionApp, TestService>) => {
            executionOrder.push('serviceError');
            expect(context.error).to.equal(testError);
            // Modify the error or result for the client
            context.result = { message: 'Error handled gracefully' };
            // context.error = null; // To indicate the error was handled
          }
        }
      });

    app.hooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalBefore');
        }
      },
      after: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalAfter'); // Should not run
        }
      },
      error: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('globalError');
          expect(context.error).to.equal(testError);
        }
      }
    });

    app.interceptorHooks({
      before: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorBefore');
        }
      },
      after: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorAfter'); // Should not run
        }
      },
      error: {
        all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
          executionOrder.push('interceptorError');
          expect(context.error).to.equal(testError);
        }
      }
    });

    // executeServiceCall should not throw but populate context.error
    const finalContext = await app.executeServiceCall<TestService>({
      servicePath: 'test-service-error',
      method: 'find',
      params: { query: {} },
    });

    expect(finalContext.error).to.equal(testError);
    expect(executionOrder).to.deep.equal([
      'globalBefore',
      'serviceBefore',
      'interceptorBefore',
      'serviceMethodFindAttempt',
      'interceptorError',
      'serviceError',
      'globalError'
    ]);

    // Ensure no after hooks were called
    expect(executionOrder).to.not.include('serviceAfter');
    expect(executionOrder).to.not.include('globalAfter');
    expect(executionOrder).to.not.include('interceptorAfter');
  });

  // More tests will go here to verify the detailed hook execution order
  // for global, service-specific, and interceptor hooks (before, around, after, error).
});
