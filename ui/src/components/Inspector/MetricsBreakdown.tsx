/**
 * MetricsBreakdown - Displays audit metric values with thresholds
 * Per Story 7.7: AC #3 - Shows SSIM, Palette %, Baseline Drift, Orphan Count
 */

import React from 'react';
import styles from './MetricsBreakdown.module.css';

export interface AuditMetrics {
  /** SSIM identity score (0.0-1.0) */
  ssim?: number;
  /** Palette fidelity percentage (0.0-1.0) */
  paletteFidelity?: number;
  /** Baseline drift in pixels */
  baselineDrift?: number;
  /** Count of orphan pixels */
  orphanPixels?: number;
}

interface MetricsBreakdownProps {
  /** Metrics object from audit report */
  metrics?: AuditMetrics;
}

interface MetricRow {
  label: string;
  value: number | undefined;
  threshold: number;
  format: (v: number) => string;
  inverse?: boolean; // If true, lower is better
}

export const MetricsBreakdown: React.FC<MetricsBreakdownProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className={styles.noMetrics} data-testid="no-metrics">
        No metrics available
      </div>
    );
  }

  const rows: MetricRow[] = [
    {
      label: 'SSIM (Identity)',
      value: metrics.ssim,
      threshold: 0.8,
      format: (v: number) => v.toFixed(3),
    },
    {
      label: 'Palette Fidelity',
      value: metrics.paletteFidelity,
      threshold: 0.75,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: 'Baseline Drift',
      value: metrics.baselineDrift,
      threshold: 3,
      format: (v: number) => `${v}px`,
      inverse: true, // Lower is better
    },
    {
      label: 'Orphan Pixels',
      value: metrics.orphanPixels,
      threshold: 15,
      format: (v: number) => String(v),
      inverse: true,
    },
  ];

  return (
    <div className={styles.container} data-testid="metrics-breakdown">
      {rows.map((row) => {
        const value = row.value ?? 0;
        const passing = row.inverse
          ? value <= row.threshold
          : value >= row.threshold;

        return (
          <div key={row.label} className={styles.row} data-testid={`metric-${row.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
            <span className={styles.label}>{row.label}</span>
            <span className={`${styles.value} ${passing ? styles.pass : styles.fail}`}>
              {row.value !== undefined ? row.format(value) : 'N/A'}
            </span>
            <span className={styles.threshold}>
              (threshold: {row.inverse ? '\u2264' : '\u2265'}{row.format(row.threshold)})
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsBreakdown;
