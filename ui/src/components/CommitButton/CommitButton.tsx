/**
 * CommitButton - Finalize Director session and trigger export
 * Per Story 7.9 AC #5-7: Server close, CLI continues, success message
 */

import React, { useState, useCallback } from 'react';
import styles from './CommitButton.module.css';

/**
 * Result from commit API
 */
export interface CommitResult {
  success: boolean;
  approvedCount?: number;
  nudgedCount?: number;
  patchedCount?: number;
  error?: string;
}

export interface CommitButtonProps {
  /** Total approved frame count (for confirmation) */
  approvedFrameCount: number;
  /** Callback to perform commit API call */
  onCommit?: () => Promise<CommitResult>;
  /** Callback after successful commit */
  onCommitComplete?: (result: CommitResult) => void;
  /** Whether commit is disabled */
  disabled?: boolean;
}

export const CommitButton: React.FC<CommitButtonProps> = ({
  approvedFrameCount,
  onCommit,
  onCommitComplete,
  disabled = false,
}) => {
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = useCallback(async () => {
    if (approvedFrameCount === 0) {
      setError('No approved frames to commit');
      return;
    }

    // Confirm with user
    const confirmed = window.confirm(
      `Commit ${approvedFrameCount} approved frame${approvedFrameCount === 1 ? '' : 's'}?\n\n` +
        'This will finalize your changes and proceed to atlas export.'
    );

    if (!confirmed) return;

    setIsCommitting(true);
    setError(null);

    try {
      let commitResult: CommitResult;

      if (onCommit) {
        commitResult = await onCommit();
      } else {
        // Default: call API endpoint
        const response = await fetch('/api/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        commitResult = await response.json();
      }

      if (commitResult.success) {
        setResult(commitResult);
        onCommitComplete?.(commitResult);
      } else {
        setError(commitResult.error || 'Commit failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  }, [approvedFrameCount, onCommit, onCommitComplete]);

  // Success view
  if (result) {
    return (
      <div className={styles.success} data-testid="commit-success">
        <h2>Commit Complete!</h2>
        <ul className={styles.stats}>
          <li data-testid="approved-count">
            <span className={styles.label}>Approved frames:</span>
            <span className={styles.value}>{result.approvedCount}</span>
          </li>
          <li data-testid="nudged-count">
            <span className={styles.label}>Nudged:</span>
            <span className={styles.value}>{result.nudgedCount}</span>
          </li>
          <li data-testid="patched-count">
            <span className={styles.label}>Patched:</span>
            <span className={styles.value}>{result.patchedCount}</span>
          </li>
        </ul>
        <p className={styles.exporting} data-testid="exporting-message">
          Proceeding to atlas export...
        </p>
      </div>
    );
  }

  // Error display
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <button
          className={styles.commitButton}
          onClick={handleCommit}
          disabled={isCommitting || disabled || approvedFrameCount === 0}
          data-testid="commit-button"
        >
          {isCommitting ? 'Committing...' : 'Commit & Export'}
        </button>
        <p className={styles.error} data-testid="commit-error">
          {error}
        </p>
      </div>
    );
  }

  // Default button view
  return (
    <button
      className={styles.commitButton}
      onClick={handleCommit}
      disabled={isCommitting || disabled || approvedFrameCount === 0}
      data-testid="commit-button"
      aria-label={`Commit ${approvedFrameCount} approved frames`}
    >
      {isCommitting ? (
        <span className={styles.loading}>Committing...</span>
      ) : (
        <>Commit & Export</>
      )}
    </button>
  );
};
