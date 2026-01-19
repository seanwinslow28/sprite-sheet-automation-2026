/**
 * Tests for frame metrics writer and CSV exporter
 * Per Story 6.2: Per-frame audit metrics as structured data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    writeFrameMetrics,
    readFrameMetrics,
    readAllFrameMetrics,
    aggregateFrameMetrics,
    createAttemptSummary,
    createEmptyFrameMetrics,
} from '../../../src/core/metrics/frame-metrics-writer.js';
import {
    exportMetricsToCSVString,
    exportRunMetricsToCSV,
    exportRunMetricsToCSVFile,
    getCSVHeaders,
} from '../../../src/core/metrics/csv-exporter.js';
import { FrameMetricsSchema, type FrameMetrics } from '../../../src/domain/types/frame-metrics.js';
import { calculateCompositeScore } from '../../../src/core/metrics/soft-metric-aggregator.js';

describe('Frame Metrics Schema', () => {
    it('should validate a complete frame metrics object', () => {
        const metrics = createEmptyFrameMetrics(0);
        const result = FrameMetricsSchema.safeParse(metrics);
        expect(result.success).toBe(true);
    });

    it('should reject invalid frame index', () => {
        const metrics = createEmptyFrameMetrics(0);
        const invalid = { ...metrics, frame_index: -1 };
        const result = FrameMetricsSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('should reject invalid composite score', () => {
        const metrics = createEmptyFrameMetrics(0);
        const invalid = { ...metrics, composite_score: 1.5 };
        const result = FrameMetricsSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });
});

describe('Frame Metrics Writer', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `metrics-writer-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('writeFrameMetrics', () => {
        it('should write metrics file with padded index', async () => {
            const metrics = createEmptyFrameMetrics(3);
            await writeFrameMetrics(testDir, 3, metrics);

            const filePath = path.join(testDir, 'audit', 'frame_0003_metrics.json');
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);

            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.frame_index).toBe(3);
        });

        it('should create audit directory if it does not exist', async () => {
            const metrics = createEmptyFrameMetrics(0);
            await writeFrameMetrics(testDir, 0, metrics);

            const auditDir = path.join(testDir, 'audit');
            const exists = await fs.access(auditDir).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('readFrameMetrics', () => {
        it('should read metrics file with padded index', async () => {
            const metrics = createEmptyFrameMetrics(5);
            metrics.composite_score = 0.85;
            await writeFrameMetrics(testDir, 5, metrics);

            const read = await readFrameMetrics(testDir, 5);
            expect(read).not.toBeNull();
            expect(read?.frame_index).toBe(5);
            expect(read?.composite_score).toBe(0.85);
        });

        it('should return null for non-existent frame', async () => {
            const read = await readFrameMetrics(testDir, 999);
            expect(read).toBeNull();
        });

        it('should validate against schema', async () => {
            // Write invalid JSON
            await fs.mkdir(path.join(testDir, 'audit'), { recursive: true });
            await fs.writeFile(
                path.join(testDir, 'audit', 'frame_0001_metrics.json'),
                JSON.stringify({ frame_index: 'invalid' })
            );

            const read = await readFrameMetrics(testDir, 1);
            expect(read).toBeNull();
        });
    });

    describe('readAllFrameMetrics', () => {
        it('should read all metrics files in order', async () => {
            await writeFrameMetrics(testDir, 2, createEmptyFrameMetrics(2));
            await writeFrameMetrics(testDir, 0, createEmptyFrameMetrics(0));
            await writeFrameMetrics(testDir, 1, createEmptyFrameMetrics(1));

            const all = await readAllFrameMetrics(testDir);
            expect(all.length).toBe(3);
            expect(all[0].frame_index).toBe(0);
            expect(all[1].frame_index).toBe(1);
            expect(all[2].frame_index).toBe(2);
        });

        it('should return empty array for non-existent audit folder', async () => {
            const all = await readAllFrameMetrics(path.join(testDir, 'nonexistent'));
            expect(all).toEqual([]);
        });
    });
});

describe('Frame Metrics Aggregation', () => {
    it('should aggregate composite score with metrics', () => {
        const compositeScore = calculateCompositeScore({
            identity: 0.9,
            stability: 0.85,
            palette: 0.8,
            style: 0.75,
        });

        const rawMetrics = {
            ssim: 0.9,
            paletteFidelity: 0.8,
            alphaArtifactScore: 0.05,
            baselineDriftPx: 1.5,
            orphanPixelCount: 2,
        };

        const attemptHistory = [
            createAttemptSummary(1, 'passed', 0.85, [], 1000),
        ];

        const metrics = aggregateFrameMetrics(
            3,
            compositeScore,
            rawMetrics,
            attemptHistory,
            'approved',
            [],
            2000,
            500
        );

        expect(metrics.frame_index).toBe(3);
        expect(metrics.status).toBe('approved');
        expect(metrics.passed).toBe(true);
        expect(metrics.attempt_count).toBe(1);
        expect(metrics.metrics.ssim).toBe(0.9);
        expect(metrics.total_generation_time_ms).toBe(2000);
    });

    it('should include MAPD metrics when provided', () => {
        const compositeScore = calculateCompositeScore({
            identity: 0.9,
            stability: 0.85,
            palette: 0.8,
            style: 0.75,
        });

        const rawMetrics = {
            ssim: 0.9,
            paletteFidelity: 0.8,
            alphaArtifactScore: 0.05,
            baselineDriftPx: 1.5,
            orphanPixelCount: 2,
            mapd: {
                value: 0.015,
                threshold: 0.02,
                moveType: 'idle_standard',
                passed: true,
                bypassed: false,
            },
        };

        const metrics = aggregateFrameMetrics(
            0,
            compositeScore,
            rawMetrics,
            [],
            'approved',
            [],
            1000,
            500
        );

        expect(metrics.metrics.mapd).toBeDefined();
        expect(metrics.metrics.mapd?.value).toBe(0.015);
        expect(metrics.metrics.mapd?.move_type).toBe('idle_standard');
    });
});

describe('Attempt Summary', () => {
    it('should create attempt summary with all fields', () => {
        const summary = createAttemptSummary(
            2,
            'soft_fail',
            0.65,
            ['SF01_IDENTITY_DRIFT'],
            4500,
            'identity_rescue'
        );

        expect(summary.attempt_index).toBe(2);
        expect(summary.result).toBe('soft_fail');
        expect(summary.composite_score).toBe(0.65);
        expect(summary.reason_codes).toEqual(['SF01_IDENTITY_DRIFT']);
        expect(summary.action_taken).toBe('identity_rescue');
        expect(summary.duration_ms).toBe(4500);
        expect(summary.timestamp).toBeTruthy();
    });
});

describe('CSV Exporter', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `csv-exporter-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should get CSV headers', () => {
        const headers = getCSVHeaders();
        expect(headers).toContain('frame_index');
        expect(headers).toContain('status');
        expect(headers).toContain('composite_score');
        expect(headers).toContain('ssim');
    });

    it('should export metrics to CSV string', () => {
        const metrics: FrameMetrics[] = [
            {
                ...createEmptyFrameMetrics(0),
                status: 'approved',
                composite_score: 0.85,
                breakdown: {
                    identity: { raw: 0.9, weighted: 0.27, passed: true },
                    stability: { raw: 0.85, weighted: 0.297, passed: true },
                    palette: { raw: 0.8, weighted: 0.16, passed: true },
                    style: { raw: 0.75, weighted: 0.112, passed: true },
                },
                metrics: {
                    ssim: 0.9,
                    palette_fidelity: 0.8,
                    alpha_artifact_score: 0.05,
                    baseline_drift_px: 1.5,
                    orphan_pixel_count: 2,
                },
                attempt_count: 1,
            },
        ];

        const csv = exportMetricsToCSVString(metrics);
        const lines = csv.split('\n');

        expect(lines.length).toBe(2); // Header + 1 row
        expect(lines[0]).toContain('frame_index');
        expect(lines[1]).toContain('0'); // frame_index
        expect(lines[1]).toContain('approved'); // status
    });

    it('should export run metrics to CSV', async () => {
        // Create test metrics files
        const metrics0 = createEmptyFrameMetrics(0);
        metrics0.status = 'approved';
        metrics0.composite_score = 0.9;
        await writeFrameMetrics(testDir, 0, metrics0);

        const metrics1 = createEmptyFrameMetrics(1);
        metrics1.status = 'failed';
        metrics1.composite_score = 0.5;
        await writeFrameMetrics(testDir, 1, metrics1);

        const csv = await exportRunMetricsToCSV(testDir);
        const lines = csv.split('\n');

        expect(lines.length).toBe(3); // Header + 2 rows
        expect(lines[1]).toContain('approved');
        expect(lines[2]).toContain('failed');
    });

    it('should throw error when no metrics found', async () => {
        await expect(exportRunMetricsToCSV(testDir)).rejects.toThrow('No frame metrics found');
    });

    it('should export metrics to CSV file', async () => {
        const metrics = createEmptyFrameMetrics(0);
        await writeFrameMetrics(testDir, 0, metrics);

        const outputPath = path.join(testDir, 'output.csv');
        const result = await exportRunMetricsToCSVFile(testDir, outputPath);

        expect(result).toBe(outputPath);
        const exists = await fs.access(outputPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should use default path when no output specified', async () => {
        const metrics = createEmptyFrameMetrics(0);
        await writeFrameMetrics(testDir, 0, metrics);

        const result = await exportRunMetricsToCSVFile(testDir);

        expect(result).toContain('metrics_summary.csv');
        const exists = await fs.access(result).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });
});
