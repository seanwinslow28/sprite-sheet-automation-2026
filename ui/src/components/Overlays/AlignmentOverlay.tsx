/**
 * AlignmentOverlay - Visualizes baseline comparison between anchor and current frame
 * Per Story 7.8 AC #4-7: Baseline lines, gap label, drift direction
 */

import React, { useRef, useEffect } from 'react';
import { formatDrift, calculateBaselineDrift } from '../../utils/baselineUtils';
import styles from './DiffOverlay.module.css';

export interface AlignmentOverlayProps {
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
  /** Zoom level for scaling */
  zoomLevel: number;
  /** Anchor frame baseline Y coordinate */
  anchorBaselineY: number;
  /** Current frame baseline Y coordinate */
  currentBaselineY: number;
}

export const AlignmentOverlay: React.FC<AlignmentOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  anchorBaselineY,
  currentBaselineY,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate drift info
  const { drift, direction } = calculateBaselineDrift(anchorBaselineY, currentBaselineY);
  const formattedDrift = formatDrift(drift, direction);

  // Draw alignment overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anchorY = anchorBaselineY * zoomLevel;
    const currentY = currentBaselineY * zoomLevel;

    // Draw anchor baseline (Cyan, solid)
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, anchorY);
    ctx.lineTo(canvas.width, anchorY);
    ctx.stroke();

    // Draw current baseline (Red, solid)
    ctx.strokeStyle = '#FF4444';
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(canvas.width, currentY);
    ctx.stroke();

    // Draw gap indicator line (white dashed, on right side)
    if (Math.abs(drift) > 0) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(canvas.width - 40, anchorY);
      ctx.lineTo(canvas.width - 40, currentY);
      ctx.stroke();
    }
  }, [anchorBaselineY, currentBaselineY, zoomLevel, canvasWidth, canvasHeight, drift]);

  return (
    <div className={styles.alignmentContainer}>
      <canvas
        ref={canvasRef}
        data-testid="alignment-overlay-canvas"
        width={canvasWidth}
        height={canvasHeight}
        className={styles.overlay}
      />

      {/* Labels positioned over the canvas */}
      <div className={styles.labels}>
        <div
          data-testid="anchor-label"
          className={styles.anchorLabel}
          style={{ top: `${anchorBaselineY * zoomLevel - 20}px` }}
        >
          Anchor: {anchorBaselineY}px
        </div>

        <div
          data-testid="current-label"
          className={styles.currentLabel}
          style={{ top: `${currentBaselineY * zoomLevel + 6}px` }}
        >
          Current: {currentBaselineY}px
        </div>

        <div
          data-testid="gap-label"
          className={`${styles.gapLabel} ${direction !== 'none' ? styles[direction] : ''}`}
          style={{
            top: `${((anchorBaselineY + currentBaselineY) / 2) * zoomLevel - 8}px`,
            right: '60px',
          }}
        >
          {formattedDrift}
        </div>
      </div>
    </div>
  );
};
