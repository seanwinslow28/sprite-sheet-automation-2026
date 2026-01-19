/**
 * Tests for Export Configuration Resolver
 * Story 5.9: Implement Export Settings Configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import {
    mergePackerFlags,
    resolveExportConfig,
    isLockedFlag,
    isAllowedFlag,
    isValidAtlasFormat,
    getTexturePackerFormat,
    toExternalExportConfig,
    LOCKED_FLAGS,
    LOCKED_TEXTUREPACKER_FLAGS,
    ALLOWED_FLAGS,
} from '../../../src/core/export/export-config-resolver.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Export Config Resolver', () => {
    describe('LOCKED_FLAGS constant', () => {
        it('should contain all required locked flags', () => {
            const expectedLocked = [
                '--format',
                '--trim-mode',
                '--extrude',
                '--shape-padding',
                '--border-padding',
                '--disable-rotation',
                '--alpha-handling',
                '--trim-sprite-names',
                '--prepend-folder-name',
            ];
            for (const flag of expectedLocked) {
                expect(LOCKED_FLAGS.has(flag)).toBe(true);
            }
        });
    });

    describe('LOCKED_TEXTUREPACKER_FLAGS array', () => {
        it('should contain all locked flag-value pairs', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--format');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('phaser');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--trim-mode');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('Trim');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--extrude');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('1');
        });

        it('should have locked flags in correct order', () => {
            const formatIndex = LOCKED_TEXTUREPACKER_FLAGS.indexOf('--format');
            expect(LOCKED_TEXTUREPACKER_FLAGS[formatIndex + 1]).toBe('phaser');
        });
    });

    describe('isLockedFlag', () => {
        it('should return true for locked flags', () => {
            expect(isLockedFlag('--format')).toBe(true);
            expect(isLockedFlag('--trim-mode')).toBe(true);
            expect(isLockedFlag('--disable-rotation')).toBe(true);
        });

        it('should return false for allowed flags', () => {
            expect(isLockedFlag('--max-size')).toBe(false);
            expect(isLockedFlag('--scale')).toBe(false);
            expect(isLockedFlag('--multipack')).toBe(false);
        });

        it('should return false for unknown flags', () => {
            expect(isLockedFlag('--unknown-flag')).toBe(false);
        });
    });

    describe('isAllowedFlag', () => {
        it('should return true for allowed flags', () => {
            expect(isAllowedFlag('--max-size')).toBe(true);
            expect(isAllowedFlag('--multipack')).toBe(true);
            expect(isAllowedFlag('--scale')).toBe(true);
        });

        it('should return false for locked flags', () => {
            expect(isAllowedFlag('--format')).toBe(false);
            expect(isAllowedFlag('--trim-mode')).toBe(false);
        });
    });

    describe('mergePackerFlags', () => {
        it('should return locked flags when no custom flags provided', () => {
            const result = mergePackerFlags(LOCKED_TEXTUREPACKER_FLAGS, []);
            expect(result.merged).toEqual(LOCKED_TEXTUREPACKER_FLAGS);
            expect(result.rejected).toEqual([]);
        });

        it('should merge allowed custom flags', () => {
            const customFlags = ['--max-size', '4096'];
            const result = mergePackerFlags(LOCKED_TEXTUREPACKER_FLAGS, customFlags);
            expect(result.merged).toContain('--max-size');
            expect(result.merged).toContain('4096');
            expect(result.rejected).toEqual([]);
        });

        it('should reject locked flags from custom flags', () => {
            const customFlags = ['--format', 'json', '--max-size', '4096'];
            const result = mergePackerFlags(LOCKED_TEXTUREPACKER_FLAGS, customFlags);

            // Should reject --format
            expect(result.rejected).toContain('--format');

            // Should still include --max-size
            expect(result.merged).toContain('--max-size');
            expect(result.merged).toContain('4096');

            // Original locked --format phaser should still be present
            const formatIndex = result.merged.indexOf('--format');
            expect(result.merged[formatIndex + 1]).toBe('phaser');
        });

        it('should reject multiple locked flags', () => {
            const customFlags = [
                '--format', 'json',
                '--trim-mode', 'None',
                '--max-size', '4096',
            ];
            const result = mergePackerFlags(LOCKED_TEXTUREPACKER_FLAGS, customFlags);

            expect(result.rejected).toContain('--format');
            expect(result.rejected).toContain('--trim-mode');
            expect(result.merged).toContain('--max-size');
        });

        it('should handle boolean flags without values', () => {
            const customFlags = ['--disable-rotation', '--scale', '0.5'];
            const result = mergePackerFlags(LOCKED_TEXTUREPACKER_FLAGS, customFlags);

            expect(result.rejected).toContain('--disable-rotation');
            expect(result.merged).toContain('--scale');
            expect(result.merged).toContain('0.5');
        });
    });

    describe('resolveExportConfig', () => {
        const runsDir = '/project/runs';
        const runId = 'test_run_123';

        it('should use defaults when config is undefined', () => {
            const resolved = resolveExportConfig(undefined, runId, runsDir);

            expect(resolved.atlasFormat).toBe('phaser');
            expect(resolved.packerFlags).toEqual(LOCKED_TEXTUREPACKER_FLAGS);
            expect(resolved.customFlagsApplied).toEqual([]);
            expect(resolved.customFlagsRejected).toEqual([]);
        });

        it('should use defaults when config is empty', () => {
            const resolved = resolveExportConfig({}, runId, runsDir);

            expect(resolved.atlasFormat).toBe('phaser');
            expect(resolved.packerFlags).toEqual(LOCKED_TEXTUREPACKER_FLAGS);
        });

        it('should resolve staging and export paths correctly', () => {
            const resolved = resolveExportConfig({}, runId, runsDir);

            expect(resolved.stagingPath).toBe(path.join(runsDir, runId, 'export_staging'));
            expect(resolved.exportPath).toBe(path.join(runsDir, runId, 'export'));
        });

        it('should resolve custom output path', () => {
            const config = { outputPath: './assets/sprites/' };
            const resolved = resolveExportConfig(config, runId, runsDir);

            expect(resolved.outputPath).toBe(path.resolve('./assets/sprites/'));
        });

        it('should not include outputPath when not specified', () => {
            const resolved = resolveExportConfig({}, runId, runsDir);

            expect(resolved.outputPath).toBeUndefined();
        });

        it('should merge custom packer flags', () => {
            const config = {
                packerFlags: ['--max-size', '4096', '--scale', '0.5'],
            };
            const resolved = resolveExportConfig(config, runId, runsDir);

            expect(resolved.packerFlags).toContain('--max-size');
            expect(resolved.packerFlags).toContain('4096');
            expect(resolved.customFlagsApplied).toContain('--max-size');
            expect(resolved.customFlagsApplied).toContain('4096');
        });

        it('should track rejected flags', () => {
            const config = {
                packerFlags: ['--format', 'json', '--max-size', '4096'],
            };
            const resolved = resolveExportConfig(config, runId, runsDir);

            expect(resolved.customFlagsRejected).toContain('--format');
            expect(resolved.customFlagsApplied).not.toContain('--format');
        });
    });

    describe('isValidAtlasFormat', () => {
        it('should return true for phaser format', () => {
            expect(isValidAtlasFormat('phaser')).toBe(true);
        });

        it('should return false for unsupported formats', () => {
            expect(isValidAtlasFormat('json')).toBe(false);
            expect(isValidAtlasFormat('unity')).toBe(false);
            expect(isValidAtlasFormat('')).toBe(false);
        });
    });

    describe('getTexturePackerFormat', () => {
        it('should return phaser for phaser format', () => {
            expect(getTexturePackerFormat('phaser')).toBe('phaser');
        });
    });

    describe('toExternalExportConfig', () => {
        it('should convert to snake_case format', () => {
            const resolved = {
                packerFlags: ['--format', 'phaser'],
                atlasFormat: 'phaser' as const,
                stagingPath: '/runs/123/export_staging',
                exportPath: '/runs/123/export',
                outputPath: '/assets/sprites',
                customFlagsApplied: ['--max-size', '4096'],
                customFlagsRejected: ['--format'],
            };

            const external = toExternalExportConfig(resolved);

            expect(external.packer_flags).toEqual(['--format', 'phaser']);
            expect(external.atlas_format).toBe('phaser');
            expect(external.staging_path).toBe('/runs/123/export_staging');
            expect(external.export_path).toBe('/runs/123/export');
            expect(external.output_path).toBe('/assets/sprites');
            expect(external.custom_flags_applied).toEqual(['--max-size', '4096']);
            expect(external.custom_flags_rejected).toEqual(['--format']);
        });

        it('should handle undefined outputPath', () => {
            const resolved = {
                packerFlags: [],
                atlasFormat: 'phaser' as const,
                stagingPath: '/runs/123/export_staging',
                exportPath: '/runs/123/export',
                outputPath: undefined,
                customFlagsApplied: [],
                customFlagsRejected: [],
            };

            const external = toExternalExportConfig(resolved);
            expect(external.output_path).toBeUndefined();
        });
    });
});
