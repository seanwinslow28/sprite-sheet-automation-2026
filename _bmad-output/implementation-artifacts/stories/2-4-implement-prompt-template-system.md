# Story 2.4: Implement Prompt Template System

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** the system to apply the correct prompt template based on generation context,
**So that** prompts are optimized for each generation scenario.

---

## Acceptance Criteria

1. **Master template for frame 0** - When generating frame 0, attempt 1, applies `generator.prompts.master` template
2. **Variation template for frame N** - When generating frame N (N > 0), attempt 1, applies `generator.prompts.variation` template with `{frame_index}` and `{total_frames}` interpolated
3. **Lock template for recovery** - When retrying with "identity rescue" action, applies `generator.prompts.lock` template
4. **Negative prompt appended** - For any generation attempt, appends `generator.prompts.negative` as the negative prompt / avoid list
5. **Complete prompt logged** - Logs the complete resolved prompt to run artifacts

---

## Tasks / Subtasks

- [ ] **Task 1: Create prompt template engine** (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `src/core/prompt-template-engine.ts`
  - [ ] 1.2: Define `PromptContext` interface with frameIndex, totalFrames, attemptIndex, retryAction
  - [ ] 1.3: Implement `selectTemplate(context: PromptContext, prompts: PromptTemplates): string`
  - [ ] 1.4: Implement template selection logic based on context

- [ ] **Task 2: Implement template selection logic** (AC: #1, #2, #3)
  - [ ] 2.1: If `frameIndex === 0 && attemptIndex === 1` → return `master`
  - [ ] 2.2: If `frameIndex > 0 && attemptIndex === 1` → return `variation`
  - [ ] 2.3: If `retryAction === 'identity_rescue'` → return `lock`
  - [ ] 2.4: If `retryAction === 'tighten_prompt'` → return `lock` with additional constraints
  - [ ] 2.5: Default fallback to `variation` template

- [ ] **Task 3: Implement variable interpolation** (AC: #2)
  - [ ] 3.1: Create `interpolateTemplate(template: string, vars: Record<string, string | number>): string`
  - [ ] 3.2: Replace `{frame_index}` with current frame number
  - [ ] 3.3: Replace `{total_frames}` with total frame count
  - [ ] 3.4: Replace `{attempt_index}` with current attempt number
  - [ ] 3.5: Replace `{character_id}` with character identifier
  - [ ] 3.6: Replace `{move_id}` with move name
  - [ ] 3.7: Warn on unresolved placeholders

- [ ] **Task 4: Implement negative prompt handling** (AC: #4)
  - [ ] 4.1: Create `buildFinalPrompt(mainPrompt: string, negativePrompt: string): string`
  - [ ] 4.2: Append negative prompt with clear separator
  - [ ] 4.3: Format: `{main_prompt}\n\nAVOID: {negative_prompt}`

- [ ] **Task 5: Implement prompt logging** (AC: #5)
  - [ ] 5.1: Log template name used
  - [ ] 5.2: Log raw template before interpolation
  - [ ] 5.3: Log resolved prompt after interpolation
  - [ ] 5.4: Log to structured JSON in `runs/{run_id}/logs/prompts.jsonl`

- [ ] **Task 6: Write tests** (AC: all)
  - [ ] 6.1: Test master template selected for frame 0
  - [ ] 6.2: Test variation template selected for frame N
  - [ ] 6.3: Test lock template selected on identity rescue
  - [ ] 6.4: Test variable interpolation
  - [ ] 6.5: Test negative prompt appending

---

## Dev Notes

### Template Selection Decision Tree

```
if frameIndex === 0 && attemptIndex === 1:
    return "master"
elif retryAction === "identity_rescue":
    return "lock"
elif retryAction === "tighten_prompt":
    return "lock" + additional constraints
elif frameIndex > 0:
    return "variation"
else:
    return "variation" (fallback)
```

### Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{frame_index}` | Current frame number (0-indexed) | `3` |
| `{total_frames}` | Total frames in animation | `8` |
| `{attempt_index}` | Current attempt for this frame | `2` |
| `{character_id}` | Character identifier | `champion_01` |
| `{move_id}` | Move name | `idle` |

### Example Templates

**Master (Frame 0):**
```
Generate Frame 0 of {total_frames} for {character_id} {move_id} animation.
This is the starting pose matching the anchor reference exactly.
Maintain pixel art style with clean edges.
```

**Variation (Frame N):**
```
Generate Frame {frame_index} of {total_frames} for {character_id} {move_id} animation.
Continue the motion from the previous frame.
Maintain consistent character identity with the anchor.
```

**Lock (Identity Rescue):**
```
CRITICAL: Character identity has drifted.
Generate Frame {frame_index} matching the ANCHOR reference EXACTLY.
Prioritize identity over motion continuity.
```

**Negative:**
```
blurry, anti-aliased, smooth gradients, 3D rendering, photograph, realistic, watermark, signature, text
```

### Project Structure Notes

- Template engine: `src/core/prompt-template-engine.ts`
- Prompt logs: `runs/{run_id}/logs/prompts.jsonl`

### References

- [Source: _bmad-output/project-context.md#Post-Processor Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR10]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Template selection logic is a well-defined decision tree. Clear patterns for each scenario with deterministic output. Codex can implement autonomously without architectural decisions.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
