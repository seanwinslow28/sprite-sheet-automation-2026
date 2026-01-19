/**
 * DiffOverlay - Main component for visual diff overlays
 * Per Story 7.8: Palette issues and alignment visualization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PaletteDiffOverlay } from './PaletteDiffOverlay';
import { AlignmentOverlay } from './AlignmentOverlay';
import {
  hexToRgb,
  findOffPalettePixels,
  legalizeColors,
  type PixelPosition,
  type RGB,
} from '../../utils/colorUtils';
import { detectBaseline } from '../../utils/baselineUtils';
import styles from './DiffOverlay.module.css';

export type OverlayMode = 'none' | 'palette' | 'alignment';

export interface DiffOverlayProps {
  /** Current frame index */
  frameIndex: number;
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
  /** Zoom level for scaling */
  zoomLevel: number;
  /** Character palette as hex colors */
  palette: string[];
  /** Anchor frame baseline Y coordinate */
  anchorBaselineY: number;
  /** Current frame image as base64 */
  imageBase64?: string;
  /** Callback when frame image is updated (from legalize) */
  onImageUpdate?: (newImageBase64: string) => void;
}

export const DiffOverlay: React.FC<DiffOverlayProps> = ({
  frameIndex,
  canvasWidth,
  canvasHeight,
  zoomLevel,
  palette,
  anchorBaselineY,
  imageBase64,
  onImageUpdate,
}) => {
  const [mode, setMode] = useState<OverlayMode>('none');
  const [offPalettePixels, setOffPalettePixels] = useState<PixelPosition[]>([]);
  const [currentBaselineY, setCurrentBaselineY] = useState<number>(anchorBaselineY);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Convert palette to RGB
  const paletteRgb: RGB[] = palette.map(hexToRgb);

  // Analyze for palette issues when mode switches to palette
  useEffect(() => {
    if (mode === 'palette' && imageBase64) {
      setIsAnalyzing(true);
      findOffPalettePixels(imageBase64, paletteRgb)
        .then(setOffPalettePixels)
        .finally(() => setIsAnalyzing(false));
    } else if (mode !== 'palette') {
      setOffPalettePixels([]);
    }
  }, [mode, imageBase64, palette]);

  // Detect baseline when mode switches to alignment
  useEffect(() => {
    if (mode === 'alignment' && imageBase64) {
      setIsAnalyzing(true);
      detectBaseline(imageBase64)
        .then((result) => setCurrentBaselineY(result.baselineY))
        .finally(() => setIsAnalyzing(false));
    }
  }, [mode, imageBase64]);

  // Handle legalize action
  const handleLegalize = useCallback(async () => {
    if (!imageBase64 || offPalettePixels.length === 0) return;

    setIsAnalyzing(true);
    try {
      const correctedBase64 = await legalizeColors(imageBase64, offPalettePixels, paletteRgb);
      onImageUpdate?.(correctedBase64);
      setOffPalettePixels([]);
      setMode('none');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageBase64, offPalettePixels, paletteRgb, onImageUpdate]);

  // Toggle mode handler
  const toggleMode = (newMode: OverlayMode) => {
    setMode((current) => (current === newMode ? 'none' : newMode));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p') {
        toggleMode('palette');
      } else if (key === 'l') {
        toggleMode('alignment');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.container}>
      {/* Overlay canvas based on mode */}
      {mode === 'palette' && (
        <PaletteDiffOverlay
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoomLevel={zoomLevel}
          offPalettePixels={offPalettePixels}
          onLegalize={handleLegalize}
        />
      )}

      {mode === 'alignment' && (
        <AlignmentOverlay
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoomLevel={zoomLevel}
          anchorBaselineY={anchorBaselineY}
          currentBaselineY={currentBaselineY}
        />
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button
          data-testid="palette-toggle"
          className={`${styles.button} ${mode === 'palette' ? styles.active : ''}`}
          onClick={() => toggleMode('palette')}
          title="Toggle palette issues (P)"
          aria-label="Toggle palette diff overlay"
          aria-pressed={mode === 'palette'}
          disabled={isAnalyzing}
        >
          <span className={styles.icon}>🎨</span>
          <span>Palette</span>
          {offPalettePixels.length > 0 && mode === 'palette' && (
            <span className={styles.badge}>{offPalettePixels.length}</span>
          )}
        </button>

        <button
          data-testid="alignment-toggle"
          className={`${styles.button} ${mode === 'alignment' ? styles.active : ''}`}
          onClick={() => toggleMode('alignment')}
          title="Toggle alignment view (L)"
          aria-label="Toggle alignment overlay"
          aria-pressed={mode === 'alignment'}
          disabled={isAnalyzing}
        >
          <span className={styles.icon}>📏</span>
          <span>Alignment</span>
        </button>
      </div>

      {/* Loading indicator */}
      {isAnalyzing && (
        <div className={styles.analyzing}>Analyzing...</div>
      )}
    </div>
  );
};
