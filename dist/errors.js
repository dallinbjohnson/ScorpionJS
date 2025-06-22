// src/errors.ts
export class ScorpionError extends Error {
    code;
    data;
    get statusCode() {
        return this.code;
    }
    constructor(message, code, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = 'ScorpionError';
        // Ensure the prototype chain is correctly set for custom errors
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class NotFound extends ScorpionError {
    constructor(message = 'Not Found', data) {
        super(message, 404, data);
        this.name = 'NotFound';
    }
}
export class BadRequest extends ScorpionError {
    constructor(message = 'Bad Request', data) {
        super(message, 400, data);
        this.name = 'BadRequest';
    }
}
export class NotAuthenticated extends ScorpionError {
    constructor(message = 'Not Authenticated', data) {
        super(message, 401, data);
        this.name = 'NotAuthenticated';
    }
}
export class PayloadTooLarge extends ScorpionError {
    constructor(message = 'Payload Too Large', data) {
        super(message, 413, data);
        this.name = 'PayloadTooLarge';
    }
}
export class MethodNotAllowed extends ScorpionError {
    constructor(message = 'Method Not Allowed', data) {
        super(message, 405, data);
        this.name = 'MethodNotAllowed';
    }
}
export class InternalServerError extends ScorpionError {
    constructor(message = 'Internal Server Error', data) {
        super(message, 500, data);
        this.name = 'InternalServerError';
    }
}
export class UnsupportedMediaType extends ScorpionError {
    constructor(message = 'Unsupported Media Type', data) {
        super(message, 415, data);
        this.name = 'UnsupportedMediaType';
    }
}
//# sourceMappingURL=errors.js.map