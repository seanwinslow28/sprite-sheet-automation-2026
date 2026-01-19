/**
 * FrameThumbnail component - Individual frame in the timeline filmstrip
 * Per Story 7.2: 64px thumbnails with status color coding
 */

import React from 'react';
import type { DirectorFrameState, FrameStatus } from '../../types/director-session';
import styles from './FrameThumbnail.module.css';

interface FrameThumbnailProps {
  frame: DirectorFrameState;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Status color mapping - meets WCAG AA contrast requirements
 * Per AC #2: Green=APPROVED, Yellow=AUDIT_WARN, Red=AUDIT_FAIL
 */
const STATUS_COLORS: Record<FrameStatus, string> = {
  PENDING: '#888888',      // Gray - neutral
  GENERATED: '#888888',    // Gray - processing
  AUDIT_FAIL: '#ff4444',   // Red - needs attention
  AUDIT_WARN: '#ffcc00',   // Yellow - needs review
  APPROVED: '#44cc44',     // Green - ready
};

/**
 * Status labels for tooltips
 */
const STATUS_LABELS: Record<FrameStatus, string> = {
  PENDING: 'Pending',
  GENERATED: 'Generated',
  AUDIT_FAIL: 'Failed Audit',
  AUDIT_WARN: 'Needs Review',
  APPROVED: 'Approved',
};

export const FrameThumbnail: React.FC<FrameThumbnailProps> = ({
  frame,
  isSelected,
  onClick,
}) => {
  const borderColor = STATUS_COLORS[frame.status];
  const statusLabel = STATUS_LABELS[frame.status];
  const score = frame.auditReport?.compositeScore;
  const scoreDisplay = score !== undefined ? `${(score * 100).toFixed(0)}%` : '';

  // Frame number with leading zeros
  const frameNumber = String(frame.frameIndex).padStart(2, '0');

  // Handle keyboard interaction for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${styles.thumbnail} ${isSelected ? styles.selected : ''}`}
      style={{ borderColor }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Frame ${frameNumber}: ${statusLabel}`}
      title={`Frame ${frameNumber}: ${statusLabel}${scoreDisplay ? ` (${scoreDisplay})` : ''}`}
      data-testid={`frame-thumbnail-${frame.frameIndex}`}
    >
      {/* Frame image - shows placeholder if no base64 data */}
      {frame.imageBase64 ? (
        <img
          src={`data:image/png;base64,${frame.imageBase64}`}
          alt={`Frame ${frameNumber}`}
          className={styles.image}
          draggable={false}
        />
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.placeholderText}>{frameNumber}</span>
        </div>
      )}

      {/* Frame number label - bottom left */}
      <div className={styles.label}>
        {frameNumber}
      </div>

      {/* Audit score badge - top right (only if score exists) */}
      {score !== undefined && score > 0 && (
        <div className={styles.score}>
          {scoreDisplay}
        </div>
      )}

      {/* Status indicator dot - top left for quick scanning */}
      <div
        className={styles.statusDot}
        style={{ backgroundColor: borderColor }}
        aria-hidden="true"
      />
    </div>
  );
};
