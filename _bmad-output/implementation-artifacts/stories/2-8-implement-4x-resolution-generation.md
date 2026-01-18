# Story 2.8: Implement 4x Resolution Generation and Downsampling

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** frames generated at 4x resolution and downsampled to target size,
**So that** pixel art has crisp edges without anti-aliasing artifacts.

---

## Acceptance Criteria

1. **Generate at 512px** - Frame is generated at 512×512 resolution
2. **Downsample to 128px** - After post-processing, frame is downsampled to 128×128 using nearest-neighbor interpolation
3. **Crisp pixel art** - Downsampling mathematically snaps "fat" lines (4px at 512) to crisp 1px lines (at 128)
4. **Sharp nearest-neighbor** - Sharp is used with `kernel: 'nearest'` for all resize operations
5. **Original preserved** - Original 512px candidate is preserved in `candidates/` for debugging

---

## Tasks / Subtasks

- [ ] **Task 1: Create resolution manager** (AC: #1, #2)
  - [ ] 1.1: Create `src/core/resolution-manager.ts`
  - [ ] 1.2: Define `ResolutionConfig` from canvas schema
  - [ ] 1.3: Implement `getGenerationSize(config): number` → returns 512
  - [ ] 1.4: Implement `getTargetSize(config): number` → returns 128 or 256
  - [ ] 1.5: Validate 4:1 ratio (512:128 or 1024:256)

- [ ] **Task 2: Implement downsampling** (AC: #3, #4)
  - [ ] 2.1: Create `src/utils/image-processing.ts`
  - [ ] 2.2: Implement `downsample(inputPath: string, outputPath: string, targetSize: number): Promise<Result<void, SystemError>>`
  - [ ] 2.3: Use Sharp with explicit `kernel: 'nearest'`
  - [ ] 2.4: Verify output dimensions match target

- [ ] **Task 3: Preserve original candidates** (AC: #5)
  - [ ] 3.1: Save 512px version to `candidates/frame_{N}_attempt_{M}_512.png`
  - [ ] 3.2: Save 128px version to `candidates/frame_{N}_attempt_{M}.png`
  - [ ] 3.3: Document naming convention in code comments

- [ ] **Task 4: Integrate with generation flow** (AC: all)
  - [ ] 4.1: Call downsample after Gemini returns image
  - [ ] 4.2: Pass 128px version to auditor
  - [ ] 4.3: Log both file paths in metrics

- [ ] **Task 5: Write tests** (AC: all)
  - [ ] 5.1: Test downsample produces correct dimensions
  - [ ] 5.2: Test nearest-neighbor preserves pixel art edges
  - [ ] 5.3: Verify no interpolation artifacts (visual test)
  - [ ] 5.4: Test both original and downsampled files exist

---

## Dev Notes

### Why 4x Resolution?

**Problem:** AI models produce soft, anti-aliased edges that look blurry in pixel art.

**Solution:** Generate at 4x resolution (512px), then downsample to target (128px) using nearest-neighbor interpolation.

**Effect:**
- A 4-pixel-wide "fat" line at 512px becomes a crisp 1-pixel line at 128px
- Anti-aliasing artifacts are mathematically eliminated
- No interpolation = no new color values introduced

### Sharp Configuration

```typescript
import sharp from 'sharp';

async function downsample(input: string, output: string, targetSize: number): Promise<void> {
  await sharp(input)
    .resize(targetSize, targetSize, {
      kernel: 'nearest',  // CRITICAL: No interpolation
      fit: 'fill',        // Exact dimensions
    })
    .toFile(output);
}
```

### Resolution Mapping

| Character Type | Generation Size | Target Size | Ratio |
|----------------|-----------------|-------------|-------|
| Champions      | 512px           | 128px       | 4:1   |
| Bosses         | 1024px          | 256px       | 4:1   |

### File Naming Convention

```
candidates/
├── frame_0000_attempt_01_512.png   # Original 512px
├── frame_0000_attempt_01.png       # Downsampled 128px
├── frame_0000_attempt_02_512.png
├── frame_0000_attempt_02.png
```

### Anti-Patterns (NEVER DO)

From project-context.md:
> **Cubic Interpolation:** Never use cubic/bilinear for pixel art downsampling. Always use nearest-neighbor.

### Visual Quality Check

After downsampling, verify:
1. Single-pixel lines are exactly 1px wide
2. No semi-transparent edge pixels introduced
3. Color palette remains unchanged (no new colors)

### Project Structure Notes

- Resolution manager: `src/core/resolution-manager.ts`
- Image processing: `src/utils/image-processing.ts`

### References

- [Source: _bmad-output/project-context.md#Post-Processor Patterns]
- [Source: _bmad-output/project-context.md#Anti-Patterns (NEVER DO)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Sharp-based resize with nearest-neighbor. Implementation is straightforward once spec is clear. Well-defined input/output with no architectural decisions.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
