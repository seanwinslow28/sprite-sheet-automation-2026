/**
 * AttemptHistory - Shows previous generation attempts with scores
 * Per Story 7.7: AC #5 - Shows previous attempts with their scores
 */

import React, { useState } from 'react';
import styles from './AttemptHistory.module.css';

export interface AttemptEntry {
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Composite score for this attempt */
  score: number;
  /** Status of this attempt */
  status: 'approved' | 'rejected' | 'pending';
  /** Timestamp of attempt */
  timestamp?: string;
  /** Reason code if rejected */
  reasonCode?: string;
}

interface AttemptHistoryProps {
  /** Array of attempt entries */
  attempts: AttemptEntry[];
}

export const AttemptHistory: React.FC<AttemptHistoryProps> = ({ attempts }) => {
  const [selectedAttempt, setSelectedAttempt] = useState<number | null>(null);

  if (attempts.length === 0) {
    return (
      <div className={styles.noAttempts} data-testid="no-attempts">
        No previous attempts
      </div>
    );
  }

  const handleAttemptClick = (attemptNumber: number) => {
    setSelectedAttempt(selectedAttempt === attemptNumber ? null : attemptNumber);
  };

  return (
    <div className={styles.container} data-testid="attempt-history">
      <div className={styles.attemptsList}>
        {attempts.map((attempt) => {
          const isSelected = selectedAttempt === attempt.attemptNumber;
          const statusClass = styles[attempt.status] ?? '';

          return (
            <button
              key={attempt.attemptNumber}
              className={`${styles.attemptItem} ${statusClass} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleAttemptClick(attempt.attemptNumber)}
              data-testid={`attempt-${attempt.attemptNumber}`}
              aria-pressed={isSelected}
            >
              <span className={styles.attemptNumber}>#{attempt.attemptNumber}</span>
              <span className={styles.attemptScore}>
                {Math.round(attempt.score * 100)}%
              </span>
              <span className={`${styles.attemptStatus} ${statusClass}`}>
                {attempt.status}
              </span>
            </button>
          );
        })}
      </div>

      {selectedAttempt !== null && (
        <AttemptDetail
          attempt={attempts.find((a) => a.attemptNumber === selectedAttempt)!}
        />
      )}
    </div>
  );
};

interface AttemptDetailProps {
  attempt: AttemptEntry;
}

const AttemptDetail: React.FC<AttemptDetailProps> = ({ attempt }) => {
  return (
    <div className={styles.attemptDetail} data-testid="attempt-detail">
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Attempt</span>
        <span className={styles.detailValue}>#{attempt.attemptNumber}</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Score</span>
        <span className={styles.detailValue}>{(attempt.score * 100).toFixed(1)}%</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Status</span>
        <span className={`${styles.detailValue} ${styles[attempt.status]}`}>
          {attempt.status}
        </span>
      </div>
      {attempt.timestamp && (
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Time</span>
          <span className={styles.detailValue}>
            {new Date(attempt.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
      {attempt.reasonCode && (
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Reason</span>
          <span className={styles.detailValue}>{attempt.reasonCode}</span>
        </div>
      )}
    </div>
  );
};

export default AttemptHistory;
