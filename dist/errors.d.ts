export declare class ScorpionError extends Error {
    readonly code: number;
    readonly data?: any;
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
