/**
 * Tests for Post-Export Validator
 * Story 5.6: Implement Post-Export Validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import {
    runPostExportValidation,
    savePostExportValidationResult,
} from '../../../src/core/export/post-export-validator.js';
import type { Manifest } from '../../../src/domain/schemas/manifest.js';
import type { AtlasPaths } from '../../../src/core/export/atlas-exporter.js';

describe('Post-Export Validator (Story 5.6)', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'postexport-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    // Create minimal manifest
    function createManifest(frameCount: number = 4, move: string = 'idle'): Manifest {
        return {
            identity: {
                character: 'test',
                move,
                version: '1.0.0',
                frame_count: frameCount,
                is_loop: false,
            },
            inputs: { anchor: 'anchor.png' },
            generator: {
                backend: 'gemini',
                model: 'gemini-2.0',
                mode: 'edit',
                seed_policy: 'fixed',
                max_attempts_per_frame: 4,
                prompts: { master: '', variation: '', lock: '', negative: '' },
            },
            canvas: {
                generation_size: 512,
                target_size: 128,
                downsample_method: 'nearest',
                alignment: { method: 'contact_patch', vertical_lock: true, root_zone_ratio: 0.15, max_shift_x: 32 },
            },
            auditor: { hard_gates: {}, soft_metrics: {}, weights: {} },
            retry: { ladder: [], stop_conditions: {} },
            export: { packer_flags: [], atlas_format: 'phaser' },
        } as Manifest;
    }

    // Create valid atlas JSON
    function createValidAtlasJson(frameCount: number, move: string) {
        const frames: Record<string, unknown> = {};
        for (let i = 0; i < frameCount; i++) {
            frames[`${move}/${i.toString().padStart(4, '0')}`] = {
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
                image: 'atlas.png',
                format: 'RGBA8888',
                size: { w: frameCount * 128, h: 128 },
                scale: '1',
            },
        };
    }

    // Create minimal multipack JSON
    function createMultipackJson(move: string) {
        return {
            textures: [
                {
                    image: 'atlas-0.png',
                    size: { w: 256, h: 128 },
                    format: 'RGBA8888',
                    frames: {
                        [`${move}/0000`]: {
                            frame: { x: 0, y: 0, w: 128, h: 128 },
                            rotated: false,
                            trimmed: false,
                            spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                            sourceSize: { w: 128, h: 128 },
                        },
                    },
                },
                {
                    image: 'atlas-1.png',
                    size: { w: 256, h: 128 },
                    format: 'RGBA8888',
                    frames: {
                        [`${move}/0001`]: {
                            frame: { x: 0, y: 0, w: 128, h: 128 },
                            rotated: false,
                            trimmed: false,
                            spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
                            sourceSize: { w: 128, h: 128 },
                        },
                    },
                },
            ],
        };
    }

    // Create test PNG
    async function createTestPng(filePath: string, width: number, height: number): Promise<void> {
        const buffer = Buffer.alloc(width * height * 4, 128);
        await sharp(buffer, { raw: { width, height, channels: 4 } })
            .png()
            .toFile(filePath);
    }

    describe('runPostExportValidation', () => {
        it('should pass for valid atlas', async () => {
            const manifest = createManifest(4, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, JSON.stringify(createValidAtlasJson(4, 'idle')));
            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(true);
                expect(report.checks.jsonStructure.passed).toBe(true);
                expect(report.checks.frameCount.passed).toBe(true);
                expect(report.checks.frameKeys.passed).toBe(true);
                expect(report.checks.pngIntegrity.passed).toBe(true);
                expect(report.checks.boundsCheck.passed).toBe(true);
                expect(report.summary.issues).toEqual([]);
            }
        });

        it('should fail for missing JSON', async () => {
            const manifest = createManifest(4, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'missing.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.jsonStructure.passed).toBe(false);
            }
        });

        it('should fail for invalid JSON', async () => {
            const manifest = createManifest(4, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, 'not valid json');
            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.jsonStructure.passed).toBe(false);
                expect(report.checks.jsonStructure.message).toContain('parse error');
            }
        });

        it('should fail for wrong frame count', async () => {
            const manifest = createManifest(8, 'idle'); // Expect 8 frames
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            // Only create 4 frames
            await fs.writeFile(atlasPaths.json, JSON.stringify(createValidAtlasJson(4, 'idle')));
            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.frameCount.passed).toBe(false);
                expect(report.checks.frameCount.message).toContain('Expected 8');
            }
        });

        it('should fail for invalid frame keys', async () => {
            const manifest = createManifest(4, 'walk'); // Expect 'walk' keys
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            // Create with 'idle' keys instead
            await fs.writeFile(atlasPaths.json, JSON.stringify(createValidAtlasJson(4, 'idle')));
            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.frameKeys.passed).toBe(false);
            }
        });

        it('should fail for PNG dimension mismatch', async () => {
            const manifest = createManifest(4, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, JSON.stringify(createValidAtlasJson(4, 'idle')));
            // Create wrong size PNG
            await createTestPng(atlasPaths.png, 256, 256);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.pngIntegrity.passed).toBe(false);
            }
        });

        it('should provide structured result with all checks', async () => {
            const manifest = createManifest(4, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas.png'),
                pngPaths: [path.join(tempDir, 'atlas.png')],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, JSON.stringify(createValidAtlasJson(4, 'idle')));
            await createTestPng(atlasPaths.png, 512, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.atlasPath).toBe(atlasPaths.json);
                expect(report.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
                expect(report.summary.totalFrames).toBe(4);
                expect(report.summary.validFrames).toBe(4);
            }
        });

        it('should pass for valid multipack atlas', async () => {
            const manifest = createManifest(2, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas-0.png'),
                pngPaths: [
                    path.join(tempDir, 'atlas-0.png'),
                    path.join(tempDir, 'atlas-1.png'),
                ],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, JSON.stringify(createMultipackJson('idle')));
            await createTestPng(path.join(tempDir, 'atlas-0.png'), 256, 128);
            await createTestPng(path.join(tempDir, 'atlas-1.png'), 256, 128);

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(true);
                expect(report.checks.pngIntegrity.passed).toBe(true);
                expect(report.checks.boundsCheck.passed).toBe(true);
            }
        });

        it('should fail when a multipack sheet is missing', async () => {
            const manifest = createManifest(2, 'idle');
            const atlasPaths: AtlasPaths = {
                json: path.join(tempDir, 'atlas.json'),
                png: path.join(tempDir, 'atlas-0.png'),
                pngPaths: [
                    path.join(tempDir, 'atlas-0.png'),
                    path.join(tempDir, 'atlas-1.png'),
                ],
                name: 'atlas',
            };

            await fs.writeFile(atlasPaths.json, JSON.stringify(createMultipackJson('idle')));
            await createTestPng(path.join(tempDir, 'atlas-0.png'), 256, 128);
            // Intentionally skip atlas-1.png

            const result = await runPostExportValidation(atlasPaths, manifest, 'test-run');

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const report = result.unwrap();
                expect(report.passed).toBe(false);
                expect(report.checks.pngIntegrity.passed).toBe(false);
            }
        });
    });

    describe('savePostExportValidationResult', () => {
        it('should save result to correct path', async () => {
            const runsDir = path.join(tempDir, 'runs');
            const runId = 'test-run';
            await fs.mkdir(path.join(runsDir, runId), { recursive: true });

            const result = {
                passed: true,
                atlasPath: '/test/atlas.json',
                validatedAt: new Date().toISOString(),
                checks: {
                    jsonStructure: { passed: true },
                    frameCount: { passed: true, details: { expected: 4, found: 4 } },
                    frameKeys: { passed: true },
                    pngIntegrity: { passed: true },
                    boundsCheck: { passed: true },
                },
                summary: {
                    totalFrames: 4,
                    validFrames: 4,
                    issues: [],
                },
            };

            const saveResult = await savePostExportValidationResult(result, runsDir, runId);

            expect(saveResult.isOk()).toBe(true);
            if (saveResult.isOk()) {
                const savedPath = saveResult.unwrap();
                expect(savedPath).toBe(path.join(runsDir, runId, 'export_validation.json'));

                const content = await fs.readFile(savedPath, 'utf-8');
                const parsed = JSON.parse(content);
                expect(parsed.passed).toBe(true);
                expect(parsed.summary.total_frames).toBe(4);
            }
        });
    });
});
