# Story 3.10: Implement Orphan Pixel Detection

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** frames checked for isolated "orphan" pixels after downsampling,
**So that** noisy artifacts from the 512px→128px conversion are detected.

---

## Acceptance Criteria

### Orphan Detection

1. **Internal scan** - System scans internal pixels (skipping 1px border)
2. **Neighbor check** - For each opaque pixel, checks 4 orthogonal neighbors (Up, Down, Left, Right)
3. **Orphan definition** - Counts pixels where NO neighbor shares the exact same RGBA color
4. **Classification** - Results classified:
   - 0-5 orphans: **PASS** (allows for eye glints, buckles)
   - 6-15 orphans: **WARNING** (logged but not failed)
   - >15 orphans: **SF_PIXEL_NOISE** soft fail
5. **Transparency exclusion** - Transparent pixels (alpha = 0) are excluded from scan
6. **Orphan count logged** - Count is logged to audit metrics
7. **Performance** - Computation completes in ≤500ms

### Implementation Details

8. **Sharp library** - Uses `sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`
9. **Exact RGBA match** - Compare pixels using exact RGBA match (pixel art has no anti-aliasing)
10. **Edge case handling** - Algorithm handles small sprites, solid color sprites

---

## Tasks / Subtasks

- [ ] **Task 1: Create orphan pixel detector** (AC: #1, #2, #3)
  - [ ] 1.1: Create `src/core/metrics/orphan-pixel-detector.ts`
  - [ ] 1.2: Implement `detectOrphanPixels(imagePath: string): Result<OrphanPixelResult, SystemError>`
  - [ ] 1.3: Return `OrphanPixelResult` with: `orphan_count`, `classification`, `orphan_locations`, `passed`

- [ ] **Task 2: Implement pixel scanning** (AC: #1, #5, #8)
  - [ ] 2.1: Load image with Sharp: `sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`
  - [ ] 2.2: Get width, height, channels from info object
  - [ ] 2.3: Skip 1px border (start at x=1, y=1, end at width-2, height-2)
  - [ ] 2.4: Skip transparent pixels (alpha = 0)

- [ ] **Task 3: Implement neighbor check** (AC: #2, #9)
  - [ ] 3.1: For each opaque pixel, get 4 orthogonal neighbors
  - [ ] 3.2: Compare RGBA values exactly (all 4 channels must match)
  - [ ] 3.3: Pixel is orphan if NO neighbor has matching color
  - [ ] 3.4: Track orphan pixel locations for debugging

- [ ] **Task 4: Implement classification** (AC: #4)
  - [ ] 4.1: Count total orphan pixels
  - [ ] 4.2: Classify based on count:
     - 0-5: PASS
     - 6-15: WARNING
     - >15: SOFT_FAIL
  - [ ] 4.3: Return `SF05_PIXEL_NOISE` code for soft fail
  - [ ] 4.4: Include classification in result

- [ ] **Task 5: Handle edge cases** (AC: #10)
  - [ ] 5.1: Handle very small sprites (<10 opaque pixels)
  - [ ] 5.2: Handle solid color sprites (all same color)
  - [ ] 5.3: Handle sprite that touches image border
  - [ ] 5.4: Handle fully transparent image (return 0 orphans)

- [ ] **Task 6: Implement logging** (AC: #6)
  - [ ] 6.1: Log orphan count
  - [ ] 6.2: Log classification
  - [ ] 6.3: Log orphan locations (first 10 if many)
  - [ ] 6.4: Include in frame metrics JSON

- [ ] **Task 7: Optimize for performance** (AC: #7)
  - [ ] 7.1: Use typed arrays for pixel data
  - [ ] 7.2: Calculate pixel index efficiently
  - [ ] 7.3: Early exit if >15 orphans found (already failed)
  - [ ] 7.4: Profile and ensure ≤500ms

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test clean sprite returns 0 orphans
  - [ ] 8.2: Test sprite with intentional orphans
  - [ ] 8.3: Test classification thresholds
  - [ ] 8.4: Test border pixels are skipped
  - [ ] 8.5: Test transparent pixels are excluded
  - [ ] 8.6: Test performance under 500ms

---

## Dev Notes

### What is an Orphan Pixel?

An orphan pixel is an opaque pixel that has no neighbors of the same color. In pixel art:
- **Normal:** Contiguous regions of same-colored pixels
- **Orphan:** Isolated single-pixel noise, often from downsampling artifacts

### Visual Example

```
Normal (no orphans):        With orphans (★):
┌─────────────┐             ┌─────────────┐
│ ░░███░░░░░░ │             │ ░★███░░░★░░ │
│ ░█████░░░░░ │             │ ░█████░░░░░ │
│ ░░███░░░░░░ │             │ ░░███★░░░░░ │
└─────────────┘             └─────────────┘
  0 orphans                   3 orphans (★ marked)
```

### OrphanPixelResult Interface

```typescript
interface OrphanPixelResult {
  orphan_count: number;
  classification: 'pass' | 'warning' | 'soft_fail';
  passed: boolean;
  orphan_locations: Array<{ x: number; y: number; color: string }>;
  total_opaque_pixels: number;
  orphan_percentage: number;
  computation_time_ms: number;
}
```

### Detection Algorithm

```typescript
async function detectOrphanPixels(imagePath: string): Promise<OrphanPixelResult> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const orphans: Array<{ x: number; y: number; color: string }> = [];
  let opaquePixelCount = 0;

  // Skip 1px border
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;

      // Skip transparent pixels
      if (data[idx + 3] === 0) continue;

      opaquePixelCount++;

      // Get current pixel RGBA
      const currentR = data[idx];
      const currentG = data[idx + 1];
      const currentB = data[idx + 2];
      const currentA = data[idx + 3];

      // Check 4 neighbors
      const neighbors = [
        { dx: 0, dy: -1 },  // up
        { dx: 0, dy: 1 },   // down
        { dx: -1, dy: 0 },  // left
        { dx: 1, dy: 0 },   // right
      ];

      let hasMatchingNeighbor = false;

      for (const { dx, dy } of neighbors) {
        const nIdx = ((y + dy) * width + (x + dx)) * channels;

        // Skip if neighbor is transparent
        if (data[nIdx + 3] === 0) continue;

        // Check exact RGBA match
        if (
          data[nIdx] === currentR &&
          data[nIdx + 1] === currentG &&
          data[nIdx + 2] === currentB &&
          data[nIdx + 3] === currentA
        ) {
          hasMatchingNeighbor = true;
          break;
        }
      }

      if (!hasMatchingNeighbor) {
        orphans.push({
          x,
          y,
          color: `#${currentR.toString(16).padStart(2, '0')}${currentG.toString(16).padStart(2, '0')}${currentB.toString(16).padStart(2, '0')}`
        });
      }
    }
  }

  return classifyResult(orphans, opaquePixelCount);
}
```

### Classification Thresholds

| Orphan Count | Classification | Action |
|--------------|----------------|--------|
| 0-5 | PASS | Normal (eye glints, buckles are OK) |
| 6-15 | WARNING | Log but don't fail |
| >15 | SOFT_FAIL | Trigger `SF05_PIXEL_NOISE` |

### Why Allow 0-5 Orphans?

Valid single-pixel details in pixel art:
- Eye glint (white highlight)
- Belt buckle (metal reflection)
- Button on clothing
- Jewelry/accessories

These are intentional design elements, not noise.

### Why Skip Border?

- Edge pixels have fewer neighbors (only 2-3)
- More likely to appear as false-positive orphans
- Border effects are often cropped anyway

### Performance Optimization

```typescript
// Pre-calculate neighbor offsets
const neighborOffsets = [
  -width * channels,           // up
  width * channels,            // down
  -channels,                   // left
  channels,                    // right
];

// Use offset calculation instead of x,y indexing
for (let i = rowStart; i < rowEnd; i += channels) {
  // Check neighbors using pre-calculated offsets
  for (const offset of neighborOffsets) {
    // ...
  }
}
```

### Edge Cases

1. **Solid color sprite:** Every pixel has matching neighbors → 0 orphans
2. **Outline-only sprite:** Pixels may have different colored neighbors → potential false positives
3. **Dithered sprite:** Alternating pixels → many "orphans" but intentional

Consider logging sprite type for debugging false positives.

### Project Structure Notes

- Orphan detector: `src/core/metrics/orphan-pixel-detector.ts`
- Integration: Called from `src/core/auditor.ts`
- Error code: `SF05_PIXEL_NOISE` added to `src/domain/error-codes.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.10]
- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Neighbor-based pixel scan follows a clear algorithm specified in Deep Think Follow-Up. Well-defined detection logic with clear thresholds. No architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
