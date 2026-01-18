# Story 3.2: Implement Transparency Strategy Enforcement with Dynamic Chroma Key

Status: ready-for-dev

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

- [ ] **Task 1: Create transparency enforcer** (AC: #1, #2)
  - [ ] 1.1: Create `src/core/transparency-enforcer.ts`
  - [ ] 1.2: Define `TransparencyConfig` interface from manifest settings
  - [ ] 1.3: Implement `enforceTransparency(imagePath: string, config: TransparencyConfig): Result<TransparencyResult, SystemError>`
  - [ ] 1.4: Return `TransparencyResult` with: `outputPath`, `strategy`, `chromaColor?`, `hadAlpha`

- [ ] **Task 2: Implement true alpha validation** (AC: #1, #2)
  - [ ] 2.1: Load image with Sharp and check for alpha channel
  - [ ] 2.2: Use `metadata().channels` to verify 4 channels (RGBA)
  - [ ] 2.3: Return `HF_NO_ALPHA` error if no alpha channel present
  - [ ] 2.4: Pass through image unchanged if valid alpha exists

- [ ] **Task 3: Implement palette analysis for auto-detection** (AC: #3, #4, #5)
  - [ ] 3.1: Create `analyzeAnchorPalette(anchorPath: string): Promise<Set<string>>` function
  - [ ] 3.2: Extract all unique RGB colors from anchor image
  - [ ] 3.3: Store palette analysis in `runs/{run_id}/palette_analysis.json`
  - [ ] 3.4: Run at start of pipeline run, cache for all frames

- [ ] **Task 4: Implement dynamic chroma selection** (AC: #3, #4, #5)
  - [ ] 4.1: Define chroma candidates: `['#00FF00', '#FF00FF', '#00FFFF', '#0000FF']`
  - [ ] 4.2: For each candidate, check if color exists in anchor palette (with tolerance)
  - [ ] 4.3: Select first candidate NOT present in palette
  - [ ] 4.4: Use color distance threshold of 30 (Euclidean RGB distance) for "contains" check
  - [ ] 4.5: Log selected chroma color and reason

- [ ] **Task 5: Implement chroma key removal** (AC: #6, #8)
  - [ ] 5.1: Identify pixels matching chroma color (within tolerance)
  - [ ] 5.2: Set matching pixels to fully transparent (alpha = 0)
  - [ ] 5.3: Handle edge pixels with partial chroma contamination
  - [ ] 5.4: Use Sharp `removeAlpha().ensureAlpha()` pipeline

- [ ] **Task 6: Implement fringe prevention** (AC: #9)
  - [ ] 6.1: Detect edge pixels adjacent to chroma-keyed areas
  - [ ] 6.2: Check if edge pixels have colors within 50 distance of chroma
  - [ ] 6.3: Log warning if potential fringe artifacts detected
  - [ ] 6.4: Emit `SF_FRINGE_RISK` soft fail if severity exceeds threshold

- [ ] **Task 7: Implement explicit chroma override** (AC: #10)
  - [ ] 7.1: Check if `transparency.chroma_color` is explicit hex value
  - [ ] 7.2: Skip auto-detection if explicit value provided
  - [ ] 7.3: Validate hex format with regex
  - [ ] 7.4: Log "Using explicit chroma color: {color}"

- [ ] **Task 8: Implement logging** (AC: #7)
  - [ ] 8.1: Log strategy type (true_alpha or chroma_key)
  - [ ] 8.2: Log selected chroma color for chroma_key mode
  - [ ] 8.3: Log to `audit_log.jsonl`
  - [ ] 8.4: Include in frame metrics

- [ ] **Task 9: Write tests** (AC: all)
  - [ ] 9.1: Test true alpha validation passes valid images
  - [ ] 9.2: Test true alpha rejects images without alpha
  - [ ] 9.3: Test auto-detection avoids green in anchor
  - [ ] 9.4: Test auto-detection avoids magenta when green not present
  - [ ] 9.5: Test explicit chroma override works
  - [ ] 9.6: Test fringe detection for edge cases

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
