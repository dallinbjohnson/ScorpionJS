// src/errors.ts
export class ScorpionError extends Error {
    code;
    data;
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
