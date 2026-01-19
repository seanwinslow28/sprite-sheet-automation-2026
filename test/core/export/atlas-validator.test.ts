/**
 * Tests for Atlas Validator
 * Story 5.3: Phaser-Compatible Atlas Output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import {
    validateAtlasJson,
    validateAtlasPng,
    validateAtlas,
    isMultipackAtlas,
    getAtlasFrameCount,
} from '../../../src/core/export/atlas-validator.js';
import {
    isValidFrameKey,
    validateFrameKeys,
    FRAME_KEY_PATTERN,
} from '../../../src/domain/schemas/atlas.js';

describe('Atlas Validator (Story 5.3)', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    // Create a valid atlas JSON for testing
    function createValidAtlasJson() {
        return {
            frames: {
                'idle/0000': {
                    frame: { x: 0, y: 0, w: 128, h: 128 },
                    rotated: false,
                    trimmed: true,
                    spriteSourceSize: { x: 10, y: 5, w: 108, h: 118 },
                    sourceSize: { w: 128, h: 128 },
                },
                'idle/0001': {
                    frame: { x: 128, y: 0, w: 128, h: 128 },
                    rotated: false,
                    trimmed: true,
                    spriteSourceSize: { x: 12, y: 5, w: 104, h: 118 },
                    sourceSize: { w: 128, h: 128 },
                },
            },
            meta: {
                app: 'https://www.codeandweb.com/texturepacker',
                version: '1.0',
                image: 'test_idle.png',
                format: 'RGBA8888',
                size: { w: 256, h: 128 },
                scale: '1',
            },
        };
    }

    // Create a valid multipack atlas JSON
    function createValidMultipackJson() {
        return {
            textures: [
                {
                    image: 'test_idle-0.png',
                    format: 'RGBA8888',
                    size: { w: 256, h: 256 },
                    scale: '1',
                    frames: {
                        'idle/0000': {
                            frame: { x: 0, y: 0, w: 128, h: 128 },
                            rotated: false,
                            trimmed: false,
                            spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                            sourceSize: { w: 128, h: 128 },
                        },
                    },
                },
                {
                    image: 'test_idle-1.png',
                    format: 'RGBA8888',
                    size: { w: 256, h: 256 },
                    scale: '1',
                    frames: {
                        'idle/0001': {
                            frame: { x: 0, y: 0, w: 128, h: 128 },
                            rotated: false,
                            trimmed: false,
                            spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                            sourceSize: { w: 128, h: 128 },
                        },
                    },
                },
            ],
            meta: {
                app: 'https://www.codeandweb.com/texturepacker',
                version: '1.0',
            },
        };
    }

    // Create a test PNG
    async function createTestPng(
        filePath: string,
        width: number,
        height: number
    ): Promise<void> {
        const buffer = Buffer.alloc(width * height * 4, 128);
        await sharp(buffer, {
            raw: { width, height, channels: 4 },
        })
            .png()
            .toFile(filePath);
    }

    describe('Frame Key Validation', () => {
        it('should accept valid frame keys', () => {
            expect(isValidFrameKey('idle/0000')).toBe(true);
            expect(isValidFrameKey('walk/0010')).toBe(true);
            expect(isValidFrameKey('attack_heavy/0100')).toBe(true);
            expect(isValidFrameKey('special_move_combo/9999')).toBe(true);
        });

        it('should reject invalid frame keys', () => {
            expect(isValidFrameKey('idle-0000')).toBe(false); // wrong separator
            expect(isValidFrameKey('idle/000')).toBe(false); // 3 digits
            expect(isValidFrameKey('idle/00000')).toBe(false); // 5 digits
            expect(isValidFrameKey('Idle/0000')).toBe(false); // uppercase
            expect(isValidFrameKey('idle_0000')).toBe(false); // underscore separator
            expect(isValidFrameKey('')).toBe(false);
        });

        it('should validate array of frame keys', () => {
            const valid = validateFrameKeys(['idle/0000', 'idle/0001', 'walk/0000']);
            expect(valid.valid).toBe(true);
            expect(valid.invalidKeys).toEqual([]);

            const invalid = validateFrameKeys(['idle/0000', 'bad-key', 'walk/0000']);
            expect(invalid.valid).toBe(false);
            expect(invalid.invalidKeys).toContain('bad-key');
        });
    });

    describe('validateAtlasJson', () => {
        it('should validate correct atlas JSON', async () => {
            const jsonPath = path.join(tempDir, 'valid.json');
            await fs.writeFile(jsonPath, JSON.stringify(createValidAtlasJson()));

            const result = await validateAtlasJson(jsonPath);

            expect(result.passed).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.details?.frameCount).toBe(2);
        });

        it('should fail for missing file', async () => {
            const result = await validateAtlasJson('/nonexistent/path.json');

            expect(result.passed).toBe(false);
            expect(result.errors[0]).toContain('not found');
        });

        it('should fail for invalid JSON', async () => {
            const jsonPath = path.join(tempDir, 'invalid.json');
            await fs.writeFile(jsonPath, 'not valid json');

            const result = await validateAtlasJson(jsonPath);

            expect(result.passed).toBe(false);
            expect(result.errors[0]).toContain('Failed to read/parse');
        });

        it('should fail for wrong format', async () => {
            const jsonPath = path.join(tempDir, 'wrong.json');
            const wrongFormat = { ...createValidAtlasJson() };
            wrongFormat.meta.format = 'RGB888' as any;
            await fs.writeFile(jsonPath, JSON.stringify(wrongFormat));

            const result = await validateAtlasJson(jsonPath);

            expect(result.passed).toBe(false);
        });

        it('should fail for invalid frame keys', async () => {
            const jsonPath = path.join(tempDir, 'badkeys.json');
            const atlas = createValidAtlasJson();
            (atlas.frames as any)['bad-key'] = atlas.frames['idle/0000'];
            await fs.writeFile(jsonPath, JSON.stringify(atlas));

            const result = await validateAtlasJson(jsonPath);

            expect(result.passed).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid frame key'))).toBe(true);
        });

        it('should validate multipack format', async () => {
            const jsonPath = path.join(tempDir, 'multipack.json');
            await fs.writeFile(jsonPath, JSON.stringify(createValidMultipackJson()));

            const result = await validateAtlasJson(jsonPath);

            expect(result.passed).toBe(true);
            expect(result.details?.format).toBe('multipack');
            expect(result.details?.textureCount).toBe(2);
        });
    });

    describe('validateAtlasPng', () => {
        it('should validate correct PNG', async () => {
            const pngPath = path.join(tempDir, 'valid.png');
            await createTestPng(pngPath, 256, 128);

            const result = await validateAtlasPng(pngPath);

            expect(result.passed).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should fail for missing file', async () => {
            const result = await validateAtlasPng('/nonexistent/path.png');

            expect(result.passed).toBe(false);
            expect(result.errors[0]).toContain('not found');
        });

        it('should fail for dimension mismatch', async () => {
            const pngPath = path.join(tempDir, 'mismatch.png');
            await createTestPng(pngPath, 256, 128);

            const result = await validateAtlasPng(pngPath, { w: 512, h: 256 });

            expect(result.passed).toBe(false);
            expect(result.errors[0]).toContain('Dimensions mismatch');
        });

        it('should pass with matching dimensions', async () => {
            const pngPath = path.join(tempDir, 'match.png');
            await createTestPng(pngPath, 256, 128);

            const result = await validateAtlasPng(pngPath, { w: 256, h: 128 });

            expect(result.passed).toBe(true);
        });
    });

    describe('validateAtlas', () => {
        it('should validate both JSON and PNG', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            const pngPath = path.join(tempDir, 'atlas.png');

            await fs.writeFile(jsonPath, JSON.stringify(createValidAtlasJson()));
            await createTestPng(pngPath, 256, 128);

            const result = await validateAtlas(jsonPath, pngPath);

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.jsonValid).toBe(true);
                expect(report.pngValid).toBe(true);
                expect(report.frameCount).toBe(2);
            }
        });
    });

    describe('isMultipackAtlas', () => {
        it('should detect multipack format', async () => {
            const multipackPath = path.join(tempDir, 'multipack.json');
            await fs.writeFile(multipackPath, JSON.stringify(createValidMultipackJson()));

            expect(await isMultipackAtlas(multipackPath)).toBe(true);
        });

        it('should detect standard format', async () => {
            const standardPath = path.join(tempDir, 'standard.json');
            await fs.writeFile(standardPath, JSON.stringify(createValidAtlasJson()));

            expect(await isMultipackAtlas(standardPath)).toBe(false);
        });

        it('should return false for invalid file', async () => {
            expect(await isMultipackAtlas('/nonexistent.json')).toBe(false);
        });
    });

    describe('getAtlasFrameCount', () => {
        it('should count frames in standard atlas', async () => {
            const jsonPath = path.join(tempDir, 'standard.json');
            await fs.writeFile(jsonPath, JSON.stringify(createValidAtlasJson()));

            expect(await getAtlasFrameCount(jsonPath)).toBe(2);
        });

        it('should count frames in multipack atlas', async () => {
            const jsonPath = path.join(tempDir, 'multipack.json');
            await fs.writeFile(jsonPath, JSON.stringify(createValidMultipackJson()));

            expect(await getAtlasFrameCount(jsonPath)).toBe(2);
        });

        it('should return 0 for invalid file', async () => {
            expect(await getAtlasFrameCount('/nonexistent.json')).toBe(0);
        });
    });
});
