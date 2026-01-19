/**
 * Tests for manifest schema validation (Story 2.1)
 */

import { describe, it, expect } from 'vitest';
import {
    manifestSchema,
    identitySchema,
    canvasSchema,
    type Manifest
} from '../../src/domain/schemas/manifest.js';
import {
    validateManifest,
    formatZodError,
    Result
} from '../../src/core/config-resolver.js';
import { z } from 'zod';

// Valid manifest fixture
const validManifest: Manifest = {
    identity: {
        character: 'champion_01',
        move: 'idle',
        version: '1.0.0',
        frame_count: 8,
        is_loop: true,
    },
    inputs: {
        anchor: './assets/anchor.png',
        style_refs: [],
        pose_refs: [],
        guides: [],
    },
    generator: {
        backend: 'gemini',
        model: 'gemini-2.0-flash-exp',
        mode: 'edit',
        seed_policy: 'fixed_then_random',
        max_attempts_per_frame: 4,
        prompts: {
            master: 'Generate frame 0...',
            variation: 'Generate frame {frame_index}...',
            lock: 'CRITICAL: Identity rescue...',
            negative: 'blurry, anti-aliased',
        },
    },
    canvas: {
        generation_size: 512,
        target_size: 128,
        downsample_method: 'nearest',
        alignment: {
            method: 'contact_patch',
            vertical_lock: true,
            root_zone_ratio: 0.15,
            max_shift_x: 32,
        },
    },
    auditor: {
        hard_gates: { HF01: 0.5 },
        soft_metrics: { SF01: 0.9 },
        weights: { SF01: 1.0 },
    },
    retry: {
        ladder: ['EDIT_FROM_ANCHOR', 'RE_ANCHOR', 'TIGHTEN_PROMPT'],
        stop_conditions: { max_attempts: 4 },
    },
    export: {
        packer_flags: ['--max-size', '4096'],
        atlas_format: 'phaser',
    },
};

describe('Manifest Schema (Story 2.1)', () => {
    describe('AC #1: Schema validation on run', () => {
        it('should validate a complete manifest', () => {
            const result = manifestSchema.safeParse(validManifest);
            expect(result.success).toBe(true);
        });

        it('should reject manifest missing required fields', () => {
            const result = manifestSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('AC #2: Identity fields validated', () => {
        it('should require character, move, version, frame_count', () => {
            const result = identitySchema.safeParse({});
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map(i => i.path[0]);
                expect(paths).toContain('character');
                expect(paths).toContain('move');
                expect(paths).toContain('version');
                expect(paths).toContain('frame_count');
            }
        });

        it('should accept is_loop boolean', () => {
            const result = identitySchema.safeParse({
                character: 'test',
                move: 'idle',
                version: '1.0.0',
                frame_count: 8,
                is_loop: true,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is_loop).toBe(true);
            }
        });

        it('should default is_loop to false', () => {
            const result = identitySchema.safeParse({
                character: 'test',
                move: 'idle',
                version: '1.0.0',
                frame_count: 8,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is_loop).toBe(false);
            }
        });

        it('should reject non-positive frame_count', () => {
            const result = identitySchema.safeParse({
                character: 'test',
                move: 'idle',
                version: '1.0.0',
                frame_count: 0,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('AC #4: Generator config validated', () => {
        it('should require backend to be "gemini"', () => {
            const result = manifestSchema.safeParse({
                ...validManifest,
                generator: { ...validManifest.generator, backend: 'openai' },
            });
            expect(result.success).toBe(false);
        });

        it('should require mode to be "edit"', () => {
            const result = manifestSchema.safeParse({
                ...validManifest,
                generator: { ...validManifest.generator, mode: 'generate' },
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Canvas schema', () => {
        it('should require generation_size to be 512', () => {
            const result = canvasSchema.safeParse({
                generation_size: 256,
                target_size: 128,
                downsample_method: 'nearest',
            });
            expect(result.success).toBe(false);
        });

        it('should accept target_size of 128 or 256', () => {
            const result128 = canvasSchema.safeParse({
                generation_size: 512,
                target_size: 128,
                downsample_method: 'nearest',
            });
            expect(result128.success).toBe(true);

            const result256 = canvasSchema.safeParse({
                generation_size: 512,
                target_size: 256,
                downsample_method: 'nearest',
            });
            expect(result256.success).toBe(true);
        });

        it('should validate alignment method enum', () => {
            const result = canvasSchema.safeParse({
                generation_size: 512,
                target_size: 128,
                downsample_method: 'nearest',
                alignment: { method: 'invalid' },
            });
            expect(result.success).toBe(false);
        });

        it('should clamp root_zone_ratio to 0.05-0.50 range', () => {
            const tooSmall = canvasSchema.safeParse({
                generation_size: 512,
                target_size: 128,
                downsample_method: 'nearest',
                alignment: { method: 'contact_patch', root_zone_ratio: 0.01 },
            });
            expect(tooSmall.success).toBe(false);

            const tooLarge = canvasSchema.safeParse({
                generation_size: 512,
                target_size: 128,
                downsample_method: 'nearest',
                alignment: { method: 'contact_patch', root_zone_ratio: 0.60 },
            });
            expect(tooLarge.success).toBe(false);
        });
    });

    describe('AC #6: Clear error messages', () => {
        it('should format errors with field path', () => {
            const result = manifestSchema.safeParse({
                identity: { character: 123 }, // Wrong type
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                const errors = formatZodError(result.error);
                expect(errors.length).toBeGreaterThan(0);
                expect(errors[0].code).toBe('VALIDATION_ERROR');
                expect(errors[0].field).toContain('identity');
            }
        });

        it('should include expected and received types', () => {
            const result = identitySchema.safeParse({ character: 123 });
            expect(result.success).toBe(false);
            if (!result.success) {
                const errors = formatZodError(result.error);
                expect(errors[0].expected).toBe('string');
                expect(errors[0].received).toBe('number');
            }
        });

        it('should provide actionable fix suggestions', () => {
            const result = identitySchema.safeParse({});
            expect(result.success).toBe(false);
            if (!result.success) {
                const errors = formatZodError(result.error);
                expect(errors[0].fix).toContain('Add required field');
            }
        });
    });

    describe('AC #7: Config hierarchy', () => {
        it('should apply canvas defaults when not provided', () => {
            const partialManifest = {
                identity: validManifest.identity,
                inputs: validManifest.inputs,
                generator: validManifest.generator,
                auditor: validManifest.auditor,
                retry: validManifest.retry,
                export: validManifest.export,
                // canvas not provided - should use defaults
            };

            const result = validateManifest(partialManifest);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.canvas.generation_size).toBe(512);
                expect(result.value.canvas.alignment.method).toBe('contact_patch');
            }
        });

        it('should allow manifest values to override defaults', () => {
            const customManifest = {
                ...validManifest,
                canvas: {
                    generation_size: 512,
                    target_size: 256, // Override default 128
                    downsample_method: 'nearest' as const,
                    alignment: {
                        method: 'center' as const, // Override default contact_patch
                        vertical_lock: false,
                        root_zone_ratio: 0.20,
                        max_shift_x: 16,
                    },
                },
            };

            const result = validateManifest(customManifest);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.canvas.target_size).toBe(256);
                expect(result.value.canvas.alignment.method).toBe('center');
            }
        });
    });
});
