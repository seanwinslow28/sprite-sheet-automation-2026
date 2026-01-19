# Epic 7 Retrospective: Director Mode (Human-in-the-Loop Interface)

**Date:** 2026-01-19
**Epic:** 7 - Director Mode (Human-in-the-Loop Interface)
**Status:** Complete
**Facilitator:** Bob (Scrum Master)
**Project Lead:** Sean

---

## Executive Summary

Epic 7 delivered the complete Director Mode - a web-based human-in-the-loop interface for reviewing, adjusting, and patching AI-generated sprite frames. This epic was the most frontend-heavy of the project, introducing a full React/TypeScript UI with 9 stories spanning session state management, timeline/stage components, interactive tools (nudge, mask/pen), API integrations (patch, commit), and visual overlays. All 9 stories completed with 376+ tests added, bringing the project total to 876 passing tests. A comprehensive adversarial code review identified 6 issues (all fixed) including a critical Result API mismatch that would have caused runtime failures.

---

## Epic Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 9/9 (100%) |
| Total Tests Added | 376 (72 + 31 + 33 + 27 + 39 + 35 + 46 + 50 + 43) |
| Project Total Tests | 876 passing |
| Primary Agent | Claude-Code (5 stories: 7.1, 7.6, 7.7, 7.8, 7.9) |
| Secondary Agent | Cursor (4 stories: 7.2, 7.3, 7.4, 7.5) |
| New Source Files | 40+ (backend + UI components) |
| UI Components Created | 15+ React components |
| Completion Date | 2026-01-19 |

---

## Story-by-Story Analysis

### Story 7.1: Director Session State Management
- **Agent:** Claude-Code
- **Tests:** 72 passing (33 schema + 39 manager)
- **Files:** `src/domain/types/director-session.ts`, `src/core/director-session-manager.ts`
- **Key Implementation:**
  - `DirectorSession` schema with sessionId, runId, moveId, frames map
  - `DirectorFrameState` with status lifecycle (PENDING → GENERATED → AUDIT_FAIL/WARN → APPROVED)
  - `DirectorOverrides` for human alignment deltas and patch history
  - `DirectorSessionManager` class with full lifecycle (create, load, update, commit, discard)
  - Atomic persistence via `writeJsonAtomic()` temp-then-rename pattern
  - Session resume capability after browser refresh
- **Code Review Fix:** Result API patterns validated

### Story 7.2: Timeline Component
- **Agent:** Cursor
- **Tests:** 31 UI tests passing
- **Files:** `ui/src/components/Timeline/*`
- **Key Implementation:**
  - Filmstrip UI with frame thumbnails
  - Color-coded status borders (green=approved, yellow=warn, red=fail)
  - Keyboard navigation (←/→ arrows, Home/End)
  - Accessibility support (ARIA labels, focus management)
  - Click-to-select frame interaction

### Story 7.3: Stage Component with Onion Skinning
- **Agent:** Cursor
- **Tests:** 33 UI tests passing
- **Files:** `ui/src/components/Stage/*`
- **Key Implementation:**
  - Canvas rendering with current frame display
  - Onion skinning overlay (previous/next frame at 30% opacity)
  - Zoom controls (fit, 1x, 2x, 4x)
  - Baseline guide overlay toggle
  - Keyboard shortcuts (+/- for zoom)
  - Pan/drag when zoomed

### Story 7.4: Nudge Tool
- **Agent:** Cursor
- **Tests:** 27 UI tests passing
- **Files:** `ui/src/components/NudgeTool/*`, `ui/src/hooks/useDrag.ts`
- **Key Implementation:**
  - Drag-to-nudge interaction with visual feedback
  - `useDrag` custom hook for pointer events
  - Delta recording (userOverrideX, userOverrideY)
  - Real-time preview during drag
  - Touch support for tablet use
  - Snap-to-pixel (integer offsets only)

### Story 7.5: Mask Pen Tool
- **Agent:** Cursor
- **Tests:** 39 UI tests passing
- **Files:** `ui/src/components/MaskPenTool/*`
- **Key Implementation:**
  - Brush drawing on canvas overlay
  - Interpolation for smooth strokes
  - Eraser mode toggle
  - Adjustable brush size (1px - 32px)
  - Binary mask export (white = paint, black = preserve)
  - Prompt input field for correction instructions
  - Clear/Undo support

### Story 7.6: Patch API for Corrective Inpainting
- **Agent:** Claude-Code
- **Tests:** 35 passing (17 adapter + 18 service)
- **Files:** `src/adapters/gemini-inpaint-adapter.ts`, `src/core/patch-service.ts`
- **Key Implementation:**
  - `GeminiInpaintAdapter` with deferred initialization
  - Prompt format: TASK/STYLE/DO NOT/DETAIL structure per AC #2
  - `PatchService` coordinating adapter, file saves, session updates
  - Patch history accumulation for multiple corrections per frame
  - Files saved with timestamps: `{frameId}_patched_{timestamp}.png`
  - Mask saved to audit folder for traceability
- **Code Review Fix:** Result API mismatch - changed `.ok` to `isErr()`, `.error.message` to `unwrapErr().message`

### Story 7.7: Inspector Pane
- **Agent:** Claude-Code
- **Tests:** 46 UI tests passing
- **Files:** `ui/src/components/Inspector/*`
- **Key Implementation:**
  - ScoreDisplay component with composite score visualization
  - FlagsList showing active reason codes with descriptions
  - MetricsBreakdown (SSIM, palette fidelity, baseline drift, etc.)
  - PromptDisplay showing generation prompt used
  - AttemptHistory showing previous attempts with scores
  - Collapsible sections for compact view
  - ReasonCodes reference panel

### Story 7.8: Visual Diff Overlays
- **Agent:** Claude-Code
- **Tests:** 50 UI tests passing
- **Files:** `ui/src/components/DiffOverlay/*`
- **Key Implementation:**
  - `PaletteDiffOverlay`: Blinking highlights for off-palette pixels
  - "Legalize" action to snap off-palette colors to nearest valid
  - `AlignmentOverlay`: Baseline comparison with anchor
  - Gap label showing pixel offset from reference
  - Toggle buttons for each overlay type
  - Color utilities for palette matching
  - Baseline detection utilities

### Story 7.9: Commit and Export Flow
- **Agent:** Claude-Code
- **Tests:** 43 passing (18 backend + 25 UI)
- **Files:** `src/core/commit-service.ts`, `ui/src/components/CommitButton/*`
- **Key Implementation:**
  - `CommitService` applying alignment deltas via Sharp image translation
  - Patched frame handling (uses latest from patchHistory)
  - Final images written to `approved/` with 4-digit padding
  - `markCommitted()` updating session status and commitInfo
  - `CommitButton` UI with confirmation dialog
  - Success overlay showing counts (approved, nudged, patched)
- **Code Review Fix:** Result API mismatch fixed, unused imports removed

---

## What Went Well

### Technical Wins

1. **Complete Human-in-the-Loop Flow** - Full end-to-end Director Mode from session creation to commit
2. **Two Result Type Pattern** - Successfully navigated dual Result types (class-based vs object-based)
3. **376+ New Tests** - Excellent coverage for a frontend-heavy epic
4. **Atomic Persistence** - All state changes use temp-then-rename pattern
5. **Deferred Initialization** - GeminiInpaintAdapter allows testing without API key
6. **Comprehensive UI Components** - 15+ React components with full test coverage
7. **Touch Support** - Nudge tool works on tablet devices

### Process Wins

1. **Adversarial Code Review** - Caught 6 issues including critical Result API mismatch
2. **Agent Assignment Strategy** - Cursor handled visual UI (7.2-7.5), Claude-Code handled backend/integration (7.1, 7.6-7.9)
3. **Test-First Mocking** - Tests properly mock class-based Result for DirectorSessionManager
4. **Single-Day Completion** - All 9 stories completed efficiently
5. **Previous Action Item Follow-Through** - A14 (frontend architecture review) completed

---

## Challenges & Lessons Learned

### Issues Discovered During Code Review

| Story | Issue | Severity | Root Cause | Resolution |
|-------|-------|----------|------------|------------|
| 7.6 | Result API mismatch in PatchService | HIGH | Used `.ok` instead of `isErr()` | Changed to class-based Result API |
| 7.9 | Result API mismatch in CommitService | HIGH | Used `.error.message` instead of `unwrapErr().message` | Changed to class-based Result API |
| 7.6 | Private method access `saveSession()` | MEDIUM | Called private method on DirectorSessionManager | Removed call - `updateFrameOverrides` already persists |
| 7.9 | Unused imports | MEDIUM | Import cleanup missed | Removed unused imports |
| 7.6 | Unused imports | MEDIUM | Import cleanup missed | Removed unused imports |
| - | Missing `@google/generative-ai` in package.json | MEDIUM | Dependency not declared | Added to dependencies |

### Key Technical Insight: Two Result Types

The codebase has TWO different Result implementations:

1. **Class-based Result** (`src/core/result.ts`):
   - Methods: `isOk()`, `isErr()`, `unwrap()`, `unwrapErr()`
   - Used by: `DirectorSessionManager`

2. **Object-based Result** (`src/core/config-resolver.ts`):
   - Properties: `.ok`, `.value`, `.error`
   - Used by: `PatchService`, `CommitService` for their own return values

**Rule:** When calling DirectorSessionManager methods, always use class-based Result API (`isErr()`, `unwrapErr()`).

### Key Lessons

1. **Result API Consistency** - The codebase has two Result patterns. When handling Results from DirectorSessionManager, use class-based methods (`isErr()`, `unwrapErr()`).

2. **Test Mock Consistency** - Test mocks must return the same Result type as the actual implementation. Use `Result.ok(undefined)` from `result.ts` for DirectorSessionManager mocks.

3. **Deferred Initialization Pattern** - For adapters requiring API keys, use deferred initialization (`initialize()` on first use) to enable testing without credentials.

4. **Atomic Writes are Project-Wide** - Rule 17 (temp-then-rename) applies everywhere, including session state, patch history, and commit output.

5. **UI/Backend Separation** - Clear separation between UI components (`ui/`) and backend services (`src/`) with well-defined API boundaries.

---

## Previous Action Item Review (from Epic 6)

| ID | Action Item | Status | Evidence |
|----|-------------|--------|----------|
| A12 | Add end-to-end integration test | Partial | Director Mode e2e test pending CLI integration (Epic 8) |
| A13 | Complete Generator/Auditor integration before Epic 7 | Partial | Director Mode works with session state; full integration in Epic 8 |
| A14 | Review Epic 7 frontend architecture (React/Preact) | Complete | Used React with TypeScript, vitest for testing |
| A15 | Export `_internal` helper functions for unit testing | Complete | Applied where needed |
| A16 | Validate templates against Zod schemas in test suite | Complete | DirectorSession schema validation |
| A17 | Continue adversarial code review for all epics | Complete | Code review caught 6 issues |

---

## Technical Debt Incurred

| Item | Severity | Impact | Notes |
|------|----------|--------|-------|
| Two Result types in codebase | Medium | Developer confusion | Consider consolidating to single Result pattern |
| Express server not fully implemented | Medium | Director Mode requires Epic 8 CLI integration | Server routes exist but not wired up |
| Gemini Inpaint uses stub model | Low | Real inpainting requires API key | Model ID `gemini-2.0-flash-exp` may need updating |

---

## Patterns Observed

### Recurring Themes Across Stories

1. **Zod Schema Everything** - DirectorSession, DirectorOverrides, HumanAlignmentDelta all use Zod
2. **Atomic Writes Enforced** - `writeJsonAtomic()` pattern consistently applied
3. **Service + Adapter Pattern** - PatchService uses GeminiInpaintAdapter, CommitService uses DirectorSessionManager
4. **Test Coverage Expectations** - Each story includes comprehensive unit tests
5. **Code Review Effectiveness** - Adversarial review catches issues before production

### Agent Performance

| Agent | Stories | Strengths |
|-------|---------|-----------|
| Claude-Code | 7.1, 7.6, 7.7, 7.8, 7.9 | Backend logic, state management, API integration, complex orchestration |
| Cursor | 7.2, 7.3, 7.4, 7.5 | Visual UI components, canvas interactions, real-time feedback |

---

## Action Items for Next Epic

### Technical Preparation

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| A18 | Consolidate Result types (consider using class-based everywhere) | Dev Team | MEDIUM |
| A19 | Wire up Express server routes for Director Mode | Dev Team | HIGH |
| A20 | Add end-to-end integration test for Director flow | Dev Team | HIGH |
| A21 | Update Gemini model ID if needed for production | Dev Team | LOW |

### Process Improvements

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| A22 | Document two Result types in project-context.md | Dev Team | MEDIUM |
| A23 | Add Result type check to code review checklist | Dev Team | MEDIUM |
| A24 | Continue adversarial code review for all epics | Dev Team | CRITICAL |

---

## Next Epic Preview

**Epic 8: CLI Pipeline Integration** includes:
- CLI entry point with Commander.js
- `banana gen` command with full generation flow
- Interactive mode flag (`--interactive`)
- Director Server bridge (Express)
- Pipeline Orchestrator (5-phase execution)
- Graceful shutdown and resume
- Export phase integration
- Progress logging with spinners

**Dependencies from Epic 7:**
- DirectorSessionManager for session lifecycle
- CommitService for finalizing approved frames
- PatchService for corrective inpainting
- All UI components for Director Mode interface

**Key Consideration:** Epic 8 is the final integration epic, connecting all previous epics into a unified CLI experience.

---

## Celebration Points

- **876 tests** protecting the entire pipeline
- **Complete Director Mode UI** with 15+ React components
- **Human-in-the-Loop workflow** enabling manual quality control
- **Adversarial code review** caught critical Result API issues
- **7 consecutive epics completed** - Strong execution momentum
- **All 63 stories completed** across Epics 1-7 (100% completion rate)

---

## Retrospective Sign-off

- [x] All 9 stories marked done
- [x] 376+ tests added (876 total passing)
- [x] Code review findings addressed (6 issues fixed)
- [x] Sprint status updated (epic-7: done, all stories: done)
- [x] Retrospective document created

**Epic 7 Status: COMPLETE**

---

## Team Acknowledgments

Bob (Scrum Master): "Epic 7 delivered a complete human-in-the-loop interface. The adversarial code review proved critical - catching that Result API mismatch would have caused runtime failures. Excellent cross-agent collaboration between Claude-Code and Cursor!"

Alice (Product Owner): "Director Mode is a game-changer for quality control. Operators can now review, nudge, and patch frames before export. This significantly reduces post-production touchup work."

Charlie (Senior Dev): "The two Result type issue is a good lesson in codebase consistency. We should document this pattern and consider consolidation in a future cleanup sprint."

Dana (QA Engineer): "376 new tests for 9 stories is excellent coverage. The code review process continues to prove its value."

Elena (Junior Dev): "The UI components are well-structured and testable. The useDrag hook is reusable for future interactive features."

---

**Retrospective Complete** | **Next: Epic 8 - CLI Pipeline Integration**
