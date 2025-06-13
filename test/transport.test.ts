// test/transport.test.ts

import { describe, it, beforeEach, afterEach } from 'mocha';
import { createRouter, addRoute, findRoute, removeRoute } from "rou3"; 

describe('rou3 sanity check', () => {
  it('should add, find, and remove a route', () => {
    const router = createRouter();
    addRoute(router, 'GET', '/sanity', { test: 'data' });
    let route = findRoute(router, 'GET', '/sanity');
    expect(route).to.not.be.null;
    expect((route?.data as { test: string }).test).to.equal('data');

    removeRoute(router, 'GET', '/sanity');
    route = findRoute(router, 'GET', '/sanity');
    expect(route).to.be.undefined;
  });

  it('should allow re-adding a route after removal', () => {
    const router = createRouter();
    addRoute(router, 'GET', '/sanity-readd', { test: 'data1' });
    removeRoute(router, 'GET', '/sanity-readd');
    addRoute(router, 'GET', '/sanity-readd', { test: 'data2' });
    const route = findRoute(router, 'GET', '/sanity-readd');
    expect(route).to.not.be.null;
    expect((route?.data as { test: string }).test).to.equal('data2');
  });

  it('should handle multiple routers independently', () => {
    const router1 = createRouter();
    const router2 = createRouter();
    addRoute(router1, 'GET', '/r1', { r: 1 });
    addRoute(router2, 'GET', '/r2', { r: 2 });

    const route1 = findRoute(router1, 'GET', '/r1');
    const route2From1 = findRoute(router1, 'GET', '/r2');
    const route2 = findRoute(router2, 'GET', '/r2');
    const route1From2 = findRoute(router2, 'GET', '/r1');

    expect((route1?.data as { r: number }).r).to.equal(1);
    expect(route2From1).to.be.undefined;
    expect((route2?.data as { r: number }).r).to.equal(2);
    expect(route1From2).to.be.undefined;
  });
});

import { Socket } from 'net';
import { expect } from 'chai';
import * as http from 'http';
import * as zlib from 'zlib';
import { createApp, ScorpionApp } from '../src/app.js';
import { Service } from '../src/types.js';

// A simple service for testing


// Helper to make HTTP requests
const request = (options: http.RequestOptions, body?: any): Promise<{ res: http.IncomingMessage; body: string }> => {
  // Disable agent to prevent connection pooling, which can cause test hangs
  const reqOptions = { ...options, agent: false };

  return new Promise((resolve, reject) => {
    const req = http.request(reqOptions, res => {
      // Handle errors on the response stream itself (e.g., parsing errors)
      res.on('error', reject);

      let responseBody = '';
      let stream: NodeJS.ReadableStream = res;

      const contentEncoding = res.headers['content-encoding'];
      if (contentEncoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (contentEncoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      // Handle errors on the decompression stream, if one exists
      if (stream !== res) {
        stream.on('error', reject);
      }

      stream.on('data', chunk => (responseBody += chunk.toString()));
      stream.on('end', () => resolve({ res, body: responseBody }));
    });

    // Handle errors on the request stream itself (e.g., network errors)
    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

describe('REST Transport Layer', () => {
  let app: ScorpionApp;
  let server: http.Server | undefined;
  let port: number;
  let sockets: Set<Socket>;

  beforeEach(() => {
    app = createApp();
    server = undefined;
    port = -1; // Initialize port to an invalid value
    sockets = new Set();
  });

  afterEach(async () => {
    const currentServer = server;
    if (currentServer) {
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();

      await new Promise<void>((resolve, reject) => {
        currentServer.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  });

  const listen = async () => {
    const s = await app.listen(0, 'localhost'); // Use port 0 for a random available port
    if (s) {
      server = s;
      const address = server.address();
      if (typeof address === 'string' || !address) {
        throw new Error('Invalid server address');
      }
      port = address.port;
      server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
      });
    }
  };

  describe('CORS Handling', () => {
    // A simple service for testing
    class TestService implements Service {
      async find() {
        return { message: 'find successful' };
      }
      async get(id: string) {
        return { message: `get successful for id ${id}` };
      }
      async create(data: any) {
        return { message: 'create successful', data };
      }
      async update(id: string, data: any) {
        return { message: `update successful for id ${id}`, data };
      }
      async patch(id: string, data: any) {
        return { message: `patch successful for id ${id}`, data };
      }
      async remove(id: string) {
        return { message: `remove successful for id ${id}` };
      }
    }

    it('should set Access-Control-Allow-Origin for a string origin', async () => {
      app.set('server.cors', { origin: 'http://example.com' });
      app.use('test', new TestService());
      await listen();

      const { res } = await request({
        port,
        path: '/test',
        method: 'GET',
        headers: { Origin: 'http://example.com' },
      });
      expect(res.headers['access-control-allow-origin']).to.equal('http://example.com');
    });

    it('should handle preflight OPTIONS request', async () => {
      app.set('server.cors', {
        origin: 'http://example.com',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 200,
      });
      app.use('test', new TestService());
      await listen();

      const { res } = await request({
        port,
        path: '/test',
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.headers['access-control-allow-origin']).to.equal('http://example.com');
      expect(res.headers['access-control-allow-methods']).to.equal('GET,POST,OPTIONS');
      expect(res.headers['access-control-allow-headers']).to.equal('Content-Type,Authorization');
    });

    it('should not set CORS headers if origin does not match', async () => {
      app.set('server.cors', { origin: 'http://example.com' });
      app.use('test', new TestService());
      await listen();

      const { res } = await request({
        port,
        path: '/test',
        method: 'GET',
        headers: { Origin: 'http://another.com' },
      });
      expect(res.headers['access-control-allow-origin']).to.be.undefined;
    });
  });

  describe('Body Parsing', () => {
    // A simple service for testing
    class BodyParsingTestService implements Service {
      async find() {
        return { message: 'find successful' };
      }
      async get(id: string) {
        return { message: `get successful for id ${id}` };
      }
      async create(data: any) {
        return { message: 'create successful', data };
      }
      async update(id: string, data: any) {
        return { message: `update successful for id ${id}`, data };
      }
      async patch(id: string, data: any) {
        return { message: `patch successful for id ${id}`, data };
      }
      async remove(id: string) {
        return { message: `remove successful for id ${id}` };
      }
    }

    it('should find a resource', async () => {
      app.use('body-parsing-test', new BodyParsingTestService());
      try {
        await listen();
      } catch (error) {
        console.error('[TEST.BodyParsing.find] ERROR during listen():', error);
        throw error; // Re-throw to ensure test still fails if listen() is the issue
      }

      const { res, body } = await request({
        port,
        path: '/body-parsing-test',
        method: 'GET',
      });
      expect(res.statusCode).to.equal(200);
      const responseData = JSON.parse(body);
      expect(responseData.message).to.equal('find successful');
    });

    it('should parse a valid JSON body', async () => {
      app.set('server.bodyParser', { json: { limit: '1mb' } });
      app.use('body-parsing-test', new BodyParsingTestService());
      await listen();

      const testData = { key: 'value', nested: { num: 1 } };
      const { res, body } = await request(
        { port, path: '/body-parsing-test', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        JSON.stringify(testData)
      );

      expect(res.statusCode).to.equal(200); // POST to create currently returns 200
      const responseData = JSON.parse(body);
      expect(responseData.message).to.equal('create successful');
      expect(responseData.data).to.deep.equal(testData);
    });

    it('should reject a request with a body larger than the limit', async () => {
      app.set('server.bodyParser', { json: { limit: '1kb' } });
      app.use('body-parsing-test', new BodyParsingTestService());
      await listen();

      const largeData = { data: 'a'.repeat(1025) };
      const { res, body } = await request(
        { port, path: '/body-parsing-test', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        JSON.stringify(largeData)
      );

      expect(res.statusCode).to.equal(413);
      const responseData = JSON.parse(body);
      expect(responseData.name).to.equal('PayloadTooLarge');
    });

    it('should parse a valid urlencoded body', async () => {
      app.set('server.bodyParser', { urlencoded: { extended: true } });
      app.use('body-parsing-test', new BodyParsingTestService());
      await listen();

      const testData = 'key=value&nested[num]=1';
      const { res, body } = await request(
        { port, path: '/body-parsing-test', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        testData
      );

      expect(res.statusCode).to.equal(200); // POST to create currently returns 200
      const responseData = JSON.parse(body);
      expect(responseData.message).to.equal('create successful');
      expect(responseData.data).to.deep.equal({ key: 'value', nested: { num: '1' } });
    });

    it('should reject a request with an unsupported media type', async () => {
      app.set('server.bodyParser', { json: true, urlencoded: false, text: false, raw: false });
      app.use('body-parsing-test', new BodyParsingTestService());
      await listen();

      const { res, body } = await request(
        { port, path: '/body-parsing-test', method: 'POST', headers: { 'Content-Type': 'application/xml' } },
        '<xml></xml>'
      );

      expect(res.statusCode).to.equal(415);
      const responseData = JSON.parse(body);
      expect(responseData.name).to.equal('UnsupportedMediaType');
    });
  });

  describe('Compression', () => {
    // A simple service for testing
    class CompressionTestService implements Service {
      async find() {
        return { message: 'find successful' };
      }
      async get(id: string) {
        return { message: `get successful for id ${id}` };
      }
      async create(data: any) {
        return { message: 'create successful', data };
      }
      async update(id: string, data: any) {
        return { message: `update successful for id ${id}`, data };
      }
      async patch(id: string, data: any) {
        return { message: `patch successful for id ${id}`, data };
      }
      async remove(id: string) {
        return { message: `remove successful for id ${id}` };
      }
    }

    it('should compress a response body with gzip if requested and above threshold', async () => {
      const responseData = { message: 'find successful', data: 'a'.repeat(2048) };
      class LargeDataService implements Service {
        async find() { return responseData; }
      }
      app.set('server.compression', { threshold: '1kb' });
      app.use('compression-test-large', new LargeDataService());
      await listen();

      const { res, body } = await request({
        port,
        path: '/compression-test-large',
        method: 'GET',
        headers: { 'Accept-Encoding': 'gzip, deflate' },
      });

      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-encoding']).to.equal('gzip');
      expect(JSON.parse(body)).to.deep.equal(responseData);
    });

    it('should not compress a response body below the threshold', async () => {
      app.set('server.compression', { threshold: '2kb' });
      app.use('compression-test', new CompressionTestService());
      await listen();

      const { res } = await request({
        port,
        path: '/compression-test',
        method: 'GET',
        headers: { 'Accept-Encoding': 'gzip' },
      });

      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-encoding']).to.be.undefined;
    });
  });
});
