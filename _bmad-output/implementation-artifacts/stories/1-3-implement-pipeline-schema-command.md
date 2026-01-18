# Story 1.3: Implement `pipeline schema` Command for Manifest Documentation

Status: done

---

## Story

**As an** operator,
**I want** to view the manifest schema and examples via CLI,
**So that** I can understand how to configure pipeline runs without leaving the terminal.

---

## Acceptance Criteria

1. **Schema output** - System outputs the complete JSON schema for manifest files
2. **Identity fields documented** - Includes field descriptions for `identity` (character, move, version, frame_count)
3. **Inputs fields documented** - Includes field descriptions for `inputs` (anchor, style_refs, pose_refs, guides)
4. **Generator fields documented** - Includes field descriptions for `generator` (backend, model, mode, prompt_templates)
5. **Auditor fields documented** - Includes field descriptions for `auditor` (hard_gates, soft_metrics, weights)
6. **Retry fields documented** - Includes field descriptions for `retry` (ladder, stop_conditions)
7. **Export fields documented** - Includes field descriptions for `export` (packer_flags, atlas_format)
8. **Example manifest provided** - At least one example manifest that passes schema validation
9. **Prompt templates demonstrated** - Example manifest demonstrates the 4 prompt template types (master, variation, lock, negative)

---

## Tasks / Subtasks

- [ ] **Task 1: Create schema command** (AC: #1)
  - [ ] 1.1: Create `src/commands/schema.ts` using Commander.js command handler
  - [ ] 1.2: Add `--format` flag: `json` (default) or `yaml`
  - [ ] 1.3: Add `--example` flag to output example manifest instead of schema
  - [ ] 1.4: Use Zod's `zodToJsonSchema` or equivalent to generate JSON Schema from Zod types

- [ ] **Task 2: Define complete manifest Zod schema** (AC: #2-7)
  - [ ] 2.1: Create `src/domain/schemas/manifest.ts` with full schema definition
  - [ ] 2.2: Define `identitySchema`: character, move, version, frame_count
  - [ ] 2.3: Define `inputsSchema`: anchor (required), style_refs[], pose_refs[], guides[]
  - [ ] 2.4: Define `generatorSchema`: backend, model, mode, seed_policy, max_attempts_per_frame, prompts
  - [ ] 2.5: Define `promptTemplatesSchema`: master, variation, lock, negative
  - [ ] 2.6: Define `auditorSchema`: hard_gates, soft_metrics, weights
  - [ ] 2.7: Define `retrySchema`: ladder[], stop_conditions
  - [ ] 2.8: Define `exportSchema`: packer_flags, atlas_format
  - [ ] 2.9: Add `.describe()` to every field for documentation generation

- [ ] **Task 3: Create example manifest** (AC: #8, #9)
  - [ ] 3.1: Create `assets/examples/sample-manifest.yaml`
  - [ ] 3.2: Include all 4 prompt template types with realistic content
  - [ ] 3.3: Include comments explaining each section
  - [ ] 3.4: Ensure example passes schema validation
  - [ ] 3.5: Create validation test that loads and validates example

- [ ] **Task 4: Implement schema output formatting** (AC: #1)
  - [ ] 4.1: Convert Zod schema to JSON Schema format
  - [ ] 4.2: Add proper `$schema`, `title`, `description` metadata
  - [ ] 4.3: Pretty-print JSON with 2-space indentation
  - [ ] 4.4: Support YAML output via js-yaml if `--format yaml`

- [ ] **Task 5: Write tests** (AC: all)
  - [ ] 5.1: Test schema command outputs valid JSON Schema
  - [ ] 5.2: Test example flag outputs valid manifest
  - [ ] 5.3: Test example manifest validates against schema
  - [ ] 5.4: Test all field descriptions are present

---

## Dev Notes

### Manifest Schema Structure (from PRD/Architecture)

```yaml
identity:
  character: string     # Character ID (e.g., "champion_01")
  move: string          # Move name (e.g., "idle", "walk", "attack")
  version: string       # Manifest version (e.g., "1.0.0")
  frame_count: number   # Total frames in animation

inputs:
  anchor: string        # Path to anchor image (required)
  style_refs: string[]  # Optional style reference images
  pose_refs: string[]   # Optional pose reference images
  guides: string[]      # Optional guide overlays

generator:
  backend: "gemini"     # AI backend (only gemini for MVP)
  model: string         # Model ID (e.g., "gemini-2.0-flash-exp")
  mode: "edit"          # Generation mode
  seed_policy: "fixed_then_random"
  max_attempts_per_frame: number
  prompts:
    master: string      # First attempt prompt
    variation: string   # Frame i of N prompt
    lock: string        # Recovery prompt after drift
    negative: string    # Avoid list

auditor:
  hard_gates:           # HF01-HF05 thresholds
  soft_metrics:         # SF01-SF05 thresholds
  weights:              # Scoring weights

retry:
  ladder: []            # Retry strategy sequence
  stop_conditions: {}   # When to halt

export:
  packer_flags: string  # TexturePacker CLI flags
  atlas_format: string  # Output format (phaser-hash)
```

### Zod Schema Best Practices

- Use `.describe()` on every field for auto-documentation
- Use `.default()` for optional fields with defaults
- Use `.refine()` for cross-field validation
- Export both the schema and inferred TypeScript type

```typescript
export const manifestSchema = z.object({
  identity: identitySchema.describe("Run identification"),
  // ...
});
export type Manifest = z.infer<typeof manifestSchema>;
```

### Project Structure Notes

- Command: `src/commands/schema.ts`
- Schemas: `src/domain/schemas/manifest.ts`
- Examples: `assets/examples/sample-manifest.yaml`

### References

- [Source: _bmad-output/project-context.md#Configuration & Artifacts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR40-FR48]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Well-defined output (JSON schema display). Schema definition follows clear patterns from Zod documentation. Fast autonomous execution from spec with no ambiguity.

### Debug Log References

None - implementation was straightforward

### Completion Notes List

- Complete manifest Zod schema with all 6 sections (identity, inputs, generator, auditor, retry, export)
- All fields have .describe() for auto-documentation
- JSON Schema generation via zod-to-json-schema
- Example manifest with all 4 prompt template types (master, variation, lock, negative)
- Schema validation successful

### Code Review Verification (2026-01-18)

- **Tests**: Added unit tests in `test/commands/schema.test.ts` (Fix #1)
- **Status**: PASSED adversarial review

### File List

- src/commands/schema.ts - Schema command with --example flag
- src/domain/schemas/manifest.ts - Complete Zod schema definitions
- assets/examples/sample-manifest.yaml - Example manifest with comments
- test/commands/schema.test.ts - Unit tests for schema output
- Updated src/bin.ts - Registered schema command
- package.json - Added zod-to-json-schema dependency
