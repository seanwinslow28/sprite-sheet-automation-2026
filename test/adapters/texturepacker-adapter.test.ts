/**
 * Tests for TexturePacker Adapter
 * Story 5.2: Implement TexturePacker Integration with Locked Settings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
    buildTexturePackerArgs,
    verifyTexturePackerInstallation,
    packAtlas,
} from '../../src/adapters/texturepacker-adapter.js';
import { LOCKED_TEXTUREPACKER_FLAGS } from '../../src/core/export/export-config-resolver.js';

// Mock execa
vi.mock('execa', () => ({
    execa: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

import { execa } from 'execa';

describe('TexturePacker Adapter (Story 5.2)', () => {
    let tempDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tp-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('buildTexturePackerArgs', () => {
        it('should include all locked flags', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas');

            // Check all locked flags are present
            expect(args).toContain('--format');
            expect(args).toContain('phaser');
            expect(args).toContain('--trim-mode');
            expect(args).toContain('Trim');
            expect(args).toContain('--extrude');
            expect(args).toContain('1');
            expect(args).toContain('--shape-padding');
            expect(args).toContain('2');
            expect(args).toContain('--border-padding');
            expect(args).toContain('2');
            expect(args).toContain('--disable-rotation');
            expect(args).toContain('--alpha-handling');
            expect(args).toContain('ReduceBorderArtifacts');
            expect(args).toContain('--trim-sprite-names');
            expect(args).toContain('--prepend-folder-name');
        });

        it('should add --data and --sheet flags with correct paths (multipack enabled by default)', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas');

            const dataIndex = args.indexOf('--data');
            const sheetIndex = args.indexOf('--sheet');

            expect(dataIndex).toBeGreaterThan(-1);
            expect(args[dataIndex + 1]).toBe('/output/atlas.json');

            expect(sheetIndex).toBeGreaterThan(-1);
            // With multipack enabled (default), uses {n} placeholder
            expect(args[sheetIndex + 1]).toBe('/output/atlas-{n}.png');
        });

        it('should use non-multipack paths when multipack disabled', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas', undefined, false);

            const sheetIndex = args.indexOf('--sheet');
            expect(sheetIndex).toBeGreaterThan(-1);
            // With multipack disabled, uses simple .png extension
            expect(args[sheetIndex + 1]).toBe('/output/atlas.png');
        });

        it('should add input directory as last argument', () => {
            const args = buildTexturePackerArgs('/input/frames', '/output/atlas');
            expect(args[args.length - 1]).toBe('/input/frames');
        });

        it('should use export config packer flags when provided', () => {
            const exportConfig = {
                packerFlags: [...LOCKED_TEXTUREPACKER_FLAGS, '--max-size', '4096'],
                atlasFormat: 'phaser' as const,
                stagingPath: '/staging',
                exportPath: '/export',
                customFlagsApplied: ['--max-size', '4096'],
                customFlagsRejected: [],
            };

            const args = buildTexturePackerArgs('/input', '/output/atlas', exportConfig);

            expect(args).toContain('--max-size');
            expect(args).toContain('4096');
        });
    });

    describe('verifyTexturePackerInstallation', () => {
        it('should return version info when TexturePacker is found', async () => {
            vi.mocked(execa).mockResolvedValue({
                stdout: 'TexturePacker 7.0.0',
                stderr: '',
                exitCode: 0,
            } as any);

            const result = await verifyTexturePackerInstallation();

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.unwrap().version).toBe('7.0.0');
            }
        });

        it('should return error when TexturePacker is not found', async () => {
            const error = new Error('spawn TexturePacker ENOENT');
            (error as any).code = 'ENOENT';
            vi.mocked(execa).mockRejectedValue(error);

            const result = await verifyTexturePackerInstallation();

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('DEP_TEXTUREPACKER_NOT_FOUND');
            }
        });

        it('should return error when TexturePacker returns non-zero', async () => {
            vi.mocked(execa).mockResolvedValue({
                stdout: '',
                stderr: 'License error',
                exitCode: 1,
            } as any);

            const result = await verifyTexturePackerInstallation();

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('DEP_TEXTUREPACKER_NOT_FOUND');
            }
        });
    });

    describe('packAtlas', () => {
        it('should return error when input directory does not exist', async () => {
            // Use a unique nonexistent path to ensure no mock interference
            const nonexistentPath = path.join(tempDir, 'definitely_does_not_exist_' + Date.now());
            const result = await packAtlas(nonexistentPath, path.join(tempDir, 'output', 'atlas'));

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_PATH_NOT_FOUND');
            }
        });

        it('should return success on successful pack', async () => {
            // Create test input directory with a frame
            const inputDir = path.join(tempDir, 'input');
            await fs.mkdir(inputDir, { recursive: true });
            await fs.writeFile(path.join(inputDir, 'frame_0000.png'), 'fake png');

            vi.mocked(execa).mockResolvedValue({
                stdout: 'Packing complete',
                stderr: '',
                exitCode: 0,
            } as any);

            const outputBase = path.join(tempDir, 'output', 'atlas');
            const result = await packAtlas(inputDir, outputBase);

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const packResult = result.unwrap();
                expect(packResult.atlasPath).toBe(`${outputBase}.json`);
                expect(packResult.sheetPath).toBe(`${outputBase}.png`);
                expect(packResult.frameCount).toBe(1);
                expect(packResult.durationMs).toBeGreaterThanOrEqual(0);
            }
        });

        it('should return error on TexturePacker failure', async () => {
            const inputDir = path.join(tempDir, 'input');
            await fs.mkdir(inputDir, { recursive: true });
            await fs.writeFile(path.join(inputDir, 'frame_0000.png'), 'fake png');

            vi.mocked(execa).mockResolvedValue({
                stdout: '',
                stderr: 'Error: Invalid frame',
                exitCode: 1,
            } as any);

            const result = await packAtlas(inputDir, path.join(tempDir, 'output', 'atlas'));

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('DEP_TEXTUREPACKER_FAIL');
            }
        });

        it('should return timeout error when pack takes too long', async () => {
            const inputDir = path.join(tempDir, 'input');
            await fs.mkdir(inputDir, { recursive: true });
            await fs.writeFile(path.join(inputDir, 'frame_0000.png'), 'fake png');

            const timeoutError = new Error('Process timed out');
            (timeoutError as any).timedOut = true;
            vi.mocked(execa).mockRejectedValue(timeoutError);

            const result = await packAtlas(inputDir, path.join(tempDir, 'output', 'atlas'), {
                timeoutMs: 1000,
            });

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('DEP_TEXTUREPACKER_TIMEOUT');
            }
        });

        it('should return ENOENT error when TexturePacker is not installed', async () => {
            const inputDir = path.join(tempDir, 'input');
            await fs.mkdir(inputDir, { recursive: true });
            await fs.writeFile(path.join(inputDir, 'frame_0000.png'), 'fake png');

            const enoentError = new Error('spawn TexturePacker ENOENT');
            (enoentError as any).code = 'ENOENT';
            vi.mocked(execa).mockRejectedValue(enoentError);

            const result = await packAtlas(inputDir, path.join(tempDir, 'output', 'atlas'));

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('DEP_TEXTUREPACKER_NOT_FOUND');
            }
        });
    });

    describe('Locked Flags Compliance', () => {
        it('should use --format phaser', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const formatIndex = args.indexOf('--format');
            expect(args[formatIndex + 1]).toBe('phaser');
        });

        it('should use --trim-mode Trim', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const trimIndex = args.indexOf('--trim-mode');
            expect(args[trimIndex + 1]).toBe('Trim');
        });

        it('should use --extrude 1', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const extrudeIndex = args.indexOf('--extrude');
            expect(args[extrudeIndex + 1]).toBe('1');
        });

        it('should use --shape-padding 2', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const paddingIndex = args.indexOf('--shape-padding');
            expect(args[paddingIndex + 1]).toBe('2');
        });

        it('should use --border-padding 2', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const borderIndex = args.indexOf('--border-padding');
            expect(args[borderIndex + 1]).toBe('2');
        });

        it('should include --disable-rotation', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            expect(args).toContain('--disable-rotation');
        });

        it('should use --alpha-handling ReduceBorderArtifacts', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            const alphaIndex = args.indexOf('--alpha-handling');
            expect(args[alphaIndex + 1]).toBe('ReduceBorderArtifacts');
        });

        it('should include --trim-sprite-names', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            expect(args).toContain('--trim-sprite-names');
        });

        it('should include --prepend-folder-name', () => {
            const args = buildTexturePackerArgs('/input', '/output');
            expect(args).toContain('--prepend-folder-name');
        });
    });
});
