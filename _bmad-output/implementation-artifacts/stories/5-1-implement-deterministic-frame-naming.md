# Story 5.1: Implement Deterministic Frame Naming Convention

Status: done

---

## Story

**As an** operator,
**I want** frames named according to Phaser expectations,
**So that** animations load correctly in the game engine.

---

## Acceptance Criteria

### Frame Naming

1. **Naming format** - Frames renamed to format `{ACTION}/{ZERO_PAD}` (e.g., `idle/0000`, `idle/0001`)
2. **Naming policy** - Naming matches validator specification from Compliance Kit
3. **4-digit padding** - Frame numbers zero-padded to 4 digits (Deep Think Lock)
4. **Mapping logged** - Original-to-renamed mapping logged for traceability

### TexturePacker Integration

5. **TP token** - TexturePacker uses `{n4}` token in naming pattern
6. **Phaser config** - Phaser animations use `zeroPad: 4` in `generateFrameNames()`
7. **Lexicographical sort** - 4-digit padding ensures correct file explorer sorting

---

## Tasks / Subtasks

- [x] **Task 1: Create frame naming utility** (AC: #1, #3)
  - [x] 1.1: Create `src/utils/frame-naming.ts`
  - [x] 1.2: Implement `generateFrameName(moveId: string, frameIndex: number): string`
  - [x] 1.3: Use 4-digit zero padding: `frameIndex.toString().padStart(4, '0')`
  - [x] 1.4: Return format: `{moveId}/{paddedIndex}` (e.g., `idle/0003`)

- [x] **Task 2: Implement frame renaming for export** (AC: #1, #2)
  - [x] 2.1: Create `prepareFramesForExport(approvedPath: string, moveId: string): Promise<string>`
  - [x] 2.2: Create export staging folder: `export_staging/`
  - [x] 2.3: Copy approved frames with new names
  - [x] 2.4: Return path to staged folder

- [x] **Task 3: Implement naming mapping log** (AC: #4)
  - [x] 3.1: Track original filename → new filename mapping
  - [x] 3.2: Write mapping to `runs/{run_id}/export/frame_mapping.json`
  - [x] 3.3: Include both paths and frame indices
  - [x] 3.4: Use for debugging and traceability

- [x] **Task 4: Configure TexturePacker naming** (AC: #5)
  - [x] 4.1: Add `--sheet {n4}` to TexturePacker CLI flags
  - [x] 4.2: Add `--texture-format png` flag
  - [x] 4.3: Ensure frame keys in output JSON match naming convention
  - [x] 4.4: Test with sample frames

- [x] **Task 5: Document Phaser loading pattern** (AC: #6)
  - [x] 5.1: Add code snippet for `generateFrameNames()` usage
  - [x] 5.2: Include `zeroPad: 4` configuration
  - [x] 5.3: Add to operator guide (Story 6.6) - Documented in Dev Notes
  - [x] 5.4: Include example animation creation code

- [x] **Task 6: Implement naming validator** (AC: #2)
  - [x] 6.1: Create `validateFrameNaming(frames: string[]): ValidationResult`
  - [x] 6.2: Check format matches regex: `^[a-z_]+/\d{4}$`
  - [x] 6.3: Check sequence is contiguous (no gaps)
  - [x] 6.4: Return errors for invalid names

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test frame name generation for various indices
  - [x] 7.2: Test 4-digit padding for indices 0-9999
  - [x] 7.3: Test naming validator catches invalid formats
  - [x] 7.4: Test mapping log is created correctly
  - [x] 7.5: Test lexicographical sort order

---

## Dev Notes

### Frame Naming Pattern

```typescript
// Input: approved frames
frame_0000.png
frame_0001.png
frame_0002.png
...

// Output: export-ready names
idle/0000.png
idle/0001.png
idle/0002.png
...

// JSON atlas frame keys
"idle/0000": { ... }
"idle/0001": { ... }
"idle/0002": { ... }
```

### Frame Naming Utility

```typescript
function generateFrameName(moveId: string, frameIndex: number): string {
  const paddedIndex = frameIndex.toString().padStart(4, '0');
  return `${moveId}/${paddedIndex}`;
}

// Examples:
generateFrameName('idle', 0);    // "idle/0000"
generateFrameName('idle', 1);    // "idle/0001"
generateFrameName('walk', 10);   // "walk/0010"
generateFrameName('attack', 100); // "attack/0100"
```

### TexturePacker Configuration

```bash
TexturePacker \
  --data {output}.json \
  --sheet {output}.png \
  --format phaser \
  --trim-mode Trim \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  --disable-rotation \
  --alpha-handling ReduceBorderArtifacts \
  --max-size 2048 \
  --trim-sprite-names \
  --prepend-folder-name \
  export_staging/
```

### Phaser Loading Code

```typescript
// In Phaser scene preload:
this.load.atlas(
  'blaze_idle',
  'assets/sprites/blaze_idle.png',
  'assets/sprites/blaze_idle.json'
);

// In Phaser scene create:
this.anims.create({
  key: 'blaze_idle_anim',
  frames: this.anims.generateFrameNames('blaze_idle', {
    prefix: 'idle/',
    start: 0,
    end: 7,
    zeroPad: 4  // CRITICAL: Must match our 4-digit padding
  }),
  frameRate: 12,
  repeat: -1
});
```

### Frame Mapping Log

```json
{
  "run_id": "abc123",
  "move_id": "idle_standard",
  "frame_count": 8,
  "mappings": [
    {
      "original": "runs/abc123/approved/frame_0000.png",
      "renamed": "idle_standard/0000",
      "frame_index": 0
    },
    {
      "original": "runs/abc123/approved/frame_0001.png",
      "renamed": "idle_standard/0001",
      "frame_index": 1
    }
  ],
  "generated_at": "2026-01-18T12:00:00.000Z"
}
```

### Why 4-Digit Padding?

| Padding | Frame 1 | Frame 10 | Sort Order |
|---------|---------|----------|------------|
| 1-digit | `1` | `10` | 1, 10, 2, 3... (wrong!) |
| 2-digit | `01` | `10` | 01, 02, ..., 10 (correct up to 99) |
| 4-digit | `0001` | `0010` | Always correct, future-proof |

4-digit padding supports up to 9999 frames per animation—more than enough for any sprite sequence.

### Project Structure Notes

- New: `src/utils/frame-naming.ts`
- New: `src/core/export/frame-preparer.ts`
- Integrates with: Story 5.2 (TexturePacker), Story 5.7 (Phaser validation)
- Tests: `test/utils/frame-naming.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: _bmad-output/project-context.md#Deep Think Follow-Up Lock - 4-Digit Frame Padding]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** String formatting with 4-digit padding is straightforward. Clear input/output pattern. No complex decision logic—just consistent naming and file operations.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 7 tasks completed
- frame-naming.ts implements generateFrameName, parseFrameName, validateFrameNaming
- frame-preparer.ts handles export staging with mapping log
- Zod schemas for external snake_case format
- Tests passing

### File List

- `src/utils/frame-naming.ts` - Frame naming utilities
- `src/core/export/frame-preparer.ts` - Export staging and frame preparation
- `src/domain/schemas/atlas.ts` - Atlas JSON schemas with frame key validation

### Completion Date

2026-01-19
