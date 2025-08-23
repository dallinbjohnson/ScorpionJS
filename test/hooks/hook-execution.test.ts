import { expect } from 'chai';
import { ScorpionApp } from '../../src/app.js'; // Adjust path as necessary
import { IScorpionApp, Service, HookContext, Params, NextFunction } from '../../src/types.js'; // Adjust path as necessary

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
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
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
      path: 'test-service',
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
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
            executionOrder.push('serviceBefore');
          }
        },
        after: {
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
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
      path: 'test-service-after',
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
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>, next: NextFunction<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
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
      path: 'test-service-around',
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
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
            executionOrder.push('serviceBefore');
          }
        },
        after: {
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
            executionOrder.push('serviceAfter'); // Should not run
          }
        },
        error: {
          find: async (context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
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
      path: 'test-service-error',
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

  describe('Pattern-Based Hooks', () => {
    it('should match wildcard patterns for service paths', async () => {
      const executionOrder: string[] = [];

      class ApiService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('api-service-find');
          return { data: 'api data' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      class UserService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('user-service-find');
          return { data: 'user data' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      app.use('api/secure/users', new ApiService());
      app.use('api/secure/posts', new ApiService());
      app.use('users', new UserService());

      // Pattern-based hook that should only match services under 'api/secure/*'
      app.hooks('api/secure/*', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('secure-api-before');
          }
        }
      });

      // Test that the pattern matches 'api/secure/users'
      await (app.service('api/secure/users') as any).find({ query: {} });

      // Test that the pattern matches 'api/secure/posts'
      await (app.service('api/secure/posts') as any).find({ query: {} });

      // Test that the pattern does NOT match 'users'
      await (app.service('users') as any).find({ query: {} });

      expect(executionOrder).to.deep.equal([
        'secure-api-before',
        'api-service-find',
        'secure-api-before',
        'api-service-find',
        'user-service-find' // No 'secure-api-before' for this one
      ]);
    });

    it('should support RegExp patterns for service paths', async () => {
      const executionOrder: string[] = [];

      class TestService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('service-find');
          return { data: 'test' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      app.use('users-v1', new TestService());
      app.use('posts-v1', new TestService());
      app.use('comments-v2', new TestService());

      // RegExp pattern that matches services ending with '-v1'
      app.hooks(/.*-v1$/, {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('v1-api-before');
          }
        }
      });

      await (app.service('users-v1') as any).find({ query: {} });

      await (app.service('posts-v1') as any).find({ query: {} });

      await (app.service('comments-v2') as any).find({ query: {} });

      expect(executionOrder).to.deep.equal([
        'v1-api-before',
        'service-find',
        'v1-api-before',
        'service-find',
        'service-find' // No 'v1-api-before' for v2 service
      ]);
    });

    it('should support method patterns in addition to service path patterns', async () => {
      const executionOrder: string[] = [];

      class CrudService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('find-method');
          return { data: [] };
        }
        async get(id: string | number, params: Params) {
          executionOrder.push('get-method');
          return { id };
        }
        async create(data: any, params: Params) {
          executionOrder.push('create-method');
          return data;
        }
        async update(id: string | number | null, data: any, params: Params) {
          executionOrder.push('update-method');
          return data;
        }
        async patch(id: string | number | null, data: any, params: Params) {
          executionOrder.push('patch-method');
          return data;
        }
        async remove(id: string | number | null, params: Params) {
          executionOrder.push('remove-method');
          return { id };
        }
      }

      app.use('api/data', new CrudService());

      // Pattern-based hook that matches 'api/*' services but only read operations (find, get)
      app.hooks('api/*', {
        before: {
          find: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('read-operation-before');
          },
          get: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('read-operation-before');
          }
        }
      });

      // Test read operations (should trigger hook)
      const apiDataService = app.service('api/data') as any;
      await apiDataService.find({ query: {} });

      await apiDataService.get(1, { query: {} });

      // Test write operations (should NOT trigger hook)
      await apiDataService.create({ name: 'test' }, { query: {} });

      await apiDataService.remove(1, { query: {} });

      expect(executionOrder).to.deep.equal([
        'read-operation-before',
        'find-method',
        'read-operation-before',
        'get-method',
        'create-method', // No hook for create
        'remove-method'  // No hook for remove
      ]);
    });

    it('should support complex glob patterns with multiple wildcards', async () => {
      const executionOrder: string[] = [];

      class TestService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push(`service-${this.constructor.name}-find`);
          return { data: 'test' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      class UserService extends TestService {}
      class PostService extends TestService {}
      class AdminService extends TestService {}

      app.use('api/v1/users/profile', new UserService());
      app.use('api/v1/posts/comments', new PostService());
      app.use('api/v2/users/settings', new UserService());
      app.use('admin/users', new AdminService());

      // Pattern that matches 'api/*/users/*' (API users endpoints across versions)
      app.hooks('api/*/users/*', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('api-users-before');
          }
        }
      });

      await (app.service('api/v1/users/profile') as any).find({ query: {} });

      await (app.service('api/v2/users/settings') as any).find({ query: {} });

      await (app.service('api/v1/posts/comments') as any).find({ query: {} });

      await (app.service('admin/users') as any).find({ query: {} });

      expect(executionOrder).to.deep.equal([
        'api-users-before',
        'service-UserService-find',
        'api-users-before',
        'service-UserService-find',
        'service-PostService-find', // No hook for posts
        'service-AdminService-find'  // No hook for admin
      ]);
    });

    it('should handle pattern-based hooks with interceptor hooks', async () => {
      const executionOrder: string[] = [];

      class SecureService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('secure-service-find');
          return { data: 'secure data' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      app.use('secure/admin/users', new SecureService());
      app.use('public/users', new SecureService());

      // Pattern-based regular hook for secure endpoints
      app.hooks('secure/*', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('secure-before');
          }
        }
      });

      // Pattern-based interceptor hook for admin endpoints
      app.interceptorHooks('*/admin/*', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp> | undefined>) => {
            executionOrder.push('admin-interceptor-before');
          }
        }
      });

      await (app.service('secure/admin/users') as any).find({ query: {} });

      await (app.service('public/users') as any).find({ query: {} });

      expect(executionOrder).to.deep.equal([
        'secure-before',           // Matches 'secure/*'
        'admin-interceptor-before', // Matches '*/admin/*'
        'secure-service-find',
        'secure-service-find'      // No hooks match 'public/users'
      ]);
    });

    it('should handle pattern matching edge cases', async () => {
      const executionOrder: string[] = [];

      class TestService implements Service<ScorpionApp> {
        app!: ScorpionApp;
        async find(params: Params) {
          executionOrder.push('service-find');
          return { data: 'test' };
        }
        async get(id: string | number, params: Params) { return { id }; }
        async create(data: any, params: Params) { return data; }
        async update(id: string | number | null, data: any, params: Params) { return data; }
        async patch(id: string | number | null, data: any, params: Params) { return data; }
        async remove(id: string | number | null, params: Params) { return { id }; }
      }

      app.use('test', new TestService());
      app.use('test.service', new TestService());
      app.use('test-service', new TestService());

      // Test exact match
      app.hooks('test', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('exact-match');
          }
        }
      });

      // Test pattern with special regex characters
      app.hooks('test.service', {
        before: {
          all: async (context: HookContext<ScorpionApp, Service<ScorpionApp>>) => {
            executionOrder.push('dot-match');
          }
        }
      });

      await (app.service('test') as any).find({ query: {} });

      await (app.service('test.service') as any).find({ query: {} });

      await (app.service('test-service') as any).find({ query: {} });

      expect(executionOrder).to.deep.equal([
        'exact-match',
        'service-find',
        'dot-match',
        'service-find',
        'service-find' // No hook matches 'test-service'
      ]);
    });
  });

  // More tests will go here to verify the detailed hook execution order
  // for global, service-specific, and interceptor hooks (before, around, after, error).
});
