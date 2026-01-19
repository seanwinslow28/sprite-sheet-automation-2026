/**
 * Tests for resolution manager (Story 2.8)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import {
    getGenerationSize,
    getTargetSize,
    validateResolutionRatio,
    downsample,
    processCandidate,
} from '../../src/core/resolution-manager.js';

describe('Resolution Manager (Story 2.8)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-resolution-test-${Date.now()}`);
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
     * Create a test 512x512 PNG
     */
    async function create512Image(path: string): Promise<void> {
        const data = Buffer.alloc(512 * 512 * 4);
        // Create pattern for visual verification
        for (let y = 0; y < 512; y++) {
            for (let x = 0; x < 512; x++) {
                const idx = (y * 512 + x) * 4;
                data[idx] = x % 256;     // R
                data[idx + 1] = y % 256; // G
                data[idx + 2] = 128;     // B
                data[idx + 3] = 255;     // A
            }
        }
        await sharp(data, { raw: { width: 512, height: 512, channels: 4 } })
            .png()
            .toFile(path);
    }

    describe('getGenerationSize', () => {
        it('should return generation_size from config', () => {
            expect(getGenerationSize({ generation_size: 512 })).toBe(512);
            expect(getGenerationSize({ generation_size: 1024 })).toBe(1024);
        });
    });

    describe('getTargetSize', () => {
        it('should return target_size from config', () => {
            expect(getTargetSize({ target_size: 128 })).toBe(128);
            expect(getTargetSize({ target_size: 256 })).toBe(256);
        });
    });

    describe('validateResolutionRatio', () => {
        it('should accept 4:1 ratio (512:128)', () => {
            const result = validateResolutionRatio(512, 128);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.ratio).toBe(4);
            }
        });

        it('should accept 4:1 ratio (1024:256)', () => {
            const result = validateResolutionRatio(1024, 256);
            expect(result.ok).toBe(true);
        });

        it('should reject non-4:1 ratio', () => {
            const result = validateResolutionRatio(512, 256);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('RESOLUTION_INVALID_RATIO');
            }
        });
    });

    describe('downsample', () => {
        it('should downsample 512→128 with nearest-neighbor', async () => {
            const inputPath = join(testDir, 'input.png');
            const outputPath = join(testDir, 'output.png');

            await create512Image(inputPath);
            const result = await downsample(inputPath, outputPath, 128);

            expect(result.ok).toBe(true);

            // Verify output dimensions
            const metadata = await sharp(outputPath).metadata();
            expect(metadata.width).toBe(128);
            expect(metadata.height).toBe(128);
        });

        it('should return error for invalid input', async () => {
            const result = await downsample('/nonexistent.png', join(testDir, 'out.png'), 128);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('RESOLUTION_DOWNSAMPLE_FAILED');
            }
        });
    });

    describe('processCandidate', () => {
        it('should process candidate and return both paths', async () => {
            const inputPath = join(testDir, 'candidate_512.png');
            const outputPath = join(testDir, 'candidate_128.png');

            await create512Image(inputPath);
            const result = await processCandidate(inputPath, outputPath, 128);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.hiResPath).toBe(inputPath);
                expect(result.value.loResPath).toBe(outputPath);
            }
        });
    });
});
