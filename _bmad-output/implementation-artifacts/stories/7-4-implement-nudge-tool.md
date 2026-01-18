# Story 7.4: Implement Nudge Tool for Manual Alignment

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to drag sprites to fine-tune alignment when AutoAligner is imperfect,
**So that** I can correct edge cases without regenerating.

---

## Acceptance Criteria

### Nudge Functionality

1. **Mouse tracking** - System tracks mouse delta (X, Y pixels) during drag
2. **Real-time preview** - Visual preview updates in real-time during drag
3. **Delta recording** - On release, records `HumanAlignmentDelta` with frameId, userOverrideX, userOverrideY, timestamp
4. **Override storage** - Delta stored in `directorOverrides.alignment`
5. **Status update** - Frame status changes to APPROVED (Green border) after nudge
6. **Non-destructive** - Actual pixel data NOT modified until export

---

## Tasks / Subtasks

- [ ] **Task 1: Create NudgeTool component** (AC: #1, #2)
  - [ ] 1.1: Create `ui/src/components/Tools/NudgeTool.tsx`
  - [ ] 1.2: Implement mouse event listeners (mousedown, mousemove, mouseup)
  - [ ] 1.3: Calculate drag delta from start position
  - [ ] 1.4: Update preview offset in real-time
  - [ ] 1.5: Add cursor style change on hover/drag

- [ ] **Task 2: Implement drag state management** (AC: #1)
  - [ ] 2.1: Create `useDrag` custom hook
  - [ ] 2.2: Track isDragging, startPos, currentPos
  - [ ] 2.3: Calculate delta = current - start
  - [ ] 2.4: Handle edge cases (drag outside canvas)
  - [ ] 2.5: Support touch events for tablet use

- [ ] **Task 3: Implement visual preview** (AC: #2)
  - [ ] 3.1: Apply CSS transform during drag
  - [ ] 3.2: Show offset indicator (e.g., "X: +3, Y: -2")
  - [ ] 3.3: Draw guide lines showing original position
  - [ ] 3.4: Use distinct color for offset frame

- [ ] **Task 4: Implement delta recording** (AC: #3, #4)
  - [ ] 4.1: Create `HumanAlignmentDelta` on mouse release
  - [ ] 4.2: Include frameId, X/Y offsets, timestamp
  - [ ] 4.3: Store in session via `updateFrameOverrides()`
  - [ ] 4.4: Persist session to disk immediately

- [ ] **Task 5: Implement status update** (AC: #5)
  - [ ] 5.1: Change frame status to APPROVED on nudge
  - [ ] 5.2: Update Timeline thumbnail border color
  - [ ] 5.3: Log nudge action to session history
  - [ ] 5.4: Show confirmation toast/message

- [ ] **Task 6: Implement undo/reset** (AC: #6)
  - [ ] 6.1: Add "Reset Alignment" button
  - [ ] 6.2: Clear directorOverrides.alignment
  - [ ] 6.3: Restore frame to auto-aligned position
  - [ ] 6.4: Support Ctrl+Z for undo

- [ ] **Task 7: Add tool selection UI** (AC: all)
  - [ ] 7.1: Create tool selector in Stage toolbar
  - [ ] 7.2: Add Nudge tool icon/button
  - [ ] 7.3: Show active tool indicator
  - [ ] 7.4: Add keyboard shortcut (N for Nudge)

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test drag delta calculation
  - [ ] 8.2: Test preview updates during drag
  - [ ] 8.3: Test delta recording on release
  - [ ] 8.4: Test status changes to APPROVED

---

## Dev Notes

### NudgeTool Component

```tsx
// ui/src/components/Tools/NudgeTool.tsx
import React, { useState, useCallback, useRef } from 'react';
import { useDirectorSession } from '../../hooks/useDirectorSession';
import styles from './NudgeTool.module.css';

interface NudgeToolProps {
  frameIndex: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  zoomLevel: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const NudgeTool: React.FC<NudgeToolProps> = ({
  frameIndex,
  canvasRef,
  zoomLevel
}) => {
  const { updateFrameOverrides, updateFrameStatus } = useDirectorSession();

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  });

  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging) return;

    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY
    }));

    // Calculate delta in source pixels (not zoomed)
    const deltaX = Math.round((e.clientX - dragState.startX) / zoomLevel);
    const deltaY = Math.round((e.clientY - dragState.startY) / zoomLevel);

    setOffset({ x: deltaX, y: deltaY });
  }, [dragState.isDragging, dragState.startX, dragState.startY, zoomLevel]);

  const handleMouseUp = useCallback(async () => {
    if (!dragState.isDragging) return;

    // Record the alignment delta
    const delta: HumanAlignmentDelta = {
      frameId: `frame_${String(frameIndex).padStart(4, '0')}`,
      userOverrideX: offset.x,
      userOverrideY: offset.y,
      timestamp: new Date().toISOString()
    };

    // Update session state
    await updateFrameOverrides(frameIndex, {
      alignment: delta,
      isPatched: false,
      patchHistory: []
    });

    // Mark as approved
    await updateFrameStatus(frameIndex, 'APPROVED');

    // Reset drag state
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    });
  }, [dragState.isDragging, frameIndex, offset, updateFrameOverrides, updateFrameStatus]);

  const handleReset = useCallback(async () => {
    await updateFrameOverrides(frameIndex, {
      alignment: undefined,
      isPatched: false,
      patchHistory: []
    });
    setOffset({ x: 0, y: 0 });
  }, [frameIndex, updateFrameOverrides]);

  return (
    <div
      className={styles.nudgeOverlay}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragState.isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Offset indicator */}
      {(offset.x !== 0 || offset.y !== 0) && (
        <div className={styles.offsetIndicator}>
          X: {offset.x > 0 ? '+' : ''}{offset.x}px,
          Y: {offset.y > 0 ? '+' : ''}{offset.y}px
        </div>
      )}

      {/* Reset button */}
      {(offset.x !== 0 || offset.y !== 0) && (
        <button
          className={styles.resetButton}
          onClick={handleReset}
        >
          Reset Alignment
        </button>
      )}
    </div>
  );
};
```

### useDrag Hook

```tsx
// ui/src/hooks/useDrag.ts
import { useState, useCallback, useRef } from 'react';

interface DragState {
  isDragging: boolean;
  delta: { x: number; y: number };
}

export function useDrag(
  onDragEnd?: (delta: { x: number; y: number }) => void
) {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    delta: { x: 0, y: 0 }
  });

  const startRef = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((x: number, y: number) => {
    startRef.current = { x, y };
    setState({ isDragging: true, delta: { x: 0, y: 0 } });
  }, []);

  const handleMove = useCallback((x: number, y: number) => {
    if (!state.isDragging) return;

    const delta = {
      x: x - startRef.current.x,
      y: y - startRef.current.y
    };

    setState(prev => ({ ...prev, delta }));
  }, [state.isDragging]);

  const handleEnd = useCallback(() => {
    if (state.isDragging && onDragEnd) {
      onDragEnd(state.delta);
    }
    setState({ isDragging: false, delta: { x: 0, y: 0 } });
  }, [state.isDragging, state.delta, onDragEnd]);

  return {
    isDragging: state.isDragging,
    delta: state.delta,
    handlers: {
      onMouseDown: (e: React.MouseEvent) => handleStart(e.clientX, e.clientY),
      onMouseMove: (e: React.MouseEvent) => handleMove(e.clientX, e.clientY),
      onMouseUp: handleEnd,
      onMouseLeave: handleEnd,
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      },
      onTouchEnd: handleEnd
    }
  };
}
```

### HumanAlignmentDelta Interface

```typescript
interface HumanAlignmentDelta {
  frameId: string;           // e.g., "frame_0001"
  userOverrideX: number;     // Horizontal adjustment in source pixels
  userOverrideY: number;     // Vertical adjustment in source pixels
  timestamp: string;         // ISO timestamp of adjustment
}
```

### CSS Styles

```css
/* NudgeTool.module.css */
.nudgeOverlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: grab;
  user-select: none;
}

.nudgeOverlay:active {
  cursor: grabbing;
}

.offsetIndicator {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.resetButton {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: #ff4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.resetButton:hover {
  background: #ff6666;
}

/* Original position guide */
.originalGuide {
  position: absolute;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  pointer-events: none;
}
```

### Tool Selection Integration

```tsx
// Tool selector in Stage toolbar
const TOOLS = {
  SELECT: 'select',
  NUDGE: 'nudge',
  MASK: 'mask'
} as const;

type Tool = typeof TOOLS[keyof typeof TOOLS];

// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key.toLowerCase()) {
      case 'n':
        setActiveTool(TOOLS.NUDGE);
        break;
      case 'm':
        setActiveTool(TOOLS.MASK);
        break;
      case 'escape':
        setActiveTool(TOOLS.SELECT);
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Export-Time Application

The nudge delta is applied during export, not during editing:

```typescript
// At export time in commit flow
async function applyAlignmentDelta(
  imagePath: string,
  delta: HumanAlignmentDelta
): Promise<Buffer> {
  const image = await sharp(imagePath);
  const metadata = await image.metadata();

  // Create canvas with offset
  return sharp({
    create: {
      width: metadata.width!,
      height: metadata.height!,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{
      input: await image.toBuffer(),
      left: delta.userOverrideX,
      top: delta.userOverrideY
    }])
    .png()
    .toBuffer();
}
```

### Project Structure Notes

- New: `ui/src/components/Tools/NudgeTool.tsx`
- New: `ui/src/components/Tools/NudgeTool.module.css`
- New: `ui/src/hooks/useDrag.ts`
- Modify: `ui/src/components/Stage/Stage.tsx` (integrate NudgeTool)
- Tests: `ui/src/components/Tools/__tests__/NudgeTool.test.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4]

---

## Dev Agent Record

### Agent Model Used

**Cursor**

**Rationale:** Interactive drag-and-drop UI with real-time visual feedback. Cursor excels at event handling and immediate visual updates in React components.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
