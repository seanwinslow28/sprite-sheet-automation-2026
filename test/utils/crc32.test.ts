/**
 * Tests for CRC32 utility (Story 2.3)
 */

import { describe, it, expect } from 'vitest';
import { crc32, calculateSeed, describeSeedPolicy } from '../../src/utils/crc32.js';

describe('CRC32 Utility', () => {
    describe('crc32 function', () => {
        it('should return consistent hash for same input', () => {
            const hash1 = crc32('test-string');
            const hash2 = crc32('test-string');
            expect(hash1).toBe(hash2);
        });

        it('should return different hashes for different inputs', () => {
            const hash1 = crc32('test-string-1');
            const hash2 = crc32('test-string-2');
            expect(hash1).not.toBe(hash2);
        });

        it('should return positive unsigned integer', () => {
            const hash = crc32('test');
            expect(hash).toBeGreaterThan(0);
            expect(Number.isInteger(hash)).toBe(true);
        });

        it('should handle empty string', () => {
            const hash = crc32('');
            expect(typeof hash).toBe('number');
        });

        it('should produce known CRC32 value for standard test vector', () => {
            // CRC32 of "123456789" should be 0xCBF43926
            const hash = crc32('123456789');
            expect(hash).toBe(0xCBF43926);
        });
    });

    describe('calculateSeed function', () => {
        it('should return CRC32 seed for attempt 1', () => {
            const seed = calculateSeed('run_123', 0, 1);
            expect(seed).toBeDefined();
            expect(typeof seed).toBe('number');
        });

        it('should return undefined for attempt > 1', () => {
            const seed2 = calculateSeed('run_123', 0, 2);
            const seed3 = calculateSeed('run_123', 0, 3);
            expect(seed2).toBeUndefined();
            expect(seed3).toBeUndefined();
        });

        it('should return consistent seed for same inputs', () => {
            const seed1 = calculateSeed('run_abc', 3, 1);
            const seed2 = calculateSeed('run_abc', 3, 1);
            expect(seed1).toBe(seed2);
        });

        it('should return different seeds for different frames', () => {
            const seed1 = calculateSeed('run_abc', 0, 1);
            const seed2 = calculateSeed('run_abc', 1, 1);
            expect(seed1).not.toBe(seed2);
        });

        it('should return different seeds for different runs', () => {
            const seed1 = calculateSeed('run_001', 0, 1);
            const seed2 = calculateSeed('run_002', 0, 1);
            expect(seed1).not.toBe(seed2);
        });
    });

    describe('describeSeedPolicy function', () => {
        it('should return "fixed_crc32" for attempt 1', () => {
            expect(describeSeedPolicy(1)).toBe('fixed_crc32');
        });

        it('should return "random" for attempt > 1', () => {
            expect(describeSeedPolicy(2)).toBe('random');
            expect(describeSeedPolicy(3)).toBe('random');
            expect(describeSeedPolicy(10)).toBe('random');
        });
    });
});
