/**
 * PaletteDiffOverlay - Visualizes off-palette pixels
 * Per Story 7.8 AC #1-3: Blinking magenta highlight for illegal pixels
 */

import React, { useRef, useEffect } from 'react';
import type { PixelPosition } from '../../utils/colorUtils';
import styles from './DiffOverlay.module.css';

export interface PaletteDiffOverlayProps {
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
  /** Zoom level for scaling */
  zoomLevel: number;
  /** Array of off-palette pixel positions */
  offPalettePixels: PixelPosition[];
  /** Callback when legalize button is clicked */
  onLegalize?: () => void;
}

export const PaletteDiffOverlay: React.FC<PaletteDiffOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  offPalettePixels,
  onLegalize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw overlay whenever pixels change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw magenta highlights at 50% opacity
    ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';

    offPalettePixels.forEach(({ x, y }) => {
      ctx.fillRect(x * zoomLevel, y * zoomLevel, zoomLevel, zoomLevel);
    });
  }, [offPalettePixels, zoomLevel, canvasWidth, canvasHeight]);

  const hasPixels = offPalettePixels.length > 0;

  return (
    <div className={styles.paletteContainer}>
      <canvas
        ref={canvasRef}
        data-testid="palette-overlay-canvas"
        width={canvasWidth}
        height={canvasHeight}
        className={`${styles.overlay} ${hasPixels ? styles.blinking : ''}`}
      />

      {hasPixels && (
        <div className={styles.paletteInfo}>
          <span className={styles.badge} data-testid="pixel-count">
            {offPalettePixels.length}
          </span>
          <span className={styles.infoText}>off-palette pixels</span>

          {onLegalize && (
            <button
              data-testid="legalize-button"
              className={styles.legalizeButton}
              onClick={onLegalize}
              title="Snap off-palette pixels to nearest valid color"
            >
              Legalize Colors
            </button>
          )}
        </div>
      )}
    </div>
  );
};
