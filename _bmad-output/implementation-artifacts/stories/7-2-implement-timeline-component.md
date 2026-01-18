# Story 7.2: Implement Timeline Component with Status Indicators

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a visual timeline showing all frames with color-coded status,
**So that** I can quickly identify frames needing attention.

---

## Acceptance Criteria

### Timeline Display

1. **Filmstrip layout** - Frames display as horizontal filmstrip at bottom of Director UI
2. **Status colors** - Each frame thumbnail has border color indicating status:
   - **Green**: APPROVED (Auditor passed or Human verified)
   - **Yellow**: AUDIT_WARN (Auto-aligned, needs review)
   - **Red**: AUDIT_FAIL (Failed hard or soft gates)
3. **Frame selection** - Clicking a frame loads it into the Stage
4. **Current highlight** - Current frame is visually highlighted
5. **Thumbnail size** - Frame thumbnails are 64px for quick scanning

---

## Tasks / Subtasks

- [ ] **Task 1: Create Timeline component structure** (AC: #1)
  - [ ] 1.1: Create `ui/src/components/Timeline/Timeline.tsx`
  - [ ] 1.2: Create horizontal scrollable container
  - [ ] 1.3: Implement flex layout for filmstrip
  - [ ] 1.4: Add scroll buttons for navigation (left/right arrows)
  - [ ] 1.5: Position at bottom of Director UI

- [ ] **Task 2: Create FrameThumbnail component** (AC: #2, #5)
  - [ ] 2.1: Create `ui/src/components/Timeline/FrameThumbnail.tsx`
  - [ ] 2.2: Render 64x64px thumbnail container
  - [ ] 2.3: Display frame image scaled to fit
  - [ ] 2.4: Add frame number label overlay

- [ ] **Task 3: Implement status color coding** (AC: #2)
  - [ ] 3.1: Define color constants for each status
  - [ ] 3.2: Apply 3px border with status color
  - [ ] 3.3: Add subtle glow effect for emphasis
  - [ ] 3.4: Ensure colors meet accessibility contrast

- [ ] **Task 4: Implement frame selection** (AC: #3, #4)
  - [ ] 4.1: Add onClick handler to FrameThumbnail
  - [ ] 4.2: Update selected frame state in parent
  - [ ] 4.3: Apply distinct highlight style to selected frame
  - [ ] 4.4: Auto-scroll to selected frame if off-screen
  - [ ] 4.5: Add keyboard navigation (left/right arrows)

- [ ] **Task 5: Connect to session state** (AC: #1-4)
  - [ ] 5.1: Subscribe to DirectorSession frames map
  - [ ] 5.2: Map frame states to thumbnails
  - [ ] 5.3: Update on frame status changes
  - [ ] 5.4: Handle empty/loading states

- [ ] **Task 6: Implement scroll behavior** (AC: #1)
  - [ ] 6.1: Add smooth scroll animation
  - [ ] 6.2: Implement scroll indicators (fade edges)
  - [ ] 6.3: Support scroll-to-frame programmatically
  - [ ] 6.4: Handle touch/swipe for mobile

- [ ] **Task 7: Add hover states and tooltips** (AC: all)
  - [ ] 7.1: Show frame number on hover
  - [ ] 7.2: Show status text on hover (tooltip)
  - [ ] 7.3: Show audit score on hover
  - [ ] 7.4: Slight scale-up on hover

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test timeline renders all frames
  - [ ] 8.2: Test correct color coding for each status
  - [ ] 8.3: Test frame selection updates parent state
  - [ ] 8.4: Test keyboard navigation

---

## Dev Notes

### Timeline Component Structure

```tsx
// ui/src/components/Timeline/Timeline.tsx
import React, { useRef, useCallback } from 'react';
import { FrameThumbnail } from './FrameThumbnail';
import { useDirectorSession } from '../../hooks/useDirectorSession';
import styles from './Timeline.module.css';

interface TimelineProps {
  onFrameSelect: (frameIndex: number) => void;
  selectedFrame: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  onFrameSelect,
  selectedFrame
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { frames } = useDirectorSession();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && selectedFrame > 0) {
      onFrameSelect(selectedFrame - 1);
    } else if (e.key === 'ArrowRight' && selectedFrame < frames.size - 1) {
      onFrameSelect(selectedFrame + 1);
    }
  }, [selectedFrame, frames.size, onFrameSelect]);

  const scrollToFrame = (index: number) => {
    const element = containerRef.current?.children[index];
    element?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  };

  return (
    <div className={styles.timelineWrapper}>
      <button className={styles.scrollButton} onClick={() => scrollBy(-200)}>
        ◀
      </button>

      <div className={styles.filmstrip} ref={containerRef}>
        {Array.from(frames.entries()).map(([index, frame]) => (
          <FrameThumbnail
            key={frame.id}
            frame={frame}
            isSelected={index === selectedFrame}
            onClick={() => onFrameSelect(index)}
          />
        ))}
      </div>

      <button className={styles.scrollButton} onClick={() => scrollBy(200)}>
        ▶
      </button>
    </div>
  );
};
```

### FrameThumbnail Component

```tsx
// ui/src/components/Timeline/FrameThumbnail.tsx
import React from 'react';
import { DirectorFrameState, FrameStatus } from '../../types/director-session';
import styles from './FrameThumbnail.module.css';

interface FrameThumbnailProps {
  frame: DirectorFrameState;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<FrameStatus, string> = {
  PENDING: '#888888',      // Gray
  GENERATED: '#888888',    // Gray
  AUDIT_FAIL: '#ff4444',   // Red
  AUDIT_WARN: '#ffcc00',   // Yellow
  APPROVED: '#44cc44',     // Green
};

export const FrameThumbnail: React.FC<FrameThumbnailProps> = ({
  frame,
  isSelected,
  onClick
}) => {
  const borderColor = STATUS_COLORS[frame.status];

  return (
    <div
      className={`${styles.thumbnail} ${isSelected ? styles.selected : ''}`}
      style={{ borderColor }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`Frame ${frame.frameIndex}: ${frame.status}`}
    >
      <img
        src={`data:image/png;base64,${frame.imageBase64}`}
        alt={`Frame ${frame.frameIndex}`}
        className={styles.image}
      />
      <div className={styles.label}>
        {String(frame.frameIndex).padStart(2, '0')}
      </div>
      {frame.auditReport?.composite_score && (
        <div className={styles.score}>
          {(frame.auditReport.composite_score * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
};
```

### CSS Styles

```css
/* Timeline.module.css */
.timelineWrapper {
  display: flex;
  align-items: center;
  height: 100px;
  background: #1a1a1a;
  border-top: 1px solid #333;
  padding: 8px 16px;
}

.filmstrip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  flex: 1;
  padding: 8px 0;
}

.filmstrip::-webkit-scrollbar {
  height: 6px;
}

.filmstrip::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.scrollButton {
  width: 32px;
  height: 64px;
  background: #333;
  border: none;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
}

.scrollButton:hover {
  background: #444;
}

/* FrameThumbnail.module.css */
.thumbnail {
  width: 64px;
  height: 64px;
  border: 3px solid;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  background: #222;
  transition: transform 0.1s, box-shadow 0.1s;
}

.thumbnail:hover {
  transform: scale(1.05);
}

.thumbnail.selected {
  box-shadow: 0 0 0 2px #fff;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.label {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
}

.score {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
}
```

### Status Color Accessibility

| Status | Color | Hex | Contrast Ratio |
|--------|-------|-----|----------------|
| APPROVED | Green | #44cc44 | 4.5:1 vs dark bg |
| AUDIT_WARN | Yellow | #ffcc00 | 8.6:1 vs dark bg |
| AUDIT_FAIL | Red | #ff4444 | 4.5:1 vs dark bg |
| PENDING | Gray | #888888 | 4.5:1 vs dark bg |

### Project Structure Notes

- New: `ui/src/components/Timeline/Timeline.tsx`
- New: `ui/src/components/Timeline/FrameThumbnail.tsx`
- New: `ui/src/components/Timeline/Timeline.module.css`
- New: `ui/src/components/Timeline/FrameThumbnail.module.css`
- New: `ui/src/components/Timeline/index.ts`
- Tests: `ui/src/components/Timeline/__tests__/Timeline.test.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2]

---

## Dev Agent Record

### Agent Model Used

**Cursor**

**Rationale:** Frontend UI component with React, CSS, and visual styling. Cursor excels at component-based frontend development with immediate visual feedback.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
