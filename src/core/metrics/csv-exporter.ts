/**
 * CSV Exporter - exports frame metrics to CSV format
 * Per Story 6.2: Metrics can be exported in CSV format with --csv flag
 */

import { promises as fs } from 'fs';
import path from 'path';
import { readAllFrameMetrics } from './frame-metrics-writer.js';
import type { FrameMetrics } from '../../domain/types/frame-metrics.js';

/**
 * CSV column headers
 */
const CSV_HEADERS = [
    'frame_index',
    'status',
    'composite_score',
    'identity_raw',
    'stability_raw',
    'palette_raw',
    'style_raw',
    'ssim',
    'palette_fidelity',
    'alpha_artifacts',
    'baseline_drift',
    'orphan_pixels',
    'attempt_count',
    'total_time_ms',
];

/**
 * Export all frame metrics to CSV string
 */
export function exportMetricsToCSVString(metrics: FrameMetrics[]): string {
    const rows: string[] = [CSV_HEADERS.join(',')];

    for (const m of metrics) {
        const row = [
            m.frame_index,
            m.status,
            m.composite_score.toFixed(3),
            m.breakdown.identity.raw.toFixed(3),
            m.breakdown.stability.raw.toFixed(3),
            m.breakdown.palette.raw.toFixed(3),
            m.breakdown.style.raw.toFixed(3),
            m.metrics.ssim.toFixed(3),
            m.metrics.palette_fidelity.toFixed(3),
            m.metrics.alpha_artifact_score.toFixed(3),
            m.metrics.baseline_drift_px.toFixed(1),
            m.metrics.orphan_pixel_count,
            m.attempt_count,
            m.total_generation_time_ms + m.total_audit_time_ms,
        ];
        rows.push(row.join(','));
    }

    return rows.join('\n');
}

/**
 * Export frame metrics from a run to CSV
 */
export async function exportRunMetricsToCSV(runPath: string): Promise<string> {
    const metrics = await readAllFrameMetrics(runPath);

    if (metrics.length === 0) {
        throw new Error('No frame metrics found in run');
    }

    return exportMetricsToCSVString(metrics);
}

/**
 * Export frame metrics to CSV file
 */
export async function exportRunMetricsToCSVFile(
    runPath: string,
    outputPath?: string
): Promise<string> {
    const csv = await exportRunMetricsToCSV(runPath);

    // Default output path is in the run's audit folder
    const finalPath = outputPath ?? path.join(runPath, 'audit', 'metrics_summary.csv');

    await fs.writeFile(finalPath, csv, 'utf-8');

    return finalPath;
}

/**
 * Get column headers for reference
 */
export function getCSVHeaders(): string[] {
    return [...CSV_HEADERS];
}
