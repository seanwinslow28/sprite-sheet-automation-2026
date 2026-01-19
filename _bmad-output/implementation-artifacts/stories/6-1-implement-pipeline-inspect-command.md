# Story 6.1: Implement `pipeline inspect` Command

Status: review

---

## Story

**As an** operator,
**I want** to inspect run artifacts via CLI,
**So that** I can debug and review pipeline results without navigating folders manually.

---

## Acceptance Criteria

### Basic Inspection

1. **Run summary** - Displays run summary: status, frames completed, frames failed, retry rate
2. **Artifact listing** - Lists all artifacts in the run folder with sizes
3. **Recent logs** - Shows the last 5 log entries
4. **Frame metrics flag** - Can display specific frame audit metrics with `--frame <index>` flag
5. **Diagnostic flag** - Can show full diagnostic report with `--diagnostic` flag

---

## Tasks / Subtasks

- [x] **Task 1: Create inspect command** (AC: #1)
  - [x] 1.1: Create `src/commands/inspect.ts` (flat structure per project convention)
  - [x] 1.2: Accept run_id as positional argument
  - [x] 1.3: Load state.json from run folder
  - [x] 1.4: Display formatted summary

- [x] **Task 2: Implement run summary display** (AC: #1)
  - [x] 2.1: Show run status (in-progress, completed, stopped, failed)
  - [x] 2.2: Show frames completed count
  - [x] 2.3: Show frames failed count
  - [x] 2.4: Calculate and show retry rate

- [x] **Task 3: Implement artifact listing** (AC: #2)
  - [x] 3.1: Scan run folder for all files
  - [x] 3.2: Group by subfolder (approved/, candidates/, audit/, etc.)
  - [x] 3.3: Show file sizes in human-readable format
  - [x] 3.4: Show total size per folder

- [x] **Task 4: Implement recent log display** (AC: #3)
  - [x] 4.1: Read audit_log.jsonl
  - [x] 4.2: Parse last 5 entries
  - [x] 4.3: Format for console display
  - [x] 4.4: Include timestamps and event types

- [x] **Task 5: Implement --frame flag** (AC: #4)
  - [x] 5.1: Accept `--frame <index>` option
  - [x] 5.2: Load `audit/frame_{index}_metrics.json`
  - [x] 5.3: Display formatted metrics
  - [x] 5.4: Show attempt history for that frame

- [x] **Task 6: Implement --diagnostic flag** (AC: #5)
  - [x] 6.1: Accept `--diagnostic` option
  - [x] 6.2: Load `diagnostic.json` if exists
  - [x] 6.3: Display full diagnostic report
  - [x] 6.4: If no diagnostic, show message

- [x] **Task 7: Implement output formatting** (AC: all)
  - [x] 7.1: Use chalk for colors (green/red/yellow)
  - [x] 7.2: Use tree-style listing for files (├──/└──)
  - [x] 7.3: Format numbers with appropriate precision
  - [x] 7.4: Handle terminal width gracefully

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test summary display with mock run
  - [x] 8.2: Test artifact listing
  - [x] 8.3: Test --frame flag
  - [x] 8.4: Test --diagnostic flag
  - [x] 8.5: Test missing run_id error

---

## Dev Notes

### Command Signature

```bash
pipeline inspect <run_id> [options]

Options:
  --frame <index>   Show detailed metrics for specific frame
  --diagnostic      Show full diagnostic report (if available)
  --json            Output as JSON instead of formatted text
```

### Summary Display Format

```
📊 Run Inspection: abc123
═══════════════════════════════════════════════════════

Status:         ✅ completed
Started:        2026-01-18 10:30:00
Duration:       12m 45s

Frames:
  Completed:    7/8 (87.5%)
  Failed:       1/8 (12.5%)
  Retry Rate:   25.0%

Stop Condition: None (run completed normally)
═══════════════════════════════════════════════════════
```

### Artifact Listing Format

```
📁 Artifacts
═══════════════════════════════════════════════════════

approved/ (7 files, 892 KB)
  ├── frame_0000.png     128 KB
  ├── frame_0001.png     124 KB
  ├── frame_0002.png     126 KB
  └── ... (4 more)

candidates/ (15 files, 2.1 MB)
  └── (15 generation attempts)

audit/ (16 files, 48 KB)
  ├── frame_0_metrics.json
  ├── frame_1_metrics.json
  └── ...

export/ (2 files, 256 KB)
  ├── blaze_idle.png     248 KB
  └── blaze_idle.json    8 KB

Total: 40 files, 3.3 MB
═══════════════════════════════════════════════════════
```

### Recent Logs Format

```
📜 Recent Activity (last 5 events)
═══════════════════════════════════════════════════════

10:42:15  [GEN]  Frame 7 generated (attempt 1)
10:42:18  [AUD]  Frame 7 passed (score: 0.94)
10:42:19  [APP]  Frame 7 approved
10:42:20  [EXP]  Export started
10:42:25  [VAL]  Validation passed (3/3 tests)

═══════════════════════════════════════════════════════
```

### Frame Metrics Display (--frame 3)

```
📊 Frame 3 Metrics
═══════════════════════════════════════════════════════

Status:         ❌ failed
Attempts:       5

Composite Score: 0.58 (threshold: 0.70)

Breakdown:
  Identity:     0.45 ❌ (weight: 0.30)
  Stability:    0.72 ✅ (weight: 0.35)
  Palette:      0.68 ⚠️ (weight: 0.20)
  Style:        0.55 ❌ (weight: 0.15)

Reason Codes:   SF01_IDENTITY_DRIFT, SF02_PALETTE_DRIFT

Attempt History:
  #1  ❌  0.48  SF01, SF02      (default)
  #2  ❌  0.52  SF01            (identity_rescue)
  #3  ❌  0.55  SF01            (re_anchor)
  #4  ❌  0.58  SF01            (tighten_negative)
  #5  ❌  0.58  MAX_ATTEMPTS

═══════════════════════════════════════════════════════
```

### Implementation Structure

```typescript
interface InspectCommand {
  run_id: string;
  options: {
    frame?: number;
    diagnostic?: boolean;
    json?: boolean;
  };
}

async function inspectRun(cmd: InspectCommand): Promise<void> {
  const runPath = path.join('runs', cmd.run_id);

  if (!await fileExists(runPath)) {
    throw new Error(`Run not found: ${cmd.run_id}`);
  }

  const state = await loadRunState(cmd.run_id);

  if (cmd.options.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  if (cmd.options.frame !== undefined) {
    await displayFrameMetrics(cmd.run_id, cmd.options.frame);
    return;
  }

  if (cmd.options.diagnostic) {
    await displayDiagnostic(cmd.run_id);
    return;
  }

  // Default: show summary
  await displaySummary(state);
  await displayArtifacts(runPath);
  await displayRecentLogs(runPath);
}
```

### Project Structure Notes

- New: `src/commands/pipeline/inspect.ts`
- New: `src/utils/cli-formatter.ts`
- Tests: `test/commands/pipeline/inspect.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code** (changed from planned Codex-CLI)

**Rationale:** CLI command with flags (--frame, --diagnostic). Well-defined output formats. File reading and formatting logic. No complex decision trees.

### Debug Log References

- 2026-01-19: Implemented all 8 tasks in single session
- Build: `npm run build` - success
- Tests: 16/16 passing, full suite 619/619 passing

### Completion Notes List

- Created `src/commands/inspect.ts` with all AC features
- Reused existing `formatDiagnosticForConsole` from `diagnostic-generator.ts`
- Uses `loadState` from `state-manager.ts` for state loading
- Uses chalk for terminal colors (already in dependencies)
- Tree-style file listing (├──/└──) instead of cli-table for cleaner output
- Supports `--json` flag for programmatic output
- Note: Used flat command structure (`src/commands/inspect.ts`) per existing project convention, not nested `pipeline/` folder

### File List

**New Files:**
- `src/commands/inspect.ts` - Main inspect command implementation (450 lines)
- `test/commands/inspect.test.ts` - Test suite (16 tests)

**Modified Files:**
- `src/bin.ts` - Added registerInspectCommand, removed placeholder

### Change Log

- 2026-01-19: Story 6.1 implemented - `banana inspect <run_id>` command with all 5 AC features
