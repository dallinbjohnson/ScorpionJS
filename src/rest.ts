// src/rest.ts

import * as http from "http";
import * as fs from "fs"; // Used by _loadConfig, consider if needed here or pass config
import * as path from "path"; // Used by _loadConfig
import { URL } from "url";
import * as qs from 'qs';
import * as zlib from "zlib";
import { Readable } from "stream";
import {
  IScorpionApp,
  IScorpionAppInternal,
  Params,
  ScorpionRouteData,
  CorsOptions,
  BodyParserOptions,
  BodyParserJsonOptions,
  BodyParserUrlencodedOptions,
  BodyParserTextOptions,
  BodyParserRawOptions,
  CompressionOptions,
  Service,
  HookContext,
} from "./types.js";
// import { runHooks } from "./hooks.js"; // Hooks are run within app._handleServiceCall
import { ScorpionError, BadRequest, NotFound, PayloadTooLarge, UnsupportedMediaType } from "./errors.js";
import { findRoute } from "rou3"; // Only findRoute is needed here
// import { validateSchema, registerSchemas } from "./schema.js"; // Schema validation happens before _handleServiceCall

// Helper function (moved from app.ts)
function parseSizeToBytes(sizeStr: string | number): number {
  if (typeof sizeStr === 'number') return sizeStr;
  if (typeof sizeStr !== 'string') return 0; // Or throw error

  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0; // Or throw error for invalid format

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b'; // Default to bytes if no unit

  return Math.floor(value * (units[unit] || 1));
}

// --- Private helper functions (originally from ScorpionApp, now adapted for rest.ts) ---
// These functions will need access to the app instance, passed to startRestServer

function _applyCors(app: IScorpionAppInternal<any>, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const corsOptions = app.get("server.cors") as CorsOptions | undefined;

  if (!corsOptions) {
    return true; // No CORS configuration, proceed
  }

  const origin = req.headers.origin;
  if (origin) {
    let allowed = false;
    if (typeof corsOptions.origin === "string") {
      allowed = corsOptions.origin === "*" || corsOptions.origin === origin;
    } else if (Array.isArray(corsOptions.origin)) {
      allowed = corsOptions.origin.includes(origin);
    } else if (corsOptions.origin instanceof RegExp) {
      allowed = corsOptions.origin.test(origin);
    } else if (typeof corsOptions.origin === "function") {
      corsOptions.origin(origin, (err: Error | null, allow?: boolean) => {
        if (err) {
          allowed = false;
          return;
        }
        allowed = !!allow;
      });
    }

    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    corsOptions.methods ? (Array.isArray(corsOptions.methods) ? corsOptions.methods.join(",") : corsOptions.methods) : "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    corsOptions.allowedHeaders ? (Array.isArray(corsOptions.allowedHeaders) ? corsOptions.allowedHeaders.join(",") : corsOptions.allowedHeaders) : "Content-Type,Authorization"
  );
  if (corsOptions.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (corsOptions.exposedHeaders) {
    res.setHeader(
      "Access-Control-Expose-Headers",
      Array.isArray(corsOptions.exposedHeaders) ? corsOptions.exposedHeaders.join(",") : corsOptions.exposedHeaders
    );
  }
  if (typeof corsOptions.maxAge === "number") {
    res.setHeader("Access-Control-Max-Age", String(corsOptions.maxAge));
  }

  if (req.method === "OPTIONS") {
    res.writeHead(corsOptions.optionsSuccessStatus || 204, '', {});
    res.end();
    return false; // Request handled
  }

  return true; // Proceed with the request
}

async function _parseBody(app: IScorpionAppInternal<any>, req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    const bodyParserOptions = app.get("server.bodyParser") as BodyParserOptions || {};
    let bodyLimit: number;

    const chunks: Buffer[] = [];
    let totalLength = 0;

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      totalLength += chunk.length;

      if (contentType.startsWith("application/json")) {
        bodyLimit = parseSizeToBytes((bodyParserOptions.json as BodyParserJsonOptions)?.limit || '1mb');
      } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
        bodyLimit = parseSizeToBytes((bodyParserOptions.urlencoded as BodyParserUrlencodedOptions)?.limit || '1mb');
      } else if (contentType.startsWith("text/")) {
        bodyLimit = parseSizeToBytes((bodyParserOptions.text as BodyParserTextOptions)?.limit || '1mb');
      } else {
        bodyLimit = parseSizeToBytes((bodyParserOptions.raw as BodyParserRawOptions)?.limit || '1mb');
      }

      if (totalLength > bodyLimit) {
        req.unpipe();
        reject(new PayloadTooLarge(`Request body exceeds limit of ${bodyLimit} bytes`));
      }
    });

    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      try {
        if (contentType.startsWith("application/json")) {
          const jsonOptions = bodyParserOptions.json as BodyParserJsonOptions || {};
          const bodyString = buffer.toString(jsonOptions.encoding || 'utf8');
          if (bodyString.trim() === "") return resolve({});
          resolve(JSON.parse(bodyString, jsonOptions.reviver));
        } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
          const urlencodedOptions = bodyParserOptions.urlencoded as BodyParserUrlencodedOptions || {};
          resolve(qs.parse(buffer.toString(), {
            allowPrototypes: urlencodedOptions.allowPrototypes === undefined ? false : urlencodedOptions.allowPrototypes,
            parameterLimit: urlencodedOptions.parameterLimit === undefined ? 1000 : urlencodedOptions.parameterLimit,
          }));
        } else if (contentType.startsWith("text/")) {
          const textOptions = bodyParserOptions.text as BodyParserTextOptions || {};
          resolve(buffer.toString((textOptions.defaultCharset || 'utf8') as BufferEncoding));
        } else if (bodyParserOptions.raw) {
          resolve(buffer);
        } else {
          if (buffer.length === 0) return resolve({});
          reject(new UnsupportedMediaType("Content-type not supported or no body parser configured for it."));
        }
      } catch (err: any) {
        reject(new BadRequest("Invalid request body: " + err.message));
      }
    });

    req.on("error", (err) => {
      reject(new BadRequest("Error reading request body: " + err.message));
    });
  });
}

async function _compressResponse(
  app: IScorpionAppInternal<any>,
  req: http.IncomingMessage, // Added req to access accept-encoding
  res: http.ServerResponse,
  data: any,
  headers: Record<string, string | number | string[]> = {}
): Promise<void> {
  const compressionOptions = app.get("server.compression") as CompressionOptions | undefined;
  const acceptEncoding = (req.headers['accept-encoding'] as string) || '';

  let body: Buffer;
  if (typeof data === 'object' || Array.isArray(data)) {
    body = Buffer.from(JSON.stringify(data));
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }
  } else if (typeof data === 'string') {
    body = Buffer.from(data);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'text/plain; charset=utf-8';
    }
  } else if (Buffer.isBuffer(data)) {
    body = data;
  } else {
    body = Buffer.from(String(data));
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'text/plain; charset=utf-8';
    }
  }
  // The Object.entries(headers).forEach loop and subsequent blank line have been removed.
  if (
    compressionOptions &&
    body.length > parseSizeToBytes(compressionOptions.threshold || "1kb")
  ) {
    if (acceptEncoding.includes("br")) {
      res.setHeader("Content-Encoding", "br");
      // res.writeHead defined by pipe
      const brotliStream = zlib.createBrotliCompress();
      Readable.from(body).pipe(brotliStream).pipe(res);
      return;
    } else if (acceptEncoding.includes("gzip")) {
      res.setHeader("Content-Encoding", "gzip");
      const gzipStream = zlib.createGzip();
      Readable.from(body).pipe(gzipStream).pipe(res);
      return;
    } else if (acceptEncoding.includes("deflate")) {
      res.setHeader("Content-Encoding", "deflate");
      const deflateStream = zlib.createDeflate();
      Readable.from(body).pipe(deflateStream).pipe(res);
      return;
    }
  }
  // No compression or not applicable - headers already set
  if (!res.headersSent) {
     res.writeHead(200, '', headers); // Default to 200, pass headers directly
  }
  res.end(body);
}

function _sendResponse(
  // app: ScorpionApp<any>, // Not strictly needed if not accessing app config here
  res: http.ServerResponse,
  statusCode: number,
  data: any,
  headers: Record<string, string | number | string[]> = {}
): void {
  if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (data === undefined || data === null || statusCode === 204) {
    res.writeHead(statusCode, '', {});
    res.end();
    return;
  }

  if (typeof data === 'string' || Buffer.isBuffer(data)) {
    if (!headers['Content-Length'] && !res.getHeader('Content-Length')) {
      res.setHeader('Content-Length', Buffer.byteLength(data).toString());
    }
    res.writeHead(statusCode, '', {});
    res.end(data);
  } else {
    const jsonData = JSON.stringify(data);
    if (!headers['Content-Length'] && !res.getHeader('Content-Length')) {
      res.setHeader('Content-Length', Buffer.byteLength(jsonData).toString());
    }
    res.writeHead(statusCode, '', {});
    res.end(jsonData);
  }
}

async function _handleRequest(app: IScorpionAppInternal<any>, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Access currentRequest and currentResponse via app if they are still needed by other parts of app
  // For now, assuming they are primarily for REST context, so managed locally or passed if essential.
  // app.currentRequest = req;
  // app.currentResponse = res;

  if (!_applyCors(app, req, res)) {
    // app.currentRequest = undefined;
    // app.currentResponse = undefined;
    return; 
  }

  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  const requestPath = parsedUrl.pathname;
  const method = req.method || "GET";

  if (requestPath === "/health" && method === "GET") {
    _sendResponse(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    // app.currentRequest = undefined;
    // app.currentResponse = undefined;
    return;
  }

  try {
    const route = findRoute<ScorpionRouteData>(app.getRouter(), requestPath); // Use app.getRouter()

    if (!route || !route.data) {
      throw new NotFound(`No service found for path '${requestPath}'`);
    }

    const { servicePath, httpMethod, serviceMethodName, allowStream } = route.data;
    const serviceInstance = app.service(servicePath);

    if (!serviceInstance) {
      throw new NotFound(`Service '${servicePath}' not found.`);
    }

    if (httpMethod.toUpperCase() !== method.toUpperCase()) {
      if (method !== 'OPTIONS') {
          _sendResponse(res, 405, { error: 'Method Not Allowed' });
          // app.currentRequest = undefined;
          // app.currentResponse = undefined;
          return;
      }
    }

    let requestData: any;
    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      try {
        requestData = await _parseBody(app, req);
      } catch (error) {
        if (error instanceof ScorpionError) {
          _sendResponse(res, error.statusCode, { error: error.message, code: error.code, data: error.data });
        } else {
          _sendResponse(res, 400, { error: (error as Error).message });
        }
        // app.currentRequest = undefined;
        // app.currentResponse = undefined;
        return;
      }
    }

    const queryParams = qs.parse(parsedUrl.search.substring(1));

    const params: Params = {
      query: queryParams,
      route: route.params,
      provider: "rest",
      headers: req.headers,
      connection: {
        remoteAddress: req.socket.remoteAddress,
        remotePort: req.socket.remotePort,
        encrypted: (req.socket as any).encrypted
      },
      user: undefined,
      payload: requestData
    };

    let id: string | number | null = null;
    if (route.params && route.params.id) {
      id = route.params.id;
    } else if (route.params && Object.keys(route.params).length === 1) {
      id = Object.values(route.params)[0];
    }
    
    if (allowStream && (serviceMethodName === 'create' || serviceMethodName === 'update' || serviceMethodName === 'patch')) {
      if (req.headers['transfer-encoding'] === 'chunked' || req.headers['content-type']?.includes('multipart/form-data')) {
        console.log(`[Scorpion REST] Streaming request for ${servicePath}#${serviceMethodName}`);
        const streamResult = await app.executeServiceCall({
          path: servicePath,
          method: serviceMethodName,
          id: id,
          data: req, 
          params: { ...params, _stream: req }
        });
        if (!res.writableEnded) {
          await _compressResponse(app, req, res, streamResult);
        }
        // app.currentRequest = undefined;
        // app.currentResponse = undefined;
        return;
      }
    }

    const result = await app.executeServiceCall({
      path: servicePath,
      method: serviceMethodName,
      id: id,
      data: requestData,
      params: params,
    });

    if (serviceMethodName === 'remove' && (result === undefined || result === null || (typeof result === 'object' && Object.keys(result).length === 0) )) {
      _sendResponse(res, 204, null);
    } else if (serviceMethodName === 'create') {
      // For create, send 201 by default, compressResponse will handle actual sending with 200 if not overridden
      // We'll let compressResponse handle the status code setting based on content or lack thereof for now.
      // To enforce 201, _sendResponse would need to be called after _compressResponse or _compressResponse modified.
      // For simplicity, we assume 200 from compress unless it's a 204 scenario.
      res.statusCode = 201; // Set status before compression
      await _compressResponse(app, req, res, result, { 'Content-Type': 'application/json; charset=utf-8' });
    } else {
      await _compressResponse(app, req, res, result);
    }

  } catch (error: any) {
    console.error("[Scorpion REST] Error handling request:", error);
    if (error instanceof ScorpionError) {
      _sendResponse(res, error.statusCode, {
        error: error.message,
        code: error.code,
        data: error.data,
      });
    } else {
      _sendResponse(res, 500, { error: "Internal Server Error" });
    }
  }
  // app.currentRequest = undefined;
  // app.currentResponse = undefined;
}

export function startRestServer(
  app: IScorpionAppInternal<any>,
  port: number,
  host: string,
  callback?: () => void
): http.Server | undefined {
  try {
    const server = http.createServer(async (req, res) => {
      try {
        await _handleRequest(app, req, res);
      } catch (error) {
        console.error("[Scorpion REST] Unhandled error in request pipeline:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      }
    });

    server.listen(port, host, () => {
      console.log(`[Scorpion REST] Server listening on http://${host}:${port}`);
      app.emit("listening", server);
      if (callback) {
        callback();
      }
    });

    server.on("error", (err) => {
      console.error("[Scorpion REST] Server error:", err);
      app.emit("error", err);
    });
    return server;
  } catch (error) {
    console.error("[Scorpion REST] Failed to start HTTP server:", error);
    app.emit("error", error as Error);
    return undefined;
  }
}
