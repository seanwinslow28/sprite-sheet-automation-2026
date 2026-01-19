/**
 * useDrag hook - Custom hook for drag-and-drop interactions
 * Per Story 7.4: Mouse/touch tracking with delta calculation
 */

import { useState, useCallback, useRef } from 'react';

export interface DragDelta {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  delta: DragDelta;
}

export interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface UseDragOptions {
  /** Callback fired when drag ends with final delta */
  onDragEnd?: (delta: DragDelta) => void;
  /** Callback fired during drag with current delta */
  onDragMove?: (delta: DragDelta) => void;
  /** Scale factor for delta calculation (e.g., zoom level) */
  scale?: number;
}

/**
 * Custom hook for managing drag state and delta calculation
 * Supports both mouse and touch events
 */
export function useDrag(options: UseDragOptions = {}): DragState & { handlers: DragHandlers; reset: () => void } {
  const { onDragEnd, onDragMove, scale = 1 } = options;

  const [state, setState] = useState<DragState>({
    isDragging: false,
    delta: { x: 0, y: 0 },
  });

  const startPosRef = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((x: number, y: number) => {
    startPosRef.current = { x, y };
    setState({ isDragging: true, delta: { x: 0, y: 0 } });
  }, []);

  const handleMove = useCallback(
    (x: number, y: number) => {
      setState((prev) => {
        if (!prev.isDragging) return prev;

        // Calculate delta scaled to source pixels
        const delta = {
          x: Math.round((x - startPosRef.current.x) / scale),
          y: Math.round((y - startPosRef.current.y) / scale),
        };

        if (onDragMove) {
          onDragMove(delta);
        }

        return { ...prev, delta };
      });
    },
    [scale, onDragMove]
  );

  const handleEnd = useCallback(() => {
    setState((prev) => {
      if (prev.isDragging && onDragEnd) {
        onDragEnd(prev.delta);
      }
      return { isDragging: false, delta: { x: 0, y: 0 } };
    });
  }, [onDragEnd]);

  const reset = useCallback(() => {
    setState({ isDragging: false, delta: { x: 0, y: 0 } });
    startPosRef.current = { x: 0, y: 0 };
  }, []);

  // Event handlers
  const handlers: DragHandlers = {
    onMouseDown: useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
      },
      [handleStart]
    ),
    onMouseMove: useCallback(
      (e: React.MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      },
      [handleMove]
    ),
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
    onTouchStart: useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
          handleStart(touch.clientX, touch.clientY);
        }
      },
      [handleStart]
    ),
    onTouchMove: useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
          handleMove(touch.clientX, touch.clientY);
        }
      },
      [handleMove]
    ),
    onTouchEnd: handleEnd,
  };

  return {
    isDragging: state.isDragging,
    delta: state.delta,
    handlers,
    reset,
  };
}
