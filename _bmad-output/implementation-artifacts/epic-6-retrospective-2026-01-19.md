# Epic 6 Retrospective: Pipeline Visibility & Documentation

**Date:** 2026-01-19
**Epic:** 6 - Pipeline Visibility & Documentation
**Status:** Complete ✅
**Facilitator:** Bob (Scrum Master)
**Project Lead:** Sean

---

## Executive Summary

Epic 6 delivered comprehensive operator tooling for the sprite animation pipeline. This epic focused on user experience and observability - providing CLI commands for inspection, metrics export, documentation, and first-run verification. All 8 stories were completed with 210 new tests added, bringing the project total to 824 passing tests. A code review identified and fixed 1 HIGH and 6 MEDIUM priority issues before completion.

---

## Epic Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 8/8 (100%) |
| Total Tests Added | 210 (project total: 824) |
| Primary Agent | Claude Opus 4.5 (5 stories) |
| Secondary Agent | Codex-CLI (2 stories), Claude-Code (1 story) |
| Key Files Created | 16+ new source files |
| Documentation | 700+ line operator guide |
| CLI Commands Added | 6 (`inspect`, `guide`, `new-manifest`, `demo`, `clean`, CSV export) |
| Completion Date | 2026-01-19 |

---

## Story-by-Story Analysis

### Story 6.1: Pipeline Inspect Command
- **Agent:** Claude-Code
- **Tests:** 16 passing
- **Files:** `src/commands/inspect.ts`, `test/commands/inspect.test.ts`
- **Key Implementation:**
  - `banana inspect <run_id>` command with summary display
  - `--frame <index>` flag for specific frame metrics
  - `--diagnostic` flag for full diagnostic report
  - `--json` flag for programmatic output
  - `--csv` flag for metrics export
  - Tree-style artifact listing (├──/└──)
  - Chalk-based terminal formatting
- **Code Review Fix:** Added `_internal` export for testability, added command integration tests

### Story 6.2: Per-Frame Audit Metrics
- **Agent:** Claude-Code
- **Tests:** 19 passing
- **Files:** `src/domain/types/frame-metrics.ts`, `src/core/metrics/frame-metrics-writer.ts`, `src/core/metrics/csv-exporter.ts`
- **Key Implementation:**
  - `FrameMetrics` Zod schema with composite scoring breakdown
  - `writeFrameMetrics()` / `readFrameMetrics()` / `readAllFrameMetrics()`
  - `aggregateFrameMetrics()` for auditor integration
  - `exportMetricsToCSVString()` for CSV export
  - 4-digit zero-padded frame naming (frame_0003_metrics.json)
- **Code Review Fix:** Added `safeDiv()` helper for division by zero protection

### Story 6.3: Run Summary Report
- **Agent:** Codex-CLI
- **Tests:** 32 passing
- **Files:** `src/domain/types/run-summary.ts`, `src/core/reporting/summary-generator.ts`
- **Key Implementation:**
  - `RunSummary` Zod schema with comprehensive statistics
  - Frame statistics (total, attempted, approved, failed, rejected, pending)
  - Rate calculations (completion, retry, reject, success)
  - Attempt statistics (total, average, min, max per frame)
  - Top 3 failure code aggregation with percentages
  - Timing breakdown (generation, audit, export, other)
  - Atomic write pattern via `writeJsonAtomic()`

### Story 6.4: Artifact Folder Organization
- **Agent:** Codex-CLI
- **Tests:** 26 passing
- **Files:** `src/domain/constants/run-folders.ts`, `src/core/run-folder-manager.ts`, `src/commands/clean.ts`
- **Key Implementation:**
  - `RUN_FOLDERS` constant with all folder names
  - `RUN_FILES` constant with all standard file paths
  - `saveRejectedFrame()` with metadata JSON
  - `writeRunReadme()` with comprehensive documentation
  - `cleanupOldRuns()` with maxAge, preserveApproved, dryRun options
  - `banana clean` command (dry-run by default)

### Story 6.5: Manifest Template Generator
- **Agent:** Claude Opus 4.5
- **Tests:** 27 passing
- **Files:** `src/commands/new-manifest.ts`, `assets/templates/manifest.yaml.template`
- **Key Implementation:**
  - `banana new-manifest --character <name> --move <name>` command
  - 3 presets: champion (128px, 8 frames), boss (256px, 12 frames), npc (128px, 4 frames)
  - Template with comprehensive inline comments
  - Name validation (alphanumeric + underscore/hyphen, max 32 chars)
  - Generated manifests pass Zod schema validation
  - `--force` flag for overwrite protection
- **Issue Found & Fixed:** Initial template didn't match Zod schema structure (fixed during implementation)

### Story 6.6: Operator Guide Documentation
- **Agent:** Claude Opus 4.5
- **Tests:** 40 passing
- **Files:** `docs/operator-guide.md`, `src/commands/guide.ts`
- **Key Implementation:**
  - 700+ line comprehensive operator guide
  - `banana guide` command with terminal formatting
  - `--section <name>` for specific section display
  - `--list` to show all available sections
  - `--output <path>` to save to file
  - `--raw` for unformatted markdown output
  - Quick start guide (NFR16: 45-minute ramp-up)
  - Quality gate explanations (all HF/SF/DEP codes)
  - ASCII art retry ladder visualization
  - 10+ FAQ entries
- **Issue Found & Fixed:** Section extraction required switching from regex to line-by-line parsing

### Story 6.7: Model Version Warning System
- **Agent:** Claude Opus 4.5
- **Tests:** 26 passing
- **Files:** `src/core/model-version-tracker.ts`, `test/core/model-version-tracker.test.ts`
- **Key Implementation:**
  - Per-character/move model version tracking
  - `ModelHistory` stored in `.sprite-pipeline/model-history.json`
  - Version change detection (model_switch, major, minor, patch)
  - Deprecation detection for known deprecated models
  - `ModelWarning` interface for run summary integration
  - Console warning functions with chalk formatting
- **Code Review Fix:** Changed `fs.writeFile` to `writeJsonAtomic()` per project-context rule 17

### Story 6.8: One-Command First Run
- **Agent:** Claude Opus 4.5
- **Tests:** 24 passing
- **Files:** `src/commands/demo.ts`, `assets/demo/*`
- **Key Implementation:**
  - `banana demo` command with prerequisite checks
  - Reusable `runDoctor()` function (refactored from doctor.ts)
  - Demo manifest with relaxed thresholds
  - Placeholder frame generation (stub mode - actual Gemini TBD)
  - `--frames <count>`, `--skip-validation`, `--verbose` options
  - Formatted output with next steps guidance
  - Demo assets: manifest.yaml, prompts/*, anchor.png

---

## What Went Well

### Technical Wins

1. **Comprehensive CLI Tooling** - 6 new commands provide full operator visibility into pipeline runs
2. **700+ Line Operator Guide** - Detailed documentation enables NFR16 (45-minute ramp-up)
3. **Structured Metrics Export** - JSON and CSV formats support both debugging and analytics
4. **Reusable Components** - `runDoctor()` refactor demonstrates good code reuse patterns
5. **Terminal Formatting System** - Markdown-to-terminal conversion for readable CLI output
6. **210 New Tests** - Excellent coverage for a documentation-heavy epic

### Process Wins

1. **Adversarial Code Review** - Caught 1 HIGH and 6 MEDIUM issues before marking epic complete
2. **Atomic Write Enforcement** - Code review caught non-atomic file write (rule 17 violation)
3. **Agent Assignment Accuracy** - Claude Opus 4.5 handled documentation-heavy stories well
4. **Single-Day Completion** - All 8 stories completed efficiently
5. **Previous Action Item Follow-Through** - A9 (TexturePacker docs), A10, A11 completed

---

## Challenges & Lessons Learned

### Issues Discovered During Code Review

| Story | Issue | Severity | Root Cause | Resolution |
|-------|-------|----------|------------|------------|
| 6.7 | Non-atomic file write in `saveModelHistory()` | HIGH | Used `fs.writeFile` instead of `writeJsonAtomic()` | Imported and used atomic write utility |
| 6.1 | Missing command integration tests | MEDIUM | Internal functions not exported | Added `_internal` export for testability |
| 6.2 | Division by zero in `aggregateFrameMetrics()` | MEDIUM | Weight could be 0 | Added `safeDiv()` helper function |
| 6.1 | Missing command registration tests | MEDIUM | Test coverage gap | Added Command Registration test suite |
| 6.5 | Template/schema mismatch | MEDIUM | Template fields didn't match Zod schema | Updated template to use correct structure |
| 6.6 | Section extraction regex failure | MEDIUM | Complex markdown parsing | Switched to line-by-line parsing |

### Key Lessons

1. **Atomic Writes are Non-Negotiable** - Rule 17 (temp-then-rename) caught in code review. All file writes should use `writeJsonAtomic()` or equivalent.

2. **Export Internal Functions for Testing** - `_internal` export pattern enables unit testing of helper functions without polluting public API.

3. **Division Guards in Aggregations** - When calculating weighted scores, always guard against zero denominators.

4. **Markdown Parsing is Tricky** - Regex-based section extraction fails on edge cases; line-by-line parsing is more reliable.

5. **Template Validation at Build Time** - Templates should be validated against schemas during development, not just at runtime.

---

## Previous Action Item Review (from Epic 5)

| ID | Action Item | Status | Evidence |
|----|-------------|--------|----------|
| A7 | Connect export pipeline to orchestrator COMPLETED state | ⏳ **Partial** | Epic 6 focused on visibility; full integration in Epic 8 |
| A8 | Add integration test: manifest → generate (mocked) → export → validate | ❌ **Not Addressed** | Requires end-to-end test framework |
| A9 | Document TexturePacker locked flags in operator guide | ✅ **Complete** | Operator guide includes TexturePacker section |
| A10 | Check external library changelogs before upgrades | ✅ **Complete** | Applied during Epic 6 (no major upgrades) |
| A11 | Run `npm run build` before marking story "done" | ✅ **Complete** | All stories built successfully |

---

## Technical Debt Incurred

| Item | Severity | Impact | Notes |
|------|----------|--------|-------|
| Demo uses stub generation | Low | Demo doesn't test actual Gemini API | Placeholder frames until API integration |
| End-to-end integration test missing | Medium | Components tested separately | A8 carried forward |
| Generator/Auditor not fully integrated | Medium | Orchestrator calls simulated | Full integration in Epic 8 |

---

## Patterns Observed

### Recurring Themes Across Stories

1. **Zod Schema Everything** - All structured data (FrameMetrics, RunSummary, ModelHistory) uses Zod
2. **Atomic Writes Enforced** - `writeJsonAtomic()` pattern consistently applied
3. **CLI-First Design** - Every capability gets a CLI entry point
4. **Test Coverage Expectations** - Stories not considered "done" without comprehensive tests
5. **Code Review Effectiveness** - Adversarial review catches issues before production

### Agent Performance

| Agent | Stories | Rationale |
|-------|---------|-----------|
| Claude Opus 4.5 | 6.5, 6.6, 6.7, 6.8 | Documentation quality, complex CLI formatting, code review fixes |
| Claude-Code | 6.1, 6.2 | Inspect command, metrics schema and aggregation |
| Codex-CLI | 6.3, 6.4 | Summary statistics, folder organization (well-defined specs) |

---

## Action Items for Next Epic

### Technical Preparation

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| A12 | Add end-to-end integration test (carried from A8) | Dev Team | HIGH |
| A13 | Complete Generator/Auditor integration before Epic 7 Director Mode | Dev Team | HIGH |
| A14 | Review Epic 7 frontend architecture (React/Preact) before starting | Dev Team | MEDIUM |

### Process Improvements

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| A15 | Always export `_internal` helper functions for unit testing | Dev Team | MEDIUM |
| A16 | Validate templates against Zod schemas in test suite | Dev Team | LOW |
| A17 | Continue adversarial code review for all epics | Dev Team | CRITICAL |

---

## Next Epic Preview

**Epic 7: Director Mode (Human-in-the-Loop Interface)** includes:
- Session state management for frame review workflow
- Timeline component with filmstrip UI
- Stage component with onion skinning
- Nudge tool for frame adjustment
- Mask/pen tool for inpainting selection
- Patch API for Gemini inpaint endpoint
- Inspector pane for audit details
- Visual diff overlays
- Commit and export flow

**Dependencies from Epic 6:**
- `banana inspect` command for artifact inspection
- Per-frame audit metrics for inspector pane
- Run summary reports for session context
- Artifact folder organization (approved/rejected/candidates)
- Operator guide for troubleshooting reference

**Key Consideration:** Epic 7 is frontend-heavy (5/9 stories assigned to Cursor agent). Requires Express server bridge for CLI/UI communication.

---

## Celebration Points

- **824 tests** protecting the entire pipeline
- **6 new CLI commands** providing comprehensive operator tooling
- **700+ line operator guide** enabling self-service troubleshooting
- **NFR16 achieved** - 45-minute ramp-up now possible with demo + guide
- **6 consecutive epics completed** - Strong execution momentum
- **Code review process validated** - Caught HIGH priority issue before production

---

## Retrospective Sign-off

- [x] All 8 stories marked done
- [x] 210 tests added (824 total passing)
- [x] Code review findings addressed (1 HIGH, 6 MEDIUM fixed)
- [x] Sprint status updated
- [x] Retrospective document created

**Epic 6 Status: COMPLETE** ✅

---

## Team Acknowledgments

Bob (Scrum Master): "Epic 6 delivered exactly what operators need - visibility, documentation, and a smooth first-run experience. The code review process proved its value by catching that atomic write violation. Excellent teamwork!"

Alice (Product Owner): "The operator guide and demo command are game-changers for onboarding. NFR16 is officially achieved."

Charlie (Senior Dev): "210 tests for 8 stories is solid coverage. The `_internal` export pattern for testability is a good practice we should continue."

Dana (QA Engineer): "Code review caught 7 issues that would have been harder to fix later. Process is working well."

Elena (Junior Dev): "The new-manifest command with presets makes creating configurations much easier. Great UX."

---

**Retrospective Complete** | **Next: Epic 7 - Director Mode (Human-in-the-Loop Interface)**
