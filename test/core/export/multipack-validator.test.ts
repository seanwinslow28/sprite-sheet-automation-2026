/**
 * Tests for Multipack Validator
 * Story 5.4: Implement Multipack Support for Large Atlases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import {
    detectMultipack,
    validateMultipack,
    getMultipackFrameKeys,
    getSheetCount,
} from '../../../src/core/export/multipack-validator.js';

describe('Multipack Validator (Story 5.4)', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multipack-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    // Create a test PNG
    async function createTestPng(filePath: string): Promise<void> {
        const buffer = Buffer.alloc(256 * 256 * 4, 128);
        await sharp(buffer, {
            raw: { width: 256, height: 256, channels: 4 },
        })
            .png()
            .toFile(filePath);
    }

    // Create a valid single atlas JSON
    function createSingleAtlasJson(frameCount: number, moveId: string = 'idle') {
        const frames: Record<string, unknown> = {};
        for (let i = 0; i < frameCount; i++) {
            frames[`${moveId}/${i.toString().padStart(4, '0')}`] = {
                frame: { x: i * 128, y: 0, w: 128, h: 128 },
                rotated: false,
                trimmed: false,
                spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                sourceSize: { w: 128, h: 128 },
            };
        }
        return {
            frames,
            meta: {
                app: 'TexturePacker',
                version: '1.0',
                image: 'test_atlas.png',
                format: 'RGBA8888',
                size: { w: 512, h: 256 },
                scale: '1',
            },
        };
    }

    // Create a valid multipack atlas JSON
    function createMultipackAtlasJson(
        sheetCount: number,
        framesPerSheet: number,
        moveId: string = 'idle',
        baseName: string = 'test_atlas'
    ) {
        const textures = [];
        let frameIndex = 0;

        for (let s = 0; s < sheetCount; s++) {
            const frames: Record<string, unknown> = {};
            for (let f = 0; f < framesPerSheet; f++) {
                frames[`${moveId}/${frameIndex.toString().padStart(4, '0')}`] = {
                    frame: { x: f * 128, y: 0, w: 128, h: 128 },
                    rotated: false,
                    trimmed: false,
                    spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                    sourceSize: { w: 128, h: 128 },
                };
                frameIndex++;
            }
            textures.push({
                image: `${baseName}-${s}.png`,
                format: 'RGBA8888',
                size: { w: 2048, h: 2048 },
                scale: '1',
                frames,
            });
        }

        return {
            textures,
            meta: {
                app: 'TexturePacker',
                version: '1.0',
            },
        };
    }

    describe('detectMultipack', () => {
        it('should detect single atlas', async () => {
            await createTestPng(path.join(tempDir, 'atlas.png'));

            const result = await detectMultipack(tempDir, 'atlas');

            expect(result.isMultipack).toBe(false);
            expect(result.sheets.length).toBe(1);
            expect(result.sheets[0].pngExists).toBe(true);
        });

        it('should detect multipack atlas', async () => {
            await createTestPng(path.join(tempDir, 'atlas-0.png'));
            await createTestPng(path.join(tempDir, 'atlas-1.png'));
            await createTestPng(path.join(tempDir, 'atlas-2.png'));

            const result = await detectMultipack(tempDir, 'atlas');

            expect(result.isMultipack).toBe(true);
            expect(result.sheets.length).toBe(3);
            expect(result.sheets.every(s => s.pngExists)).toBe(true);
        });

        it('should handle missing files', async () => {
            const result = await detectMultipack(tempDir, 'nonexistent');

            expect(result.isMultipack).toBe(false);
            expect(result.sheets.length).toBe(0);
        });
    });

    describe('validateMultipack', () => {
        it('should validate single atlas format', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            const pngPath = path.join(tempDir, 'test_atlas.png');

            await fs.writeFile(jsonPath, JSON.stringify(createSingleAtlasJson(4, 'idle')));
            await createTestPng(pngPath);

            const result = await validateMultipack(jsonPath, 4, 'idle');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(true);
                expect(report.isMultipack).toBe(false);
                expect(report.totalFrames).toBe(4);
                expect(report.sheets.length).toBe(1);
            }
        });

        it('should validate multipack atlas format', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');

            // Create multipack JSON with 2 sheets, 3 frames each
            await fs.writeFile(
                jsonPath,
                JSON.stringify(createMultipackAtlasJson(2, 3, 'walk', 'atlas'))
            );

            // Create the PNG files
            await createTestPng(path.join(tempDir, 'atlas-0.png'));
            await createTestPng(path.join(tempDir, 'atlas-1.png'));

            const result = await validateMultipack(jsonPath, 6, 'walk');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(true);
                expect(report.isMultipack).toBe(true);
                expect(report.totalFrames).toBe(6);
                expect(report.sheets.length).toBe(2);
            }
        });

        it('should fail for missing JSON', async () => {
            const result = await validateMultipack('/nonexistent.json', 4, 'idle');

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('HF_ATLAS_FORMAT');
            }
        });

        it('should fail for wrong frame count', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            const pngPath = path.join(tempDir, 'test_atlas.png');

            await fs.writeFile(jsonPath, JSON.stringify(createSingleAtlasJson(4, 'idle')));
            await createTestPng(pngPath);

            // Expect 8 frames but only 4 exist
            const result = await validateMultipack(jsonPath, 8, 'idle');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.errors.some(e => e.includes('Expected 8 frames'))).toBe(true);
            }
        });

        it('should fail for missing PNG in multipack', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');

            // Create multipack JSON but only one PNG
            await fs.writeFile(
                jsonPath,
                JSON.stringify(createMultipackAtlasJson(2, 3, 'idle', 'atlas'))
            );
            await createTestPng(path.join(tempDir, 'atlas-0.png'));
            // Missing atlas-1.png

            const result = await validateMultipack(jsonPath, 6, 'idle');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.errors.some(e => e.includes('Missing PNG'))).toBe(true);
            }
        });

        it('should fail for invalid frame keys', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            const pngPath = path.join(tempDir, 'test_atlas.png');

            // Create atlas with wrong move ID in keys
            await fs.writeFile(jsonPath, JSON.stringify(createSingleAtlasJson(4, 'walk')));
            await createTestPng(pngPath);

            // Validate expecting 'idle' keys but got 'walk'
            const result = await validateMultipack(jsonPath, 4, 'idle');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.errors.some(e => e.includes('Invalid frame keys'))).toBe(true);
            }
        });

        it('should fail for missing textures array', async () => {
            const jsonPath = path.join(tempDir, 'invalid.json');
            await fs.writeFile(jsonPath, JSON.stringify({ invalid: 'structure' }));

            const result = await validateMultipack(jsonPath, 4, 'idle');

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('HF_ATLAS_FORMAT');
                expect(result.unwrapErr().message).toContain('textures');
            }
        });
    });

    describe('getMultipackFrameKeys', () => {
        it('should get keys from single atlas', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            await fs.writeFile(jsonPath, JSON.stringify(createSingleAtlasJson(4, 'idle')));

            const keys = await getMultipackFrameKeys(jsonPath);

            expect(keys.length).toBe(4);
            expect(keys).toContain('idle/0000');
            expect(keys).toContain('idle/0003');
        });

        it('should get keys from multipack atlas', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            await fs.writeFile(
                jsonPath,
                JSON.stringify(createMultipackAtlasJson(2, 3, 'walk', 'atlas'))
            );

            const keys = await getMultipackFrameKeys(jsonPath);

            expect(keys.length).toBe(6);
            expect(keys).toContain('walk/0000');
            expect(keys).toContain('walk/0005');
        });

        it('should return empty array for invalid file', async () => {
            const keys = await getMultipackFrameKeys('/nonexistent.json');
            expect(keys).toEqual([]);
        });
    });

    describe('getSheetCount', () => {
        it('should return 1 for single atlas', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            await fs.writeFile(jsonPath, JSON.stringify(createSingleAtlasJson(4, 'idle')));

            expect(await getSheetCount(jsonPath)).toBe(1);
        });

        it('should return sheet count for multipack', async () => {
            const jsonPath = path.join(tempDir, 'atlas.json');
            await fs.writeFile(
                jsonPath,
                JSON.stringify(createMultipackAtlasJson(3, 2, 'idle', 'atlas'))
            );

            expect(await getSheetCount(jsonPath)).toBe(3);
        });

        it('should return 0 for invalid file', async () => {
            expect(await getSheetCount('/nonexistent.json')).toBe(0);
        });
    });
});
