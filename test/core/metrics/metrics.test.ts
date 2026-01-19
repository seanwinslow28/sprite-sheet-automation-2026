/**
 * Tests for metrics modules (Stories 3.4-3.10)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';

import { calculateSSIM } from '../../../src/core/metrics/ssim-calculator.js';
import { calculatePaletteFidelity, extractDominantColors } from '../../../src/core/metrics/palette-fidelity.js';
import { detectAlphaArtifacts } from '../../../src/core/metrics/alpha-artifact-detector.js';
import { detectOrphanPixels } from '../../../src/core/metrics/orphan-pixel-detector.js';
import { calculateMAPD } from '../../../src/core/metrics/mapd-calculator.js';
import { calculateCompositeScore } from '../../../src/core/metrics/soft-metric-aggregator.js';

describe('Metrics Modules (Stories 3.4-3.10)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-metrics-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    /**
     * Create a test image with specific characteristics
     */
    async function createTestImage(
        filepath: string,
        size: number = 128,
        fillColor: { r: number; g: number; b: number; a: number } = { r: 128, g: 64, b: 192, a: 255 }
    ): Promise<void> {
        const data = Buffer.alloc(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                if (x >= 32 && x < 96 && y >= 32 && y < 96) {
                    data[idx] = fillColor.r;
                    data[idx + 1] = fillColor.g;
                    data[idx + 2] = fillColor.b;
                    data[idx + 3] = fillColor.a;
                } else {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0;
                }
            }
        }
        await sharp(data, { raw: { width: size, height: size, channels: 4 } })
            .png()
            .toFile(filepath);
    }

    // ======================================
    // Story 3.4: SSIM Calculator Tests
    // ======================================
    describe('SSIM Calculator (Story 3.4)', () => {
        it('should return high SSIM for identical images', async () => {
            const img1 = join(testDir, 'ssim_a.png');
            const img2 = join(testDir, 'ssim_b.png');
            await createTestImage(img1);
            await createTestImage(img2);

            const result = await calculateSSIM(img1, img2);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.score).toBeGreaterThanOrEqual(0.99);
                expect(result.value.passed).toBe(true);
            }
        });

        it('should return lower SSIM for different images', async () => {
            const img1 = join(testDir, 'ssim_diff_a.png');
            const img2 = join(testDir, 'ssim_diff_b.png');
            await createTestImage(img1, 128, { r: 255, g: 0, b: 0, a: 255 });
            await createTestImage(img2, 128, { r: 0, g: 0, b: 255, a: 255 });

            const result = await calculateSSIM(img1, img2);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.score).toBeLessThan(1.0);
            }
        });

        it('should reject dimension mismatch', async () => {
            const img1 = join(testDir, 'ssim_size_a.png');
            const img2 = join(testDir, 'ssim_size_b.png');
            await createTestImage(img1, 128);
            await createTestImage(img2, 64);

            const result = await calculateSSIM(img1, img2);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('SSIM_DIMENSION_MISMATCH');
            }
        });
    });

    // ======================================
    // Story 3.5: Palette Fidelity Tests
    // ======================================
    describe('Palette Fidelity (Story 3.5)', () => {
        it('should detect perfect palette match', async () => {
            const img = join(testDir, 'palette_match.png');
            await createTestImage(img, 128, { r: 128, g: 64, b: 192, a: 255 });

            const palette = ['#8040C0']; // Same color
            const result = await calculatePaletteFidelity(img, palette);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.fidelity_score).toBeGreaterThan(0.9);
                expect(result.value.passed).toBe(true);
            }
        });

        it('should detect off-palette colors', async () => {
            const img = join(testDir, 'palette_off.png');
            await createTestImage(img, 128, { r: 255, g: 0, b: 0, a: 255 });

            const palette = ['#00FF00', '#0000FF']; // Different colors
            const result = await calculatePaletteFidelity(img, palette, 0.90, 10);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.off_palette_colors.length).toBeGreaterThan(0);
            }
        });

        it('should extract dominant colors', async () => {
            const img = join(testDir, 'palette_extract.png');
            await createTestImage(img);

            const result = await extractDominantColors(img);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.length).toBeGreaterThan(0);
            }
        });

        it('should reject empty palette', async () => {
            const img = join(testDir, 'palette_empty.png');
            await createTestImage(img);

            const result = await calculatePaletteFidelity(img, []);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('PALETTE_EMPTY');
            }
        });
    });

    // ======================================
    // Story 3.6: Alpha Artifact Detection Tests
    // ======================================
    describe('Alpha Artifact Detection (Story 3.6)', () => {
        it('should pass clean image', async () => {
            const img = join(testDir, 'alpha_clean.png');
            await createTestImage(img);

            const result = await detectAlphaArtifacts(img);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.passed).toBe(true);
            }
        });

        it('should detect halo artifacts', async () => {
            // Create image with semi-transparent edge
            const size = 64;
            const data = Buffer.alloc(size * size * 4);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;
                    const dist = Math.sqrt((x - size / 2) ** 2 + (y - size / 2) ** 2);
                    if (dist < 20) {
                        data[idx] = 128;
                        data[idx + 1] = 64;
                        data[idx + 2] = 192;
                        data[idx + 3] = 255;
                    } else if (dist < 24) {
                        // Semi-transparent halo
                        data[idx] = 128;
                        data[idx + 1] = 64;
                        data[idx + 2] = 192;
                        data[idx + 3] = 128;
                    } else {
                        data[idx + 3] = 0;
                    }
                }
            }
            const img = join(testDir, 'alpha_halo.png');
            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(img);

            const result = await detectAlphaArtifacts(img);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.halo_detected).toBe(true);
            }
        });
    });

    // ======================================
    // Story 3.10: Orphan Pixel Detection Tests
    // ======================================
    describe('Orphan Pixel Detection (Story 3.10)', () => {
        it('should pass image with no orphan pixels', async () => {
            const img = join(testDir, 'orphan_clean.png');
            await createTestImage(img);

            const result = await detectOrphanPixels(img);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.classification).toBe('pass');
                expect(result.value.passed).toBe(true);
            }
        });

        it('should detect orphan pixels', async () => {
            // Create image with isolated pixels
            const size = 64;
            const data = Buffer.alloc(size * size * 4);
            // Add some isolated single pixels
            const orphanPositions = [[10, 10], [20, 20], [30, 30], [40, 40], [50, 50],
            [10, 50], [20, 40], [30, 20], [40, 10], [50, 30],
            [15, 15], [25, 25], [35, 35], [45, 45], [55, 55],
            [5, 5], [7, 7], [9, 9], [11, 11], [13, 13]];
            for (const [x, y] of orphanPositions) {
                const idx = (y * size + x) * 4;
                data[idx] = 255;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 255;
            }
            const img = join(testDir, 'orphan_many.png');
            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(img);

            const result = await detectOrphanPixels(img);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.orphan_count).toBeGreaterThan(5);
            }
        });
    });

    // ======================================
    // Story 3.8: MAPD Calculator Tests
    // ======================================
    describe('MAPD Calculator (Story 3.8)', () => {
        it('should return low MAPD for similar frames', async () => {
            const frame1 = join(testDir, 'mapd_a.png');
            const frame2 = join(testDir, 'mapd_b.png');
            await createTestImage(frame1);
            await createTestImage(frame2);

            const result = await calculateMAPD(frame1, frame2, 'idle');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.mapd_score).toBeLessThan(0.05);
                expect(result.value.passed).toBe(true);
            }
        });

        it('should bypass for high-motion moves', async () => {
            const frame1 = join(testDir, 'mapd_attack_a.png');
            const frame2 = join(testDir, 'mapd_attack_b.png');
            await createTestImage(frame1, 128, { r: 255, g: 0, b: 0, a: 255 });
            await createTestImage(frame2, 128, { r: 0, g: 0, b: 255, a: 255 });

            const result = await calculateMAPD(frame1, frame2, 'attack');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.bypassed).toBe(true);
                expect(result.value.passed).toBe(true);
            }
        });
    });

    // ======================================
    // Story 3.8: Soft Metric Aggregator Tests
    // ======================================
    describe('Soft Metric Aggregator (Story 3.8)', () => {
        it('should calculate composite score correctly', () => {
            const result = calculateCompositeScore({
                stability: 0.9,
                identity: 0.85,
                palette: 0.95,
                style: 0.8,
            });

            expect(result.composite_score).toBeGreaterThan(0.8);
            expect(result.passed).toBe(true);
        });

        it('should flag retry for low scores', () => {
            const result = calculateCompositeScore({
                stability: 0.5,
                identity: 0.5,
                palette: 0.5,
                style: 0.5,
            });

            expect(result.composite_score).toBe(0.5);
            expect(result.passed).toBe(false);
            expect(result.should_retry).toBe(true);
        });

        it('should handle partial metrics', () => {
            const result = calculateCompositeScore({
                identity: 0.9,
            });

            expect(result.composite_score).toBeCloseTo(0.9);
            expect(result.metrics_provided).toContain('identity');
            expect(result.metrics_provided.length).toBe(1);
        });
    });
});
