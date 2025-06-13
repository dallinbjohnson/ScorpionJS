// src/errors.ts

export class ScorpionError extends Error {
  public readonly code: number;
  public readonly data?: any;

  constructor(message: string, code: number, data?: any) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = 'ScorpionError';
    // Ensure the prototype chain is correctly set for custom errors
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFound extends ScorpionError {
  constructor(message = 'Not Found', data?: any) {
    super(message, 404, data);
    this.name = 'NotFound';
  }
}

export class BadRequest extends ScorpionError {
  constructor(message = 'Bad Request', data?: any) {
    super(message, 400, data);
    this.name = 'BadRequest';
  }
}

export class NotAuthenticated extends ScorpionError {
  constructor(message = 'Not Authenticated', data?: any) {
    super(message, 401, data);
    this.name = 'NotAuthenticated';
  }
}

export class PayloadTooLarge extends ScorpionError {
  constructor(message = 'Payload Too Large', data?: any) {
    super(message, 413, data);
    this.name = 'PayloadTooLarge';
  }
}

export class UnsupportedMediaType extends ScorpionError {
  constructor(message = 'Unsupported Media Type', data?: any) {
    super(message, 415, data);
    this.name = 'UnsupportedMediaType';
  }
}
