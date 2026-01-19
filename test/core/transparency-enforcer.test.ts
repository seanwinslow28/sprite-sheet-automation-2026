/**
 * Tests for transparency enforcer and palette analyzer (Story 3.2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import {
    colorDistance,
    hexToRgb,
    rgbToHex,
    paletteContainsColor,
    analyzeAnchorPalette,
    CHROMA_CANDIDATES,
} from '../../src/utils/palette-analyzer.js';
import {
    enforceTransparency,
    isValidHexColor,
    type TransparencyConfig,
} from '../../src/core/transparency-enforcer.js';

describe('Palette Analyzer (Story 3.2)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-palette-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    describe('colorDistance', () => {
        it('should return 0 for identical colors', () => {
            const c1 = { r: 255, g: 128, b: 64 };
            expect(colorDistance(c1, c1)).toBe(0);
        });

        it('should calculate correct distance for different colors', () => {
            const white = { r: 255, g: 255, b: 255 };
            const black = { r: 0, g: 0, b: 0 };
            // Max distance is sqrt(255^2 * 3) ≈ 441.67
            expect(colorDistance(white, black)).toBeCloseTo(441.67, 1);
        });

        it('should calculate distance for similar colors', () => {
            const c1 = { r: 100, g: 100, b: 100 };
            const c2 = { r: 110, g: 100, b: 100 };
            expect(colorDistance(c1, c2)).toBe(10);
        });
    });

    describe('hexToRgb', () => {
        it('should parse valid hex colors', () => {
            expect(hexToRgb('#FF00FF')).toEqual({ r: 255, g: 0, b: 255 });
            expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should handle lowercase hex', () => {
            expect(hexToRgb('#ff00ff')).toEqual({ r: 255, g: 0, b: 255 });
        });
    });

    describe('rgbToHex', () => {
        it('should convert RGB to hex', () => {
            expect(rgbToHex({ r: 255, g: 0, b: 255 })).toBe('#FF00FF');
            expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00');
        });
    });

    describe('paletteContainsColor', () => {
        it('should find exact color match', () => {
            const palette = [
                { r: 255, g: 0, b: 0 },
                { r: 0, g: 255, b: 0 },
                { r: 0, g: 0, b: 255 },
            ];
            expect(paletteContainsColor(palette, { r: 0, g: 255, b: 0 })).toBe(true);
        });

        it('should find color within tolerance', () => {
            const palette = [{ r: 0, g: 250, b: 0 }];
            expect(paletteContainsColor(palette, { r: 0, g: 255, b: 0 }, 30)).toBe(true);
        });

        it('should not find color outside tolerance', () => {
            const palette = [{ r: 255, g: 0, b: 0 }];
            expect(paletteContainsColor(palette, { r: 0, g: 255, b: 0 }, 30)).toBe(false);
        });
    });

    describe('analyzeAnchorPalette', () => {
        async function createTestImage(filepath: string, colors: Array<{ r: number; g: number; b: number }>): Promise<void> {
            const size = 64;
            const data = Buffer.alloc(size * size * 4);

            for (let i = 0; i < size * size; i++) {
                const color = colors[i % colors.length];
                const idx = i * 4;
                data[idx] = color.r;
                data[idx + 1] = color.g;
                data[idx + 2] = color.b;
                data[idx + 3] = 255; // Opaque
            }

            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(filepath);
        }

        it('should select green when not in palette', async () => {
            const imagePath = join(testDir, 'no_green.png');
            await createTestImage(imagePath, [
                { r: 255, g: 0, b: 0 },     // Red
                { r: 0, g: 0, b: 255 },     // Blue
            ]);

            const analysis = await analyzeAnchorPalette(imagePath);

            expect(analysis.selected_chroma).toBe('#00FF00');
            expect(analysis.contains_green).toBe(false);
        });

        it('should select magenta when green is in palette', async () => {
            const imagePath = join(testDir, 'has_green.png');
            await createTestImage(imagePath, [
                { r: 0, g: 255, b: 0 },     // Green
                { r: 255, g: 0, b: 0 },     // Red
            ]);

            const analysis = await analyzeAnchorPalette(imagePath);

            expect(analysis.selected_chroma).toBe('#FF00FF');
            expect(analysis.contains_green).toBe(true);
        });

        it('should select cyan when green and magenta are in palette', async () => {
            const imagePath = join(testDir, 'has_green_magenta.png');
            await createTestImage(imagePath, [
                { r: 0, g: 255, b: 0 },     // Green
                { r: 255, g: 0, b: 255 },   // Magenta
            ]);

            const analysis = await analyzeAnchorPalette(imagePath);

            expect(analysis.selected_chroma).toBe('#00FFFF');
            expect(analysis.contains_green).toBe(true);
            expect(analysis.contains_magenta).toBe(true);
        });
    });
});

describe('Transparency Enforcer (Story 3.2)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-transparency-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    describe('isValidHexColor', () => {
        it('should validate proper hex colors', () => {
            expect(isValidHexColor('#FF00FF')).toBe(true);
            expect(isValidHexColor('#00ff00')).toBe(true);
            expect(isValidHexColor('#123ABC')).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(isValidHexColor('FF00FF')).toBe(false);
            expect(isValidHexColor('#FF00')).toBe(false);
            expect(isValidHexColor('#GGGGGG')).toBe(false);
        });
    });

    describe('enforceTransparency - true_alpha mode', () => {
        it('should pass image with valid alpha channel', async () => {
            const inputPath = join(testDir, 'with_alpha.png');
            const outputPath = join(testDir, 'output.png');

            // Create image with alpha
            const size = 64;
            const data = Buffer.alloc(size * size * 4);
            for (let i = 0; i < size * size; i++) {
                const idx = i * 4;
                data[idx] = 128;
                data[idx + 1] = 64;
                data[idx + 2] = 192;
                data[idx + 3] = i % 2 === 0 ? 255 : 0; // Alternating alpha
            }
            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(inputPath);

            const config: TransparencyConfig = { strategy: 'true_alpha' };
            const result = await enforceTransparency(inputPath, outputPath, config);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.strategy).toBe('true_alpha');
                expect(result.value.hadAlpha).toBe(true);
            }
        });

        it('should reject image without alpha channel', async () => {
            const inputPath = join(testDir, 'no_alpha.jpg');
            const outputPath = join(testDir, 'output.png');

            // Create RGB-only image (JPEG)
            const size = 64;
            const data = Buffer.alloc(size * size * 3);
            for (let i = 0; i < size * size * 3; i++) {
                data[i] = 128;
            }
            await sharp(data, { raw: { width: size, height: size, channels: 3 } })
                .jpeg()
                .toFile(inputPath);

            const config: TransparencyConfig = { strategy: 'true_alpha' };
            const result = await enforceTransparency(inputPath, outputPath, config);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('HF_NO_ALPHA');
            }
        });
    });

    describe('enforceTransparency - chroma_key mode', () => {
        it('should remove chroma key background', async () => {
            const inputPath = join(testDir, 'green_bg.png');
            const outputPath = join(testDir, 'output.png');

            // Create image with green background and red sprite
            const size = 64;
            const data = Buffer.alloc(size * size * 4);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;
                    // Center square is red (sprite), rest is green (background)
                    if (x >= 20 && x < 44 && y >= 20 && y < 44) {
                        data[idx] = 255;     // R
                        data[idx + 1] = 0;   // G
                        data[idx + 2] = 0;   // B
                    } else {
                        data[idx] = 0;       // R
                        data[idx + 1] = 255; // G (chroma)
                        data[idx + 2] = 0;   // B
                    }
                    data[idx + 3] = 255;     // A
                }
            }
            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(inputPath);

            const config: TransparencyConfig = {
                strategy: 'chroma_key',
                chroma_color: '#00FF00',
            };
            const result = await enforceTransparency(inputPath, outputPath, config);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.strategy).toBe('chroma_key');
                expect(result.value.chromaColor).toBe('#00FF00');
                expect(result.value.edgePixelsProcessed).toBeGreaterThan(0);

                // Verify output has transparent background
                const { data: outData, info } = await sharp(outputPath)
                    .raw()
                    .toBuffer({ resolveWithObject: true });

                // Check a background pixel (0,0) is now transparent
                expect(outData[3]).toBe(0); // Alpha should be 0
            }
        });

        it('should use explicit chroma color', async () => {
            const inputPath = join(testDir, 'magenta_bg.png');
            const outputPath = join(testDir, 'output.png');

            const size = 32;
            const data = Buffer.alloc(size * size * 4);
            for (let i = 0; i < size * size; i++) {
                const idx = i * 4;
                data[idx] = 255;     // R (magenta)
                data[idx + 1] = 0;   // G
                data[idx + 2] = 255; // B (magenta)
                data[idx + 3] = 255; // A
            }
            await sharp(data, { raw: { width: size, height: size, channels: 4 } })
                .png()
                .toFile(inputPath);

            const config: TransparencyConfig = {
                strategy: 'chroma_key',
                chroma_color: '#FF00FF',
            };
            const result = await enforceTransparency(inputPath, outputPath, config);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.chromaColor).toBe('#FF00FF');
            }
        });
    });
});
