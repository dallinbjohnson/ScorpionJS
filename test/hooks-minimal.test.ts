import { describe, it } from 'mocha';
import { expect } from 'chai';
import { ScorpionApp } from '../src/app.js';
import { HookContext, IScorpionApp, Service } from '../src/types.js';

describe('Minimal Hooks Test', () => {
  it('should correctly add hooks to a service', () => {
    const app = new ScorpionApp();
    
    // Create a simple test service
    const testService: Service<ScorpionApp> = {
      async find() { return []; },
      async get(id: string) { return { id }; }
    };
    
    // Register the service
    app.use('test', testService);
    
    // This should work without TypeScript errors
    const service = app.service('test');
    
    // Add hooks to the service
    service.hooks({
      before: {
        all: [(context: HookContext<IScorpionApp<any>, Service<IScorpionApp<any>>>) => {
          context.data = { modified: true };
          return context;
        }]
      }
    });
    
    // Verify the service has been registered correctly
    expect(service).to.exist;
    expect(typeof service.hooks).to.equal('function');
  });
});
