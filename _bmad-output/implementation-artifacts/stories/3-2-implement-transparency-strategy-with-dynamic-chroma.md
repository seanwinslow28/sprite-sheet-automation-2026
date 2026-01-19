# Story 3.2: Implement Transparency Strategy Enforcement with Dynamic Chroma Key

Status: done

---

## Story

**As an** operator,
**I want** the system to enforce a consistent transparency strategy per run,
**So that** all frames have clean alpha channels for game rendering.

---

## Acceptance Criteria

### True Alpha Mode

1. **Alpha validation** - When `transparency.strategy: "true_alpha"`, system validates image has proper alpha channel
2. **Alpha rejection** - Frames without alpha are rejected as Hard Fail (`HF_NO_ALPHA`)

### Chroma Key Mode

3. **Auto-detection** - When `transparency.chroma_color: "auto"`, system analyzes anchor palette at run start
4. **Green avoidance** - If anchor contains green (#00FF00), uses magenta (#FF00FF) as chroma
5. **Magenta avoidance** - If anchor contains magenta, uses cyan (#00FFFF) as chroma
6. **Deterministic removal** - Applies background removal using the selected chroma color
7. **Method logging** - Logs transparency method and selected color to run artifacts

### Output Quality

8. **Clean edges** - Resulting image has clean alpha edges (no semi-transparent fringe)
9. **Fringe prevention** - Chroma key removal is validated against sprites with near-chroma colors
10. **Explicit override** - When explicit `transparency.chroma_color: "#FF00FF"` is set, uses specified color without auto-detection

---

## Tasks / Subtasks

- [x] **Task 1: Create transparency enforcer** (AC: #1, #2)
  - [x] 1.1: Create `src/core/transparency-enforcer.ts`
  - [x] 1.2: Define `TransparencyConfig` interface from manifest settings
  - [x] 1.3: Implement `enforceTransparency(imagePath: string, config: TransparencyConfig): Result<TransparencyResult, SystemError>`
  - [x] 1.4: Return `TransparencyResult` with: `outputPath`, `strategy`, `chromaColor?`, `hadAlpha`

- [x] **Task 2: Implement true alpha validation** (AC: #1, #2)
  - [x] 2.1: Load image with Sharp and check for alpha channel
  - [x] 2.2: Use `metadata().channels` to verify 4 channels (RGBA)
  - [x] 2.3: Return `HF_NO_ALPHA` error if no alpha channel present
  - [x] 2.4: Pass through image unchanged if valid alpha exists

- [x] **Task 3: Implement palette analysis for auto-detection** (AC: #3, #4, #5)
  - [x] 3.1: Create `analyzeAnchorPalette(anchorPath: string): Promise<Set<string>>` function
  - [x] 3.2: Extract all unique RGB colors from anchor image
  - [x] 3.3: Store palette analysis in `runs/{run_id}/palette_analysis.json`
  - [x] 3.4: Run at start of pipeline run, cache for all frames

- [x] **Task 4: Implement dynamic chroma selection** (AC: #3, #4, #5)
  - [x] 4.1: Define chroma candidates: `['#00FF00', '#FF00FF', '#00FFFF', '#0000FF']`
  - [x] 4.2: For each candidate, check if color exists in anchor palette (with tolerance)
  - [x] 4.3: Select first candidate NOT present in palette
  - [x] 4.4: Use color distance threshold of 30 (Euclidean RGB distance) for "contains" check
  - [x] 4.5: Log selected chroma color and reason

- [x] **Task 5: Implement chroma key removal** (AC: #6, #8)
  - [x] 5.1: Identify pixels matching chroma color (within tolerance)
  - [x] 5.2: Set matching pixels to fully transparent (alpha = 0)
  - [x] 5.3: Handle edge pixels with partial chroma contamination
  - [x] 5.4: Use Sharp `removeAlpha().ensureAlpha()` pipeline

- [x] **Task 6: Implement fringe prevention** (AC: #9)
  - [x] 6.1: Detect edge pixels adjacent to chroma-keyed areas
  - [x] 6.2: Check if edge pixels have colors within 50 distance of chroma
  - [x] 6.3: Log warning if potential fringe artifacts detected
  - [x] 6.4: Emit `SF_FRINGE_RISK` soft fail if severity exceeds threshold

- [x] **Task 7: Implement explicit chroma override** (AC: #10)
  - [x] 7.1: Check if `transparency.chroma_color` is explicit hex value
  - [x] 7.2: Skip auto-detection if explicit value provided
  - [x] 7.3: Validate hex format with regex
  - [x] 7.4: Log "Using explicit chroma color: {color}"

- [x] **Task 8: Implement logging** (AC: #7)
  - [x] 8.1: Log strategy type (true_alpha or chroma_key)
  - [x] 8.2: Log selected chroma color for chroma_key mode
  - [x] 8.3: Log to `audit_log.jsonl`
  - [x] 8.4: Include in frame metrics

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test true alpha validation passes valid images
  - [x] 9.2: Test true alpha rejects images without alpha
  - [x] 9.3: Test auto-detection avoids green in anchor
  - [x] 9.4: Test auto-detection avoids magenta when green not present
  - [x] 9.5: Test explicit chroma override works
  - [x] 9.6: Test fringe detection for edge cases

---

## Dev Notes

### Chroma Selection Priority

```typescript
const CHROMA_CANDIDATES = [
  '#00FF00',  // Green (classic chroma key)
  '#FF00FF',  // Magenta (if green in palette)
  '#00FFFF',  // Cyan (if magenta also in palette)
  '#0000FF',  // Blue (last resort)
];
```

### Color Distance Algorithm

```typescript
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// Color "exists" in palette if distance < 30
const PALETTE_TOLERANCE = 30;

// Edge pixel has "fringe risk" if distance < 50
const FRINGE_TOLERANCE = 50;
```

### Auto-Detection Flow

```
Anchor Image → Extract Palette → Check Green → Check Magenta → Select Chroma
      ↓                               ↓             ↓              ↓
 palette_analysis.json           present?      present?       first available
      ↓                               ↓             ↓
  Cache for run                  Use Magenta   Use Cyan
```

### TransparencyResult Interface

```typescript
interface TransparencyResult {
  outputPath: string;
  strategy: 'true_alpha' | 'chroma_key';
  chromaColor?: string;  // Only for chroma_key strategy
  hadAlpha: boolean;
  edgePixelsProcessed?: number;
  fringeRisk?: {
    detected: boolean;
    severity: number;  // 0.0 - 1.0
    affectedPixels: number;
  };
}
```

### palette_analysis.json Schema

```json
{
  "analyzed_at": "2026-01-18T14:30:52.000Z",
  "anchor_path": "/absolute/path/to/anchor.png",
  "unique_colors": 156,
  "palette": ["#FF5733", "#C70039", ...],
  "contains_green": false,
  "contains_magenta": true,
  "selected_chroma": "#00FFFF",
  "selection_reason": "Magenta (#FF00FF) found in palette, using cyan"
}
```

### Edge Case: Near-Chroma Colors

**Problem:** Character might have a teal outfit close to cyan chroma.

**Solution:**
1. Detect sprite edge pixels
2. Calculate color distance from selected chroma
3. If < 50 distance, flag as fringe risk
4. Operator can specify explicit chroma color in manifest

### Sharp Implementation Pattern

```typescript
async function removeChromaKey(input: string, output: string, chromaColor: string): Promise<void> {
  const { r, g, b } = hexToRgb(chromaColor);

  // Read raw pixel data
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Process pixels
  for (let i = 0; i < data.length; i += 4) {
    const distance = colorDistance(
      { r: data[i], g: data[i + 1], b: data[i + 2] },
      { r, g, b }
    );

    if (distance < CHROMA_TOLERANCE) {
      data[i + 3] = 0;  // Set alpha to 0
    }
  }

  // Write result
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(output);
}
```

### Project Structure Notes

- Transparency enforcer: `src/core/transparency-enforcer.ts`
- Palette analyzer: `src/utils/palette-analyzer.ts`
- Integration: Called from `src/core/frame-normalizer.ts`

### References

- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Dynamic auto-detection of chroma key based on anchor palette. Edge case handling (green in sprite, fringe artifacts). Multiple code paths requiring reasoning about color theory and image processing.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
