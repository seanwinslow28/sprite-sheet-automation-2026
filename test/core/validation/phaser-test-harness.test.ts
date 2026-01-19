/**
 * Tests for Phaser Test Harness
 * Story 5.7: Implement Phaser Micro-Test Suite
 *
 * Note: Full integration tests require Puppeteer/Chromium which may not be available
 * in all CI environments. These tests focus on the harness logic and helpers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
    generateTestPageHtml,
    formatValidationResults,
    loadValidationResults,
} from '../../../src/core/validation/phaser-test-harness.js';
import type {
    ValidationSummary,
    MicroTestResult,
} from '../../../src/core/validation/phaser-test-harness.js';

describe('Phaser Test Harness (Story 5.7)', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phaser-harness-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('generateTestPageHtml', () => {
        it('should generate valid HTML with Phaser script', () => {
            const html = generateTestPageHtml();

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('phaser@3');
            expect(html).toContain('Phaser.WEBGL');
        });

        it('should include all three test scenes', () => {
            const html = generateTestPageHtml();

            expect(html).toContain('TEST02_PivotScene');
            expect(html).toContain('TEST03_TrimJitterScene');
            expect(html).toContain('TEST04_SuffixScene');
        });

        it('should parse URL parameters', () => {
            const html = generateTestPageHtml();

            expect(html).toContain('URLSearchParams');
            expect(html).toContain("urlParams.get('test')");
            expect(html).toContain("urlParams.get('moveId')");
            expect(html).toContain("urlParams.get('frameCount')");
        });

        it('should use correct frame naming pattern', () => {
            const html = generateTestPageHtml();

            expect(html).toContain("padStart(4, '0')");
            expect(html).toContain("moveId + '/'");
        });

        it('should output JSON results via console.log', () => {
            const html = generateTestPageHtml();

            expect(html).toContain('console.log(JSON.stringify');
            expect(html).toContain("test: 'TEST-02'");
            expect(html).toContain("test: 'TEST-03'");
            expect(html).toContain("test: 'TEST-04'");
        });
    });

    describe('formatValidationResults', () => {
        it('should format passing results', () => {
            const summary: ValidationSummary = {
                run_id: 'test-run',
                atlas_path: '/path/to/atlas.json',
                validated_at: '2026-01-19T10:00:00.000Z',
                overall_passed: true,
                tests: {
                    'TEST-02': {
                        test: 'TEST-02',
                        name: 'Pivot Auto-Apply',
                        passed: true,
                        details: { maxDrift: 0.5 },
                        screenshot: '/path/to/test-02.png',
                        duration_ms: 100,
                    },
                    'TEST-03': {
                        test: 'TEST-03',
                        name: 'Trim Mode Jitter',
                        passed: true,
                        details: { xVariance: 0.2, yVariance: 0.1 },
                        screenshot: '/path/to/test-03.png',
                        duration_ms: 100,
                    },
                    'TEST-04': {
                        test: 'TEST-04',
                        name: 'Suffix Convention',
                        passed: true,
                        details: { totalFrames: 8, resolvedFrames: 8 },
                        screenshot: '/path/to/test-04.png',
                        duration_ms: 100,
                    },
                },
                console_logs: [],
            };

            const output = formatValidationResults(summary);

            expect(output).toContain('test-run');
            expect(output).toContain('TEST-02');
            expect(output).toContain('TEST-03');
            expect(output).toContain('TEST-04');
            expect(output).toContain('PASS');
            expect(output).toContain('3/3');
            expect(output).toContain('0.5px');
        });

        it('should format failing results', () => {
            const summary: ValidationSummary = {
                run_id: 'test-run',
                atlas_path: '/path/to/atlas.json',
                validated_at: '2026-01-19T10:00:00.000Z',
                overall_passed: false,
                tests: {
                    'TEST-02': {
                        test: 'TEST-02',
                        name: 'Pivot Auto-Apply',
                        passed: true,
                        details: { maxDrift: 0.5 },
                        duration_ms: 100,
                    },
                    'TEST-03': {
                        test: 'TEST-03',
                        name: 'Trim Mode Jitter',
                        passed: false,
                        details: { xVariance: 5, yVariance: 3 },
                        duration_ms: 100,
                        error: 'Jitter exceeded tolerance',
                    },
                    'TEST-04': {
                        test: 'TEST-04',
                        name: 'Suffix Convention',
                        passed: true,
                        details: { totalFrames: 8, resolvedFrames: 8 },
                        duration_ms: 100,
                    },
                },
                console_logs: [],
            };

            const output = formatValidationResults(summary);

            expect(output).toContain('FAIL');
            expect(output).toContain('2/3');
            expect(output).toContain('5px');
            expect(output).toContain('Jitter exceeded tolerance');
        });

        it('should show screenshot paths', () => {
            const summary: ValidationSummary = {
                run_id: 'test-run',
                atlas_path: '/path/to/atlas.json',
                validated_at: '2026-01-19T10:00:00.000Z',
                overall_passed: true,
                tests: {
                    'TEST-02': {
                        test: 'TEST-02',
                        name: 'Pivot Auto-Apply',
                        passed: true,
                        details: {},
                        screenshot: '/full/path/test-02.png',
                        duration_ms: 100,
                    },
                },
                console_logs: [],
            };

            const output = formatValidationResults(summary);

            expect(output).toContain('test-02.png');
        });
    });

    describe('loadValidationResults', () => {
        it('should load existing results', async () => {
            const runId = 'test-run';
            const validationDir = path.join(tempDir, runId, 'validation');
            await fs.mkdir(validationDir, { recursive: true });

            const summary: ValidationSummary = {
                run_id: runId,
                atlas_path: '/path/to/atlas.json',
                validated_at: '2026-01-19T10:00:00.000Z',
                overall_passed: true,
                tests: {
                    'TEST-02': {
                        test: 'TEST-02',
                        name: 'Pivot Auto-Apply',
                        passed: true,
                        details: {},
                        duration_ms: 100,
                    },
                },
                console_logs: ['log1', 'log2'],
            };

            await fs.writeFile(
                path.join(validationDir, 'test-results.json'),
                JSON.stringify(summary)
            );

            const result = await loadValidationResults(tempDir, runId);

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const loaded = result.unwrap();
                expect(loaded.run_id).toBe(runId);
                expect(loaded.overall_passed).toBe(true);
                expect(loaded.console_logs).toEqual(['log1', 'log2']);
            }
        });

        it('should fail for missing results', async () => {
            const result = await loadValidationResults(tempDir, 'nonexistent');

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_READ_FAILED');
            }
        });
    });

    describe('Test Page Logic (unit tests)', () => {
        it('should define correct tolerance for TEST-02', () => {
            const html = generateTestPageHtml();
            // TEST-02 should have 1px tolerance for pivot drift
            expect(html).toContain('maxDrift <= 1');
        });

        it('should define correct tolerance for TEST-03', () => {
            const html = generateTestPageHtml();
            // TEST-03 should have 2px tolerance for jitter
            expect(html).toContain('xVariance <= 2');
            expect(html).toContain('yVariance <= 2');
        });

        it('should use zeroPad: 4 for frame names in TEST-04', () => {
            const html = generateTestPageHtml();
            expect(html).toContain('zeroPad: 4');
        });

        it('should set sprite origin to feet (0.5, 1) in TEST-02', () => {
            const html = generateTestPageHtml();
            expect(html).toContain('setOrigin(0.5, 1)');
        });
    });

    describe('Test Result Schema', () => {
        it('should include all required fields in TEST-02 output', () => {
            const html = generateTestPageHtml();

            // TEST-02 should output these fields
            expect(html).toContain("test: 'TEST-02'");
            expect(html).toContain('passed');
            expect(html).toContain('maxDrift');
            expect(html).toContain('baselineY');
            expect(html).toContain('frameResults');
        });

        it('should include all required fields in TEST-03 output', () => {
            const html = generateTestPageHtml();

            // TEST-03 should output these fields
            expect(html).toContain("test: 'TEST-03'");
            expect(html).toContain('xVariance');
            expect(html).toContain('yVariance');
            expect(html).toContain('positions');
        });

        it('should include all required fields in TEST-04 output', () => {
            const html = generateTestPageHtml();

            // TEST-04 should output these fields
            expect(html).toContain("test: 'TEST-04'");
            expect(html).toContain('totalFrames');
            expect(html).toContain('resolvedFrames');
            expect(html).toContain('missingFrames');
        });
    });

    describe('Error Handling', () => {
        it('should catch and report errors in TEST-02', () => {
            const html = generateTestPageHtml();
            expect(html).toContain('catch (e)');
            expect(html).toContain('error: e.message');
        });

        it('should catch and report errors in TEST-03', () => {
            const html = generateTestPageHtml();
            // Each test scene has its own try-catch
            const test03Section = html.split('TEST03_TrimJitterScene')[1];
            expect(test03Section).toContain('catch (e)');
        });

        it('should catch and report errors in TEST-04', () => {
            const html = generateTestPageHtml();
            // Each test scene has its own try-catch
            const test04Section = html.split('TEST04_SuffixScene')[1];
            expect(test04Section).toContain('catch (e)');
        });
    });
});

/**
 * Integration tests (require Puppeteer to be installed and functional)
 * These tests are marked to skip if Puppeteer is not available
 */
describe.skip('Phaser Test Harness Integration (requires Puppeteer)', () => {
    // These tests require actual Puppeteer + Chromium installation
    // and should be run in an environment with full browser support

    it('should run TEST-02 with valid atlas', async () => {
        // TODO: Implement when CI has Puppeteer support
    });

    it('should run TEST-03 with valid atlas', async () => {
        // TODO: Implement when CI has Puppeteer support
    });

    it('should run TEST-04 with valid atlas', async () => {
        // TODO: Implement when CI has Puppeteer support
    });

    it('should capture screenshots', async () => {
        // TODO: Implement when CI has Puppeteer support
    });

    it('should handle test timeout', async () => {
        // TODO: Implement when CI has Puppeteer support
    });
});
