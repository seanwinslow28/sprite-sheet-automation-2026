/**
 * Inspector - Main inspector pane showing audit details for selected frame
 * Per Story 7.7: Displays score, flags, metrics, prompt, and attempt history
 */

import React from 'react';
import { ScoreDisplay } from './ScoreDisplay';
import { FlagsList } from './FlagsList';
import { MetricsBreakdown, type AuditMetrics } from './MetricsBreakdown';
import { PromptDisplay } from './PromptDisplay';
import { AttemptHistory, type AttemptEntry } from './AttemptHistory';
import styles from './Inspector.module.css';

/**
 * Audit report structure from frame state
 */
export interface AuditReport {
  compositeScore: number;
  flags: string[];
  passed: boolean;
  metrics?: AuditMetrics;
  promptUsed?: string;
}

/**
 * Frame state subset needed by Inspector
 */
export interface InspectorFrameData {
  /** Frame index (0-based) */
  frameIndex: number;
  /** Frame ID (e.g., "frame_0001") */
  frameId: string;
  /** Audit report data */
  auditReport?: AuditReport;
  /** Previous generation attempts */
  attemptHistory?: AttemptEntry[];
}

interface InspectorProps {
  /** Selected frame data, or null if no frame selected */
  frame: InspectorFrameData | null;
}

export const Inspector: React.FC<InspectorProps> = ({ frame }) => {
  if (!frame) {
    return (
      <div className={styles.inspector} data-testid="inspector">
        <div className={styles.placeholder} data-testid="inspector-placeholder">
          Select a frame to view details
        </div>
      </div>
    );
  }

  const { frameIndex, auditReport, attemptHistory } = frame;

  return (
    <div className={styles.inspector} data-testid="inspector">
      <h2 className={styles.header}>
        Frame {String(frameIndex).padStart(2, '0')} Inspector
      </h2>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Audit Score</h3>
        <ScoreDisplay score={auditReport?.compositeScore ?? 0} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Flags ({auditReport?.flags?.length ?? 0})
        </h3>
        <FlagsList flags={auditReport?.flags ?? []} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Metrics Breakdown</h3>
        <MetricsBreakdown metrics={auditReport?.metrics} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Generation Prompt</h3>
        <PromptDisplay prompt={auditReport?.promptUsed ?? 'No prompt recorded'} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Attempt History ({attemptHistory?.length ?? 0})
        </h3>
        <AttemptHistory attempts={attemptHistory ?? []} />
      </section>
    </div>
  );
};

export default Inspector;
