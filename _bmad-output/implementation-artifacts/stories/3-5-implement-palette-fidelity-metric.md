# Story 3.5: Implement Palette Fidelity Metric

Status: done

---

## Story

**As an** operator,
**I want** frames evaluated against the character's color palette,
**So that** off-palette colors are detected before export.

---

## Acceptance Criteria

### Palette Comparison

1. **Dominant colors extracted** - System extracts dominant colors from candidate frame
2. **Palette matching** - Calculates percentage of pixels matching palette colors (within tolerance)
3. **Threshold comparison** - Score is compared against `auditor.thresholds.palette_min`
4. **Soft fail trigger** - Scores below threshold trigger `SF_PALETTE_DRIFT` soft fail
5. **Score logged** - Fidelity percentage is logged to audit metrics

---

## Tasks / Subtasks

- [x] **Task 1: Create palette fidelity calculator** (AC: #1, #2)
  - [x] 1.1: Create `src/core/metrics/palette-fidelity.ts`
  - [x] 1.2: Implement `calculatePaletteFidelity(candidatePath: string, palette: string[]): Result<PaletteFidelityResult, SystemError>`
  - [x] 1.3: Return `PaletteFidelityResult` with: `fidelity_percentage`, `matched_pixels`, `unmatched_pixels`, `off_palette_colors`
  - [x] 1.4: Support palette from manifest `inputs.palette[]`

- [x] **Task 2: Implement color extraction** (AC: #1)
  - [x] 2.1: Load candidate image with Sharp
  - [x] 2.2: Get raw RGBA pixel buffer
  - [x] 2.3: Filter out transparent pixels (alpha < 128)
  - [x] 2.4: Build histogram of unique colors

- [x] **Task 3: Implement palette matching** (AC: #2)
  - [x] 3.1: Parse palette colors from hex strings
  - [x] 3.2: For each opaque pixel, find nearest palette color
  - [x] 3.3: Calculate color distance using Euclidean RGB
  - [x] 3.4: Pixel is "matched" if distance < tolerance (default: 30)

- [x] **Task 4: Calculate fidelity score** (AC: #2)
  - [x] 4.1: Count matched vs unmatched opaque pixels
  - [x] 4.2: Calculate percentage: `matched / (matched + unmatched) * 100`
  - [x] 4.3: Identify top 5 most common off-palette colors
  - [x] 4.4: Calculate coverage of each palette color

- [x] **Task 5: Implement threshold evaluation** (AC: #3, #4)
  - [x] 5.1: Read `auditor.thresholds.palette_min` (default: 0.90)
  - [x] 5.2: Convert fidelity percentage to 0.0-1.0
  - [x] 5.3: If below threshold, return `SF02_PALETTE_DRIFT` soft fail
  - [x] 5.4: Include off-palette colors in failure details

- [x] **Task 6: Implement logging** (AC: #5)
  - [x] 6.1: Log fidelity percentage
  - [x] 6.2: Log off-palette color count
  - [x] 6.3: Log most common off-palette colors
  - [x] 6.4: Include in frame metrics JSON

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test 100% palette match returns 1.0
  - [x] 7.2: Test off-palette colors reduce score
  - [x] 7.3: Test threshold triggers soft fail
  - [x] 7.4: Test transparent pixels are excluded
  - [x] 7.5: Test tolerance matching works correctly

---

## Dev Notes

### Palette Format in Manifest

```yaml
inputs:
  palette:
    - "#FF5733"  # Primary orange
    - "#C70039"  # Secondary red
    - "#900C3F"  # Dark accent
    - "#581845"  # Shadow color
    - "#FFC300"  # Highlight
    - "#FFFFFF"  # White
    - "#000000"  # Black outline
```

### PaletteFidelityResult Interface

```typescript
interface PaletteFidelityResult {
  fidelity_percentage: number;  // 0-100
  fidelity_score: number;       // 0.0-1.0
  matched_pixels: number;
  unmatched_pixels: number;
  total_opaque_pixels: number;
  off_palette_colors: OffPaletteColor[];
  palette_coverage: PaletteCoverage[];
  tolerance_used: number;
  passed: boolean;
  threshold: number;
}

interface OffPaletteColor {
  color: string;      // Hex format
  pixel_count: number;
  percentage: number;
  nearest_palette_color: string;
  distance: number;
}

interface PaletteCoverage {
  palette_color: string;
  pixel_count: number;
  percentage: number;
}
```

### Color Distance Calculation

```typescript
function colorDistance(c1: RGB, c2: RGB): number {
  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// Maximum possible distance (black to white)
const MAX_DISTANCE = Math.sqrt(255**2 * 3); // ≈ 441.67

// Default tolerance: 30 RGB units (~7% of max)
const DEFAULT_TOLERANCE = 30;
```

### Algorithm Flow

```
Candidate Image
      │
      ▼
┌─────────────────────────────────────┐
│  1. Extract all opaque pixels       │
│     (alpha >= 128)                  │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  2. For each pixel:                 │
│     - Find nearest palette color    │
│     - Calculate distance            │
│     - Mark as matched if < tolerance│
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  3. Calculate fidelity:             │
│     matched / total_opaque * 100    │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  4. Collect off-palette statistics  │
│     - Top 5 off-palette colors      │
│     - Palette coverage breakdown    │
└─────────────────────────────────────┘
```

### Tolerance Rationale

- **Distance 0-10:** Imperceptible difference (measurement noise)
- **Distance 10-30:** Subtle variation (acceptable)
- **Distance 30-60:** Noticeable but related color
- **Distance 60+:** Different color (off-palette)

Default tolerance of 30 allows for:
- Anti-aliasing blending
- Minor lighting variations
- Compression artifacts

### Performance Optimization

```typescript
// Use color binning for large palettes
function findNearestPaletteColor(
  pixel: RGB,
  palette: RGB[],
  cache: Map<number, number>
): { index: number; distance: number } {
  // Create cache key from RGB
  const key = (pixel.r << 16) | (pixel.g << 8) | pixel.b;

  if (cache.has(key)) {
    const index = cache.get(key)!;
    return { index, distance: colorDistance(pixel, palette[index]) };
  }

  // Find nearest
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(pixel, palette[i]);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = i;
    }
  }

  cache.set(key, nearestIndex);
  return { index: nearestIndex, distance: nearestDistance };
}
```

### Edge Case: Empty Palette

If no palette is specified in manifest:
1. Log warning "No palette specified, skipping palette fidelity check"
2. Return `fidelity_score: 1.0` (pass by default)
3. Set `passed: true` with note

### Project Structure Notes

- Palette fidelity: `src/core/metrics/palette-fidelity.ts`
- Integration: Called from `src/core/auditor.ts`
- Palette config: Read from manifest `inputs.palette[]`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Color matching within tolerance is an algorithmic task. Well-defined pixel comparison logic with clear inputs/outputs. No architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
