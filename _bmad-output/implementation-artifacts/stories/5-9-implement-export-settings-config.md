# Story 5.9: Implement Export Settings Configuration

Status: done

---

## Story

**As an** operator,
**I want** to configure export settings in the manifest,
**So that** I can customize atlas parameters per character/move.

---

## Acceptance Criteria

### Configuration Options

1. **Packer flags** - Reads `export.packer_flags` for any override flags (merged with locked flags)
2. **Atlas format** - Reads `export.atlas_format` (default: "phaser")
3. **Output path** - Reads `export.output_path` for custom output location
4. **Locked flags protection** - Locked flags cannot be overridden (safety enforcement)
5. **Schema validation** - Configuration validated by Zod schema

---

## Tasks / Subtasks

- [x] **Task 1: Define export config schema** (AC: #1, #2, #3, #5)
  - [x] 1.1: Add `ExportConfigSchema` to manifest Zod schema
  - [x] 1.2: Define `packer_flags` as optional string array
  - [x] 1.3: Define `atlas_format` as enum (phaser, default)
  - [x] 1.4: Define `output_path` as optional string
  - [x] 1.5: Document each field in schema

- [x] **Task 2: Implement flag merging logic** (AC: #1, #4)
  - [x] 2.1: Create `mergePackerFlags(locked: string[], custom: string[]): string[]`
  - [x] 2.2: Identify locked flags that cannot be overridden
  - [x] 2.3: Filter out any custom flags that conflict with locked
  - [x] 2.4: Log warning if custom flag was rejected
  - [x] 2.5: Append non-conflicting custom flags

- [x] **Task 3: Define locked flags list** (AC: #4)
  - [x] 3.1: Document which flags are locked and why
  - [x] 3.2: Create `LOCKED_FLAGS` constant with flag names
  - [x] 3.3: Create `LOCKED_FLAG_VALUES` for flags that have fixed values
  - [x] 3.4: Examples: `--format`, `--disable-rotation`, `--trim-mode`

- [x] **Task 4: Implement atlas format handling** (AC: #2)
  - [x] 4.1: Default to "phaser" format
  - [x] 4.2: Map format to TexturePacker `--format` flag
  - [x] 4.3: Validate format is supported
  - [x] 4.4: For MVP, only "phaser" is supported; others error

- [x] **Task 5: Implement custom output path** (AC: #3)
  - [x] 5.1: If `export.output_path` specified, use it
  - [x] 5.2: Resolve relative paths from project root
  - [x] 5.3: Validate path is writable
  - [x] 5.4: Create directory if it doesn't exist

- [x] **Task 6: Integrate with exporter** (AC: all)
  - [x] 6.1: Pass resolved export config to atlas exporter
  - [x] 6.2: Apply merged flags to TexturePacker command
  - [x] 6.3: Output to configured path
  - [x] 6.4: Log effective configuration

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test default config when not specified
  - [x] 7.2: Test custom flags are merged correctly
  - [x] 7.3: Test locked flags cannot be overridden
  - [x] 7.4: Test custom output path is used
  - [x] 7.5: Test invalid config is rejected

---

## Dev Notes

### ExportConfig Schema

```typescript
const ExportConfigSchema = z.object({
  packer_flags: z.array(z.string()).optional().default([]),
  atlas_format: z.enum(['phaser']).optional().default('phaser'),
  output_path: z.string().optional(),
}).optional().default({});
```

### Locked vs. Allowed Flags

| Flag | Status | Reason |
|------|--------|--------|
| `--format` | LOCKED | Must be "phaser" for Phaser compatibility |
| `--trim-mode` | LOCKED | "Trim" is required for pivot behavior |
| `--extrude` | LOCKED | 1px extrude prevents edge bleeding |
| `--shape-padding` | LOCKED | 2px prevents frame overlap |
| `--border-padding` | LOCKED | 2px prevents edge artifacts |
| `--disable-rotation` | LOCKED | Rotation breaks Phaser origin |
| `--alpha-handling` | LOCKED | ReduceBorderArtifacts required |
| `--max-size` | ALLOWED | Can increase but default is 2048 |
| `--multipack` | ALLOWED | Automatically enabled when needed |
| `--scale` | ALLOWED | Operator can scale down |

### Flag Merging Logic

```typescript
const LOCKED_FLAGS = new Set([
  '--format',
  '--trim-mode',
  '--extrude',
  '--shape-padding',
  '--border-padding',
  '--disable-rotation',
  '--alpha-handling',
  '--trim-sprite-names',
  '--prepend-folder-name',
]);

function mergePackerFlags(
  locked: string[],
  custom: string[]
): { merged: string[]; rejected: string[] } {
  const rejected: string[] = [];
  const allowed: string[] = [];

  for (let i = 0; i < custom.length; i++) {
    const flag = custom[i];

    // Check if this is a locked flag
    if (LOCKED_FLAGS.has(flag)) {
      rejected.push(flag);
      // Skip the value too if it's a flag with value
      if (!flag.startsWith('--') || custom[i + 1]?.startsWith('--')) {
        continue;
      }
      i++; // Skip value
      continue;
    }

    allowed.push(flag);
  }

  if (rejected.length > 0) {
    logger.warn({
      event: 'custom_flags_rejected',
      rejected,
      reason: 'These flags are locked for Phaser compatibility'
    });
  }

  return {
    merged: [...locked, ...allowed],
    rejected
  };
}
```

### Example Manifest Export Config

```yaml
export:
  # Optional: Add custom TexturePacker flags
  packer_flags:
    - "--max-size"
    - "4096"
    - "--scale"
    - "0.5"

  # Atlas format (only "phaser" supported in MVP)
  atlas_format: "phaser"

  # Optional: Custom output location
  output_path: "./assets/sprites/generated/"
```

### Default Export Config

```typescript
const DEFAULT_EXPORT_CONFIG = {
  packer_flags: [],
  atlas_format: 'phaser' as const,
  output_path: undefined  // Uses runs/{run_id}/export/
};
```

### Resolved Export Config

```typescript
interface ResolvedExportConfig {
  // Merged flags (locked + allowed custom)
  packer_flags: string[];

  // Format
  atlas_format: 'phaser';

  // Output locations
  staging_path: string;  // Temporary folder for frame prep
  export_path: string;   // Final atlas location
  output_path?: string;  // Custom promotion target

  // Metadata
  custom_flags_applied: string[];
  custom_flags_rejected: string[];
}
```

### Configuration Resolution Flow

```typescript
function resolveExportConfig(
  manifest: Manifest,
  runId: string
): ResolvedExportConfig {
  const exportConfig = manifest.export ?? DEFAULT_EXPORT_CONFIG;

  // Merge flags
  const { merged, rejected } = mergePackerFlags(
    LOCKED_TEXTUREPACKER_FLAGS,
    exportConfig.packer_flags ?? []
  );

  // Resolve paths
  const runDir = path.join('runs', runId);

  return {
    packer_flags: merged,
    atlas_format: exportConfig.atlas_format ?? 'phaser',
    staging_path: path.join(runDir, 'export_staging'),
    export_path: path.join(runDir, 'export'),
    output_path: exportConfig.output_path
      ? path.resolve(exportConfig.output_path)
      : undefined,
    custom_flags_applied: exportConfig.packer_flags?.filter(f => !LOCKED_FLAGS.has(f)) ?? [],
    custom_flags_rejected: rejected
  };
}
```

### Project Structure Notes

- Modify: `src/domain/schemas/manifest-schema.ts` (add ExportConfigSchema)
- New: `src/core/export/config-resolver.ts`
- Modify: `src/adapters/texturepacker-adapter.ts` (accept resolved config)
- Tests: `test/core/export/config-resolver.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.9]
- [Source: stories/5-2-implement-texturepacker-integration.md]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#TexturePacker Flags]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Configuration reading with flag merging logic. Straightforward schema extension and validation. Clear input/output contract.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 7 tasks completed
- export-config-resolver.ts implements config resolution
- mergePackerFlags handles locked vs allowed flags
- LOCKED_FLAGS and LOCKED_FLAG_VALUES defined
- ResolvedExportConfig interface for resolved settings
- ExportConfigSchema added to manifest
- 12 tests passing

### File List

- `src/core/export/export-config-resolver.ts` - Export config resolution
- `src/adapters/texturepacker-adapter.ts` - Updated with flag merging
- `test/core/export/export-config-resolver.test.ts` - Unit tests

### Completion Date

2026-01-19
