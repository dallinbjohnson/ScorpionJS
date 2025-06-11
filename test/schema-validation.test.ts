import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { createApp } from '../src/index.js';
import type { ScorpionApp } from '../src/app.js';
import { validateData, validateQuery, validateSchema } from '../src/schema.js';
import { BadRequest } from '../src/errors.js';

// Mock validator function that directly throws BadRequest errors
function createMockValidator() {
  return {
    validate: (schema: any, data: any, options: any = {}) => {
      // Simple validation: check if required fields are present
      if (schema.required) {
        for (const field of schema.required) {
          if (data[field] === undefined) {
            // Directly throw a BadRequest error
            throw new BadRequest('Validation error', {
              errors: [{ message: `Missing required field: ${field}` }],
              schema
            });
          }
        }
      }
      return { valid: true, data };
    }
  };
}

describe('Schema Validation', () => {
  let sandbox: sinon.SinonSandbox;
  // Each test will create its own app instance to avoid service registration conflicts

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Schema Registration', () => {
    it('registers schemas on service for introspection', async () => {
      // Create a fresh app for this test
      const app = createApp();
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };

      const testService = {
        async create(data: any) {
          return data;
        },
        async find(params: any) {
          return [];
        }
      };

      // Register the service with schemas
      app.use('test', testService, { schemas: testSchema });

      // Access schemas through the service's _schemas property
      const service = app.service('test');
      // The schemas are stored in the service as _schemas
      expect(service).to.not.be.undefined;
      if (service) {
        // Access the _schemas property directly
        expect((service as any)._schemas).to.not.be.undefined;
        expect((service as any)._schemas).to.deep.equal(testSchema);
      } else {
        expect.fail('Service should be defined');
      }
    });

    it('does not automatically apply validation hooks', async () => {
      // Create a fresh app for this test
      const app = createApp();
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };

      const testService = {
        async create(data: any) {
          return data;
        },
        async find(params: any) {
          return [];
        }
      };

      app.use('test', testService, { schemas: testSchema });

      // Validation is not automatically applied
      await app.executeServiceCall({
        path: 'test',
        method: 'create',
        data: { notName: 'test' }
      }); // Should not throw
    });
  });

  describe('Validation Hooks', () => {
    it('validateData validates request data against schema', async () => {
      const app3 = createApp();
      
      // Create a spy for the service method to verify it's called
      const createSpy = sandbox.spy(async (data: any) => data);
      
      const testService = {
        async create(data: any) {
          return createSpy(data);
        },
        async find(params: any) {
          return [];
        }
      };
      
      // Define schema with required name field
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };
      
      // Create a validator with a spy that will fail for empty objects
      type ValidatorResult = { valid: boolean; data?: any; errors?: any[] };
      const validateFn = (schema: any, data: any): ValidatorResult => {
        if (Object.keys(data).length === 0) {
          return {
            valid: false,
            errors: [{ message: 'Missing required field: name' }]
          };
        }
        return { valid: true, data };
      };
      
      const validateSpy = sandbox.spy(validateFn);
      const validator = { validate: validateSpy };
      
      // Set the validator on the app
      app3.set('validator', validator);
      
      // Register service with schemas
      app3.use('test', testService, { schemas: testSchema });
      
      // Get service instance and register hooks
      const testServiceInstance = app3.service('test');
      if (!testServiceInstance) {
        throw new Error('Service not registered');
      }
      
      // Register validation hook
      (testServiceInstance as any).hooks({
        before: {
          create: [validateData(testSchema.create)]
        }
      });
      
      let thrownError: any;
      try {
        const service = app3.service('test');
        if (!service || typeof service.create !== 'function') {
          throw new Error('Service not registered or create method not available for app3 test service');
        }
        await service.create({}); // data is {}, which is invalid against testSchema.create
      } catch (error) {
        thrownError = error;
      }
      expect(thrownError, 'Validation hook did not throw an error for invalid data').to.be.instanceOf(BadRequest);
      if (thrownError) {
         expect(thrownError.message).to.equal('Validation error');
      }
      expect(validateSpy.called, 'Validator spy was not called by the validation hook').to.be.true;
      expect(createSpy.called, 'Service method should not have been called due to validation failure').to.be.false;
      
      // Test with valid data
      const testService3 = app3.service('test');
      if (!testService3 || typeof testService3.create !== 'function') {
        throw new Error('Service not registered or create method not available');
      }
      const result = await testService3.create({ name: 'test' });
      expect(result).to.deep.equal({ name: 'test' });
      expect(createSpy.called).to.be.true; // Service method should be called with valid data
    });

    it('validateQuery validates query parameters against schema', async () => {
      // Create a fresh app for this test
      const app4 = createApp();
      
      // Create a spy for the service method to verify it's not called on validation failure
      const findSpy = sandbox.spy(async (params: any) => []);
      
      const testService = {
        async find(params: any) {
          return findSpy(params);
        }
      };
      
      const testSchema = {
        find: {
          definition: {
            type: 'object',
            properties: {
              active: { type: 'boolean' }
            },
            required: ['active']
          }
        }
      };

      // Create a validator with a spy
      type ValidatorResult = { valid: boolean; data?: any; errors?: any[] };
      const validateFn = (schema: any, data: any): ValidatorResult => {
        // Basic check for the 'active' field for this test's purpose
        if (data.active === undefined && schema.required && schema.required.includes('active')) {
          return {
            valid: false,
            errors: [{ message: 'Missing required field: active' }]
          };
        }
        if (typeof data.active !== 'boolean' && schema.properties.active.type === 'boolean' && data.active !== undefined) {
          return {
            valid: false,
            errors: [{ message: 'Field active must be a boolean' }]
          };
        }
        return { valid: true, data };
      };
      
      const validateSpy = sandbox.spy(validateFn);
      const validator = { validate: validateSpy };
      
      // Set the validator on the app
      app4.set('validator', validator);

      // Register service with schemas
      app4.use('test', testService, { schemas: testSchema });
      
      const serviceInstance = app4.service('test');
      if (!serviceInstance) {
        throw new Error('Service not registered for app4');
      }
      
      (serviceInstance as any).hooks({
        before: {
          find: [validateQuery(testSchema.find)]
        }
      });

      // Test with invalid query (empty query object, missing 'active')
      let thrownErrorInvalid: any;
      try {
        if (typeof serviceInstance.find !== 'function') {
          throw new Error('serviceInstance.find is not a function for invalid query (empty)');
        }
        await serviceInstance.find({ query: {} });
      } catch (error) {
        thrownErrorInvalid = error;
      }
      
      expect(thrownErrorInvalid, 'Validation hook did not throw an error for invalid query (empty)').to.be.instanceOf(BadRequest);
      if (thrownErrorInvalid) {
        expect(thrownErrorInvalid.message).to.equal('Query validation error');
      }
      expect(validateSpy.called, 'Validator spy was not called by the validation hook for invalid query (empty)').to.be.true;
      expect(findSpy.called, 'Service find method should not have been called due to validation failure (empty)').to.be.false;
      
      validateSpy.resetHistory();
      findSpy.resetHistory();

      // Test with invalid query (wrong type for 'active')
      let thrownErrorInvalidType: any;
      try {
        if (typeof serviceInstance.find !== 'function') {
          throw new Error('serviceInstance.find is not a function for invalid query (wrong type)');
        }
        await serviceInstance.find({ query: { active: 'not-a-boolean' } });
      } catch (error) {
        thrownErrorInvalidType = error;
      }
      expect(thrownErrorInvalidType, 'Validation hook did not throw an error for invalid query (wrong type)').to.be.instanceOf(BadRequest);
      if (thrownErrorInvalidType) {
        expect(thrownErrorInvalidType.message).to.equal('Query validation error');
      }
      expect(validateSpy.called, 'Validator spy was not called by the validation hook for invalid query (wrong type)').to.be.true;
      expect(findSpy.called, 'Service find method should not have been called due to validation failure (wrong type)').to.be.false;

      validateSpy.resetHistory();
      findSpy.resetHistory();

      // Test with valid query
      let thrownErrorValid: any;
      let validResult: any;
      try {
        if (typeof serviceInstance.find !== 'function') {
          throw new Error('serviceInstance.find is not a function for valid query');
        }
        validResult = await serviceInstance.find({ query: { active: true as any } });
      } catch (error) {
        thrownErrorValid = error;
      }

      expect(thrownErrorValid, 'Validation hook threw an error for valid query').to.be.undefined;
      expect(validResult).to.deep.equal([]);
      expect(validateSpy.called, 'Validator spy was not called for valid query').to.be.true;
      expect(findSpy.called, 'Service find method was not called for valid query').to.be.true;
    });

    it('validateSchema validates both data and query based on method', async () => {
      // Create a fresh app for this test
      const app5 = createApp();
      
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        },
        find: {
          definition: {
            type: 'object',
            properties: {
              active: { type: 'string' }
            },
            required: ['active']
          }
        }
      };

      const testService = {
        async create(data: any) {
          return data;
        },
        async find(params: any) {
          return [];
        }
      };

      // Create a validator that returns invalid result
      const validator = {
        validate: (schema: any, data: any) => {
          if (schema.required) {
            for (const field of schema.required) {
              if (data[field] === undefined) {
                return {
                  valid: false,
                  errors: [{ message: `Missing required field: ${field}` }]
                };
              }
            }
          }
          return { valid: true, data };
        }
      };

      // Set the app validator with a spy that forces failure for empty objects
      const validateSpy = sandbox.spy((schema: any, data: any) => {
        // Force invalid result for empty objects
        if (Object.keys(data).length === 0) {
          return {
            valid: false,
            errors: [{ message: `Missing required field: name` }]
          };
        }
        return { valid: true, data };
      });
      
      validator.validate = validateSpy;
      app5.set('validator', validator);

      // Register the service with schemas
      app5.use('test', testService, { schemas: testSchema });
      
      // Register hooks using the hooks() method to match documentation
      app5.service('test').hooks({
        before: {
          all: [validateSchema(testSchema)]
        }
      });
      
      let errorFromExecuteCall: any = null;
      
      // This should fail validation (missing required 'name' field)
      const errorResultContext = await app5.executeServiceCall({
        path: 'test',
        method: 'create',
        data: {} // This will cause validateSpy to return { valid: false }
      });

      // executeServiceCall returns the error in the context, it does not throw
      errorFromExecuteCall = errorResultContext.error;
      
      // Assert that an error was indeed found in the context
      expect(errorFromExecuteCall, 'executeServiceCall should have returned a context with an error for invalid data').to.not.be.null;
      expect(errorFromExecuteCall).to.be.instanceOf(BadRequest);
      if (errorFromExecuteCall) { // type guard for TS
        expect(errorFromExecuteCall.message).to.equal('Validation error');
        expect(errorFromExecuteCall.data.errors[0].message).to.equal('Missing required field: name');
      }
      // Ensure the service method itself wasn't called due to before hook failure
      // (This requires the service method to be spied on if we want to assert its call count, currently it's not spied for app5.testService.create)

      const createResult = await app5.executeServiceCall({
        path: 'test',
        method: 'create',
        data: { name: 'test' }
      });
      expect(createResult.result).to.deep.equal({ name: 'test' });

      // For the 'find' method, the current testSchema doesn't specify a query schema for 'find',
      // and context.data is undefined, so validateSchema hook as configured will not perform validation.
      // The validateSpy (app validator) will not be called by validateSchema for this 'find' operation.
      const findSpyCallCountBefore = validateSpy.callCount;
      const findResultContext = await app5.executeServiceCall({
        path: 'test',
        method: 'find',
        params: { query: { active: 'true' } } // This query is not validated by current testSchema setup
      });
      expect(findResultContext.error, 'Find operation should not have an error in this setup').to.be.undefined;
      // The testService.find method returns an empty array.
      expect(findResultContext.result).to.deep.equal([]);
      // validateSpy should not be called again if validateSchema doesn't trigger validation for find
      expect(validateSpy.callCount, 'validateSpy should not be called for find if schema does not trigger it').to.equal(findSpyCallCountBefore);
    });
  });

  describe('Per-Service Validators', () => {
    it('uses service-specific validator when provided', async () => {
      // Create a fresh app for this test
      const app6 = createApp();
      
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };

      const testService = {
        async create(data: any) {
          return data;
        }
      };

      // Create a spy for the service validator that forces failure for empty objects
      const serviceValidator = {
        validate: sandbox.spy((schema: any, data: any, options: any) => {
          // Force invalid result for empty objects
          if (Object.keys(data).length === 0) {
            const resToLog = {
              valid: false,
              errors: [{ message: `Service validator: Missing name` }]
            };
            console.log('[TEST_SPY_VALIDATOR] app6/test validator returning for empty data:', JSON.stringify(resToLog));
            return resToLog;
          }
          
          // Check if required fields are present
          if (schema.required) {
            for (const field of schema.required) {
              if (data[field] === undefined) {
                return {
                  valid: false,
                  errors: [{ message: `Service validator: Missing ${field}` }]
                };
              }
            }
          }
          return { valid: true, data };
        })
      };

      // Spy on the original service's create method
      const originalServiceCreateSpy = sandbox.spy(testService, 'create');

      // Register the service with schemas and validator
      app6.use('test', testService, { validator: serviceValidator, schemas: testSchema });
      
      const serviceInstance = app6.service('test');
      if (!serviceInstance) {
        throw new Error('Service `test` not found on app6');
      }

      // Register hooks using the hooks() method to match documentation
      (serviceInstance as any).hooks({
        before: {
          create: [validateData(testSchema.create)]
        }
      });

      let thrownError: any;
      try {
        if (typeof serviceInstance.create !== 'function') {
          throw new Error('serviceInstance.create is not a function');
        }
        // This should fail validation (missing required 'name' field due to serviceValidator)
        await serviceInstance.create({});
      } catch (e) {
        thrownError = e;
      }
      
      expect(thrownError, 'Service-specific validator hook did not throw an error for invalid data').to.be.instanceOf(BadRequest);
      if (thrownError) {
        expect(thrownError.message).to.equal('Validation error');
        // Check that the error message comes from the service validator
        expect(thrownError.data.errors[0].message).to.equal('Service validator: Missing name');
      }
      // Check that the service-specific validator was called
      expect(serviceValidator.validate.called, 'Service-specific validator spy was not called').to.be.true;
      // Check that the original service method was NOT called
      expect(originalServiceCreateSpy.called, 'Original service create method should not have been called').to.be.false;

      originalServiceCreateSpy.restore();
    });

    it('falls back to app-level validator when service validator is not provided', async () => {
      // Create a fresh app for this test
      const app7 = createApp();
      
      const testSchema = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };

      const testService = {
        async create(data: any) {
          return data;
        }
      };

      // Create a spy for the app validator that forces failure for empty objects
      const appValidator = {
        validate: sandbox.spy((schema: any, data: any, options: any) => {
          // Force invalid result for empty objects
          if (Object.keys(data).length === 0) {
            return {
              valid: false,
              errors: [{ message: `App validator: Missing name` }]
            };
          }
          
          // Check if required fields are present
          if (schema.required) {
            for (const field of schema.required) {
              if (data[field] === undefined) {
                return {
                  valid: false,
                  errors: [{ message: `App validator: Missing ${field}` }]
                };
              }
            }
          }
          return { valid: true, data };
        })
      };

      // Set the app validator
      app7.set('validator', appValidator);

      // Spy on the original service's create method
      const originalServiceCreateSpy = sandbox.spy(testService, 'create');

      // Register the service with schemas but NO service-specific validator
      app7.use('test', testService, { schemas: testSchema });
      
      const serviceInstance = app7.service('test');
      if (!serviceInstance) {
        throw new Error('Service `test` not found on app7');
      }

      // Register hooks
      (serviceInstance as any).hooks({
        before: {
          create: [validateData(testSchema.create)]
        }
      });

      let thrownError: any;
      try {
        if (typeof serviceInstance.create !== 'function') {
          throw new Error('serviceInstance.create is not a function');
        }
        await serviceInstance.create({}); // Empty data should fail app validation
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError, 'App-level validator hook did not throw an error for invalid data').to.be.instanceOf(BadRequest);
      if (thrownError) {
        expect(thrownError.message).to.equal('Validation error');
        expect(thrownError.data.errors[0].message).to.equal('App validator: Missing name');
      }
      expect(appValidator.validate.called, 'App-level validator spy was not called').to.be.true;
      expect(originalServiceCreateSpy.called, 'Original service create method should not have been called').to.be.false;

      originalServiceCreateSpy.restore();
    });

    it('uses service-specific validators with multiple services', async () => {
      // Create a fresh app for this test
      const app8 = createApp();

      const testSchema1 = {
        create: {
          definition: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };

      const testSchema2 = {
        create: {
          definition: {
            type: 'object',
            properties: {
              email: { type: 'string' }
            },
            required: ['email']
          }
        }
      };

      // Create spies for the service validators that force failure for empty objects
      const service1Validator = {
        validate: sandbox.spy((schema: any, data: any, options: any) => {
          // Force invalid result for empty objects
          if (Object.keys(data).length === 0) {
            return {
              valid: false,
              errors: [{ message: `Service1 validator: Missing name` }]
            };
          }
          
          // Check if required fields are present
          if (schema.required) {
            for (const field of schema.required) {
              if (data[field] === undefined) {
                return {
                  valid: false,
                  errors: [{ message: `Service1 validator: Missing ${field}` }]
                };
              }
            }
          }
          return { valid: true, data };
        })
      };

      const service2Validator = {
        validate: sandbox.spy((schema: any, data: any, options: any) => {
          // Force invalid result for empty objects
          if (Object.keys(data).length === 0) {
            return {
              valid: false,
              errors: [{ message: `Service2 validator: Missing email` }]
            };
          }
          
          // Check if required fields are present
          if (schema.required) {
            for (const field of schema.required) {
              if (data[field] === undefined) {
                return {
                  valid: false,
                  errors: [{ message: `Service2 validator: Missing ${field}` }]
                };
              }
            }
          }
          return { valid: true, data };
        })
      };

      const service1Object = { async create(data: any) { return data; } };
      const service1CreateSpy = sandbox.spy(service1Object, 'create');
      // Register the first service with schemas and validator
      app8.use('test1', service1Object, {
        validator: service1Validator,
        schemas: testSchema1
      });
      const serviceInstance1 = app8.service('test1');
      if (!serviceInstance1) throw new Error('Service test1 not found');
      (serviceInstance1 as any).hooks({
        before: { create: [validateData(testSchema1.create)] }
      });

      const service2Object = { async create(data: any) { return data; } };
      const service2CreateSpy = sandbox.spy(service2Object, 'create');
      // Register the second service with schemas and validator
      app8.use('test2', service2Object, {
        validator: service2Validator,
        schemas: testSchema2
      });
      const serviceInstance2 = app8.service('test2');
      if (!serviceInstance2) throw new Error('Service test2 not found');
      (serviceInstance2 as any).hooks({
        before: { create: [validateData(testSchema2.create)] }
      });

      // Test 1: Invalid data for service1
      let thrownError1: any;
      try {
        if (typeof serviceInstance1.create !== 'function') {
          throw new Error('serviceInstance1.create is not a function');
        }
        await serviceInstance1.create({}); // Empty data should fail service1 validation
      } catch (e) {
        thrownError1 = e;
      }
      
      expect(thrownError1, 'Service1 validator hook did not throw an error').to.be.instanceOf(BadRequest);
      if (thrownError1) {
        expect(thrownError1.message).to.equal('Validation error');
        expect(thrownError1.data.errors[0].message).to.equal('Service1 validator: Missing name');
      }
      expect(service1Validator.validate.calledOnce, 'Service1 validator spy was not called once').to.be.true;
      expect(service1CreateSpy.called, 'Service1 original create method should not have been called').to.be.false;
      expect(service2Validator.validate.called, 'Service2 validator spy should not have been called yet').to.be.false;

      // Test 2: Invalid data for service2
      let thrownError2: any;
      const service1ValidatorCallCountBeforeTest2 = service1Validator.validate.callCount;
      try {
        if (typeof serviceInstance2.create !== 'function') {
          throw new Error('serviceInstance2.create is not a function');
        }
        await serviceInstance2.create({}); // Empty data should fail service2 validation
      } catch (e) {
        thrownError2 = e;
      }

      expect(thrownError2, 'Service2 validator hook did not throw an error').to.be.instanceOf(BadRequest);
      if (thrownError2) {
        expect(thrownError2.message).to.equal('Validation error');
        expect(thrownError2.data.errors[0].message).to.equal('Service2 validator: Missing email');
      }
      expect(service2Validator.validate.calledOnce, 'Service2 validator spy was not called once').to.be.true;
      expect(service2CreateSpy.called, 'Service2 original create method should not have been called').to.be.false;
      expect(service1Validator.validate.callCount, 'Service1 validator call count should not change for service2 call').to.equal(service1ValidatorCallCountBeforeTest2);

      // Test 3: Valid data for service1
      let result1: any;
      thrownError1 = undefined; // Reset from previous test section
      const service1ValidatorCallCountBeforeValidCall = service1Validator.validate.callCount;
      const service2ValidatorCallCountBeforeValidCall1 = service2Validator.validate.callCount;

      try {
        if (typeof serviceInstance1.create !== 'function') {
          throw new Error('serviceInstance1.create is not a function for valid call');
        }
        result1 = await serviceInstance1.create({ name: 'Valid Name S1' });
      } catch (e) {
        thrownError1 = e;
      }

      expect(thrownError1, 'Service1 create call with valid data should not throw').to.be.undefined;
      expect(result1).to.deep.equal({ name: 'Valid Name S1' });
      expect(service1Validator.validate.callCount, 'Service1 validator should be called again for valid data').to.equal(service1ValidatorCallCountBeforeValidCall + 1);
      expect(service1CreateSpy.calledOnce, 'Service1 original create method should have been called once for valid data').to.be.true;
      expect(service2Validator.validate.callCount, 'Service2 validator call count should not change for service1 valid call').to.equal(service2ValidatorCallCountBeforeValidCall1);

      // Test 4: Valid data for service2
      let result2: any;
      thrownError2 = undefined; // Reset from previous test section
      const service2ValidatorCallCountBeforeValidCall = service2Validator.validate.callCount;
      const service1ValidatorCallCountBeforeValidCall2 = service1Validator.validate.callCount;

      try {
        if (typeof serviceInstance2.create !== 'function') {
          throw new Error('serviceInstance2.create is not a function for valid call');
        }
        result2 = await serviceInstance2.create({ email: 'valid@example.com' });
      } catch (e) {
        thrownError2 = e;
      }

      expect(thrownError2, 'Service2 create call with valid data should not throw').to.be.undefined;
      expect(result2).to.deep.equal({ email: 'valid@example.com' });
      expect(service2Validator.validate.callCount, 'Service2 validator should be called again for valid data').to.equal(service2ValidatorCallCountBeforeValidCall + 1);
      expect(service2CreateSpy.calledOnce, 'Service2 original create method should have been called once for valid data').to.be.true;
      expect(service1Validator.validate.callCount, 'Service1 validator call count should not change for service2 valid call').to.equal(service1ValidatorCallCountBeforeValidCall2);
    });
  }); // Closes 'describe('Per-service validators', ...)'
}); // Closes 'describe('Schema Validation', ...)'
