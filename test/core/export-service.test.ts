/**
 * Tests for Export Service (Story 8.7)
 * AC #1-4: Export orchestration, atlas generation, Phaser validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'path';
import { tmpdir } from 'os';

import { ExportService, type ExportOptions, type ExportResult } from '../../src/core/export-service.js';
import type { Manifest } from '../../src/domain/schemas/manifest.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock atlas exporter
vi.mock('../../src/core/export/atlas-exporter.js', () => ({
    exportAtlas: vi.fn(),
}));

// Mock Phaser test harness
vi.mock('../../src/core/validation/phaser-test-harness.js', () => ({
    runPhaserMicroTests: vi.fn(),
}));

// Mock fs-helpers
vi.mock('../../src/utils/fs-helpers.js', () => ({
    pathExists: vi.fn(),
}));

import { exportAtlas } from '../../src/core/export/atlas-exporter.js';
import { runPhaserMicroTests } from '../../src/core/validation/phaser-test-harness.js';
import { pathExists } from '../../src/utils/fs-helpers.js';

describe('ExportService (Story 8.7)', () => {
    let testDir: string;
    let runPath: string;
    let approvedDir: string;
    let exportDir: string;
    let manifest: Manifest;

    // Create a test PNG buffer (1x1 transparent pixel)
    const createTestPng = (): Buffer => {
        return Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Create temp directories
        testDir = path.join(tmpdir(), `export-service-test-${Date.now()}`);
        runPath = path.join(testDir, 'runs', 'test-run-123');
        approvedDir = path.join(runPath, 'approved');
        exportDir = path.join(runPath, 'export');

        mkdirSync(approvedDir, { recursive: true });
        mkdirSync(exportDir, { recursive: true });

        // Create test frame files
        for (let i = 0; i < 4; i++) {
            writeFileSync(
                path.join(approvedDir, `frame_${String(i).padStart(4, '0')}.png`),
                createTestPng()
            );
        }

        // Create minimal manifest
        manifest = {
            version: '1.0',
            identity: {
                character: 'warrior',
                move: 'idle_standard',
                frame_count: 4,
            },
            inputs: {
                anchor: '/anchor.png',
            },
            outputs: {
                type: 'atlas',
                format: 'png',
            },
            generator: {
                model: 'gemini-2.5-flash-preview-04-17',
                prompts: {} as Manifest['generator']['prompts'],
            },
        } as Manifest;

        // Default mock implementations
        (pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    });

    afterEach(() => {
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Constructor', () => {
        it('should create service with run path and manifest', () => {
            const service = new ExportService(runPath, manifest);
            expect(service).toBeDefined();
        });
    });

    describe('run()', () => {
        it('should fail when no approved directory exists', async () => {
            (pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(false);
            expect(result.releaseReady).toBe(false);
        });

        it('should fail when approved directory is empty', async () => {
            // Remove frame files
            rmSync(approvedDir, { recursive: true });
            mkdirSync(approvedDir, { recursive: true });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(false);
            expect(result.releaseReady).toBe(false);
        });

        it('should export atlas successfully', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: true,
                    tests: {
                        'TEST-02': { passed: true },
                        'TEST-03': { passed: true },
                        'TEST-04': { passed: true },
                    },
                }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(true);
            expect(result.atlasPath).toBe(mockAtlasResult.paths.png);
            expect(result.jsonPath).toBe(mockAtlasResult.paths.json);
            expect(result.releaseReady).toBe(true);
        });

        it('should fail when TexturePacker fails', async () => {
            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => false,
                isErr: () => true,
                unwrapErr: () => ({ code: 'EXPORT_FAILED', message: 'TexturePacker error' }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(false);
            expect(result.releaseReady).toBe(false);
        });

        it('should skip validation when skipValidation option is true', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run({ skipValidation: true });

            expect(result.success).toBe(true);
            expect(result.releaseReady).toBe(true);
            expect(result.validationResults).toEqual([]);
            expect(runPhaserMicroTests).not.toHaveBeenCalled();
        });

        it('should handle validation failure', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: false,
                    tests: {
                        'TEST-02': { passed: false, error: 'Pivot misaligned' },
                        'TEST-03': { passed: true },
                        'TEST-04': { passed: true },
                    },
                }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(true);
            expect(result.releaseReady).toBe(false);
            expect(result.validationResults?.some(r => !r.passed)).toBe(true);
        });

        it('should allow export despite validation failure with allowValidationFail', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: false,
                    tests: {
                        'TEST-02': { passed: false, error: 'Pivot misaligned' },
                    },
                }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run({ allowValidationFail: true });

            expect(result.success).toBe(true);
            expect(result.releaseReady).toBe(true);
        });

        it('should handle Phaser validation error gracefully', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => false,
                isErr: () => true,
                unwrapErr: () => ({ code: 'PUPPETEER_MISSING', message: 'Puppeteer not installed' }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            // Should still succeed but mark as release ready (validation skipped)
            expect(result.success).toBe(true);
            expect(result.releaseReady).toBe(true);
        });

        it('should write summary.json after export', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1500,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: true,
                    tests: {},
                }),
            });

            const service = new ExportService(runPath, manifest);
            await service.run();

            const summaryPath = path.join(exportDir, 'summary.json');
            expect(existsSync(summaryPath)).toBe(true);

            const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
            expect(summary.release_ready).toBe(true);
            expect(summary.atlas.frame_count).toBe(4);
            expect(summary.duration_ms).toBe(1500);
        });

        it('should handle unexpected errors', async () => {
            (pathExists as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Disk error'));

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.success).toBe(false);
            expect(result.releaseReady).toBe(false);
        });
    });

    describe('Validation results formatting', () => {
        it('should format TEST-02 pivot alignment results', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: true,
                    tests: {
                        'TEST-02': { passed: true },
                    },
                }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.validationResults).toContainEqual({
                testName: 'TEST-02 Pivot Alignment',
                passed: true,
                message: undefined,
            });
        });

        it('should format TEST-03 trim jitter results with error', async () => {
            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: false,
                    tests: {
                        'TEST-03': { passed: false, error: 'Frame jitter detected at frame 3' },
                    },
                }),
            });

            const service = new ExportService(runPath, manifest);
            const result = await service.run();

            expect(result.validationResults).toContainEqual({
                testName: 'TEST-03 Trim Jitter',
                passed: false,
                message: 'Frame jitter detected at frame 3',
            });
        });
    });

    describe('Integration with ProgressReporter', () => {
        it('should use provided reporter for logging', async () => {
            const mockReporter = {
                start: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
            } as unknown as import('../../src/core/progress-reporter.js').ProgressReporter;

            const mockAtlasResult = {
                paths: {
                    png: path.join(exportDir, 'atlas.png'),
                    json: path.join(exportDir, 'atlas.json'),
                },
                frameCount: 4,
                sheetCount: 1,
                durationMs: 1000,
            };

            (exportAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                isErr: () => false,
                unwrap: () => mockAtlasResult,
            });

            (runPhaserMicroTests as ReturnType<typeof vi.fn>).mockResolvedValue({
                isOk: () => true,
                unwrap: () => ({
                    overall_passed: true,
                    tests: {},
                }),
            });

            const service = new ExportService(runPath, manifest);
            await service.run({}, mockReporter);

            expect(mockReporter.start).toHaveBeenCalled();
            expect(mockReporter.succeed).toHaveBeenCalled();
        });
    });
});
