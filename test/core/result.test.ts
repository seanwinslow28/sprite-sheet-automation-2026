/**
 * Tests for Result pattern
 */

import { describe, it, expect } from 'vitest';
import { Result } from '../../src/core/result.js';

describe('Result Pattern', () => {
    it('should create Ok result', () => {
        const result = Result.ok('success');
        expect(result.isOk()).toBe(true);
        expect(result.isErr()).toBe(false);
        expect(result.unwrap()).toBe('success');
    });

    it('should create Err result', () => {
        const error = { code: 'TEST_ERR', message: 'Something went wrong' };
        const result = Result.err(error);
        expect(result.isOk()).toBe(false);
        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(error);
    });

    it('should unwrapOr correctly', () => {
        const ok = Result.ok('success');
        const err = Result.err({ code: 'ERR', message: 'fail' });

        expect(ok.unwrapOr('default')).toBe('success');
        expect(err.unwrapOr('default')).toBe('default');
    });

    it('should throw when unwrapping Err', () => {
        const result = Result.err({ code: 'ERR', message: 'fail' });
        expect(() => result.unwrap()).toThrow('Called unwrap() on an Err value');
    });

    it('should throw when unwrappingErr Ok', () => {
        const result = Result.ok('success');
        expect(() => result.unwrapErr()).toThrow('Called unwrapErr() on an Ok value');
    });
});
