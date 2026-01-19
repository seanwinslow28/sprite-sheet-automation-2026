# Story 2.1: Define Manifest Schema with Zod Validation

Status: done

---

## Story

**As an** operator,
**I want** the system to validate my manifest against a strict schema before running,
**So that** configuration errors are caught early with clear messages.

---

## Acceptance Criteria

1. **Schema validation on run** - System validates the manifest against the Zod schema before any generation
2. **Identity fields validated** - Validates required fields: `identity.character`, `identity.move`, `identity.version`, `identity.frame_count`
3. **Input paths validated** - Validates input paths: `inputs.anchor`, `inputs.style_refs[]`, `inputs.pose_refs[]`, `inputs.guides[]`
4. **Generator config validated** - Validates generator config: `generator.backend`, `generator.model`, `generator.mode`, `generator.seed_policy`, `generator.max_attempts_per_frame`
5. **Prompt templates validated** - Validates prompt templates exist: `generator.prompts.master`, `generator.prompts.variation`, `generator.prompts.lock`, `generator.prompts.negative`
6. **Clear error messages** - Reports validation errors with field path and expected type (NFR18)
7. **Config hierarchy** - Resolves configuration hierarchy: manifest > defaults > env (FR47)

---

## Tasks / Subtasks

- [x] **Task 1: Define core schema types** (AC: #2)
  - [x] 1.1: Create `src/domain/schemas/identity.ts` with `identitySchema`
  - [x] 1.2: Define `character` as non-empty string with regex validation
  - [x] 1.3: Define `move` as enum or string (idle, walk, attack, etc.)
  - [x] 1.4: Define `version` as semver string
  - [x] 1.5: Define `frame_count` as positive integer (1-32 range)
  - [x] 1.6: Define `is_loop` as boolean (for loop closure detection)

- [x] **Task 2: Define inputs schema** (AC: #3)
  - [x] 2.1: Create `src/domain/schemas/inputs.ts` with `inputsSchema`
  - [x] 2.2: Define `anchor` as required file path string
  - [x] 2.3: Define `style_refs` as optional array of file paths
  - [x] 2.4: Define `pose_refs` as optional array of file paths
  - [x] 2.5: Define `guides` as optional array of file paths
  - [x] 2.6: Add `.refine()` to validate paths exist on disk

- [x] **Task 3: Define generator schema** (AC: #4, #5)
  - [x] 3.1: Create `src/domain/schemas/generator.ts` with `generatorSchema`
  - [x] 3.2: Define `backend` as literal "gemini" (only option for MVP)
  - [x] 3.3: Define `model` as string (e.g., "gemini-2.0-flash-exp")
  - [x] 3.4: Define `mode` as literal "edit"
  - [x] 3.5: Define `seed_policy` as enum: "fixed_then_random" | "always_random"
  - [x] 3.6: Define `max_attempts_per_frame` as positive integer (default: 4)
  - [x] 3.7: Define `prompts` sub-schema with master, variation, lock, negative

- [x] **Task 4: Define canvas schema** (AC: related to alignment stories)
  - [x] 4.1: Create `src/domain/schemas/canvas.ts` with `canvasSchema`
  - [x] 4.2: Define `generation_size` as 512 (locked for MVP)
  - [x] 4.3: Define `target_size` as 128 | 256
  - [x] 4.4: Define `downsample_method` as literal "nearest"
  - [x] 4.5: Define `alignment` sub-schema with method, vertical_lock, root_zone_ratio, max_shift_x

- [x] **Task 5: Define auditor and retry schemas** (AC: related to Epic 3/4)
  - [x] 5.1: Create `src/domain/schemas/auditor.ts` with placeholder structure
  - [x] 5.2: Create `src/domain/schemas/retry.ts` with placeholder structure
  - [x] 5.3: Define `export` schema with packer_flags, atlas_format

- [x] **Task 6: Compose manifest schema** (AC: #1, #6)
  - [x] 6.1: Create `src/domain/schemas/manifest.ts` composing all sub-schemas
  - [x] 6.2: Add `.describe()` to every field for documentation
  - [x] 6.3: Export `ManifestSchema` and `Manifest` type
  - [x] 6.4: Implement `validateManifest(input: unknown): Result<Manifest, ValidationError>`

- [x] **Task 7: Implement config hierarchy resolution** (AC: #7)
  - [x] 7.1: Create `src/core/config-resolver.ts`
  - [x] 7.2: Load defaults from `src/domain/defaults.ts`
  - [x] 7.3: Merge: manifest values > defaults > env variables
  - [x] 7.4: Return fully resolved manifest

- [x] **Task 8: Implement validation error formatting** (AC: #6)
  - [x] 8.1: Create `formatZodError(error: ZodError): ValidationError`
  - [x] 8.2: Include field path (e.g., "generator.prompts.master")
  - [x] 8.3: Include expected type vs received type
  - [x] 8.4: Include actionable fix suggestion

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test valid manifest passes validation
  - [x] 9.2: Test missing required fields fail with correct paths
  - [x] 9.3: Test invalid types fail with correct messages
  - [x] 9.4: Test config hierarchy merges correctly

---

## Dev Notes

### Schema Design Principles (from project-context.md)

- **Zod is the ONLY source of truth** for external data shapes
- Use `.describe()` on every field for auto-documentation
- External artifacts use `snake_case` (manifests, logs)
- Internal TypeScript uses `camelCase`
- Zod schemas handle transformation at boundaries

### Manifest Structure Overview

```yaml
identity:
  character: "champion_01"
  move: "idle"
  version: "1.0.0"
  frame_count: 8
  is_loop: true

inputs:
  anchor: "./assets/anchor.png"
  style_refs: []
  pose_refs: []
  guides: []

generator:
  backend: "gemini"
  model: "gemini-2.0-flash-exp"
  mode: "edit"
  seed_policy: "fixed_then_random"
  max_attempts_per_frame: 4
  prompts:
    master: "..."
    variation: "..."
    lock: "..."
    negative: "..."

canvas:
  generation_size: 512
  target_size: 128
  downsample_method: "nearest"
  alignment:
    method: "contact_patch"
    vertical_lock: true
    root_zone_ratio: 0.15
    max_shift_x: 32

auditor: { ... }  # Defined in Epic 3
retry: { ... }    # Defined in Epic 4
export: { ... }   # Defined in Epic 5
```

### Error Message Format (NFR18)

```json
{
  "code": "VALIDATION_ERROR",
  "field": "generator.prompts.master",
  "expected": "string",
  "received": "undefined",
  "fix": "Add 'master' template to generator.prompts section"
}
```

### Project Structure Notes

- Schemas: `src/domain/schemas/*.ts`
- Config resolver: `src/core/config-resolver.ts`
- Defaults: `src/domain/defaults.ts`

### References

- [Source: _bmad-output/project-context.md#Testing & Quality]
- [Source: _bmad-output/project-context.md#Configuration & Artifacts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR40-FR48]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Schema design is architectural. Zod schemas become the source of truth for the entire system. Claude's comprehensive reasoning ensures complete field coverage, proper type definitions, and catches edge cases in validation logic that simpler agents might miss.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

- All acceptance criteria met
- 17/17 tests passing in `test/domain/manifest-schema.test.ts`
- Schema uses `.describe()` on all fields for auto-documentation
- Config resolver implements manifest > defaults > env hierarchy
- Validation errors include field path, expected type, and fix suggestions

### File List

- `src/domain/schemas/manifest.ts` - Main manifest schema composition
- `src/domain/schemas/canvas.ts` - Canvas configuration schema
- `src/core/config-resolver.ts` - Config hierarchy resolution
- `test/domain/manifest-schema.test.ts` - Schema validation tests
