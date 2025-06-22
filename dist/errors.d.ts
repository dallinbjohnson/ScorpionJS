export declare class ScorpionError extends Error {
    readonly code: number;
    readonly data?: any;
    get statusCode(): number;
    constructor(message: string, code: number, data?: any);
}
export declare class NotFound extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class BadRequest extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class NotAuthenticated extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class PayloadTooLarge extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class MethodNotAllowed extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class InternalServerError extends ScorpionError {
    constructor(message?: string, data?: any);
}
export declare class UnsupportedMediaType extends ScorpionError {
    constructor(message?: string, data?: any);
}
