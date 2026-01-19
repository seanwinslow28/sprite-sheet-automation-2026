/**
 * Stage component - Central workspace for frame display and editing
 * Per Story 7.3: High zoom display with onion skinning and baseline guides
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { DirectorFrameState } from '../../types/director-session';
import { StageToolbar, type ZoomLevel } from './StageToolbar';
import styles from './Stage.module.css';

/**
 * Anchor analysis data from backend
 */
export interface AnchorAnalysis {
  baselineY: number;
  rootX: number;
  visibleBounds: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface StageProps {
  frames: DirectorFrameState[];
  selectedFrameIndex: number;
  anchorAnalysis?: AnchorAnalysis;
  sourceSize?: number; // Default: 128px
}

/**
 * Opacity levels for overlay layers
 * Per AC #2, #3: Previous at 30%, Anchor at 15%
 */
const OPACITY = {
  ANCHOR: 0.15,
  PREVIOUS: 0.30,
  CURRENT: 1.0,
};

/**
 * Baseline guide styling
 */
const BASELINE_STYLE = {
  color: '#00FFFF', // Cyan
  lineWidth: 1,
  dashPattern: [4, 4] as number[],
};

export const Stage: React.FC<StageProps> = ({
  frames,
  selectedFrameIndex,
  anchorAnalysis,
  sourceSize = 128,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State for toolbar controls
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(4);
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [showAnchor, setShowAnchor] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);

  // Get frames for rendering
  const currentFrame = frames[selectedFrameIndex];
  const prevFrame = selectedFrameIndex > 0 ? frames[selectedFrameIndex - 1] : undefined;
  const anchorFrame = frames[0];

  /**
   * Draw a single frame to the canvas context
   */
  const drawFrame = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      frame: DirectorFrameState,
      displaySize: number
    ): Promise<void> => {
      if (!frame.imageBase64) return;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, displaySize, displaySize);
          resolve();
        };
        img.onerror = () => {
          reject(new Error(`Failed to load frame ${frame.frameIndex}`));
        };
        img.src = `data:image/png;base64,${frame.imageBase64}`;
      });
    },
    []
  );

  /**
   * Draw the baseline guide
   */
  const drawBaselineGuide = useCallback(
    (ctx: CanvasRenderingContext2D, baselineY: number, zoom: number, width: number) => {
      const y = baselineY * zoom;

      ctx.strokeStyle = BASELINE_STYLE.color;
      ctx.lineWidth = BASELINE_STYLE.lineWidth;
      ctx.setLineDash(BASELINE_STYLE.dashPattern);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = BASELINE_STYLE.color;
      ctx.font = '10px monospace';
      ctx.fillText(`baseline: ${Math.round(baselineY)}px`, 4, y - 4);
    },
    []
  );

  /**
   * Main render function
   */
  const renderFrame = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displaySize = sourceSize * zoomLevel;

    canvas.width = displaySize;
    canvas.height = displaySize;

    // Clear canvas
    ctx.clearRect(0, 0, displaySize, displaySize);

    try {
      // Draw onion skin layers (back to front)
      if (showAnchor && anchorFrame && anchorFrame !== currentFrame) {
        ctx.globalAlpha = OPACITY.ANCHOR;
        await drawFrame(ctx, anchorFrame, displaySize);
      }

      if (showOnionSkin && prevFrame) {
        ctx.globalAlpha = OPACITY.PREVIOUS;
        await drawFrame(ctx, prevFrame, displaySize);
      }

      // Draw current frame
      ctx.globalAlpha = OPACITY.CURRENT;
      await drawFrame(ctx, currentFrame, displaySize);

      // Draw baseline guide
      if (showBaseline && anchorAnalysis?.baselineY !== undefined) {
        drawBaselineGuide(ctx, anchorAnalysis.baselineY, zoomLevel, displaySize);
      }
    } catch (error) {
      console.error('Failed to render frame:', error);
    }
  }, [
    currentFrame,
    prevFrame,
    anchorFrame,
    zoomLevel,
    showOnionSkin,
    showAnchor,
    showBaseline,
    anchorAnalysis,
    sourceSize,
    drawFrame,
    drawBaselineGuide,
  ]);

  // Re-render when dependencies change
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case '+':
        case '=':
          if (zoomLevel < 8) {
            setZoomLevel((prev) =>
              prev === 1 ? 2 : prev === 2 ? 4 : prev === 4 ? 8 : prev
            );
          }
          break;
        case '-':
          if (zoomLevel > 1) {
            setZoomLevel((prev) =>
              prev === 8 ? 4 : prev === 4 ? 2 : prev === 2 ? 1 : prev
            );
          }
          break;
        case 'o':
          setShowOnionSkin((prev) => !prev);
          break;
        case 'a':
          setShowAnchor((prev) => !prev);
          break;
        case 'b':
          setShowBaseline((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomLevel]);

  /**
   * Handle scroll wheel zoom
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0 && zoomLevel < 8) {
          setZoomLevel((prev) =>
            prev === 1 ? 2 : prev === 2 ? 4 : prev === 4 ? 8 : prev
          );
        } else if (e.deltaY > 0 && zoomLevel > 1) {
          setZoomLevel((prev) =>
            prev === 8 ? 4 : prev === 4 ? 2 : prev === 2 ? 1 : prev
          );
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomLevel]);

  // Empty state
  if (frames.length === 0) {
    return (
      <div className={styles.stageContainer} data-testid="stage">
        <StageToolbar
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          showOnionSkin={showOnionSkin}
          onToggleOnionSkin={() => setShowOnionSkin(!showOnionSkin)}
          showAnchor={showAnchor}
          onToggleAnchor={() => setShowAnchor(!showAnchor)}
          showBaseline={showBaseline}
          onToggleBaseline={() => setShowBaseline(!showBaseline)}
        />
        <div className={styles.emptyState}>No frames loaded</div>
      </div>
    );
  }

  // Loading state (no current frame)
  if (!currentFrame) {
    return (
      <div className={styles.stageContainer} data-testid="stage">
        <StageToolbar
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          showOnionSkin={showOnionSkin}
          onToggleOnionSkin={() => setShowOnionSkin(!showOnionSkin)}
          showAnchor={showAnchor}
          onToggleAnchor={() => setShowAnchor(!showAnchor)}
          showBaseline={showBaseline}
          onToggleBaseline={() => setShowBaseline(!showBaseline)}
        />
        <div className={styles.loadingState}>Loading frame...</div>
      </div>
    );
  }

  return (
    <div className={styles.stageContainer} data-testid="stage">
      <StageToolbar
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        showOnionSkin={showOnionSkin}
        onToggleOnionSkin={() => setShowOnionSkin(!showOnionSkin)}
        showAnchor={showAnchor}
        onToggleAnchor={() => setShowAnchor(!showAnchor)}
        showBaseline={showBaseline}
        onToggleBaseline={() => setShowBaseline(!showBaseline)}
      />

      <div className={styles.canvasWrapper} ref={containerRef}>
        <div className={styles.checkerboard} data-testid="stage-checkerboard">
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-testid="stage-canvas"
            aria-label={`Frame ${selectedFrameIndex} at ${zoomLevel}x zoom`}
          />
        </div>
      </div>
    </div>
  );
};
