import { expect } from 'chai';
import { createApp } from '../src/app.js';
import { Service, Params, HookContext, IScorpionApp } from '../src/types.js';

describe('app.unservice', () => {
  it('should remove a service from the app', () => {
    const app: IScorpionApp<any> = createApp();
    
    const testService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', testService);
    
    expect(app.services).to.have.property('test');
    
    const removedService = app.unuse('test');
    
    expect(app.services).to.not.have.property('test');
    
    expect(removedService).to.equal(testService);
  });
  
  it('should throw an error when trying to unregister a non-existent service', () => {
    const app: IScorpionApp<any> = createApp();
    
    expect(() => app.unuse('non-existent')).to.throw(Error, "Service on path 'non-existent' not found.");
  });
  
  it('should clean up service-specific hooks', () => {
    const app: IScorpionApp<any> = createApp();
    
    const testService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', testService);
    app.service('test').hooks({
        before: {
          all: [(context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => { 
            context.data = { modified: true };
            return context;
          }]
        }
      });
    
    app.executeServiceCall({
      path: 'test',
      method: 'get',
      params: {},
      id: '1'
    });
    
    app.unuse('test');
    
    const newService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', newService);
    
    app.executeServiceCall({
      path: 'test',
      method: 'get',
      params: {},
      id: '1'
    }).then(context => {
      expect(context.data).to.not.deep.equal({ modified: true });
    });
  });
  
  it('should clean up routes when unregistering a service', async () => {
    const app: IScorpionApp<any> = createApp();
    
    const testService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', testService);
    
    app.unuse('test');
    
    const newService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); },
      customMethod() { return 'custom result'; }
    };
    
    app.use('test', newService);
    
    const result = await app.executeServiceCall({
      path: 'test',
      method: 'find',
      params: {}
    });
    
    expect(result.result).to.deep.equal(['new data']);
    
    const customResult = await app.executeServiceCall({
      path: 'test',
      method: 'customMethod',
      params: {}
    });
    
    expect(customResult.result).to.equal('custom result');
    
    const getResult = await app.executeServiceCall({
      path: 'test',
      method: 'get',
      params: {},
      id: '1'
    });
    
    expect(getResult.result).to.deep.equal({ id: '1', text: 'new' });
  });
  
  it('should call teardown method on service if it exists', () => {
    const app: IScorpionApp<any> = createApp();
    
    let teardownCalled = false;
    
    const testService: Service<IScorpionApp<any>> = {
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
    
    app.use('test', testService);
    
    app.unuse('test');
    
    expect(teardownCalled).to.be.true;
  });
  
  it('should filter out service-specific global hooks', () => {
    const app: IScorpionApp<any> = createApp();
    
    app.hooks('test', {
      before: {
        all: [(context) => {
          context.data = { modified: true };
          return context;
        }]
      }
    });
    
    const testService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['test data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'test' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', testService);
    
    app.unuse('test');
    
    const newService: Service<IScorpionApp<any>> = {
      find(params?: Params) { return Promise.resolve(['new data']); },
      get(id: string | number, params?: Params) { return Promise.resolve({ id, text: 'new' }); },
      create(data: any, params?: Params) { return Promise.resolve({ ...data, id: '1' }); },
      update(id: string | number, data: any, params?: Params) { return Promise.resolve({ ...data, id }); },
      patch(id: string | number, data: any, params?: Params) { return Promise.resolve({ id, ...data }); },
      remove(id: string | number, params?: Params) { return Promise.resolve({ id }); }
    };
    
    app.use('test', newService);
    
    app.executeServiceCall({
      path: 'test',
      method: 'find',
      params: {}
    }).then(context => {
      expect(context.data).to.not.deep.equal({ modified: true });
    });
  });
});
