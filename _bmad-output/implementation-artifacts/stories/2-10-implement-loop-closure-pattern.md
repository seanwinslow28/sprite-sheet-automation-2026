# Story 2.10: Implement Loop Closure Pattern for Cyclic Animations

Status: done

---

## Story

**As an** operator,
**I want** the final frame of a looping animation to transition smoothly back to Frame 0,
**So that** cyclic animations (Idle, Walk) don't have a visible "pop" when looping.

---

## Acceptance Criteria

### Loop Closure

1. **Loop detection** - System detects `isLoopClosure = (frameIndex === totalFrames - 1)` when manifest has `identity.is_loop: true`
2. **Prompt modification** - Modifies prompt to include loop closure context:
   - `CRITICAL CONTEXT: This is the FINAL frame of a looping animation.`
   - `OBJECTIVE: Create the missing link that connects [IMAGE 2] back to [IMAGE 1].`
   - `CONSTRAINT: The pose must be 85% transitioned towards [IMAGE 1].`
   - `PHYSICS: Ensure momentum decelerates to match the starting state.`
3. **Dual-purpose anchor** - [IMAGE 1] (Anchor) serves dual purpose as Identity Truth AND Motion Target
4. **Loop logged** - Loop closure logic is logged to audit artifacts
5. **Visual bridge** - Generated frame visually bridges Frame N-1 to Frame 0

### Non-Looping Animations

6. **No closure for linear** - When manifest has `identity.is_loop: false` (e.g., Attack moves), loop closure pattern is NOT applied
7. **Standard flow** - Standard linear flow prompts are used for non-looping animations

---

## Tasks / Subtasks

- [x] **Task 1: Extend prompt template engine** (AC: #1, #2)
  - [x] 1.1: Add `isLoop` and `isLoopClosure` to `PromptContext`
  - [x] 1.2: Create `buildLoopClosurePrompt(basePrompt: string): string`
  - [x] 1.3: Inject loop closure context before main prompt
  - [x] 1.4: Maintain Semantic Interleaving structure

- [x] **Task 2: Implement loop detection** (AC: #1, #6)
  - [x] 2.1: Read `identity.is_loop` from manifest (default: false)
  - [x] 2.2: Calculate `isLoopClosure = is_loop && (frameIndex === totalFrames - 1)`
  - [x] 2.3: Pass flag to prompt template engine

- [x] **Task 3: Build loop closure prompt additions** (AC: #2, #3)
  - [x] 3.1: Create loop closure prompt template constant
  - [x] 3.2: Include all 4 required lines (CONTEXT, OBJECTIVE, CONSTRAINT, PHYSICS)
  - [x] 3.3: Reference [IMAGE 1] as motion target
  - [x] 3.4: Inject after Semantic Interleaving labels, before main prompt

- [x] **Task 4: Update generator context** (AC: #3)
  - [x] 4.1: Mark anchor image as having dual purpose in context
  - [x] 4.2: Document anchor role in prompt: "Identity Truth + Motion Target"
  - [x] 4.3: Maintain hierarchy rule (Anchor still wins on conflict)

- [x] **Task 5: Implement logging** (AC: #4)
  - [x] 5.1: Log `isLoopClosure: true` when triggered
  - [x] 5.2: Log complete modified prompt
  - [x] 5.3: Log to `audit_log.jsonl`

- [x] **Task 6: Write tests** (AC: all)
  - [x] 6.1: Test loop closure detected on final frame of looping animation
  - [x] 6.2: Test loop closure NOT applied on non-looping animation
  - [x] 6.3: Test prompt contains all 4 required lines
  - [x] 6.4: Test prompt structure maintains Semantic Interleaving
  - [x] 6.5: Test middle frames of looping animation don't get closure

---

## Dev Notes

### Loop Closure Prompt Template

```
CRITICAL CONTEXT: This is the FINAL frame of a looping animation.

OBJECTIVE: Create the missing link that connects [IMAGE 2] (current pose) back to [IMAGE 1] (starting pose).

CONSTRAINT: The pose must be 85% transitioned towards [IMAGE 1]. The character should be almost returned to the starting position but with residual motion energy.

PHYSICS: Ensure momentum decelerates to match the starting state. No abrupt stops - the motion should flow naturally into the loop restart.

[Rest of normal prompt follows...]
```

### Why 85% Transition?

- 100% = Frame looks identical to Frame 0 (redundant)
- 85% = Visible "almost there" state that bridges the gap
- Creates illusion of continuous motion when looped
- Avoids the "pop" of sudden position change

### Animation Types

| Animation | is_loop | Loop Closure Applied |
|-----------|---------|---------------------|
| Idle      | true    | Yes (final frame)   |
| Walk      | true    | Yes (final frame)   |
| Run       | true    | Yes (final frame)   |
| Attack    | false   | No                  |
| Jump      | false   | No                  |
| Death     | false   | No                  |

### Prompt Structure with Loop Closure

```
[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH + MOTION TARGET)
<anchor image>
[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)
<previous frame>
HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.

CRITICAL CONTEXT: This is the FINAL frame of a looping animation.
OBJECTIVE: Create the missing link...
CONSTRAINT: The pose must be 85% transitioned...
PHYSICS: Ensure momentum decelerates...

Generate Frame 7 of 8 for champion_01 idle animation.
<variation template continues>
```

### Project Structure Notes

- Integration point: `src/core/prompt-template-engine.ts`
- Loop closure template: `src/domain/prompt-templates.ts`

### References

- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.10]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Prompt modification for final frame. Logic is clear once the pattern is understood. Well-defined detection condition and template injection.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

- All acceptance criteria met
- Loop closure integrated into prompt-template-engine.ts
- Tests combined with Story 2.4 in `test/core/prompt-template-engine.test.ts`
- 85% transition constraint for smooth loop restart
- CONTEXT, OBJECTIVE, CONSTRAINT, PHYSICS all present

### File List

- `src/core/prompt-template-engine.ts` - Loop closure detection and context injection
- (Tests in `test/core/prompt-template-engine.test.ts`)
