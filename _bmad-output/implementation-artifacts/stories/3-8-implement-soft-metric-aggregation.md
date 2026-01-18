# Story 3.8: Implement Soft Metric Aggregation and Scoring

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** soft metrics aggregated into a weighted composite score,
**So that** I can understand overall frame quality at a glance.

---

## Acceptance Criteria

### Composite Scoring

1. **Weighted aggregation** - System applies scoring weights: Stability 0.35, Identity 0.30, Palette 0.20, Style 0.15
2. **Score normalized** - Composite score is normalized to 0.0-1.0 range
3. **Retry flagging** - Frames below `auditor.thresholds.composite_min` are flagged for retry
4. **Breakdown logged** - Score breakdown and composite are logged to `audit/{frame}_metrics.json`
5. **Performance** - All soft metrics computed within NFR2 (≤10 seconds total)

### MAPD Temporal Coherence

6. **MAPD threshold** - System applies move-type-specific thresholds for temporal coherence
7. **Idle threshold** - Idle moves: >0.02 (2%) triggers `SF04_TEMPORAL_FLICKER`
8. **Walk threshold** - Walk moves: >0.10 (10%) triggers `SF04_TEMPORAL_FLICKER`
9. **Block threshold** - Block moves: >0.05 (5%) triggers `SF04_TEMPORAL_FLICKER`
10. **High-motion bypass** - Attack, jump, hit moves BYPASS MAPD (use SSIM instead)
11. **Mask-aware** - MAPD calculated only on intersection of non-transparent pixels
12. **Move type source** - Move type read from `identity.move_type` in manifest
13. **Bypass logging** - Bypassed moves log "MAPD skipped: high-motion move type"

---

## Tasks / Subtasks

- [ ] **Task 1: Create soft metric aggregator** (AC: #1, #2)
  - [ ] 1.1: Create `src/core/metrics/soft-metric-aggregator.ts`
  - [ ] 1.2: Define `AggregationWeights` from project spec
  - [ ] 1.3: Implement `aggregateSoftMetrics(metrics: IndividualMetrics, weights: AggregationWeights): Result<CompositeScore, SystemError>`
  - [ ] 1.4: Return `CompositeScore` with: `composite`, `breakdown`, `passed`, `failed_metrics`

- [ ] **Task 2: Implement weighted scoring** (AC: #1, #2)
  - [ ] 2.1: Define default weights: `{ stability: 0.35, identity: 0.30, palette: 0.20, style: 0.15 }`
  - [ ] 2.2: Normalize each input metric to 0.0-1.0 if needed
  - [ ] 2.3: Calculate weighted sum: `sum(metric * weight)`
  - [ ] 2.4: Handle missing metrics gracefully (use neutral 0.5 or skip)

- [ ] **Task 3: Implement threshold evaluation** (AC: #3)
  - [ ] 3.1: Read `auditor.thresholds.composite_min` (default: 0.70)
  - [ ] 3.2: If composite < threshold, flag for retry
  - [ ] 3.3: Identify which metrics contributed most to failure
  - [ ] 3.4: Return list of failed metric names

- [ ] **Task 4: Implement MAPD calculation** (AC: #6, #11)
  - [ ] 4.1: Create `calculateMAPD(currentPath: string, previousPath: string): Promise<number>`
  - [ ] 4.2: Load both images with Sharp
  - [ ] 4.3: Find intersection of non-transparent pixels (both alpha > 0)
  - [ ] 4.4: Calculate mean absolute difference for each channel
  - [ ] 4.5: Return normalized 0.0-1.0 score

- [ ] **Task 5: Implement move-type thresholds** (AC: #7, #8, #9, #10)
  - [ ] 5.1: Define threshold map: `{ idle: 0.02, walk: 0.10, block: 0.05, attack: 'bypass', jump: 'bypass', hit: 'bypass' }`
  - [ ] 5.2: Read move type from manifest `identity.move_type`
  - [ ] 5.3: If threshold is 'bypass', skip MAPD entirely
  - [ ] 5.4: Otherwise, compare MAPD to threshold

- [ ] **Task 6: Implement bypass logging** (AC: #13)
  - [ ] 6.1: When move type is high-motion, log bypass message
  - [ ] 6.2: Include move type in log entry
  - [ ] 6.3: Set MAPD result to null/undefined for bypassed moves
  - [ ] 6.4: Do not include in composite calculation

- [ ] **Task 7: Implement metrics logging** (AC: #4)
  - [ ] 7.1: Create `audit/frame_{N}_metrics.json` file
  - [ ] 7.2: Include breakdown: stability, identity, palette, style, temporal
  - [ ] 7.3: Include composite score
  - [ ] 7.4: Include pass/fail status and threshold used
  - [ ] 7.5: Use atomic write pattern

- [ ] **Task 8: Optimize for performance** (AC: #5)
  - [ ] 8.1: Track total computation time
  - [ ] 8.2: Log warning if exceeds 10 seconds
  - [ ] 8.3: Consider parallel computation for independent metrics
  - [ ] 8.4: Profile and optimize hot paths

- [ ] **Task 9: Write tests** (AC: all)
  - [ ] 9.1: Test weighted average calculation
  - [ ] 9.2: Test threshold triggers retry flag
  - [ ] 9.3: Test MAPD calculation for similar frames
  - [ ] 9.4: Test MAPD calculation for different frames
  - [ ] 9.5: Test move-type bypass for attack/jump
  - [ ] 9.6: Test metrics file is created correctly

---

## Dev Notes

### Scoring Weights (From PRD)

| Metric | Weight | Description |
|--------|--------|-------------|
| Stability | 0.35 | Temporal coherence (MAPD) |
| Identity | 0.30 | Character similarity (SSIM) |
| Palette | 0.20 | Color fidelity |
| Style | 0.15 | Visual consistency |

### CompositeScore Interface

```typescript
interface CompositeScore {
  composite: number;  // 0.0 - 1.0 weighted average
  breakdown: {
    stability: { raw: number; weighted: number };
    identity: { raw: number; weighted: number };
    palette: { raw: number; weighted: number };
    style: { raw: number; weighted: number };
  };
  mapd?: {
    value: number;
    threshold: number;
    move_type: string;
    passed: boolean;
    bypassed: boolean;
  };
  passed: boolean;
  threshold: number;
  failed_metrics: string[];
  computation_time_ms: number;
}
```

### MAPD Algorithm

```typescript
async function calculateMAPD(
  currentPath: string,
  previousPath: string
): Promise<number> {
  // Load both images
  const [current, previous] = await Promise.all([
    loadRawPixels(currentPath),
    loadRawPixels(previousPath)
  ]);

  let sumDiff = 0;
  let pixelCount = 0;

  // Iterate over all pixels
  for (let i = 0; i < current.data.length; i += 4) {
    const currentAlpha = current.data[i + 3];
    const previousAlpha = previous.data[i + 3];

    // Only compare where BOTH are opaque
    if (currentAlpha > 0 && previousAlpha > 0) {
      // Sum absolute differences for R, G, B
      for (let c = 0; c < 3; c++) {
        sumDiff += Math.abs(current.data[i + c] - previous.data[i + c]);
      }
      pixelCount++;
    }
  }

  // Normalize to 0.0 - 1.0
  // Max possible diff per pixel per channel is 255
  // 3 channels = 765 max
  const maxDiff = pixelCount * 765;
  return maxDiff > 0 ? sumDiff / maxDiff : 0;
}
```

### Move Type Thresholds

```typescript
const MAPD_THRESHOLDS: Record<string, number | 'bypass'> = {
  idle: 0.02,      // 2% - very stable
  idle_standard: 0.02,
  walk: 0.10,      // 10% - moderate motion
  walk_forward: 0.10,
  block: 0.05,     // 5% - slight movement
  attack: 'bypass',  // High motion - use SSIM
  jump: 'bypass',    // High motion - use SSIM
  hit: 'bypass',     // High motion - use SSIM
  death: 'bypass',   // High motion - use SSIM
};
```

### Why MAPD, Not LPIPS?

- **LPIPS:** Uses deep learning (requires Python, VGG model)
- **MAPD:** Pure pixel comparison (Node.js native)
- **MVP Decision:** Use MAPD for simplicity; LPIPS in v1+

### MAPD Threshold Rationale

| Move Type | Threshold | Rationale |
|-----------|-----------|-----------|
| Idle | 2% | Breathing animation is subtle |
| Walk | 10% | Limbs move significantly |
| Block | 5% | Slight defensive stance change |
| Attack | BYPASS | Huge motion, frames barely overlap |
| Jump | BYPASS | Character position changes drastically |
| Hit | BYPASS | Reaction animation is dramatic |

### Metrics File Schema

```json
{
  "frame_index": 3,
  "computed_at": "2026-01-18T14:30:52.000Z",
  "composite_score": 0.82,
  "passed": true,
  "threshold": 0.70,
  "breakdown": {
    "stability": {
      "raw": 0.95,
      "weighted": 0.3325,
      "passed": true
    },
    "identity": {
      "raw": 0.88,
      "weighted": 0.264,
      "passed": true
    },
    "palette": {
      "raw": 0.72,
      "weighted": 0.144,
      "passed": true
    },
    "style": {
      "raw": 0.65,
      "weighted": 0.0975,
      "passed": true
    }
  },
  "mapd": {
    "value": 0.015,
    "threshold": 0.02,
    "move_type": "idle_standard",
    "passed": true,
    "bypassed": false
  },
  "computation_time_ms": 4523
}
```

### Project Structure Notes

- Soft metric aggregator: `src/core/metrics/soft-metric-aggregator.ts`
- MAPD calculator: `src/core/metrics/mapd-calculator.ts`
- Integration: Called from `src/core/auditor.ts`
- Output: `runs/{run_id}/audit/frame_{N}_metrics.json`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.8]
- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Weighted scoring with MAPD move-type thresholds. Multiple conditions and bypass logic requires reasoning about move types, threshold selection, and edge cases. Integration with multiple metric sources.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
