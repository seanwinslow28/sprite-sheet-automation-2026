/**
 * NudgeTool component - Manual alignment adjustment tool
 * Per Story 7.4: Drag-to-nudge with real-time preview and delta recording
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useDrag, type DragDelta } from '../../hooks/useDrag';
import type { HumanAlignmentDelta } from '../../types/director-session';
import styles from './NudgeTool.module.css';

interface NudgeToolProps {
  /** Index of the frame being nudged */
  frameIndex: number;
  /** Current zoom level for delta scaling */
  zoomLevel: number;
  /** Callback when nudge is applied */
  onNudgeApply: (delta: HumanAlignmentDelta) => void;
  /** Callback when alignment is reset */
  onNudgeReset: () => void;
  /** Callback during drag for visual preview */
  onPreviewUpdate?: (offset: DragDelta) => void;
  /** Current alignment delta (if any) */
  currentAlignment?: HumanAlignmentDelta;
  /** Whether the tool is disabled */
  disabled?: boolean;
}

/**
 * Format a pixel offset value for display
 */
function formatOffset(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

export const NudgeTool: React.FC<NudgeToolProps> = ({
  frameIndex,
  zoomLevel,
  onNudgeApply,
  onNudgeReset,
  onPreviewUpdate,
  currentAlignment,
  disabled = false,
}) => {
  // Track the accumulated offset (existing + drag)
  const [accumulatedOffset, setAccumulatedOffset] = useState<DragDelta>({
    x: currentAlignment?.userOverrideX ?? 0,
    y: currentAlignment?.userOverrideY ?? 0,
  });

  // Sync accumulated offset with prop changes
  useEffect(() => {
    setAccumulatedOffset({
      x: currentAlignment?.userOverrideX ?? 0,
      y: currentAlignment?.userOverrideY ?? 0,
    });
  }, [currentAlignment]);

  // Handle drag completion - record the alignment delta
  const handleDragEnd = useCallback(
    (delta: DragDelta) => {
      if (disabled || (delta.x === 0 && delta.y === 0)) {
        return;
      }

      // Calculate new total offset
      const newOffset = {
        x: accumulatedOffset.x + delta.x,
        y: accumulatedOffset.y + delta.y,
      };

      // Create alignment delta
      const alignmentDelta: HumanAlignmentDelta = {
        frameId: `frame_${String(frameIndex).padStart(4, '0')}`,
        userOverrideX: newOffset.x,
        userOverrideY: newOffset.y,
        timestamp: new Date().toISOString(),
      };

      // Update accumulated offset
      setAccumulatedOffset(newOffset);

      // Notify parent
      onNudgeApply(alignmentDelta);
    },
    [frameIndex, accumulatedOffset, onNudgeApply, disabled]
  );

  // Handle drag move - update preview
  const handleDragMove = useCallback(
    (delta: DragDelta) => {
      if (disabled) return;

      const previewOffset = {
        x: accumulatedOffset.x + delta.x,
        y: accumulatedOffset.y + delta.y,
      };

      if (onPreviewUpdate) {
        onPreviewUpdate(previewOffset);
      }
    },
    [accumulatedOffset, onPreviewUpdate, disabled]
  );

  // Use drag hook with zoom scaling
  const { isDragging, delta, handlers } = useDrag({
    scale: zoomLevel,
    onDragEnd: handleDragEnd,
    onDragMove: handleDragMove,
  });

  // Handle reset button click
  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setAccumulatedOffset({ x: 0, y: 0 });
      onNudgeReset();
    },
    [onNudgeReset]
  );

  // Calculate current display offset (accumulated + current drag)
  const displayOffset = isDragging
    ? { x: accumulatedOffset.x + delta.x, y: accumulatedOffset.y + delta.y }
    : accumulatedOffset;

  const hasOffset = displayOffset.x !== 0 || displayOffset.y !== 0;

  return (
    <div
      className={`${styles.nudgeOverlay} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      data-testid="nudge-tool"
      aria-label={`Nudge tool for frame ${frameIndex}`}
      role="application"
      {...(disabled ? {} : handlers)}
    >
      {/* Offset indicator - shows current adjustment */}
      {hasOffset && (
        <div className={styles.offsetIndicator} data-testid="offset-indicator">
          X: {formatOffset(displayOffset.x)}px, Y: {formatOffset(displayOffset.y)}px
        </div>
      )}

      {/* Reset button - only show when there's an offset and not dragging */}
      {hasOffset && !isDragging && (
        <button
          className={styles.resetButton}
          onClick={handleReset}
          onMouseDown={(e) => e.stopPropagation()}
          data-testid="reset-alignment-button"
          aria-label="Reset alignment"
        >
          Reset Alignment
        </button>
      )}

      {/* Crosshair guides during drag */}
      {isDragging && (
        <>
          <div
            className={`${styles.crosshair} ${styles.crosshairH}`}
            style={{ top: '50%' }}
          />
          <div
            className={`${styles.crosshair} ${styles.crosshairV}`}
            style={{ left: '50%' }}
          />
        </>
      )}
    </div>
  );
};

export default NudgeTool;
