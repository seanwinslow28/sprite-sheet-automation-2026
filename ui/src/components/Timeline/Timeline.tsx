/**
 * Timeline component - Horizontal filmstrip of frame thumbnails
 * Per Story 7.2: Filmstrip layout at bottom with status indicators
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { FrameThumbnail } from './FrameThumbnail';
import type { DirectorFrameState } from '../../types/director-session';
import styles from './Timeline.module.css';

interface TimelineProps {
  frames: DirectorFrameState[];
  selectedFrameIndex: number;
  onFrameSelect: (frameIndex: number) => void;
}

/**
 * Timeline component displaying frames as a horizontal filmstrip
 * Features:
 * - Horizontal scrollable filmstrip
 * - Status color-coded thumbnails
 * - Keyboard navigation (arrow keys)
 * - Auto-scroll to selected frame
 * - Scroll buttons for mouse users
 */
export const Timeline: React.FC<TimelineProps> = ({
  frames,
  selectedFrameIndex,
  onFrameSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Scroll amount for button clicks (pixels)
  const SCROLL_AMOUNT = 200;

  // Scroll the filmstrip by a given amount
  const scrollBy = useCallback((amount: number) => {
    if (filmstripRef.current) {
      filmstripRef.current.scrollBy({
        left: amount,
        behavior: 'smooth',
      });
    }
  }, []);

  // Scroll to a specific frame (center it in view)
  const scrollToFrame = useCallback((index: number) => {
    if (filmstripRef.current) {
      const thumbnails = filmstripRef.current.children;
      if (thumbnails[index]) {
        (thumbnails[index] as HTMLElement).scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }
  }, []);

  // Auto-scroll when selected frame changes
  useEffect(() => {
    scrollToFrame(selectedFrameIndex);
  }, [selectedFrameIndex, scrollToFrame]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (selectedFrameIndex > 0) {
        onFrameSelect(selectedFrameIndex - 1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (selectedFrameIndex < frames.length - 1) {
        onFrameSelect(selectedFrameIndex + 1);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      onFrameSelect(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onFrameSelect(frames.length - 1);
    }
  }, [selectedFrameIndex, frames.length, onFrameSelect]);

  // Empty state
  if (frames.length === 0) {
    return (
      <div className={styles.timelineWrapper} data-testid="timeline">
        <div className={styles.emptyState}>
          No frames loaded
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.timelineWrapper}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-testid="timeline"
      role="listbox"
      aria-label="Animation frames"
      aria-activedescendant={`frame-thumbnail-${selectedFrameIndex}`}
    >
      {/* Left scroll button */}
      <button
        className={styles.scrollButton}
        onClick={() => scrollBy(-SCROLL_AMOUNT)}
        aria-label="Scroll left"
        type="button"
      >
        <span className={styles.scrollArrow}>◀</span>
      </button>

      {/* Filmstrip container */}
      <div
        ref={filmstripRef}
        className={styles.filmstrip}
        role="presentation"
      >
        {frames.map((frame) => (
          <FrameThumbnail
            key={frame.id}
            frame={frame}
            isSelected={frame.frameIndex === selectedFrameIndex}
            onClick={() => onFrameSelect(frame.frameIndex)}
          />
        ))}
      </div>

      {/* Right scroll button */}
      <button
        className={styles.scrollButton}
        onClick={() => scrollBy(SCROLL_AMOUNT)}
        aria-label="Scroll right"
        type="button"
      >
        <span className={styles.scrollArrow}>▶</span>
      </button>

      {/* Frame counter */}
      <div className={styles.frameCounter}>
        {selectedFrameIndex + 1} / {frames.length}
      </div>
    </div>
  );
};
