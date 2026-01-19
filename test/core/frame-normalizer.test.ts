/**
 * Tests for frame normalizer (Story 3.1)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import {
    normalizeFrame,
    getNormalizerConfig,
    type NormalizerConfig,
} from '../../src/core/frame-normalizer.js';
import { analyzeAnchor, type AnchorAnalysis } from '../../src/core/anchor-analyzer.js';

describe('Frame Normalizer (Story 3.1)', () => {
    let testDir: string;
    let anchorPath: string;
    let anchorAnalysis: AnchorAnalysis;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-normalizer-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });

        // Create a test anchor image (512x512 with a sprite shape)
        anchorPath = join(testDir, 'anchor.png');
        await createTestSprite(anchorPath, 512);

        // Analyze anchor
        const result = await analyzeAnchor(anchorPath, 0.15, 128);
        if (!result.ok) {
            throw new Error('Failed to analyze anchor: ' + result.error.message);
        }
        anchorAnalysis = result.value;
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    /**
     * Create a test sprite with a character-like shape
     */
    async function createTestSprite(filepath: string, size: number): Promise<void> {
        const data = Buffer.alloc(size * size * 4, 0); // Start transparent

        // Draw a simple character shape (centered, bottom-heavy)
        const centerX = Math.floor(size / 2);
        const bottomY = Math.floor(size * 0.85);
        const headRadius = Math.floor(size * 0.1);
        const bodyWidth = Math.floor(size * 0.15);
        const bodyHeight = Math.floor(size * 0.3);

        // Draw body (rectangle)
        for (let y = bottomY - bodyHeight; y <= bottomY; y++) {
            for (let x = centerX - bodyWidth; x <= centerX + bodyWidth; x++) {
                if (x >= 0 && x < size && y >= 0 && y < size) {
                    const idx = (y * size + x) * 4;
                    data[idx] = 128;     // R
                    data[idx + 1] = 64;  // G
                    data[idx + 2] = 192; // B
                    data[idx + 3] = 255; // A (opaque)
                }
            }
        }

        // Draw head (circle)
        const headY = bottomY - bodyHeight - headRadius;
        for (let y = headY - headRadius; y <= headY + headRadius; y++) {
            for (let x = centerX - headRadius; x <= centerX + headRadius; x++) {
                const dx = x - centerX;
                const dy = y - headY;
                if (dx * dx + dy * dy <= headRadius * headRadius) {
                    if (x >= 0 && x < size && y >= 0 && y < size) {
                        const idx = (y * size + x) * 4;
                        data[idx] = 255;     // R (skin tone)
                        data[idx + 1] = 200; // G
                        data[idx + 2] = 180; // B
                        data[idx + 3] = 255; // A (opaque)
                    }
                }
            }
        }

        await sharp(data, { raw: { width: size, height: size, channels: 4 } })
            .png()
            .toFile(filepath);
    }

    /**
     * Create test normalizer config
     */
    function createTestConfig(): NormalizerConfig {
        return {
            targetSize: 128,
            generationSize: 512,
            alignment: {
                method: 'contact_patch',
                vertical_lock: true,
                root_zone_ratio: 0.15,
                max_shift_x: 32,
            },
            transparency: {
                strategy: 'true_alpha',
            },
        };
    }

    describe('normalizeFrame', () => {
        it('should normalize a 512px frame to 128px', async () => {
            const inputPath = join(testDir, 'candidate_512.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);
            if (result.ok) {
                // Verify output exists
                const exists = await fs.access(result.value.outputPath).then(() => true).catch(() => false);
                expect(exists).toBe(true);

                // Verify output dimensions
                const metadata = await sharp(result.value.outputPath).metadata();
                expect(metadata.width).toBe(128);
                expect(metadata.height).toBe(128);

                // Verify final dimensions in result
                expect(result.value.dimensions.final.width).toBe(128);
                expect(result.value.dimensions.final.height).toBe(128);
            }
        });

        it('should process all 4 steps in order', async () => {
            const inputPath = join(testDir, 'candidate_512.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);
            if (result.ok) {
                // Verify all 4 steps completed
                expect(result.value.processingSteps).toHaveLength(4);

                // Verify order
                expect(result.value.processingSteps[0].name).toBe('contact_patch');
                expect(result.value.processingSteps[1].name).toBe('downsample');
                expect(result.value.processingSteps[2].name).toBe('transparency');
                expect(result.value.processingSteps[3].name).toBe('canvas_sizing');

                // Verify all succeeded
                expect(result.value.processingSteps.every(s => s.success)).toBe(true);
            }
        });

        it('should apply _norm suffix to output filename', async () => {
            const inputPath = join(testDir, 'frame_0001_attempt_01.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toContain('_norm.png');
            }
        });

        it('should track alignment shift values', async () => {
            const inputPath = join(testDir, 'candidate_512.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);
            if (result.ok) {
                // Alignment values should be present
                expect(result.value.alignmentApplied).toBeDefined();
                expect(typeof result.value.alignmentApplied.shiftX).toBe('number');
                expect(typeof result.value.alignmentApplied.shiftY).toBe('number');
                expect(typeof result.value.alignmentApplied.clamped).toBe('boolean');
            }
        });

        it('should track total duration in milliseconds', async () => {
            const inputPath = join(testDir, 'candidate_512.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.durationMs).toBeGreaterThan(0);
                // Each step should also have duration
                for (const step of result.value.processingSteps) {
                    expect(step.durationMs).toBeGreaterThanOrEqual(0);
                }
            }
        });

        it('should return error for invalid input path', async () => {
            const config = createTestConfig();
            const result = await normalizeFrame(
                '/nonexistent/image.png',
                config,
                anchorAnalysis,
                testDir
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('NORMALIZER_INPUT_FAILED');
            }
        });

        it('should preserve original file', async () => {
            const inputPath = join(testDir, 'original_512.png');
            await createTestSprite(inputPath, 512);

            const config = createTestConfig();
            const result = await normalizeFrame(inputPath, config, anchorAnalysis, testDir);

            expect(result.ok).toBe(true);

            // Original should still exist
            const exists = await fs.access(inputPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('getNormalizerConfig', () => {
        it('should extract config from canvas settings', () => {
            const canvas = {
                target_size: 128,
                generation_size: 512,
                alignment: {
                    method: 'contact_patch' as const,
                    vertical_lock: true,
                    root_zone_ratio: 0.15,
                    max_shift_x: 32,
                },
                transparency: {
                    strategy: 'chroma_key' as const,
                    chroma_color: '#00FF00',
                },
            };

            const config = getNormalizerConfig(canvas);

            expect(config.targetSize).toBe(128);
            expect(config.generationSize).toBe(512);
            expect(config.alignment.method).toBe('contact_patch');
            expect(config.transparency.strategy).toBe('chroma_key');
            expect(config.transparency.chroma_color).toBe('#00FF00');
        });

        it('should default to true_alpha strategy', () => {
            const canvas = {
                target_size: 128,
                generation_size: 512,
                alignment: {
                    method: 'contact_patch' as const,
                    vertical_lock: true,
                    root_zone_ratio: 0.15,
                    max_shift_x: 32,
                },
            };

            const config = getNormalizerConfig(canvas);

            expect(config.transparency.strategy).toBe('true_alpha');
        });
    });
});
