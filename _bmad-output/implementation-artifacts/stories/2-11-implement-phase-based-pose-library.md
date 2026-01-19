# Story 2.11: Implement Phase-Based Pose Library

Status: done

---

## Story

**As an** operator,
**I want** pose descriptions defined as kinematic phases rather than per-frame text,
**So that** I can efficiently define animation poses without hand-authoring 8+ descriptions.

---

## Acceptance Criteria

### Pose Lookup

1. **Pose file exists** - File `src/domain/poses.ts` exists with pose definitions
2. **Frame lookup** - When generator prepares prompt for Frame N, looks up pose via `getPoseForFrame(moveId, frameIndex)`
3. **Prompt injection** - Injects description into prompt as `POSE ACTION: {description}`
4. **Fallback** - Falls back to "Maintain style and consistent volume." if no specific description exists

### Pose Library Structure

5. **Move mapping** - Each move maps frame indices to `PosePhase` objects
6. **Phase properties** - PosePhase includes:
   - `description`: Natural language pose instruction (mid-level intent)
   - `tension`: "relaxed" | "tense" | "explosive" (for style modulation)
7. **Frame 0 implicit** - Frame 0 is implicitly the Anchor pose (no description needed)
8. **Biomechanical phases** - Phases describe biomechanical states (Contact, Recoil, Passing, High Point)

### MVP Content

9. **Idle defined** - `idle_standard`: 8 frames (breathing sine wave)
10. **Walk defined** - `walk_forward`: 8 frames (standard locomotion cycle)
11. **Phase map pattern** - Each frame has specific pose description following the Phase Map pattern

---

## Tasks / Subtasks

- [x] **Task 1: Define pose types** (AC: #5, #6, #8)
  - [x] 1.1: Create `src/domain/poses.ts`
  - [x] 1.2: Define `PosePhase` interface with description, tension
  - [x] 1.3: Define `MovePoseMap` type: `Record<number, PosePhase>`
  - [x] 1.4: Define `PoseLibrary` type: `Record<string, MovePoseMap>`

- [x] **Task 2: Implement pose lookup** (AC: #2, #4)
  - [x] 2.1: Implement `getPoseForFrame(moveId: string, frameIndex: number): PosePhase | null`
  - [x] 2.2: Return null for frame 0 (anchor pose - implicit)
  - [x] 2.3: Return fallback pose if move not found
  - [x] 2.4: Return fallback pose if frame index not defined

- [x] **Task 3: Define idle_standard poses** (AC: #9, #11)
  - [x] 3.1: Frame 0: null (Anchor pose)
  - [x] 3.2: Frame 1: "Slight exhale, shoulders drop 1px" (relaxed)
  - [x] 3.3: Frame 2: "Full exhale, minimal compression" (relaxed)
  - [x] 3.4: Frame 3: "Begin inhale, chest rises" (relaxed)
  - [x] 3.5: Frame 4: "Mid inhale, upward energy" (relaxed)
  - [x] 3.6: Frame 5: "Full inhale, maximum expansion" (relaxed)
  - [x] 3.7: Frame 6: "Hold, stable peak" (relaxed)
  - [x] 3.8: Frame 7: "Exhale begins, return to Frame 0 energy" (relaxed)

- [x] **Task 4: Define walk_forward poses** (AC: #10, #11)
  - [x] 4.1: Frame 0: null (Contact - right foot forward)
  - [x] 4.2: Frame 1: "Recoil - weight shifts onto right foot, left foot lifts" (tense)
  - [x] 4.3: Frame 2: "Passing - left leg swings forward, body at midpoint" (relaxed)
  - [x] 4.4: Frame 3: "High Point - left leg at maximum forward extension" (tense)
  - [x] 4.5: Frame 4: "Contact - left foot strikes ground" (tense)
  - [x] 4.6: Frame 5: "Recoil - weight shifts onto left foot, right foot lifts" (tense)
  - [x] 4.7: Frame 6: "Passing - right leg swings forward, body at midpoint" (relaxed)
  - [x] 4.8: Frame 7: "High Point - right leg at maximum forward extension" (tense)

- [x] **Task 5: Implement prompt injection** (AC: #3)
  - [x] 5.1: Modify prompt template engine to call `getPoseForFrame()`
  - [x] 5.2: If pose exists, add `POSE ACTION: {description}` to prompt
  - [x] 5.3: Add `TENSION: {tension}` hint for style modulation
  - [x] 5.4: Log pose injection to audit

- [x] **Task 6: Implement fallback** (AC: #4, #7)
  - [x] 6.1: Create default fallback pose: "Maintain style and consistent volume."
  - [x] 6.2: Use fallback for undefined frames
  - [x] 6.3: Use fallback for undefined moves
  - [x] 6.4: Frame 0 always returns null (no injection needed)

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test idle poses return correct descriptions
  - [x] 7.2: Test walk poses return correct descriptions
  - [x] 7.3: Test frame 0 returns null
  - [x] 7.4: Test unknown move returns fallback
  - [x] 7.5: Test unknown frame returns fallback

---

## Dev Notes

### Phase-Based vs Per-Frame

**Old approach (per-frame):**
```yaml
frame_0: "Standing neutral pose with feet shoulder-width apart..."
frame_1: "Left arm begins to raise, weight shifts slightly..."
# 8 detailed descriptions = high authoring cost
```

**New approach (phase-based):**
```typescript
// Define kinematic phases, not pixel-level descriptions
walk_forward: {
  1: { description: "Recoil - weight shifts onto right foot", tension: "tense" },
  2: { description: "Passing - left leg swings forward", tension: "relaxed" },
  // Mid-level intent, AI handles details
}
```

### Biomechanical Phases (Walk Cycle)

Standard 8-frame walk cycle phases:
1. **Contact** - Foot strikes ground (heel or ball)
2. **Recoil** - Body absorbs impact, weight transfers
3. **Passing** - Swing leg passes under body
4. **High Point** - Swing leg at maximum extension

Each leg goes through all 4 phases, offset by 4 frames.

### Tension Values

| Tension | Visual Effect |
|---------|---------------|
| relaxed | Softer lines, natural pose |
| tense | Sharper edges, defined muscles |
| explosive | Dynamic pose, motion blur hints |

### MOVES_LIBRARY Structure

```typescript
export const MOVES_LIBRARY: PoseLibrary = {
  idle_standard: {
    // Frame 0 is anchor pose (implicit)
    1: { description: "Slight exhale, shoulders drop 1px", tension: "relaxed" },
    2: { description: "Full exhale, minimal compression", tension: "relaxed" },
    // ...
  },
  walk_forward: {
    1: { description: "Recoil - weight shifts onto right foot, left foot lifts", tension: "tense" },
    // ...
  }
};
```

### Prompt Injection Example

```
[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)
<anchor>
[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)
<prev frame>
HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.

POSE ACTION: Passing - left leg swings forward, body at midpoint
TENSION: relaxed

Generate Frame 2 of 8 for champion_01 walk_forward animation.
```

### Project Structure Notes

- Pose library: `src/domain/poses.ts`
- Integration: `src/core/prompt-template-engine.ts`

### References

- [Source: _bmad-output/project-context.md#Deep Think Architecture Lock Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.11]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Data structure definition (MOVES_LIBRARY constant). Well-scoped TypeScript const with clear pattern. Lookup function is straightforward.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

- All acceptance criteria met
- MOVES_LIBRARY contains idle, walk, run, attack pose phases
- Kinematic phases use biomechanical terms (Contact, Recoil, Passing, High Point)
- Tension values (relaxed, tense, explosive) for style modulation
- Fallback: "Maintain style and consistent volume."
- Tests combined with Story 2.4 in `test/core/prompt-template-engine.test.ts`

### File List

- `src/domain/poses.ts` - Phase-based pose library with MOVES_LIBRARY
- `src/core/prompt-template-engine.ts` - Pose lookup integration
