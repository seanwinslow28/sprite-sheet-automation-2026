# Story 2.7: Implement Anchor Analysis for Target Baseline Extraction

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** the system to extract alignment targets from the anchor image at run start,
**So that** all generated frames can be aligned consistently to the anchor's spatial position.

---

## Acceptance Criteria

1. **Baseline extraction** - System analyzes anchor image to extract `baselineY` (Y-coordinate of lowest opaque pixel / feet position)
2. **Root X extraction** - Extracts `rootX` (X-centroid of the bottom `root_zone_ratio` of the visible sprite)
3. **Results persisted** - Stores values in `runs/{run_id}/anchor_analysis.json`
4. **Alpha threshold** - Uses `alphaThreshold = 128` to filter semi-transparent pixels (shadows)
5. **Empty anchor error** - Throws an error if the anchor is fully transparent
6. **Values logged** - Logs the extracted values to structured output

---

## Tasks / Subtasks

- [ ] **Task 1: Create anchor analyzer** (AC: #1, #2)
  - [ ] 1.1: Create `src/core/anchor-analyzer.ts`
  - [ ] 1.2: Implement `analyzeAnchor(imagePath: string, config: CanvasConfig): Result<AnchorAnalysis, SystemError>`
  - [ ] 1.3: Define `AnchorAnalysis` interface with baselineY, rootX, visibleBounds, rootZoneBounds

- [ ] **Task 2: Load and process anchor image** (AC: #4)
  - [ ] 2.1: Load image using Sharp
  - [ ] 2.2: Extract raw pixel data with alpha channel
  - [ ] 2.3: Apply alphaThreshold (128) to determine opacity
  - [ ] 2.4: Build binary mask of opaque pixels

- [ ] **Task 3: Calculate visible bounds** (AC: #1)
  - [ ] 3.1: Scan image to find topY (first opaque row)
  - [ ] 3.2: Scan image to find bottomY (last opaque row) → this is baselineY
  - [ ] 3.3: Scan image to find leftX, rightX bounds
  - [ ] 3.4: Calculate visibleHeight = bottomY - topY

- [ ] **Task 4: Calculate root zone centroid** (AC: #2)
  - [ ] 4.1: Calculate rootZoneHeight = visibleHeight * root_zone_ratio (default 0.15)
  - [ ] 4.2: Define root zone as pixels from (bottomY - rootZoneHeight) to bottomY
  - [ ] 4.3: Find all opaque pixels in root zone
  - [ ] 4.4: Calculate X-centroid of root zone pixels → rootX

- [ ] **Task 5: Handle edge cases** (AC: #5)
  - [ ] 5.1: Check if image has any opaque pixels
  - [ ] 5.2: Throw `ANCHOR_FULLY_TRANSPARENT` error if empty
  - [ ] 5.3: Handle images with very small visible area
  - [ ] 5.4: Handle images where root zone has no pixels

- [ ] **Task 6: Persist analysis results** (AC: #3, #6)
  - [ ] 6.1: Create `anchor_analysis.json` in run directory
  - [ ] 6.2: Use atomic write pattern
  - [ ] 6.3: Log extracted values via Pino
  - [ ] 6.4: Include analysis timestamp

- [ ] **Task 7: Write tests** (AC: all)
  - [ ] 7.1: Test with sample anchor image
  - [ ] 7.2: Test baselineY extraction accuracy
  - [ ] 7.3: Test rootX centroid calculation
  - [ ] 7.4: Test empty image error handling
  - [ ] 7.5: Test alpha threshold filtering

---

## Dev Notes

### Anchor Analysis Algorithm

```
1. Load image with Sharp
2. Get raw pixel buffer (RGBA)
3. For each pixel:
   - If alpha >= 128: mark as opaque
4. Scan rows top-to-bottom: find first opaque row → topY
5. Scan rows bottom-to-top: find last opaque row → bottomY (baselineY)
6. Calculate visibleHeight = bottomY - topY
7. Calculate rootZoneStart = bottomY - (visibleHeight * 0.15)
8. For pixels in root zone:
   - Collect X coordinates of opaque pixels
   - Calculate mean X → rootX
9. Store results
```

### anchor_analysis.json Schema

```json
{
  "analyzed_at": "2026-01-18T14:30:52.000Z",
  "image_path": "/absolute/path/to/anchor.png",
  "image_dimensions": { "width": 512, "height": 512 },
  "alpha_threshold": 128,
  "root_zone_ratio": 0.15,
  "results": {
    "baselineY": 480,
    "rootX": 256,
    "visible_bounds": {
      "topY": 120,
      "bottomY": 480,
      "leftX": 180,
      "rightX": 332
    },
    "visible_height": 360,
    "root_zone": {
      "startY": 426,
      "endY": 480,
      "height": 54,
      "pixel_count": 2340
    }
  }
}
```

### Why Alpha Threshold 128?

- Semi-transparent pixels (alpha 1-127) are typically shadows or anti-aliasing
- These should NOT influence baseline detection
- Threshold of 128 (50%) provides clean separation

### Root Zone Visualization

```
┌────────────────────┐ ← topY (first opaque row)
│                    │
│     Character      │
│       Body         │
│                    │
├────────────────────┤ ← rootZoneStart (baselineY - 15% of height)
│  ████ Feet ████    │ ← Root zone (bottom 15%)
└────────────────────┘ ← baselineY (last opaque row)
         ↑
       rootX (X-centroid of feet pixels)
```

### Error Codes

- `ANCHOR_FULLY_TRANSPARENT` - No opaque pixels found
- `ANCHOR_LOAD_FAILED` - Could not load image file
- `ANCHOR_INVALID_FORMAT` - Image format not supported

### Project Structure Notes

- Anchor analyzer: `src/core/anchor-analyzer.ts`
- Output: `runs/{run_id}/anchor_analysis.json`

### References

- [Source: _bmad-output/project-context.md#Post-Processor Patterns]
- [Source: _bmad-output/project-context.md#Canvas Configuration Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Image analysis algorithm is well-specified (baselineY, rootX extraction). Clear inputs/outputs with deterministic calculations. No architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
