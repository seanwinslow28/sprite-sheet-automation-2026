/**
 * StageToolbar component - Zoom controls and overlay toggles
 * Per Story 7.3: Zoom levels, onion skinning, anchor, and baseline controls
 */

import React from 'react';
import styles from './StageToolbar.module.css';

export type ZoomLevel = 1 | 2 | 4 | 8;

interface StageToolbarProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  showOnionSkin: boolean;
  onToggleOnionSkin: () => void;
  showAnchor: boolean;
  onToggleAnchor: () => void;
  showBaseline: boolean;
  onToggleBaseline: () => void;
}

const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 4, 8];

export const StageToolbar: React.FC<StageToolbarProps> = ({
  zoomLevel,
  onZoomChange,
  showOnionSkin,
  onToggleOnionSkin,
  showAnchor,
  onToggleAnchor,
  showBaseline,
  onToggleBaseline,
}) => {
  const canZoomIn = zoomLevel < 8;
  const canZoomOut = zoomLevel > 1;

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  return (
    <div className={styles.toolbar} data-testid="stage-toolbar">
      {/* Zoom controls */}
      <div className={styles.group}>
        <label htmlFor="zoom-select">Zoom:</label>
        <select
          id="zoom-select"
          value={zoomLevel}
          onChange={(e) => onZoomChange(Number(e.target.value) as ZoomLevel)}
          aria-label="Zoom level"
        >
          {ZOOM_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}x
            </option>
          ))}
        </select>
        <div className={styles.zoomButtons}>
          <button
            className={styles.zoomButton}
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            −
          </button>
          <button
            className={styles.zoomButton}
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.separator} />

      {/* Overlay toggles */}
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${showOnionSkin ? styles.active : ''}`}
          onClick={onToggleOnionSkin}
          title="Toggle previous frame overlay (30% opacity) [O]"
          aria-label="Toggle onion skin"
          aria-pressed={showOnionSkin}
        >
          Onion
          <span className={styles.shortcutHint}>[O]</span>
        </button>

        <button
          className={`${styles.toggle} ${showAnchor ? styles.active : ''}`}
          onClick={onToggleAnchor}
          title="Toggle anchor frame overlay (15% opacity) [A]"
          aria-label="Toggle anchor overlay"
          aria-pressed={showAnchor}
        >
          Anchor
          <span className={styles.shortcutHint}>[A]</span>
        </button>

        <button
          className={`${styles.toggle} ${showBaseline ? styles.active : ''}`}
          onClick={onToggleBaseline}
          title="Toggle baseline guide [B]"
          aria-label="Toggle baseline guide"
          aria-pressed={showBaseline}
        >
          Baseline
          <span className={styles.shortcutHint}>[B]</span>
        </button>
      </div>
    </div>
  );
};
