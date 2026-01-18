# Story 5.9: Implement Export Settings Configuration

Status: ready-for-dev

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

- [ ] **Task 1: Define export config schema** (AC: #1, #2, #3, #5)
  - [ ] 1.1: Add `ExportConfigSchema` to manifest Zod schema
  - [ ] 1.2: Define `packer_flags` as optional string array
  - [ ] 1.3: Define `atlas_format` as enum (phaser, default)
  - [ ] 1.4: Define `output_path` as optional string
  - [ ] 1.5: Document each field in schema

- [ ] **Task 2: Implement flag merging logic** (AC: #1, #4)
  - [ ] 2.1: Create `mergePackerFlags(locked: string[], custom: string[]): string[]`
  - [ ] 2.2: Identify locked flags that cannot be overridden
  - [ ] 2.3: Filter out any custom flags that conflict with locked
  - [ ] 2.4: Log warning if custom flag was rejected
  - [ ] 2.5: Append non-conflicting custom flags

- [ ] **Task 3: Define locked flags list** (AC: #4)
  - [ ] 3.1: Document which flags are locked and why
  - [ ] 3.2: Create `LOCKED_FLAGS` constant with flag names
  - [ ] 3.3: Create `LOCKED_FLAG_VALUES` for flags that have fixed values
  - [ ] 3.4: Examples: `--format`, `--disable-rotation`, `--trim-mode`

- [ ] **Task 4: Implement atlas format handling** (AC: #2)
  - [ ] 4.1: Default to "phaser" format
  - [ ] 4.2: Map format to TexturePacker `--format` flag
  - [ ] 4.3: Validate format is supported
  - [ ] 4.4: For MVP, only "phaser" is supported; others error

- [ ] **Task 5: Implement custom output path** (AC: #3)
  - [ ] 5.1: If `export.output_path` specified, use it
  - [ ] 5.2: Resolve relative paths from project root
  - [ ] 5.3: Validate path is writable
  - [ ] 5.4: Create directory if it doesn't exist

- [ ] **Task 6: Integrate with exporter** (AC: all)
  - [ ] 6.1: Pass resolved export config to atlas exporter
  - [ ] 6.2: Apply merged flags to TexturePacker command
  - [ ] 6.3: Output to configured path
  - [ ] 6.4: Log effective configuration

- [ ] **Task 7: Write tests** (AC: all)
  - [ ] 7.1: Test default config when not specified
  - [ ] 7.2: Test custom flags are merged correctly
  - [ ] 7.3: Test locked flags cannot be overridden
  - [ ] 7.4: Test custom output path is used
  - [ ] 7.5: Test invalid config is rejected

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

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
