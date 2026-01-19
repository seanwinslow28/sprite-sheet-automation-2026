/**
 * Tests for frame naming utilities
 * Story 5.1: Deterministic Frame Naming Convention
 */

import { describe, it, expect } from 'vitest';
import {
    generateFrameName,
    parseFrameName,
    validateFrameNaming,
    generateExpectedFrameNames,
    createFrameMapping,
    createFrameMappingLog,
    toExternalMappingFormat,
} from '../../src/utils/frame-naming.js';

describe('Frame Naming Utilities', () => {
    describe('generateFrameName', () => {
        it('should generate correct format with 4-digit padding', () => {
            expect(generateFrameName('idle', 0)).toBe('idle/0000');
            expect(generateFrameName('idle', 1)).toBe('idle/0001');
            expect(generateFrameName('walk', 10)).toBe('walk/0010');
            expect(generateFrameName('attack', 100)).toBe('attack/0100');
            expect(generateFrameName('special_move', 1000)).toBe('special_move/1000');
        });

        it('should handle edge cases at 9999', () => {
            expect(generateFrameName('idle', 9999)).toBe('idle/9999');
        });

        it('should throw for negative indices', () => {
            expect(() => generateFrameName('idle', -1)).toThrow('Frame index must be between 0 and 9999');
        });

        it('should throw for indices above 9999', () => {
            expect(() => generateFrameName('idle', 10000)).toThrow('Frame index must be between 0 and 9999');
        });

        it('should support move IDs with underscores', () => {
            expect(generateFrameName('idle_standard', 5)).toBe('idle_standard/0005');
            expect(generateFrameName('attack_heavy_combo', 0)).toBe('attack_heavy_combo/0000');
        });
    });

    describe('parseFrameName', () => {
        it('should parse valid frame names', () => {
            expect(parseFrameName('idle/0000')).toEqual({ moveId: 'idle', frameIndex: 0 });
            expect(parseFrameName('walk/0010')).toEqual({ moveId: 'walk', frameIndex: 10 });
            expect(parseFrameName('attack_heavy/0100')).toEqual({ moveId: 'attack_heavy', frameIndex: 100 });
        });

        it('should return null for invalid format', () => {
            expect(parseFrameName('idle-0000')).toBeNull(); // wrong separator
            expect(parseFrameName('idle/000')).toBeNull(); // not 4 digits
            expect(parseFrameName('idle/00000')).toBeNull(); // too many digits
            expect(parseFrameName('Idle/0000')).toBeNull(); // uppercase
            expect(parseFrameName('')).toBeNull();
        });
    });

    describe('validateFrameNaming', () => {
        it('should validate correct frame names', () => {
            const result = validateFrameNaming(['idle/0000', 'idle/0001', 'idle/0002']);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.invalidNames).toEqual([]);
            expect(result.gaps).toEqual([]);
        });

        it('should detect invalid format', () => {
            const result = validateFrameNaming(['idle/0000', 'idle-0001', 'idle/0002']);
            expect(result.valid).toBe(false);
            expect(result.invalidNames).toContain('idle-0001');
        });

        it('should detect gaps in sequence', () => {
            const result = validateFrameNaming(['idle/0000', 'idle/0001', 'idle/0003']);
            expect(result.valid).toBe(false);
            expect(result.gaps).toContain(2);
            expect(result.errors.some(e => e.includes('missing frame index 2'))).toBe(true);
        });

        it('should detect multiple gaps', () => {
            const result = validateFrameNaming(['idle/0000', 'idle/0005']);
            expect(result.valid).toBe(false);
            expect(result.gaps).toEqual([1, 2, 3, 4]);
        });

        it('should handle empty array', () => {
            const result = validateFrameNaming([]);
            expect(result.valid).toBe(true);
        });

        it('should handle multiple move IDs separately', () => {
            const result = validateFrameNaming([
                'idle/0000', 'idle/0001',
                'walk/0000', 'walk/0001',
            ]);
            expect(result.valid).toBe(true);
        });

        it('should detect gaps in multiple move ID sequences', () => {
            const result = validateFrameNaming([
                'idle/0000', 'idle/0002', // gap at 1
                'walk/0000', 'walk/0001', // no gap
            ]);
            expect(result.valid).toBe(false);
            expect(result.gaps).toContain(1);
        });
    });

    describe('generateExpectedFrameNames', () => {
        it('should generate correct sequence', () => {
            const names = generateExpectedFrameNames('idle', 4);
            expect(names).toEqual([
                'idle/0000',
                'idle/0001',
                'idle/0002',
                'idle/0003',
            ]);
        });

        it('should handle frame count of 1', () => {
            const names = generateExpectedFrameNames('walk', 1);
            expect(names).toEqual(['walk/0000']);
        });

        it('should handle frame count of 0', () => {
            const names = generateExpectedFrameNames('idle', 0);
            expect(names).toEqual([]);
        });
    });

    describe('createFrameMapping', () => {
        it('should create correct mapping entry', () => {
            const mapping = createFrameMapping('/path/to/frame_0000.png', 'idle', 0);
            expect(mapping).toEqual({
                original: '/path/to/frame_0000.png',
                renamed: 'idle/0000',
                frameIndex: 0,
            });
        });
    });

    describe('createFrameMappingLog', () => {
        it('should create complete log with timestamp', () => {
            const mappings = [
                { original: '/path/0.png', renamed: 'idle/0000', frameIndex: 0 },
                { original: '/path/1.png', renamed: 'idle/0001', frameIndex: 1 },
            ];
            const log = createFrameMappingLog('run_123', 'idle', mappings);

            expect(log.runId).toBe('run_123');
            expect(log.moveId).toBe('idle');
            expect(log.frameCount).toBe(2);
            expect(log.mappings).toEqual(mappings);
            expect(log.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
        });
    });

    describe('toExternalMappingFormat', () => {
        it('should convert camelCase to snake_case', () => {
            const log = {
                runId: 'run_123',
                moveId: 'idle',
                frameCount: 1,
                mappings: [
                    { original: '/path/0.png', renamed: 'idle/0000', frameIndex: 0 },
                ],
                generatedAt: '2026-01-18T12:00:00.000Z',
            };
            const external = toExternalMappingFormat(log);

            expect(external.run_id).toBe('run_123');
            expect(external.move_id).toBe('idle');
            expect(external.frame_count).toBe(1);
            expect(external.generated_at).toBe('2026-01-18T12:00:00.000Z');
            expect(external.mappings[0].frame_index).toBe(0);
        });
    });

    describe('Lexicographical Sort', () => {
        it('should sort correctly with 4-digit padding', () => {
            const names = [
                'idle/0010',
                'idle/0002',
                'idle/0001',
                'idle/0100',
            ];
            const sorted = [...names].sort();
            expect(sorted).toEqual([
                'idle/0001',
                'idle/0002',
                'idle/0010',
                'idle/0100',
            ]);
        });

        it('should handle sorting across different move IDs', () => {
            const names = [
                'walk/0001',
                'idle/0002',
                'attack/0000',
                'idle/0001',
            ];
            const sorted = [...names].sort();
            expect(sorted).toEqual([
                'attack/0000',
                'idle/0001',
                'idle/0002',
                'walk/0001',
            ]);
        });
    });
});
