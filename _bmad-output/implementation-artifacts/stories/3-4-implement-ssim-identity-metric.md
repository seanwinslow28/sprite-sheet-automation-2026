# Story 3.4: Implement SSIM Identity Metric

Status: done

---

## Story

**As an** operator,
**I want** frames compared against the anchor using SSIM,
**So that** character identity drift is detected and quantified.

---

## Acceptance Criteria

### SSIM Calculation

1. **SSIM computed** - System calculates Structural Similarity Index between candidate and anchor
2. **Score normalized** - SSIM score is normalized to 0.0-1.0 range
3. **Threshold comparison** - Score is compared against `auditor.thresholds.identity_min` from manifest
4. **Soft fail trigger** - Scores below threshold trigger `SF_IDENTITY_DRIFT` soft fail
5. **Score logged** - SSIM score is logged to audit metrics
6. **Performance** - Computation completes in ≤3 seconds

---

## Tasks / Subtasks

- [x] **Task 1: Create SSIM calculator module** (AC: #1, #2)
  - [x] 1.1: Create `src/core/metrics/ssim-calculator.ts`
  - [x] 1.2: Implement `calculateSSIM(candidatePath: string, anchorPath: string): Result<SSIMResult, SystemError>`
  - [x] 1.3: Return `SSIMResult` with: `score`, `channel_scores`, `computation_time_ms`
  - [x] 1.4: Handle images of different sizes (resize to match if needed)

- [x] **Task 2: Implement SSIM algorithm** (AC: #1)
  - [x] 2.1: Load both images with Sharp
  - [x] 2.2: Convert to grayscale for luminance comparison
  - [x] 2.3: Calculate mean, variance, covariance using sliding window
  - [x] 2.4: Apply SSIM formula: `(2*μx*μy + C1)(2*σxy + C2) / ((μx² + μy² + C1)(σx² + σy² + C2))`
  - [x] 2.5: Use constants: C1 = (0.01 * 255)², C2 = (0.03 * 255)²

- [x] **Task 3: Implement per-channel comparison** (AC: #2)
  - [x] 3.1: Calculate SSIM for R, G, B channels separately
  - [x] 3.2: Calculate SSIM for alpha channel
  - [x] 3.3: Compute weighted average: RGB 0.8, Alpha 0.2
  - [x] 3.4: Return both composite and per-channel scores

- [x] **Task 4: Implement threshold evaluation** (AC: #3, #4)
  - [x] 4.1: Read `auditor.thresholds.identity_min` from manifest (default: 0.85)
  - [x] 4.2: Compare SSIM score to threshold
  - [x] 4.3: If below threshold, return `SF01_IDENTITY_DRIFT` soft fail code
  - [x] 4.4: Include score delta in failure details

- [x] **Task 5: Implement mask-aware comparison** (AC: #1)
  - [x] 5.1: Only compare pixels where both images are opaque (alpha > 0)
  - [x] 5.2: Skip transparent regions in SSIM calculation
  - [x] 5.3: Calculate effective comparison area percentage
  - [x] 5.4: Warn if comparison area is <50% of image

- [x] **Task 6: Implement logging** (AC: #5)
  - [x] 6.1: Log SSIM score to `audit_log.jsonl`
  - [x] 6.2: Log per-channel breakdown
  - [x] 6.3: Log comparison area percentage
  - [x] 6.4: Include in frame metrics JSON

- [x] **Task 7: Optimize for performance** (AC: #6)
  - [x] 7.1: Use 8×8 or 11×11 sliding window (configurable)
  - [x] 7.2: Consider downsampling for faster computation (optional)
  - [x] 7.3: Use typed arrays for pixel operations
  - [x] 7.4: Profile and optimize hot paths

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test identical images return SSIM ≈ 1.0
  - [x] 8.2: Test completely different images return SSIM < 0.5
  - [x] 8.3: Test threshold evaluation triggers soft fail
  - [x] 8.4: Test mask-aware comparison excludes transparent pixels
  - [x] 8.5: Test computation time is under 3 seconds

---

## Dev Notes

### SSIM Formula

```
SSIM(x, y) = [l(x,y)]^α · [c(x,y)]^β · [s(x,y)]^γ

Where:
- l(x,y) = (2μxμy + C1) / (μx² + μy² + C1)  [luminance]
- c(x,y) = (2σxσy + C2) / (σx² + σy² + C2)  [contrast]
- s(x,y) = (σxy + C3) / (σxσy + C3)          [structure]

Simplified (α=β=γ=1, C3=C2/2):
SSIM(x,y) = (2μxμy + C1)(2σxy + C2) / ((μx² + μy²) + C1)(σx² + σy² + C2))
```

### SSIMResult Interface

```typescript
interface SSIMResult {
  score: number;  // 0.0 - 1.0 composite
  channel_scores: {
    luminance: number;
    red: number;
    green: number;
    blue: number;
    alpha: number;
  };
  comparison_area: {
    total_pixels: number;
    compared_pixels: number;
    percentage: number;
  };
  computation_time_ms: number;
  passed: boolean;
  threshold: number;
}
```

### Window-Based Calculation

```typescript
function calculateWindowSSIM(
  img1: Uint8Array,
  img2: Uint8Array,
  width: number,
  height: number,
  windowSize: number = 11
): number {
  const K1 = 0.01, K2 = 0.03;
  const L = 255; // Dynamic range
  const C1 = Math.pow(K1 * L, 2);
  const C2 = Math.pow(K2 * L, 2);

  let ssimSum = 0;
  let windowCount = 0;

  for (let y = 0; y <= height - windowSize; y++) {
    for (let x = 0; x <= width - windowSize; x++) {
      // Extract window pixels
      const window1 = extractWindow(img1, x, y, windowSize, width);
      const window2 = extractWindow(img2, x, y, windowSize, width);

      // Calculate statistics
      const mean1 = mean(window1);
      const mean2 = mean(window2);
      const var1 = variance(window1, mean1);
      const var2 = variance(window2, mean2);
      const cov = covariance(window1, window2, mean1, mean2);

      // SSIM formula
      const ssim = (
        ((2 * mean1 * mean2 + C1) * (2 * cov + C2)) /
        ((mean1 ** 2 + mean2 ** 2 + C1) * (var1 + var2 + C2))
      );

      ssimSum += ssim;
      windowCount++;
    }
  }

  return ssimSum / windowCount;
}
```

### Mask-Aware Comparison

```
Anchor (A)          Candidate (C)         Mask (M)
┌─────────────┐     ┌─────────────┐       ┌─────────────┐
│ ░░░███░░░░░ │     │ ░░░███░░░░░ │       │ ░░░111░░░░░ │
│ ░░█████░░░░ │     │ ░░█████░░░░ │       │ ░░11111░░░░ │
│ ░░░███░░░░░ │     │ ░░░███░░░░░ │       │ ░░░111░░░░░ │
└─────────────┘     └─────────────┘       └─────────────┘
                                               ↑
                                      Only compare where M=1
```

### Threshold Recommendations

| Threshold | Interpretation |
|-----------|----------------|
| 0.95+ | Nearly identical (only noise) |
| 0.85-0.95 | Good identity match (default) |
| 0.70-0.85 | Moderate drift (may need retry) |
| <0.70 | Significant drift (likely failure) |

### Why SSIM (Not Pixel Diff)?

- Pixel diff is sensitive to minor shifts
- SSIM accounts for structural similarity
- Better correlation with human perception
- More tolerant of small lighting variations

### Project Structure Notes

- SSIM calculator: `src/core/metrics/ssim-calculator.ts`
- Integration: Called from `src/core/auditor.ts`
- Threshold config: Read from manifest `auditor.thresholds.identity_min`

### References

- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4]
- [Wikipedia: Structural Similarity](https://en.wikipedia.org/wiki/Structural_similarity)

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** SSIM is a well-known algorithm with clear mathematical definition. Implementation is algorithmic with well-defined inputs/outputs. No architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
