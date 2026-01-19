# Story 3.7: Implement Baseline Drift Measurement

Status: done

---

## Story

**As an** operator,
**I want** frames measured for baseline position consistency,
**So that** characters don't appear to float or sink between frames.

---

## Acceptance Criteria

### Baseline Detection

1. **Baseline detection** - System detects the sprite's bottom edge (baseline) position
2. **Offset calculation** - Calculates pixel offset from anchor baseline
3. **Threshold comparison** - Drift exceeding `auditor.thresholds.baseline_drift_max` triggers `SF_BASELINE_DRIFT` soft fail
4. **Drift logged** - Drift value in pixels is logged to audit metrics

---

## Tasks / Subtasks

- [x] **Task 1: Create baseline drift detector** (AC: #1, #2)
  - [x] 1.1: Create `src/core/metrics/baseline-drift-detector.ts`
  - [x] 1.2: Implement `measureBaselineDrift(candidatePath: string, anchorAnalysis: AnchorAnalysis): Result<BaselineDriftResult, SystemError>`
  - [x] 1.3: Return `BaselineDriftResult` with: `drift_pixels`, `candidate_baseline`, `anchor_baseline`, `direction`
  - [x] 1.4: Reuse visible bounds logic from anchor analyzer (Story 2.7)

- [x] **Task 2: Detect candidate baseline** (AC: #1)
  - [x] 2.1: Load candidate image with Sharp
  - [x] 2.2: Get raw RGBA pixel buffer
  - [x] 2.3: Scan rows from bottom to top
  - [x] 2.4: Find last row with any opaque pixel (alpha >= 128)
  - [x] 2.5: This row Y-coordinate is the candidate baseline

- [x] **Task 3: Calculate drift offset** (AC: #2)
  - [x] 3.1: Get anchor baseline from `anchorAnalysis.results.baselineY`
  - [x] 3.2: Calculate drift: `candidateBaseline - anchorBaseline`
  - [x] 3.3: Positive drift = sprite is lower (sinking)
  - [x] 3.4: Negative drift = sprite is higher (floating)
  - [x] 3.5: Calculate absolute drift for threshold comparison

- [x] **Task 4: Implement threshold evaluation** (AC: #3)
  - [x] 4.1: Read `auditor.thresholds.baseline_drift_max` (default: 4 pixels)
  - [x] 4.2: If |drift| > threshold, return `SF04_BASELINE_DRIFT` soft fail
  - [x] 4.3: Include drift direction and magnitude in failure details
  - [x] 4.4: Note: 0 drift is ideal, but small drift is acceptable

- [x] **Task 5: Implement logging** (AC: #4)
  - [x] 5.1: Log drift value with sign (+/-)
  - [x] 5.2: Log direction (floating/sinking/aligned)
  - [x] 5.3: Log anchor vs candidate baseline Y-coordinates
  - [x] 5.4: Include in frame metrics JSON

- [x] **Task 6: Handle edge cases** (AC: all)
  - [x] 6.1: Handle fully transparent frame (error)
  - [x] 6.2: Handle frame where baseline is at image edge
  - [x] 6.3: Handle anchor analysis missing (error)

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test aligned sprites return drift 0
  - [x] 7.2: Test floating sprite returns negative drift
  - [x] 7.3: Test sinking sprite returns positive drift
  - [x] 7.4: Test threshold triggers soft fail
  - [x] 7.5: Test fully transparent frame returns error

---

## Dev Notes

### Baseline Detection Visualization

```
Canvas (128x128)
┌─────────────────────────────────────┐  Y=0
│                                     │
│           ███████████               │
│          █████████████              │
│         ███████████████             │
│          █████████████              │
│           ███████████               │
│            █████████                │
│              █████                  │
│              █ █ █                  │  ← Feet
├─────────────────────────────────────┤  Y=100 (anchor baseline)
│                                     │
│                                     │
└─────────────────────────────────────┘  Y=127

Candidate with DRIFT:
┌─────────────────────────────────────┐  Y=0
│                                     │
│           ███████████               │
│          █████████████              │
│         ███████████████             │
│          █████████████              │
│           ███████████               │
│            █████████                │
│              █████                  │
├─────────────────────────────────────┤  Y=96 (candidate baseline)
│              █ █ █                  │  ← Feet are HIGHER
│                                     │
│                                     │
└─────────────────────────────────────┘  Y=127

Drift = 96 - 100 = -4 pixels (floating)
```

### BaselineDriftResult Interface

```typescript
interface BaselineDriftResult {
  drift_pixels: number;         // Signed: + = sinking, - = floating
  absolute_drift: number;       // |drift_pixels|
  candidate_baseline: number;   // Y-coordinate
  anchor_baseline: number;      // Y-coordinate (from anchor analysis)
  direction: 'floating' | 'sinking' | 'aligned';
  passed: boolean;
  threshold: number;
}
```

### Baseline Detection Algorithm

```typescript
async function detectBaseline(imagePath: string, alphaThreshold: number = 128): Promise<number> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Scan from bottom to top
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3];

      if (alpha >= alphaThreshold) {
        return y;  // Found baseline
      }
    }
  }

  // No opaque pixels found
  throw new Error('FRAME_FULLY_TRANSPARENT');
}
```

### Drift Direction Interpretation

| Drift Value | Direction | Visual Effect |
|-------------|-----------|---------------|
| 0 | Aligned | Perfect match |
| -1 to -4 | Floating (minor) | Slight upward shift |
| -5 to -10 | Floating (moderate) | Noticeable lift |
| > -10 | Floating (severe) | Character appears airborne |
| +1 to +4 | Sinking (minor) | Slight downward shift |
| +5 to +10 | Sinking (moderate) | Feet below ground plane |
| > +10 | Sinking (severe) | Character partially underground |

### Why Baseline Matters

- **Animation continuity:** Baseline drift causes character to "bounce" between frames
- **Ground contact:** Character should maintain consistent floor position
- **Attack readability:** Jumping attacks need baseline to show lift

### Threshold Rationale

- **Default: 4 pixels** at 128px scale
- At 4x generation (512px), this is 16 pixels
- Allows for minor pose variation (weight shift, slight crouch)
- Catches significant baseline errors that would be visible in-game

### Relationship to Contact Patch Alignment

1. **Contact Patch Alignment (Story 2.9)** corrects baseline drift during normalization
2. **Baseline Drift Measurement (this story)** audits whether correction was successful
3. **Expected flow:**
   - Frame is aligned before auditing
   - Drift should be minimal (0-2px) after alignment
   - Large drift indicates alignment failure or corrupted frame

### Project Structure Notes

- Baseline drift detector: `src/core/metrics/baseline-drift-detector.ts`
- Integration: Called from `src/core/auditor.ts`
- Uses: Anchor analysis from `runs/{run_id}/anchor_analysis.json`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7]
- [Source: _bmad-output/project-context.md#Post-Processor Patterns]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Compare sprite baseline to anchor. Simple geometric calculation with clear algorithm. Well-defined inputs/outputs with no architectural decisions.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
