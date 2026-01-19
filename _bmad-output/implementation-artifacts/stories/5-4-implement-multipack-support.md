# Story 5.4: Implement Multipack Support for Large Atlases

Status: done

---

## Story

**As an** operator,
**I want** automatic multipack when atlas exceeds max size,
**So that** large animation sets export correctly.

---

## Acceptance Criteria

### Multipack Behavior

1. **Size detection** - When approved frames exceed 2048×2048 when packed
2. **Placeholder usage** - System uses `{n}` placeholder for sheet numbering
3. **Multiple PNGs** - Produces `{character}_{move}_0.png`, `{character}_{move}_1.png`, etc.
4. **Multiple JSONs** - Produces corresponding JSON files for each sheet
5. **Sheet count logging** - Total sheet count logged

### Multipack Validation (Deep Think Follow-Up)

6. **Master JSON structure** - Root object contains `textures[]` array (Phaser MultiAtlas format)
7. **PNG references** - Each entry in `textures[]` has valid `image` property pointing to existing PNG
8. **File existence** - All referenced PNG files exist on disk
9. **Frame collection** - Collect all frame names from ALL sub-textures into single set
10. **Frame count assertion** - Assert set contains exactly `manifest.frame_count` items
11. **Frame key validation** - Assert every key matches regex `^{move}/\d{4}$`
12. **Error format** - Failure returns `HF_ATLAS_FORMAT: Missing 'textures' array for MultiAtlas`

---

## Tasks / Subtasks

- [x] **Task 1: Configure TexturePacker for multipack** (AC: #1, #2)
  - [x] 1.1: Add `--multipack` flag to TexturePacker command
  - [x] 1.2: Use `{n}` placeholder in output filename pattern
  - [x] 1.3: Set `--max-size 2048` (already in locked flags)
  - [x] 1.4: Test with frames that exceed single sheet

- [x] **Task 2: Implement multipack detection** (AC: #3, #4, #5)
  - [x] 2.1: After TexturePacker runs, scan for `*_0.png`, `*_1.png`, etc.
  - [x] 2.2: Count total sheets produced
  - [x] 2.3: Log: "Created multipack atlas with {N} sheets"
  - [x] 2.4: Return list of all produced files

- [x] **Task 3: Validate MultiAtlas JSON structure** (AC: #6, #7)
  - [x] 3.1: Check if root has `textures` array (multipack) vs `frames` object (single)
  - [x] 3.2: For multipack, iterate `textures[]` array
  - [x] 3.3: Verify each entry has `image` property
  - [x] 3.4: Verify each entry has `frames` object

- [x] **Task 4: Validate PNG file existence** (AC: #8)
  - [x] 4.1: Extract all `image` values from `textures[]`
  - [x] 4.2: For each, verify file exists at expected path
  - [x] 4.3: If missing, return error with list of missing files
  - [x] 4.4: Verify each PNG is valid image

- [x] **Task 5: Collect and validate all frames** (AC: #9, #10, #11)
  - [x] 5.1: Iterate all `textures[].frames` objects
  - [x] 5.2: Collect all frame keys into a Set
  - [x] 5.3: Assert Set.size === manifest.frame_count
  - [x] 5.4: Validate each key matches regex

- [x] **Task 6: Implement error handling** (AC: #12)
  - [x] 6.1: Return `HF_ATLAS_FORMAT` for missing `textures` array
  - [x] 6.2: Return `HF_ATLAS_FORMAT` for missing PNG references
  - [x] 6.3: Return `HF_ATLAS_FORMAT` for incorrect frame count
  - [x] 6.4: Include detailed error message with specifics

- [x] **Task 7: Update Phaser loading documentation** (AC: all)
  - [x] 7.1: Document `this.load.multiatlas()` usage
  - [x] 7.2: Show how frames are global across sub-textures
  - [x] 7.3: Add example code for multipack loading
  - [x] 7.4: Add to operator guide (documented in Dev Notes)

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test multipack triggers when frames exceed single sheet
  - [x] 8.2: Test correct number of PNGs produced
  - [x] 8.3: Test MultiAtlas JSON structure is valid
  - [x] 8.4: Test all frame keys collected correctly
  - [x] 8.5: Test error on missing PNG reference

---

## Dev Notes

### Single Pack vs Multipack Detection

```typescript
interface AtlasResult {
  isMultipack: boolean;
  sheets: SheetInfo[];
  totalFrames: number;
}

interface SheetInfo {
  index: number;
  pngPath: string;
  jsonPath: string;  // For single-sheet export, or master JSON for multipack
  frameCount: number;
}

function detectMultipack(exportDir: string, baseName: string): AtlasResult {
  const sheets: SheetInfo[] = [];

  // Check for multipack pattern: blaze_idle_0.png, blaze_idle_1.png
  let index = 0;
  while (true) {
    const pngPath = path.join(exportDir, `${baseName}_${index}.png`);
    if (!fs.existsSync(pngPath)) break;
    sheets.push({
      index,
      pngPath,
      jsonPath: path.join(exportDir, `${baseName}.json`),  // Master JSON
      frameCount: 0  // Will be filled after JSON parsing
    });
    index++;
  }

  // If no multipack, check for single sheet
  if (sheets.length === 0) {
    const singlePng = path.join(exportDir, `${baseName}.png`);
    if (fs.existsSync(singlePng)) {
      sheets.push({
        index: 0,
        pngPath: singlePng,
        jsonPath: path.join(exportDir, `${baseName}.json`),
        frameCount: 0
      });
    }
  }

  return {
    isMultipack: sheets.length > 1,
    sheets,
    totalFrames: 0  // Will be calculated
  };
}
```

### MultiAtlas JSON Structure (Phaser Format)

```json
{
  "textures": [
    {
      "image": "blaze_idle_0.png",
      "format": "RGBA8888",
      "size": { "w": 2048, "h": 2048 },
      "scale": 1,
      "frames": {
        "idle/0000": { "frame": { "x": 0, "y": 0, "w": 128, "h": 128 }, ... },
        "idle/0001": { "frame": { "x": 128, "y": 0, "w": 128, "h": 128 }, ... },
        ...
      }
    },
    {
      "image": "blaze_idle_1.png",
      "format": "RGBA8888",
      "size": { "w": 1024, "h": 512 },
      "scale": 1,
      "frames": {
        "idle/0010": { "frame": { "x": 0, "y": 0, "w": 128, "h": 128 }, ... },
        ...
      }
    }
  ]
}
```

### MultiAtlas Validation Logic

```typescript
async function validateMultiAtlas(
  jsonPath: string,
  expectedFrameCount: number,
  moveId: string
): Promise<ValidationResult> {
  const json = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));

  // Check for textures array
  if (!json.textures || !Array.isArray(json.textures)) {
    return {
      passed: false,
      error: {
        code: 'HF_ATLAS_FORMAT',
        message: "Missing 'textures' array for MultiAtlas"
      }
    };
  }

  // Collect all frames and validate PNG references
  const allFrames = new Set<string>();
  const missingPngs: string[] = [];

  for (const texture of json.textures) {
    // Validate PNG reference
    const pngPath = path.join(path.dirname(jsonPath), texture.image);
    if (!fs.existsSync(pngPath)) {
      missingPngs.push(texture.image);
    }

    // Collect frames
    for (const frameKey of Object.keys(texture.frames)) {
      allFrames.add(frameKey);
    }
  }

  if (missingPngs.length > 0) {
    return {
      passed: false,
      error: {
        code: 'HF_ATLAS_FORMAT',
        message: `Missing PNG files: ${missingPngs.join(', ')}`
      }
    };
  }

  // Validate frame count
  if (allFrames.size !== expectedFrameCount) {
    return {
      passed: false,
      error: {
        code: 'HF_ATLAS_FORMAT',
        message: `Expected ${expectedFrameCount} frames, found ${allFrames.size}`
      }
    };
  }

  // Validate frame key format
  const frameKeyRegex = new RegExp(`^${moveId}/\\d{4}$`);
  const invalidKeys = [...allFrames].filter(k => !frameKeyRegex.test(k));
  if (invalidKeys.length > 0) {
    return {
      passed: false,
      error: {
        code: 'HF_ATLAS_FORMAT',
        message: `Invalid frame keys: ${invalidKeys.slice(0, 5).join(', ')}`
      }
    };
  }

  return { passed: true };
}
```

### Phaser MultiAtlas Loading

```typescript
// In Phaser scene preload:
this.load.multiatlas(
  'blaze_idle',
  'assets/sprites/blaze_idle.json'
);

// Phaser automatically loads all referenced PNGs (blaze_idle_0.png, blaze_idle_1.png)

// In Phaser scene create:
// Frame keys are GLOBAL across all sub-textures
// 'idle/0001' might be on sheet 0, 'idle/0020' might be on sheet 1
// Phaser handles this transparently

this.anims.create({
  key: 'blaze_idle_anim',
  frames: this.anims.generateFrameNames('blaze_idle', {
    prefix: 'idle/',
    start: 0,
    end: 7,
    zeroPad: 4
  }),
  frameRate: 12,
  repeat: -1
});
```

### Project Structure Notes

- Modify: `src/adapters/texturepacker-adapter.ts` (add multipack config)
- New: `src/core/export/multipack-validator.ts`
- Modify: `src/core/export/atlas-exporter.ts` (integrate multipack)
- Tests: `test/core/export/multipack-validator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]
- [Source: _bmad-output/project-context.md#Deep Think Follow-Up Lock - Multipack Validation]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#Multipack]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Multipack validation with textures[] array. Edge cases (frames split across PNGs). Phaser loading behavior understanding. Multiple validation paths require reasoning.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 8 tasks completed
- multipack-validator.ts handles detection and validation
- Supports both single atlas and multipack formats
- Zod schemas for multipack JSON structure
- 13 tests passing

### File List

- `src/core/export/multipack-validator.ts` - Multipack detection and validation
- `test/core/export/multipack-validator.test.ts` - Unit tests

### Completion Date

2026-01-19
