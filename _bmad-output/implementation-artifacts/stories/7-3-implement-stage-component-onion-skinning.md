# Story 7.3: Implement Stage Component with Onion Skinning

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a central workspace showing the current frame at high zoom with overlays,
**So that** I can inspect details and compare to adjacent frames.

---

## Acceptance Criteria

### Stage Display

1. **High zoom display** - Frame rendered at 4x zoom (512px display for 128px source)
2. **Onion skinning toggle** - Previous frame visible at 30% opacity behind current
3. **Anchor overlay** - Frame 0 (Anchor) visible at 15% opacity (toggleable)
4. **Baseline guide** - Horizontal line drawn at Anchor's baselineY position
5. **Background** - Neutral checkerboard background for transparency visualization
6. **Zoom levels** - Adjustable zoom (1x, 2x, 4x, 8x)

---

## Tasks / Subtasks

- [ ] **Task 1: Create Stage component structure** (AC: #1, #5)
  - [ ] 1.1: Create `ui/src/components/Stage/Stage.tsx`
  - [ ] 1.2: Create canvas container with checkerboard background
  - [ ] 1.3: Implement CSS checkerboard pattern
  - [ ] 1.4: Center frame in viewport
  - [ ] 1.5: Add padding/margin for visual breathing room

- [ ] **Task 2: Implement frame rendering** (AC: #1)
  - [ ] 2.1: Create HTML5 Canvas for frame display
  - [ ] 2.2: Render current frame at specified zoom
  - [ ] 2.3: Use `image-rendering: pixelated` for crisp pixels
  - [ ] 2.4: Handle frame loading/error states

- [ ] **Task 3: Implement zoom controls** (AC: #6)
  - [ ] 3.1: Create zoom level selector (1x, 2x, 4x, 8x)
  - [ ] 3.2: Scale canvas based on selected zoom
  - [ ] 3.3: Add zoom in/out buttons
  - [ ] 3.4: Support keyboard shortcuts (+/- for zoom)
  - [ ] 3.5: Support scroll wheel zoom

- [ ] **Task 4: Implement onion skinning** (AC: #2, #3)
  - [ ] 4.1: Create overlay layer for previous frame
  - [ ] 4.2: Render Frame[i-1] at 30% opacity
  - [ ] 4.3: Create overlay layer for anchor frame
  - [ ] 4.4: Render Frame[0] at 15% opacity
  - [ ] 4.5: Add toggle switches for each overlay

- [ ] **Task 5: Implement baseline guide** (AC: #4)
  - [ ] 5.1: Load baselineY from anchor analysis
  - [ ] 5.2: Draw horizontal line at baselineY
  - [ ] 5.3: Use distinct color (cyan recommended)
  - [ ] 5.4: Make guide toggleable
  - [ ] 5.5: Add label showing pixel value

- [ ] **Task 6: Implement toolbar controls** (AC: #2, #3, #4, #6)
  - [ ] 6.1: Create Stage toolbar component
  - [ ] 6.2: Add onion skin toggle button
  - [ ] 6.3: Add anchor overlay toggle button
  - [ ] 6.4: Add baseline toggle button
  - [ ] 6.5: Add zoom level dropdown

- [ ] **Task 7: Connect to session state** (AC: all)
  - [ ] 7.1: Subscribe to selected frame from Timeline
  - [ ] 7.2: Load current frame image
  - [ ] 7.3: Load adjacent frames for onion skinning
  - [ ] 7.4: Handle frame updates when edited

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test frame renders at correct zoom level
  - [ ] 8.2: Test onion skinning toggle
  - [ ] 8.3: Test baseline guide positioning
  - [ ] 8.4: Test zoom controls

---

## Dev Notes

### Stage Component Structure

```tsx
// ui/src/components/Stage/Stage.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useDirectorSession } from '../../hooks/useDirectorSession';
import { StageToolbar } from './StageToolbar';
import styles from './Stage.module.css';

interface StageProps {
  selectedFrameIndex: number;
  anchorAnalysis: AnchorAnalysis;
}

type ZoomLevel = 1 | 2 | 4 | 8;

export const Stage: React.FC<StageProps> = ({
  selectedFrameIndex,
  anchorAnalysis
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { frames, getFrame } = useDirectorSession();

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(4);
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [showAnchor, setShowAnchor] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);

  const currentFrame = frames.get(selectedFrameIndex);
  const prevFrame = selectedFrameIndex > 0 ? frames.get(selectedFrameIndex - 1) : null;
  const anchorFrame = frames.get(0);

  useEffect(() => {
    renderFrame();
  }, [currentFrame, zoomLevel, showOnionSkin, showAnchor, showBaseline]);

  const renderFrame = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sourceSize = 128; // Assuming 128px source
    const displaySize = sourceSize * zoomLevel;

    canvas.width = displaySize;
    canvas.height = displaySize;

    // Clear with transparent
    ctx.clearRect(0, 0, displaySize, displaySize);

    // Draw onion skin layers
    if (showAnchor && anchorFrame) {
      ctx.globalAlpha = 0.15;
      await drawFrame(ctx, anchorFrame, displaySize);
    }

    if (showOnionSkin && prevFrame) {
      ctx.globalAlpha = 0.30;
      await drawFrame(ctx, prevFrame, displaySize);
    }

    // Draw current frame
    ctx.globalAlpha = 1.0;
    await drawFrame(ctx, currentFrame, displaySize);

    // Draw baseline guide
    if (showBaseline && anchorAnalysis.baselineY) {
      drawBaselineGuide(ctx, anchorAnalysis.baselineY * zoomLevel, displaySize);
    }
  };

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    frame: DirectorFrameState,
    size: number
  ): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, size, size);
        resolve();
      };
      img.src = `data:image/png;base64,${frame.imageBase64}`;
    });
  };

  const drawBaselineGuide = (
    ctx: CanvasRenderingContext2D,
    y: number,
    width: number
  ) => {
    ctx.strokeStyle = '#00FFFF'; // Cyan
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = '#00FFFF';
    ctx.font = '10px monospace';
    ctx.fillText(`baseline: ${Math.round(y / zoomLevel)}px`, 4, y - 4);
  };

  return (
    <div className={styles.stageContainer}>
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

      <div className={styles.canvasWrapper}>
        <div className={styles.checkerboard}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
          />
        </div>
      </div>
    </div>
  );
};
```

### Toolbar Component

```tsx
// ui/src/components/Stage/StageToolbar.tsx
import React from 'react';
import styles from './StageToolbar.module.css';

interface StageToolbarProps {
  zoomLevel: number;
  onZoomChange: (level: 1 | 2 | 4 | 8) => void;
  showOnionSkin: boolean;
  onToggleOnionSkin: () => void;
  showAnchor: boolean;
  onToggleAnchor: () => void;
  showBaseline: boolean;
  onToggleBaseline: () => void;
}

export const StageToolbar: React.FC<StageToolbarProps> = ({
  zoomLevel,
  onZoomChange,
  showOnionSkin,
  onToggleOnionSkin,
  showAnchor,
  onToggleAnchor,
  showBaseline,
  onToggleBaseline
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <label>Zoom:</label>
        <select
          value={zoomLevel}
          onChange={(e) => onZoomChange(Number(e.target.value) as any)}
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>

      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${showOnionSkin ? styles.active : ''}`}
          onClick={onToggleOnionSkin}
          title="Toggle previous frame overlay (30% opacity)"
        >
          🧅 Onion
        </button>

        <button
          className={`${styles.toggle} ${showAnchor ? styles.active : ''}`}
          onClick={onToggleAnchor}
          title="Toggle anchor frame overlay (15% opacity)"
        >
          ⚓ Anchor
        </button>

        <button
          className={`${styles.toggle} ${showBaseline ? styles.active : ''}`}
          onClick={onToggleBaseline}
          title="Toggle baseline guide"
        >
          📏 Baseline
        </button>
      </div>
    </div>
  );
};
```

### CSS Styles

```css
/* Stage.module.css */
.stageContainer {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: #1a1a1a;
  overflow: hidden;
}

.canvasWrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}

.checkerboard {
  /* Classic transparency checkerboard pattern */
  background-image:
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: #1e1e1e;
  padding: 8px;
  border-radius: 4px;
}

.canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
}

/* StageToolbar.module.css */
.toolbar {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group label {
  color: #888;
  font-size: 12px;
}

.group select {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  padding: 4px 8px;
  border-radius: 4px;
}

.toggle {
  background: #333;
  color: #888;
  border: 1px solid #444;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.toggle.active {
  background: #444;
  color: #fff;
  border-color: #666;
}

.toggle:hover {
  background: #3a3a3a;
}
```

### Onion Skinning Opacity Levels

| Layer | Opacity | Purpose |
|-------|---------|---------|
| Anchor (Frame 0) | 15% | Identity reference |
| Previous Frame | 30% | Motion continuity |
| Current Frame | 100% | Active editing |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` or `=` | Zoom in |
| `-` | Zoom out |
| `O` | Toggle onion skin |
| `A` | Toggle anchor overlay |
| `B` | Toggle baseline guide |

### Project Structure Notes

- New: `ui/src/components/Stage/Stage.tsx`
- New: `ui/src/components/Stage/StageToolbar.tsx`
- New: `ui/src/components/Stage/Stage.module.css`
- New: `ui/src/components/Stage/StageToolbar.module.css`
- New: `ui/src/components/Stage/index.ts`
- Tests: `ui/src/components/Stage/__tests__/Stage.test.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3]

---

## Dev Agent Record

### Agent Model Used

**Cursor**

**Rationale:** Frontend UI component with Canvas rendering, overlays, and interactive controls. Cursor excels at visual component development with real-time preview.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
