/**
 * MaskPenTool component - Brush-based mask drawing for inpainting regions
 * Per Story 7.5: Brush cursor, mask drawing, erasing, storage, and prompt input
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import styles from './MaskPenTool.module.css';

interface MaskPenToolProps {
  /** Width of the canvas in display pixels */
  canvasWidth: number;
  /** Height of the canvas in display pixels */
  canvasHeight: number;
  /** Current zoom level for coordinate scaling */
  zoomLevel: number;
  /** Source image dimensions (for mask export) */
  sourceSize?: number;
  /** Callback when mask and prompt are ready for patching */
  onMaskComplete: (maskBase64: string, prompt: string) => void;
  /** Callback when mask is cleared/cancelled */
  onCancel?: () => void;
  /** Whether the tool is disabled */
  disabled?: boolean;
}

/** Mask drawing color - semi-transparent red */
const MASK_COLOR = 'rgba(255, 0, 0, 0.5)';

/** Default brush size */
const DEFAULT_BRUSH_SIZE = 20;

/** Min/max brush sizes */
const MIN_BRUSH_SIZE = 5;
const MAX_BRUSH_SIZE = 50;

export const MaskPenTool: React.FC<MaskPenToolProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  sourceSize = 128,
  onMaskComplete,
  onCancel,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushPreviewRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [hasMask, setHasMask] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Convert mouse event to canvas coordinates
   */
  const getCanvasPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return { x: 0, y: 0 };
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) / zoomLevel,
        y: (clientY - rect.top) / zoomLevel,
      };
    },
    [zoomLevel]
  );

  /**
   * Draw a brush stroke at position, interpolating from last position
   */
  const draw = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set composite operation based on draw/erase mode
      ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
      ctx.fillStyle = MASK_COLOR;

      const scaledBrushSize = brushSize / zoomLevel;

      // Draw circle at current position
      ctx.beginPath();
      ctx.arc(x, y, scaledBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Interpolate between last position and current for smooth strokes
      if (lastPosRef.current) {
        const dx = x - lastPosRef.current.x;
        const dy = y - lastPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(distance / (scaledBrushSize / 4)));

        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const ix = lastPosRef.current.x + dx * t;
          const iy = lastPosRef.current.y + dy * t;

          ctx.beginPath();
          ctx.arc(ix, iy, scaledBrushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      lastPosRef.current = { x, y };

      // Check if we have any mask content
      checkMaskContent();
    },
    [brushSize, zoomLevel, isErasing]
  );

  /**
   * Check if mask has any content (non-transparent pixels)
   */
  const checkMaskContent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] > 0);
    setHasMask(hasContent);
  }, []);

  /**
   * Handle mouse/touch down - start drawing
   */
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;

      // Right click for erase mode
      if ('button' in e && e.button === 2) {
        setIsErasing(true);
      }

      setIsDrawing(true);
      lastPosRef.current = null;
      const pos = getCanvasPos(e);
      draw(pos.x, pos.y);
    },
    [disabled, getCanvasPos, draw]
  );

  /**
   * Handle mouse/touch move - continue drawing
   */
  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Update cursor position for brush preview
      if ('clientX' in e) {
        setCursorPos({ x: e.clientX, y: e.clientY });
      } else if (e.touches[0]) {
        setCursorPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }

      if (!isDrawing || disabled) return;

      const pos = getCanvasPos(e);
      draw(pos.x, pos.y);
    },
    [isDrawing, disabled, getCanvasPos, draw]
  );

  /**
   * Handle mouse/touch up - end drawing
   */
  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
    setIsErasing(false);
    lastPosRef.current = null;
  }, []);

  /**
   * Handle mouse leave - end drawing and hide cursor preview
   */
  const handlePointerLeave = useCallback(() => {
    handlePointerUp();
    setCursorPos(null);
  }, [handlePointerUp]);

  /**
   * Clear all mask content
   */
  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
    setPrompt('');
  }, []);

  /**
   * Export mask as binary PNG (black background, white mask)
   */
  const getMaskAsBase64 = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Create binary mask canvas at source resolution
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = sourceSize;
    maskCanvas.height = sourceSize;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return '';

    // Black background
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, sourceSize, sourceSize);

    // Get mask pixels from overlay
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Scale factor from display canvas to source
    const scale = sourceSize / canvas.width;

    // Convert red overlay to white mask at source resolution
    for (let y = 0; y < sourceSize; y++) {
      for (let x = 0; x < sourceSize; x++) {
        // Sample from display canvas
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
        const srcIdx = (srcY * canvas.width + srcX) * 4;

        // If pixel has alpha (mask is drawn), set to white
        if (imageData.data[srcIdx + 3] > 0) {
          const dstIdx = (y * sourceSize + x) * 4;
          const maskData = maskCtx.getImageData(x, y, 1, 1);
          maskData.data[0] = 255; // R
          maskData.data[1] = 255; // G
          maskData.data[2] = 255; // B
          maskData.data[3] = 255; // A
          maskCtx.putImageData(maskData, x, y);
        }
      }
    }

    return maskCanvas.toDataURL('image/png').split(',')[1];
  }, [sourceSize]);

  /**
   * Handle patch button click
   */
  const handlePatch = useCallback(() => {
    if (!hasMask || !prompt.trim()) return;

    const maskBase64 = getMaskAsBase64();
    onMaskComplete(maskBase64, prompt.trim());
  }, [hasMask, prompt, getMaskAsBase64, onMaskComplete]);

  /**
   * Handle cancel button click
   */
  const handleCancel = useCallback(() => {
    clearMask();
    if (onCancel) {
      onCancel();
    }
  }, [clearMask, onCancel]);

  /**
   * Toggle eraser mode
   */
  const toggleEraser = useCallback(() => {
    setIsErasing((prev) => !prev);
  }, []);

  // Prevent context menu on right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className={`${styles.maskToolContainer} ${disabled ? styles.disabled : ''}`}
      data-testid="mask-pen-tool"
    >
      {/* Overlay canvas for mask drawing */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.maskCanvas}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onContextMenu={handleContextMenu}
        data-testid="mask-canvas"
        aria-label="Mask drawing canvas"
      />

      {/* Brush cursor preview */}
      {cursorPos && !disabled && (
        <div
          ref={brushPreviewRef}
          className={`${styles.brushPreview} ${isErasing ? styles.erasing : ''}`}
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: brushSize,
            height: brushSize,
          }}
          data-testid="brush-preview"
        />
      )}

      {/* Controls panel */}
      <div className={styles.controls} data-testid="mask-controls">
        <div className={styles.brushControls}>
          <label htmlFor="brush-size">Brush Size: {brushSize}px</label>
          <input
            id="brush-size"
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            aria-label="Brush size"
          />
        </div>

        <div className={styles.buttonRow}>
          <button
            className={`${styles.button} ${isErasing ? styles.active : ''}`}
            onClick={toggleEraser}
            data-testid="eraser-toggle"
            aria-label="Toggle eraser"
            aria-pressed={isErasing}
          >
            Eraser
          </button>

          <button
            className={styles.button}
            onClick={clearMask}
            data-testid="clear-mask-button"
            aria-label="Clear mask"
          >
            Clear
          </button>
        </div>

        {hasMask && (
          <div className={styles.maskInfo}>Mask area marked</div>
        )}
      </div>

      {/* Prompt panel - shows when mask has content */}
      {hasMask && (
        <div className={styles.promptPanel} data-testid="prompt-panel">
          <label htmlFor="correction-prompt">Correction Prompt:</label>
          <textarea
            id="correction-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the fix, e.g., 'Clenched fist, darker skin'"
            rows={2}
            data-testid="correction-prompt"
            aria-label="Correction prompt"
          />
          <div className={styles.promptButtons}>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              className={styles.patchButton}
              onClick={handlePatch}
              disabled={!prompt.trim()}
              data-testid="patch-button"
              aria-label="Patch region"
            >
              Patch Region
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaskPenTool;
