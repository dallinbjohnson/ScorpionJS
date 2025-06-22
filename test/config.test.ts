import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createApp } from '../src/app.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Configuration System', () => {
  const originalEnv = { ...process.env };
  const configFiles: string[] = [];
  const testDir = process.cwd();

  // Helper to create temporary config files
  const createConfigFile = (filename: string, content: object) => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    configFiles.push(filePath);
    return filePath;
  };

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Clean up any existing config files
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    configFiles.length = 0;
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Clean up any created config files
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    configFiles.length = 0;
    
    // Restore any stubs
    sinon.restore();
  });

  it('should use default configuration values', () => {
    const app = createApp();
    const currentEnv = process.env.NODE_ENV || 'development';

    expect(app.get('env')).to.equal(currentEnv);

    // REST config
    expect(app.get('rest.enabled')).to.be.true;
    expect(app.get('rest.port')).to.equal(3030);
    expect(app.get('rest.host')).to.equal('localhost');
    expect(app.get('rest.basePath')).to.equal('/');
    expect(app.get('rest.cors')).to.deep.equal({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
      optionsSuccessStatus: 204,
    });
    expect(app.get('rest.bodyParser')).to.deep.equal({
      json: { limit: "1mb" },
      urlencoded: { extended: true, limit: "1mb" },
    });
    expect(app.get('rest.compression')).to.deep.equal({
      threshold: "1kb",
    });

    // WebSocket config
    expect(app.get('websocket.enabled')).to.be.true;
    expect(app.get('websocket.port')).to.equal(3030);
    expect(app.get('websocket.host')).to.equal('localhost');
    expect(app.get('websocket.path')).to.equal('/scorpion');
    expect(app.get('websocket.cors')).to.deep.equal({ origin: "*" });
    expect(app.get('websocket.serverOptions')).to.deep.equal({});

    // Logging config
    expect(app.get('logging.level')).to.equal(currentEnv === 'production' ? 'info' : 'debug');
    expect(app.get('logging.prettyPrint')).to.equal(currentEnv !== 'production');
    expect(app.get('logging.transports')).to.deep.equal([]);

    // Validation config
    expect(app.get('validation.defaultProvider')).to.equal('zod');
    expect(app.get('validation.providerOptions')).to.deep.equal({});
    expect(app.get('validation.strict')).to.be.true;

    // Fault Tolerance config
    expect(app.get('faultTolerance.circuitBreaker')).to.deep.equal({
      enabled: false,
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });
    expect(app.get('faultTolerance.timeout')).to.deep.equal({
      enabled: false,
      default: 5000,
    });
    expect(app.get('faultTolerance.retries')).to.deep.equal({
      enabled: false,
      defaultAttempts: 3,
      backoffStrategy: 'fixed',
      defaultDelay: 1000,
    });
    expect(app.get('faultTolerance.bulkhead')).to.deep.equal({
      enabled: false,
      maxConcurrent: 10,
      maxQueue: 10,
    });

    // Service Discovery config
    expect(app.get('serviceDiscovery.enabled')).to.be.false;
    expect(app.get('serviceDiscovery.strategy')).to.equal('static');
    expect(app.get('serviceDiscovery.options')).to.deep.equal({});

    // i18n config
    expect(app.get('i18n.defaultLocale')).to.equal('en');
    expect(app.get('i18n.locales')).to.deep.equal(['en']);
    expect(app.get('i18n.directory')).to.equal('./locales');
    expect(app.get('i18n.parserOptions')).to.deep.equal({});
  });

  it('should load configuration from a file', () => {
    createConfigFile('scorpion.config.json', {
      rest: {
        port: 8080,
        host: '0.0.0.0'
      },
      logging: {
        level: 'warn'
      }
    });

    const app = createApp();
    
    expect(app.get('rest.port')).to.equal(8080);
    expect(app.get('rest.host')).to.equal('0.0.0.0');
    expect(app.get('logging.level')).to.equal('warn');
    // Check that a default value for a non-overridden nested property still applies
    expect(app.get('rest.cors.origin')).to.equal('*'); 
  });

  it('should load environment-specific configuration', () => {
    process.env.NODE_ENV = 'production';
    
    createConfigFile('scorpion.config.json', {
      rest: {
        port: 8080 // Base config
      },
      logging: {
        prettyPrint: true // Base config
      }
    });
    
    createConfigFile('scorpion.production.config.json', {
      rest: {
        port: 80, // Production override
        host: '0.0.0.0' // Production override
      },
      logging: {
        prettyPrint: false // Production override
      }
    });

    const app = createApp();
    
    expect(app.get('env')).to.equal('production');
    expect(app.get('rest.port')).to.equal(80); // From production config
    expect(app.get('rest.host')).to.equal('0.0.0.0'); // From production config
    expect(app.get('logging.prettyPrint')).to.be.false; // From production config
  });

  it('should load configuration from environment variables', function() {
    // Clear existing environment variables that might interfere
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SCORPION_')) {
        delete process.env[key];
      }
    });
    
    // Set test environment variables
    process.env.SCORPION_REST_PORT = '9000';
    process.env.SCORPION_REST_HOST = '127.0.0.1';
    process.env.SCORPION_WEBSOCKET_ENABLED = 'false';
    process.env.SCORPION_LOGGING_LEVEL = 'error';
    
    // Create app after setting environment variables
    const app = createApp({});
    
    // Debug logging (optional, can be removed or commented out)
    // console.log('Environment variables test:');
    // console.log('SCORPION_REST_PORT =', process.env.SCORPION_REST_PORT);
    // console.log('app.get("rest.port") =', app.get('rest.port'));
    // console.log('SCORPION_WEBSOCKET_ENABLED =', process.env.SCORPION_WEBSOCKET_ENABLED);
    // console.log('app.get("websocket.enabled") =', app.get('websocket.enabled'));
    // console.log('SCORPION_LOGGING_LEVEL =', process.env.SCORPION_LOGGING_LEVEL);
    // console.log('app.get("logging.level") =', app.get('logging.level'));
    // console.log('app._config =', JSON.stringify(app['_config'], null, 2));
    
    // Check that environment variables were properly loaded
    expect(app.get('rest.port')).to.equal(9000); // Number parsed from string
    expect(app.get('rest.host')).to.equal('127.0.0.1');
    expect(app.get('websocket.enabled')).to.equal(false); // Boolean parsed from string
    expect(app.get('logging.level')).to.equal('error');
  });

  it('should prioritize programmatic config over other sources', () => {
    // Set up all config sources
    process.env.SCORPION_REST_PORT = '9000'; // Environment variable
    
    createConfigFile('scorpion.config.json', { // Base config file
      rest: {
        port: 8080
      },
      logging: {
        level: 'info' // Base logging level
      }
    });
    
    process.env.NODE_ENV = 'production';
    createConfigFile('scorpion.production.config.json', { // Environment-specific config file
      rest: {
        port: 80
      },
      logging: {
        level: 'warn' // Production logging level
      }
    });

    // Programmatic config should win
    const app = createApp({
      rest: {
        port: 5000 // Programmatic override for rest.port
      },
      logging: {
        level: 'fatal' // Programmatic override for logging.level
      }
    });
    
    expect(app.get('rest.port')).to.equal(5000);
    expect(app.get('logging.level')).to.equal('fatal');
  });

  it('should correctly merge nested configuration objects', function() {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      this.skip();
    }
    
    // Create a config file with nested objects
    createConfigFile('scorpion.config.json', {
      nested: {
        level1: {
          level2: {
            value: 1
          }
        }
      }
    });

    // Create environment-specific config that overrides part of the nested structure
    const envName = process.env.NODE_ENV || 'development';
    createConfigFile(`scorpion.${envName}.config.json`, {
      nested: {
        level1: {
          level2: {
            value: 2
          }
        }
      }
    });

    // Force a clean reload of the configuration
    const app = createApp();

    // The environment-specific config should take precedence
    expect(app.get('nested.level1.level2.value')).to.equal(2);

    // Now override with programmatic config
    const appWithConfig = createApp({
      nested: {
        level1: {
          level2: {
            value: 3
          }
        }
      }
    });

    // Programmatic config should take highest precedence
    expect(appWithConfig.get('nested.level1.level2.value')).to.equal(3);
  });

  it('should handle get and set methods with dot notation', () => {
    const app = createApp();
    
    // Set values
    app.set('custom.value', 123);
    app.set('custom.nested.value', 'test');
    
    // Get values
    expect(app.get('custom.value')).to.equal(123);
    expect(app.get('custom.nested.value')).to.equal('test');
    
    // Get nested object
    expect(app.get('custom')).to.deep.equal({
      value: 123,
      nested: {
        value: 'test'
      }
    });
    
    // Override nested value
    app.set('custom.nested', { newValue: 'updated' });
    expect(app.get('custom.nested.value')).to.be.undefined;
    expect(app.get('custom.nested.newValue')).to.equal('updated');
  });

  it('should handle non-existent paths gracefully', () => {
    const app = createApp();
    
    expect(app.get('nonexistent.path')).to.be.undefined;
    expect(app.get('deeply.nested.nonexistent.path')).to.be.undefined;
  });

  it('should handle complex environment variable values for new config sections', function() {
    // Clear existing environment variables that might interfere
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SCORPION_')) {
        delete process.env[key];
      }
    });
    
    // Set complex environment variable for rest.cors
    // This will override 'origin' and 'credentials', but other cors properties should remain default.
    process.env.SCORPION_REST_CORS = '{"origin": "https://example.com", "credentials": false}';
    process.env.SCORPION_LOGGING_TRANSPORTS = '[{"type": "file", "options": {"path": "/tmp/app.log"}}]';

    // Create app after setting environment variables
    const app = createApp({});
        
    // Verify the rest.cors object was correctly merged
    const corsConfig = app.get('rest.cors');
    expect(corsConfig.origin).to.equal('https://example.com'); // Overridden
    expect(corsConfig.credentials).to.be.false; // Overridden
    expect(corsConfig.methods).to.deep.equal(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]); // Default
    expect(corsConfig.allowedHeaders).to.deep.equal(["Content-Type", "Authorization", "X-Requested-With"]); // Default
    expect(corsConfig.optionsSuccessStatus).to.equal(204); // Default

    // Verify the logging.transports array was set
    const loggingTransports = app.get('logging.transports');
    expect(loggingTransports).to.be.an('array').with.lengthOf(1);
    expect(loggingTransports[0]).to.deep.equal({
      type: "file", 
      options: { path: "/tmp/app.log" }
    });
  });
});
