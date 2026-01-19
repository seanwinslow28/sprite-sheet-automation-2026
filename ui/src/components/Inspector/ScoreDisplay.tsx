/**
 * ScoreDisplay - Displays audit composite score with color coding
 * Per Story 7.7: AC #1 - Displays composite quality score (0.0-1.0)
 */

import React from 'react';
import styles from './ScoreDisplay.module.css';

interface ScoreDisplayProps {
  /** Composite score from 0.0 to 1.0 */
  score: number;
}

/**
 * Get color based on score threshold
 */
function getScoreColor(score: number): string {
  if (score >= 0.8) return '#44cc44'; // Green - Good
  if (score >= 0.6) return '#ffcc00'; // Yellow - Marginal
  return '#ff4444'; // Red - Poor
}

/**
 * Get label based on score threshold
 */
function getScoreLabel(score: number): string {
  if (score >= 0.8) return 'Good';
  if (score >= 0.6) return 'Marginal';
  return 'Poor';
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score }) => {
  const percentage = Math.round(score * 100);
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className={styles.container} data-testid="score-display">
      <div className={styles.scoreValue} style={{ color }} data-testid="score-value">
        {percentage}%
      </div>
      <div className={styles.scoreBar} data-testid="score-bar">
        <div
          className={styles.scoreFill}
          style={{ width: `${percentage}%`, backgroundColor: color }}
          data-testid="score-fill"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <div className={styles.label} data-testid="score-label">
        {label}
      </div>
    </div>
  );
};

export default ScoreDisplay;
