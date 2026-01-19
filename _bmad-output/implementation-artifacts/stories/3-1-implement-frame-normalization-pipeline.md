# Story 3.1: Implement Frame Normalization Pipeline

Status: done

---

## Story

**As an** operator,
**I want** each generated candidate normalized to target specifications,
**So that** frames are consistent before auditing and packing.

---

## Acceptance Criteria

### Normalization Steps

1. **Alignment first** - Contact Patch Alignment is applied at generation resolution (512px) before downsampling
2. **Downsample second** - 4x→1x downsampling using nearest-neighbor interpolation
3. **Exact dimensions** - Image is resized to exact canvas size (128×128 or 256×256 per manifest)
4. **Pixel-safe method** - All resizing uses `kernel: 'nearest'` (no interpolation artifacts)
5. **Suffix naming** - Normalized image is saved to `candidates/` with `_norm` suffix
6. **Performance** - Normalization completes in ≤2 seconds per frame
7. **Sharp library** - Sharp is used for all image processing operations

### Processing Order

8. **Order enforced** - Processing follows strict order:
   1. Contact Patch Alignment (at 512px)
   2. Downsampling (512px → 128px)
   3. Transparency enforcement
   4. Final canvas crop/pad

---

## Tasks / Subtasks

- [x] **Task 1: Create normalizer module** (AC: #1-8)
  - [x] 1.1: Create `src/core/frame-normalizer.ts`
  - [x] 1.2: Define `NormalizerConfig` interface from manifest canvas settings
  - [x] 1.3: Implement `normalizeFrame(inputPath: string, config: NormalizerConfig, anchorAnalysis: AnchorAnalysis): Result<NormalizedFrame, SystemError>`
  - [x] 1.4: Return `NormalizedFrame` with: `inputPath`, `outputPath`, `processingSteps[]`, `durationMs`

- [x] **Task 2: Implement processing pipeline** (AC: #1, #2, #3, #8)
  - [x] 2.1: Call Contact Patch Aligner (Story 2.9) as first step
  - [x] 2.2: Call downsampler (Story 2.8) as second step
  - [x] 2.3: Apply transparency enforcement (Story 3.2) as third step
  - [x] 2.4: Apply final canvas sizing as fourth step
  - [x] 2.5: Log each step with timing

- [x] **Task 3: Implement canvas sizing** (AC: #3, #4)
  - [x] 3.1: Read target size from `canvas.target_size` manifest field
  - [x] 3.2: Crop if frame exceeds target dimensions
  - [x] 3.3: Pad with transparent pixels if frame is smaller
  - [x] 3.4: Use Sharp `extend()` for padding with `{ background: { r: 0, g: 0, b: 0, alpha: 0 } }`
  - [x] 3.5: Use Sharp `extract()` for cropping

- [x] **Task 4: Implement output handling** (AC: #5)
  - [x] 4.1: Generate output path: `{inputBasename}_norm.png`
  - [x] 4.2: Save to `candidates/` folder
  - [x] 4.3: Preserve original 512px file for debugging
  - [x] 4.4: Use atomic write pattern for normalized output

- [x] **Task 5: Implement performance tracking** (AC: #6)
  - [x] 5.1: Track start time at function entry
  - [x] 5.2: Track duration for each processing step
  - [x] 5.3: Log warning if total duration exceeds 2 seconds
  - [x] 5.4: Include timing in `NormalizedFrame` result

- [x] **Task 6: Write tests** (AC: all)
  - [x] 6.1: Test processing order is enforced
  - [x] 6.2: Test output dimensions match target_size
  - [x] 6.3: Test _norm suffix is applied correctly
  - [x] 6.4: Test performance warning is logged for slow processing
  - [x] 6.5: Test original file is preserved

---

## Dev Notes

### Processing Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: 512px candidate from Gemini                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Contact Patch Alignment (at 512px resolution)          │
│  - Calculates frame's root zone centroid                        │
│  - Shifts to match anchor's baseline position                   │
│  - Clamps to ±32px safety valve                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Downsampling (512px → 128px)                           │
│  - Uses Sharp with kernel: 'nearest'                            │
│  - Mathematically snaps 4px lines to 1px                        │
│  - No interpolation = no new colors                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Transparency Enforcement                               │
│  - Validates true alpha OR applies chroma key removal           │
│  - Ensures clean alpha edges                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Final Canvas Sizing                                    │
│  - Crops if larger than target                                  │
│  - Pads with transparent if smaller                             │
│  - Ensures exact dimensions                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: 128px normalized frame (frame_0000_attempt_01_norm.png)│
└─────────────────────────────────────────────────────────────────┘
```

### NormalizedFrame Interface

```typescript
interface NormalizedFrame {
  inputPath: string;
  outputPath: string;
  processingSteps: ProcessingStep[];
  durationMs: number;
  alignmentApplied: {
    shiftX: number;
    shiftY: number;
    clamped: boolean;
  };
  dimensions: {
    original: { width: number; height: number };
    final: { width: number; height: number };
  };
}

interface ProcessingStep {
  name: 'contact_patch' | 'downsample' | 'transparency' | 'canvas_sizing';
  durationMs: number;
  success: boolean;
  details?: Record<string, unknown>;
}
```

### Why Order Matters

1. **Alignment at 512px**: Sub-pixel shifts are more precise at higher resolution
2. **Downsample second**: Nearest-neighbor at 4:1 ratio eliminates anti-aliasing
3. **Transparency third**: Chroma key removal works better on downsampled pixels
4. **Canvas sizing last**: Final dimensions guaranteed after all transforms

### Performance Budget

| Step | Target | Max |
|------|--------|-----|
| Contact Patch | 200ms | 500ms |
| Downsample | 100ms | 300ms |
| Transparency | 300ms | 500ms |
| Canvas Sizing | 50ms | 200ms |
| **Total** | **650ms** | **2000ms** |

### File Naming Convention

```
candidates/
├── frame_0000_attempt_01.png        # Original 512px
├── frame_0000_attempt_01_512.png    # Original preserved
├── frame_0000_attempt_01_norm.png   # Normalized 128px
```

### Project Structure Notes

- Normalizer: `src/core/frame-normalizer.ts`
- Uses: `src/core/contact-patch-aligner.ts` (Story 2.9)
- Uses: `src/utils/image-processing.ts` (Story 2.8)

### References

- [Source: _bmad-output/project-context.md#Post-Processor Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Image processing pipeline with Sharp. Sequential operations are well-defined. Clear inputs/outputs with no architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
