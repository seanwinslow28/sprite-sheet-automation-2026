# Story 5.3: Implement Phaser-Compatible Atlas Output

Status: done

---

## Story

**As an** operator,
**I want** atlas exported in PNG + JSON Hash format,
**So that** it loads directly in Phaser 3.

---

## Acceptance Criteria

### Atlas Output

1. **PNG output** - `{character}_{move}.png` sprite sheet created
2. **JSON output** - `{character}_{move}.json` JSON Hash atlas created
3. **Frames object** - JSON contains `frames` object with correct frame keys
4. **Meta object** - JSON contains `meta` object with image dimensions
5. **Export location** - Output placed in `runs/{run_id}/export/` folder

### JSON Structure

6. **Frame key format** - Keys match `{action}/{zero_pad}` pattern
7. **Frame data** - Each frame has: `frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`
8. **Meta data** - Meta includes: `app`, `version`, `image`, `format`, `size`, `scale`

---

## Tasks / Subtasks

- [x] **Task 1: Define atlas output paths** (AC: #1, #2, #5)
  - [x] 1.1: Create `generateAtlasPath(runId: string, character: string, move: string): AtlasPaths`
  - [x] 1.2: Return `{ png: '...export/{char}_{move}.png', json: '...export/{char}_{move}.json' }`
  - [x] 1.3: Ensure export folder exists
  - [x] 1.4: Handle special characters in names (sanitize)

- [x] **Task 2: Implement atlas export orchestration** (AC: #1, #2, #5)
  - [x] 2.1: Create `exportAtlas(runId: string, manifest: Manifest): Promise<Result<AtlasOutput, SystemError>>`
  - [x] 2.2: Prepare frames (Story 5.1)
  - [x] 2.3: Call TexturePacker (Story 5.2)
  - [x] 2.4: Validate output exists

- [x] **Task 3: Validate JSON structure** (AC: #3, #4, #6, #7, #8)
  - [x] 3.1: Create `validateAtlasJson(jsonPath: string): ValidationResult`
  - [x] 3.2: Parse JSON and check structure
  - [x] 3.3: Verify `frames` object exists
  - [x] 3.4: Verify `meta` object exists
  - [x] 3.5: Validate frame key format matches regex

- [x] **Task 4: Validate PNG output** (AC: #1)
  - [x] 4.1: Create `validateAtlasPng(pngPath: string): ValidationResult`
  - [x] 4.2: Verify file exists and is readable
  - [x] 4.3: Verify dimensions match meta.size
  - [x] 4.4: Verify format is PNG with alpha

- [x] **Task 5: Implement frame key validation** (AC: #6)
  - [x] 5.1: Extract all frame keys from JSON
  - [x] 5.2: Validate each matches pattern: `^[a-z_]+/\d{4}$`
  - [x] 5.3: Verify key count matches expected frame count
  - [x] 5.4: Return list of invalid keys if any

- [x] **Task 6: Implement frame data validation** (AC: #7)
  - [x] 6.1: For each frame, verify required fields exist
  - [x] 6.2: Verify `frame` has `x`, `y`, `w`, `h`
  - [x] 6.3: Verify `rotated` is false (we disable rotation)
  - [x] 6.4: Verify dimensions are positive

- [x] **Task 7: Implement meta validation** (AC: #8)
  - [x] 7.1: Verify `meta.image` matches PNG filename
  - [x] 7.2: Verify `meta.format` is "RGBA8888"
  - [x] 7.3: Verify `meta.size` has `w` and `h`
  - [x] 7.4: Verify `meta.scale` is "1"

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test atlas output paths are correct
  - [x] 8.2: Test JSON validation passes for valid atlas
  - [x] 8.3: Test JSON validation fails for missing frames
  - [x] 8.4: Test PNG validation passes for valid image
  - [x] 8.5: Test frame key format validation

---

## Dev Notes

### AtlasPaths Interface

```typescript
interface AtlasPaths {
  png: string;   // Full path to atlas PNG
  json: string;  // Full path to atlas JSON
  name: string;  // Base name without extension
}

function generateAtlasPath(
  runId: string,
  character: string,
  move: string
): AtlasPaths {
  const name = `${character.toLowerCase()}_${move.toLowerCase()}`;
  const exportDir = path.join('runs', runId, 'export');

  return {
    png: path.join(exportDir, `${name}.png`),
    json: path.join(exportDir, `${name}.json`),
    name
  };
}
```

### Expected JSON Hash Structure

```json
{
  "frames": {
    "idle/0000": {
      "frame": { "x": 0, "y": 0, "w": 128, "h": 128 },
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 10, "y": 5, "w": 108, "h": 118 },
      "sourceSize": { "w": 128, "h": 128 }
    },
    "idle/0001": {
      "frame": { "x": 128, "y": 0, "w": 128, "h": 128 },
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 12, "y": 5, "w": 104, "h": 118 },
      "sourceSize": { "w": 128, "h": 128 }
    }
  },
  "meta": {
    "app": "https://www.codeandweb.com/texturepacker",
    "version": "1.0",
    "image": "blaze_idle.png",
    "format": "RGBA8888",
    "size": { "w": 512, "h": 256 },
    "scale": "1",
    "smartupdate": "$TexturePacker:SmartUpdate:abc123..."
  }
}
```

### Atlas JSON Schema (Zod)

```typescript
const FrameDataSchema = z.object({
  frame: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  rotated: z.literal(false),  // We disable rotation
  trimmed: z.boolean(),
  spriteSourceSize: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  sourceSize: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
});

const AtlasMetaSchema = z.object({
  app: z.string(),
  version: z.string(),
  image: z.string().endsWith('.png'),
  format: z.literal('RGBA8888'),
  size: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  scale: z.literal('1'),
});

const AtlasJsonSchema = z.object({
  frames: z.record(z.string().regex(/^[a-z_]+\/\d{4}$/), FrameDataSchema),
  meta: AtlasMetaSchema,
});
```

### Export Orchestration Flow

```typescript
async function exportAtlas(
  runId: string,
  manifest: Manifest
): Promise<Result<AtlasOutput, SystemError>> {
  const { character, move } = manifest.identity;

  // 1. Generate output paths
  const paths = generateAtlasPath(runId, character, move);

  // 2. Ensure export directory exists
  await fs.mkdir(path.dirname(paths.png), { recursive: true });

  // 3. Prepare frames with correct naming (Story 5.1)
  const stagingDir = await prepareFramesForExport(
    path.join('runs', runId, 'approved'),
    move
  );

  // 4. Call TexturePacker (Story 5.2)
  const packResult = await texturePackerAdapter.packAtlas(
    stagingDir,
    paths.png
  );

  if (packResult.isErr()) {
    return Result.err(packResult.error);
  }

  // 5. Validate output
  const jsonValid = await validateAtlasJson(paths.json);
  const pngValid = await validateAtlasPng(paths.png);

  if (!jsonValid.passed || !pngValid.passed) {
    return Result.err({
      code: 'SYS_EXPORT_VALIDATION_FAILED',
      message: 'Atlas validation failed after TexturePacker',
      details: { json: jsonValid.errors, png: pngValid.errors }
    });
  }

  return Result.ok({
    paths,
    frameCount: packResult.value.frameCount,
    sheetCount: packResult.value.sheetCount
  });
}
```

### Project Structure Notes

- New: `src/core/export/atlas-exporter.ts`
- New: `src/core/export/atlas-validator.ts`
- New: `src/domain/schemas/atlas-schema.ts`
- Integrates with: Story 5.1, Story 5.2
- Tests: `test/core/export/atlas-exporter.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#JSON Structure]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** File organization and JSON structure validation is well-defined. Zod schema creation follows established patterns. Straightforward orchestration of previous stories.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 8 tasks completed
- atlas-exporter.ts orchestrates full export flow
- atlas-validator.ts validates JSON and PNG
- Zod schemas in atlas.ts for JSON structure
- Tests passing

### File List

- `src/core/export/atlas-exporter.ts` - Export orchestration
- `src/core/export/atlas-validator.ts` - Atlas JSON/PNG validation
- `src/domain/schemas/atlas.ts` - Zod schemas for atlas JSON

### Completion Date

2026-01-19
