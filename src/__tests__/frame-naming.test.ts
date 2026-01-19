/**
 * Tests for frame-naming.ts
 * Story 5.1: Deterministic Frame Naming
 */

import { describe, it, expect } from 'vitest';
import {
    generateFrameName,
    parseFrameName,
    validateFrameNaming,
    createFrameMapping,
} from '../utils/frame-naming.js';

describe('Frame Naming', () => {
    describe('generateFrameName', () => {
        it('should generate 4-digit zero-padded frame names', () => {
            expect(generateFrameName('idle', 0)).toBe('idle/0000');
            expect(generateFrameName('idle', 1)).toBe('idle/0001');
            expect(generateFrameName('idle', 99)).toBe('idle/0099');
            expect(generateFrameName('idle', 9999)).toBe('idle/9999');
        });

        it('should handle different move prefixes', () => {
            expect(generateFrameName('walk', 5)).toBe('walk/0005');
            expect(generateFrameName('attack', 12)).toBe('attack/0012');
        });

        it('should throw for invalid frame indices', () => {
            expect(() => generateFrameName('idle', -1)).toThrow();
            expect(() => generateFrameName('idle', 10000)).toThrow();
        });
    });

    describe('parseFrameName', () => {
        it('should parse valid frame names', () => {
            const result = parseFrameName('idle/0005');
            expect(result).toEqual({ moveId: 'idle', frameIndex: 5 });
        });

        it('should return null for invalid frame names', () => {
            expect(parseFrameName('invalid')).toBeNull();
            expect(parseFrameName('idle_5')).toBeNull();
            expect(parseFrameName('IDLE/0001')).toBeNull(); // uppercase not allowed
        });
    });

    describe('validateFrameNaming', () => {
        it('should validate correct frame names', () => {
            const names = ['idle/0000', 'idle/0001', 'idle/0002'];
            const result = validateFrameNaming(names);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid format', () => {
            const names = ['invalid', 'idle/0001'];
            const result = validateFrameNaming(names);
            expect(result.valid).toBe(false);
            expect(result.invalidNames).toContain('invalid');
        });

        it('should detect gaps in sequence', () => {
            const names = ['idle/0000', 'idle/0002']; // Missing 0001
            const result = validateFrameNaming(names);
            expect(result.valid).toBe(false);
            expect(result.gaps).toContain(1);
        });
    });

    describe('createFrameMapping', () => {
        it('should create valid mapping entry', () => {
            const entry = createFrameMapping('frame_0005.png', 'idle', 5);
            expect(entry.original).toBe('frame_0005.png');
            expect(entry.renamed).toBe('idle/0005');
            expect(entry.frameIndex).toBe(5);
        });
    });
});
