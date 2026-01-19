/**
 * Tests for anchor analyzer (Story 2.7)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { analyzeAnchor, saveAnchorAnalysis, analyzeFrame } from '../../src/core/anchor-analyzer.js';

describe('Anchor Analyzer (Story 2.7)', () => {
    let testDir: string;
    let testImagePath: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-anchor-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        testImagePath = join(testDir, 'test-anchor.png');
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    /**
     * Create a test image with a specific pattern
     */
    async function createTestImage(
        width: number,
        height: number,
        spriteRect: { x: number; y: number; w: number; h: number }
    ): Promise<void> {
        // Create transparent canvas
        const channels = 4;
        const data = Buffer.alloc(width * height * channels, 0);

        // Draw opaque sprite in the given rectangle
        for (let y = spriteRect.y; y < spriteRect.y + spriteRect.h; y++) {
            for (let x = spriteRect.x; x < spriteRect.x + spriteRect.w; x++) {
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    const idx = (y * width + x) * channels;
                    data[idx] = 255;     // R
                    data[idx + 1] = 128; // G
                    data[idx + 2] = 64;  // B
                    data[idx + 3] = 255; // A (opaque)
                }
            }
        }

        await sharp(data, { raw: { width, height, channels } })
            .png()
            .toFile(testImagePath);
    }

    describe('AC #1: Alpha threshold filtering', () => {
        it('should detect opaque pixels above threshold', async () => {
            await createTestImage(128, 128, { x: 32, y: 32, w: 64, h: 64 });
            const result = await analyzeAnchor(testImagePath);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.alpha_threshold).toBe(128);
            }
        });
    });

    describe('AC #2: baselineY extraction', () => {
        it('should find bottommost opaque pixel', async () => {
            // Sprite from y=20 to y=79 (60px tall)
            await createTestImage(128, 128, { x: 32, y: 20, w: 64, h: 60 });
            const result = await analyzeAnchor(testImagePath);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.results.baselineY).toBe(79); // y=20 + h=60 - 1
            }
        });
    });

    describe('AC #3: rootX calculation', () => {
        it('should calculate X-centroid of root zone', async () => {
            // Centered sprite: x=32 to x=95 (64px wide)
            await createTestImage(128, 128, { x: 32, y: 32, w: 64, h: 64 });
            const result = await analyzeAnchor(testImagePath);

            expect(result.ok).toBe(true);
            if (result.ok) {
                // Root zone centroid should be near center of sprite
                // Sprite center X = 32 + 64/2 = 64
                expect(result.value.results.rootX).toBeGreaterThan(55);
                expect(result.value.results.rootX).toBeLessThan(72);
            }
        });
    });

    describe('AC #4: Root zone ratio', () => {
        it('should use 15% of visible height for root zone', async () => {
            await createTestImage(128, 128, { x: 32, y: 28, w: 64, h: 72 });
            const result = await analyzeAnchor(testImagePath, 0.15);

            expect(result.ok).toBe(true);
            if (result.ok) {
                const visibleHeight = result.value.results.visible_height;
                const rootZoneHeight = result.value.results.root_zone.height;
                // Root zone should be ~15% of visible height
                expect(rootZoneHeight).toBe(Math.ceil(visibleHeight * 0.15));
            }
        });
    });

    describe('AC #5: Error handling', () => {
        it('should return error for fully transparent image', async () => {
            // Create fully transparent image
            const data = Buffer.alloc(128 * 128 * 4, 0);
            await sharp(data, { raw: { width: 128, height: 128, channels: 4 } })
                .png()
                .toFile(testImagePath);

            const result = await analyzeAnchor(testImagePath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('ANCHOR_FULLY_TRANSPARENT');
            }
        });

        it('should return error for non-existent file', async () => {
            const result = await analyzeAnchor('/nonexistent/path.png');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('ANCHOR_LOAD_FAILED');
            }
        });
    });

    describe('saveAnchorAnalysis', () => {
        it('should save analysis to JSON file', async () => {
            await createTestImage(128, 128, { x: 32, y: 32, w: 64, h: 64 });
            const analyzeResult = await analyzeAnchor(testImagePath);
            expect(analyzeResult.ok).toBe(true);

            if (analyzeResult.ok) {
                const outputPath = join(testDir, 'anchor_analysis.json');
                const saveResult = await saveAnchorAnalysis(analyzeResult.value, outputPath);
                expect(saveResult.ok).toBe(true);

                // Verify file was written
                const content = await fs.readFile(outputPath, 'utf-8');
                const parsed = JSON.parse(content);
                expect(parsed.results.baselineY).toBeDefined();
                expect(parsed.results.rootX).toBeDefined();
            }
        });
    });

    describe('analyzeFrame', () => {
        it('should reuse anchor analysis for frame analysis', async () => {
            await createTestImage(128, 128, { x: 32, y: 32, w: 64, h: 64 });
            const result = await analyzeFrame(testImagePath);
            expect(result.ok).toBe(true);
        });
    });
});
