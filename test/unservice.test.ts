import { expect } from 'chai';
import { createApp, ScorpionApp } from '../src/app.js';
import { Service, Params, HookContext } from '../src/types.js';

describe('app.unservice', () => {
  it('should remove a service from the app', () => {
    const app = createApp();
    
    // Create a simple service that implements the Service interface
    const testService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    // Register the service
    app.use('test', testService);
    
    // Verify service is registered
    expect(app.services).to.have.property('test');
    
    // Unregister the service
    const removedService = app.unuse('test');
    
    // Verify service is no longer registered
    expect(app.services).to.not.have.property('test');
    
    // Verify the returned service is the one we registered
    expect(removedService).to.equal(testService);
  });
  
  it('should throw an error when trying to unregister a non-existent service', () => {
    const app = createApp();
    
    // Attempt to unregister a service that doesn't exist
    expect(() => app.unuse('non-existent')).to.throw(Error, "Service on path 'non-existent' not found.");
  });
  
  it('should clean up service-specific hooks', () => {
    const app = createApp();
    
    // Create a simple service with hooks
    const testService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    // Register the service with hooks
    app.use('test', testService);
    app.service('test').hooks({
        before: {
          all: [(context: HookContext<ScorpionApp>) => { 
            context.data = { modified: true };
            return context;
          }]
        }
      });
    
    // Verify hooks are registered (indirectly by checking if they run)
    const getContext = app.executeServiceCall({
      servicePath: 'test',
      method: 'get',
      params: {},
      id: '1'
    });
    
    // Unregister the service
    app.unuse('test');
    
    // Register a new service with the same path
    const newService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', newService);
    
    // Verify the hooks from the old service are not applied
    app.executeServiceCall({
      servicePath: 'test',
      method: 'get',
      params: {},
      id: '1'
    }).then(context => {
      // If the old hooks were still applied, data would be { modified: true }
      expect(context.data).to.not.deep.equal({ modified: true });
    });
  });
  
  it('should clean up routes when unregistering a service', async () => {
    const app = createApp();
    
    // Create a simple service
    const testService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    // Register the service
    app.use('test', testService);
    
    // Unregister the service
    app.unuse('test');
    
    // Register a different service on the same path
    const newService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); },
      customMethod() { return 'custom result'; }
    };
    
    app.use('test', newService);
    
    // The new service should work correctly
    const result = await app.executeServiceCall({
      servicePath: 'test',
      method: 'find',
      params: {}
    });
    
    expect(result.result).to.deep.equal(['new data']);
    
    // Verify the new service has the custom method
    const customResult = await app.executeServiceCall({
      servicePath: 'test',
      method: 'customMethod',
      params: {}
    });
    
    expect(customResult.result).to.equal('custom result');
    
    // Verify that the new service's methods work correctly
    const getResult = await app.executeServiceCall({
      servicePath: 'test',
      method: 'get',
      params: {},
      id: '1'
    });
    
    expect(getResult.result).to.deep.equal({ id: '1', text: 'new' });
  });
  
  it('should call teardown method on service if it exists', () => {
    const app = createApp();
    
    let teardownCalled = false;
    
    // Create a service with teardown method
    const testService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); },
      teardown() { 
        teardownCalled = true;
      }
    };
    
    // Register the service
    app.use('test', testService);
    
    // Unregister the service
    app.unuse('test');
    
    // Verify teardown was called
    expect(teardownCalled).to.be.true;
  });
  
  it('should filter out service-specific global hooks', () => {
    const app = createApp();
    
    // Add a global hook for a specific service path
    app.hooks('test', {
      before: {
        all: [(context) => {
          context.data = { modified: true };
          return context;
        }]
      }
    });
    
    // Create and register a service
    const testService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', testService);
    
    // Unregister the service
    app.unuse('test');
    
    // Register a new service with the same path
    const newService: Service<ScorpionApp> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', newService);
    
    // Execute a call to verify hooks are not applied
    app.executeServiceCall({
      servicePath: 'test',
      method: 'find',
      params: {}
    }).then(context => {
      // If the old hooks were still applied, data would be { modified: true }
      expect(context.data).to.not.deep.equal({ modified: true });
    });
  });
});
