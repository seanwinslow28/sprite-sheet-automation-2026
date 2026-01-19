# Epic 4 Retrospective: Resilient Orchestration & Retry Ladder

**Date:** 2026-01-19
**Epic:** 4 - Resilient Orchestration & Retry Ladder
**Status:** Complete ✅
**Facilitator:** Bob (Scrum Master)

---

## Executive Summary

Epic 4 delivered the complete orchestration layer for the sprite generation pipeline, implementing an 8-state state machine with intelligent retry logic, stop conditions, diagnostic reporting, and idempotent run resumption. All 8 stories were completed successfully with comprehensive test coverage.

---

## Epic Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 8/8 (100%) |
| Total Tests | 108+ |
| Primary Agent | Claude-Code (5 stories) |
| Secondary Agent | Codex-CLI (3 stories) |
| Key Files Created | 16 new source files |
| Lines of Code | ~2,800 LOC |

---

## Story-by-Story Analysis

### Story 4.1: Frame-to-Frame Chaining
- **Agent:** Codex-CLI
- **Tests:** 17 passing
- **Files:** `src/core/frame-chain-resolver.ts` (172 lines)
- **Key Implementation:**
  - Frame reference selection with anchor fallback
  - Force re-anchor on drift recovery
  - Integration with retry ladder for automatic re-anchor decisions

### Story 4.2: Attempt Tracking
- **Agent:** Codex-CLI
- **Tests:** 24 passing
- **Files:** `src/core/attempt-tracker.ts`
- **Key Implementation:**
  - RunStateWithAttempts extended state interface
  - Attempt recording with prompt hash and strategy tracking
  - Circuit breaker with cost estimation (~$0.20 per 50 attempts)
  - Frame rejection and max attempts handling

### Story 4.3: Retry Ladder (Reason-to-Action Mapping)
- **Agent:** Claude-Code
- **Tests:** 29 passing
- **Files:** `src/core/retry-manager.ts`, `src/domain/retry-actions.ts`
- **Key Implementation:**
  - 8-level retry ladder with reason-to-action mapping
  - HF_IDENTITY_COLLAPSE detection (2+ consecutive re-anchors)
  - Oscillation detection for alternating pass/fail patterns
  - Deep Think Follow-Up Lock prevention

### Story 4.4: Stop Conditions & Run Halting
- **Agent:** Claude-Code
- **Tests:** 19 passing
- **Files:** `src/core/stop-condition-evaluator.ts`
- **Key Implementation:**
  - 4 stop condition types: retry_rate, reject_rate, consecutive_fails, circuit_breaker
  - Graceful halt with work preservation
  - Configurable thresholds via manifest

### Story 4.5: Run Status Reporting
- **Agent:** Codex-CLI
- **Files:** `src/core/status-reporter.ts` (378 lines), `src/domain/types/run-status.ts`
- **Key Implementation:**
  - Status calculation for all 4 run states
  - CLI formatting with progress bars and colors
  - Reason code mapping for all status types
  - Type guards for status detail identification

### Story 4.6: Diagnostic Report Generation
- **Agent:** Claude-Code
- **Files:** `src/core/diagnostic-generator.ts` (474 lines)
- **Key Implementation:**
  - Root cause analysis with pattern matching
  - Recovery action recommendations with priority
  - Secret sanitization for safe logging
  - Console formatting for human-readable output
- **Issue Found & Fixed:** SF01 count test failure due to codes being deduped per frame - fixed test data to use different frames

### Story 4.7: Idempotent Run Resumption
- **Agent:** Claude-Code
- **Files:** `src/core/run-detector.ts` (339 lines)
- **Key Implementation:**
  - Run detection based on manifest identity
  - Manifest hash calculation for change detection
  - Force flag for resuming despite changes
  - Approved frame verification for integrity
- **Issue Found & Fixed:** Manifest hash calculation bug (only sorted top-level keys) - fixed with recursive `sortObjectKeys()` function

### Story 4.8: Orchestrator State Machine
- **Agent:** Claude-Code
- **Files:** `src/core/orchestrator.ts` (846 lines), `src/domain/types/orchestrator-state.ts`
- **Key Implementation:**
  - 8-state state machine (INIT → GENERATING → AUDITING → RETRY_DECIDING → APPROVING → NEXT_FRAME → COMPLETED → STOPPED)
  - State transition validation with logging
  - Atomic state persistence after each transition
  - Dry run mode for testing
  - Abort handling with graceful shutdown
- **Issue Found & Fixed:** Error handling test failure (mkdir creates directories) - replaced with different test approach
- **Note:** Generator/Auditor calls use simulated results - actual integration pending

---

## What Went Well

### Technical Wins

1. **Comprehensive Test Coverage** - 108+ tests across 8 stories, all passing
2. **Clear State Machine Design** - The 8-state orchestrator provides clear visibility into pipeline state
3. **Intelligent Retry Logic** - The 8-level retry ladder with HF_IDENTITY_COLLAPSE detection prevents runaway costs
4. **Atomic State Persistence** - All work persisted atomically, no in-memory-only state (NFR10, NFR11)
5. **Diagnostic Capabilities** - Root cause analysis with actionable recovery recommendations

### Process Wins

1. **Agent Assignment Strategy** - Complex decision logic (4.3, 4.4, 4.6, 4.7, 4.8) assigned to Claude-Code; straightforward logic (4.1, 4.2, 4.5) assigned to Codex-CLI
2. **Code Review Effectiveness** - Adversarial code review caught 15 issues including the manifest hash bug
3. **Dev Notes Quality** - Story dev notes provided excellent implementation guidance

---

## Challenges & Lessons Learned

### Issues Discovered During Implementation

| Story | Issue | Root Cause | Resolution |
|-------|-------|------------|------------|
| 4.6 | SF01 count test failure | Codes deduped per frame | Fixed test data |
| 4.7 | Manifest hash inconsistent | Only sorted top-level keys | Recursive sortObjectKeys() |
| 4.8 | Error handling test failure | mkdir creates directories | Different test approach |

### Key Lessons

1. **Recursive Deep Operations** - When implementing hash/comparison functions, ensure they operate recursively on nested structures
2. **Test Data Design** - Test data must account for deduplication behavior in the code
3. **Mock Behavior** - Test mocks must accurately reflect real behavior (mkdir creates paths)

---

## Technical Debt Incurred

| Item | Severity | Impact | Notes |
|------|----------|--------|-------|
| Generator/Auditor integration pending | Medium | 4.8 uses simulated results | Actual integration needed in Epic 5 |
| No integration tests yet | Medium | Unit tests only | E2E testing deferred |

---

## Patterns Observed

### Recurring Themes Across Stories

1. **State Management Centrality** - Every story touched state.json in some way
2. **Reason Code Taxonomy** - Consistent use of HFxx/SFxx codes throughout
3. **Atomic Operations** - Temp-then-rename pattern used consistently
4. **Result Type** - `Result<T, Error>` pattern applied across all adapters

### Agent Performance

| Agent | Stories | Rationale |
|-------|---------|-----------|
| Claude-Code | 4.3, 4.4, 4.6, 4.7, 4.8 | Complex decision trees, state machine logic, pattern matching |
| Codex-CLI | 4.1, 4.2, 4.5 | Straightforward logic, clear input/output, no complex decisions |

---

## Action Items for Next Epic

### Technical Preparation

1. [ ] **Integrate real Generator adapter** - Replace simulated calls in orchestrator
2. [ ] **Integrate real Auditor pipeline** - Connect hard gates and soft metrics
3. [ ] **Add E2E tests** - Full pipeline run with test manifest

### Process Improvements

1. [ ] **Recursive operation review** - Check all comparison/hash functions for deep operation
2. [ ] **Test data validation** - Review test data for edge cases before implementation

---

## Next Epic Preview

**Epic 5: Pack & Export** (if defined) would build on:
- Orchestrator's COMPLETED state as trigger for export
- Approved frames in `runs/{run_id}/approved/`
- State metadata for atlas generation

**Dependencies from Epic 4:**
- Orchestrator must be fully integrated with real Generator/Auditor
- State.json structure finalized
- Approved frame paths consistent

---

## Team Acknowledgments

The implementation of Epic 4 demonstrated excellent execution of a complex state machine architecture. The retry ladder with collapse detection and the diagnostic report generation are particularly well-designed components that will provide significant value in production operation.

---

## Retrospective Sign-off

- [x] All 8 stories marked done
- [x] 108+ tests passing
- [x] Code review findings addressed
- [x] Sprint status updated
- [x] Retrospective document created

**Epic 4 Status: COMPLETE** ✅
