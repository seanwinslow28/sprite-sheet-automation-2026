/**
 * Result type for error handling without exceptions
 * All adapter methods must return Promise<Result<T, SystemError>>
 */

export interface SystemError {
    code: string;
    message: string;
    context?: Record<string, unknown>;
    attempted?: string;
    fix?: string;
}

export class Result<T, E = SystemError> {
    private readonly _success: boolean;
    private readonly _value?: T;
    private readonly _error?: E;

    private constructor(success: boolean, value?: T, error?: E) {
        this._success = success;
        this._value = value;
        this._error = error;
    }

    static ok<T, E = SystemError>(value: T): Result<T, E> {
        return new Result<T, E>(true, value, undefined);
    }

    static err<T, E = SystemError>(error: E): Result<T, E> {
        return new Result<T, E>(false, undefined, error);
    }

    isOk(): boolean {
        return this._success;
    }

    isErr(): boolean {
        return !this._success;
    }

    unwrap(): T {
        if (!this._success) {
            // Improved: throw structured error if possible, or formatted string
            const err = this._error as any;
            const msg = err?.message || JSON.stringify(this._error);
            throw new Error(`Called unwrap() on an Err value: ${msg}`);
        }
        return this._value as T;
    }

    unwrapOr(defaultValue: T): T {
        return this._success ? (this._value as T) : defaultValue;
    }

    unwrapErr(): E {
        if (this._success) {
            throw new Error('Called unwrapErr() on an Ok value');
        }
        return this._error as E;
    }
}
