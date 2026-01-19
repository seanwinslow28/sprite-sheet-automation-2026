# Story 3.6: Implement Alpha Artifact Detection (Halo/Fringe)

Status: done

---

## Story

**As an** operator,
**I want** frames checked for alpha edge artifacts,
**So that** halos and fringes are detected before they appear in-game.

---

## Acceptance Criteria

### Alpha Analysis

1. **Edge detection** - System detects semi-transparent pixels at sprite edges
2. **Severity score** - Calculates halo severity score (0.0 = clean, 1.0 = severe)
3. **Threshold comparison** - Score compared against `auditor.thresholds.alpha_artifact_max`
4. **Soft fail trigger** - Scores above threshold trigger `SF_ALPHA_HALO` soft fail
5. **Score logged** - Severity score is logged to audit metrics

---

## Tasks / Subtasks

- [x] **Task 1: Create alpha artifact detector** (AC: #1, #2)
  - [x] 1.1: Create `src/core/metrics/alpha-artifact-detector.ts`
  - [x] 1.2: Implement `detectAlphaArtifacts(imagePath: string): Result<AlphaArtifactResult, SystemError>`
  - [x] 1.3: Return `AlphaArtifactResult` with: `severity_score`, `edge_pixels`, `problem_pixels`, `artifact_types`

- [x] **Task 2: Identify edge pixels** (AC: #1)
  - [x] 2.1: Load image with Sharp and get raw RGBA buffer
  - [x] 2.2: For each opaque pixel (alpha > 0), check if any neighbor is transparent (alpha = 0)
  - [x] 2.3: Build list of edge pixels with their alpha values
  - [x] 2.4: Use 4-neighbor connectivity (up, down, left, right)

- [x] **Task 3: Detect halo artifacts** (AC: #1, #2)
  - [x] 3.1: Identify edge pixels with partial alpha (1-254)
  - [x] 3.2: Check if edge pixel color is significantly different from nearest fully opaque pixel
  - [x] 3.3: "Halo" = light-colored semi-transparent pixels next to darker sprite
  - [x] 3.4: Calculate halo severity as: `halo_pixels / edge_pixels`

- [x] **Task 4: Detect fringe artifacts** (AC: #1, #2)
  - [x] 4.1: Identify edge pixels with colors bleeding from chroma key
  - [x] 4.2: Check for green, magenta, or cyan tinting on edges
  - [x] 4.3: "Fringe" = edge pixels with color distance < 50 from chroma colors
  - [x] 4.4: Calculate fringe severity as: `fringe_pixels / edge_pixels`

- [x] **Task 5: Calculate composite severity score** (AC: #2)
  - [x] 5.1: Combine halo and fringe into single score
  - [x] 5.2: Weight: halo 0.6, fringe 0.4
  - [x] 5.3: Normalize to 0.0-1.0 range
  - [x] 5.4: Classify: clean (<0.1), minor (0.1-0.3), moderate (0.3-0.6), severe (>0.6)

- [x] **Task 6: Implement threshold evaluation** (AC: #3, #4)
  - [x] 6.1: Read `auditor.thresholds.alpha_artifact_max` (default: 0.20)
  - [x] 6.2: If severity > threshold, return `SF03_ALPHA_HALO` soft fail
  - [x] 6.3: Include artifact breakdown in failure details

- [x] **Task 7: Implement logging** (AC: #5)
  - [x] 7.1: Log severity score and classification
  - [x] 7.2: Log edge pixel count
  - [x] 7.3: Log halo/fringe breakdown
  - [x] 7.4: Include in frame metrics JSON

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test clean sprite returns severity 0.0
  - [x] 8.2: Test sprite with halo returns elevated severity
  - [x] 8.3: Test sprite with fringe returns elevated severity
  - [x] 8.4: Test threshold triggers soft fail
  - [x] 8.5: Test fully opaque sprite (no edge artifacts)

---

## Dev Notes

### Artifact Types

| Type | Description | Visual Effect |
|------|-------------|---------------|
| **Halo** | Light semi-transparent ring around sprite | White/light edge glow |
| **Fringe** | Chroma color bleeding into edges | Green/magenta/cyan edge tint |
| **Aliasing** | Partial alpha from downsampling | Soft, blurred edges |

### AlphaArtifactResult Interface

```typescript
interface AlphaArtifactResult {
  severity_score: number;  // 0.0 - 1.0 composite
  classification: 'clean' | 'minor' | 'moderate' | 'severe';
  edge_pixels: number;
  problem_pixels: number;
  artifact_breakdown: {
    halo: {
      count: number;
      severity: number;
    };
    fringe: {
      count: number;
      severity: number;
      detected_colors: string[];  // Hex colors
    };
    aliasing: {
      count: number;
      severity: number;
    };
  };
  passed: boolean;
  threshold: number;
}
```

### Edge Detection Algorithm

```typescript
function isEdgePixel(
  data: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const alpha = getAlpha(data, x, y, width);

  // Not an edge if fully transparent
  if (alpha === 0) return false;

  // Check 4 neighbors
  const neighbors = [
    { dx: 0, dy: -1 },  // up
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 },  // left
    { dx: 1, dy: 0 },   // right
  ];

  for (const { dx, dy } of neighbors) {
    const nx = x + dx;
    const ny = y + dy;

    // Edge of image counts as transparent neighbor
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      return true;
    }

    const neighborAlpha = getAlpha(data, nx, ny, width);
    if (neighborAlpha === 0) {
      return true;
    }
  }

  return false;
}
```

### Halo Detection Logic

```
For each edge pixel with alpha < 255:
  1. Find nearest fully opaque neighbor
  2. Calculate luminance difference
  3. If edge is LIGHTER than sprite interior:
     - Mark as potential halo
     - Weight by alpha level (lower alpha = more likely halo)

Halo Score = sum(halo_weight) / edge_count
```

### Fringe Detection Logic

```
Chroma colors:
- Green:   RGB(0, 255, 0)
- Magenta: RGB(255, 0, 255)
- Cyan:    RGB(0, 255, 255)

For each edge pixel:
  1. Calculate distance to each chroma color
  2. If distance < 50 AND pixel is not pure chroma:
     - Mark as potential fringe
     - The closer to chroma, the worse the fringe

Fringe Score = sum(fringe_weight) / edge_count
```

### Why This Matters for Pixel Art

Pixel art should have:
- **Fully opaque pixels** (alpha = 255) or **fully transparent** (alpha = 0)
- **No semi-transparent edges** (anti-aliasing)
- **No color bleeding** from background removal

AI-generated images often have:
- Soft edges with gradient alpha
- Remnants of chroma key backgrounds
- Anti-aliased outlines that blur at game resolution

### Severity Classification

| Score Range | Classification | Action |
|-------------|----------------|--------|
| 0.00 - 0.10 | Clean | Pass |
| 0.10 - 0.20 | Minor | Pass (default threshold) |
| 0.20 - 0.40 | Moderate | Soft fail, retry |
| 0.40 - 1.00 | Severe | Soft fail, may need manual |

### Project Structure Notes

- Alpha artifact detector: `src/core/metrics/alpha-artifact-detector.ts`
- Integration: Called from `src/core/auditor.ts`
- Threshold config: Read from manifest `auditor.thresholds.alpha_artifact_max`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6]
- [Source: _bmad-output/project-context.md#Post-Processor Patterns]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Edge pixel analysis follows a clear algorithm. Well-defined detection criteria for halo and fringe artifacts. No architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
