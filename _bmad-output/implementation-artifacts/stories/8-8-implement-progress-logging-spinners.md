# Story 8.8: Implement Progress Logging and Spinners

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** clear visual feedback during long-running operations,
**So that** I know the pipeline is working and can estimate completion.

---

## Acceptance Criteria

### Visual Feedback

1. **Ora spinners** - Uses ora spinners for active operations
2. **Status icons** - Shows ✔ (success), ⚠ (warning), ✖ (failure) icons
3. **Frame messages** - Displays generation status with scores
4. **Completion summary** - Shows summary with statistics
5. **Log file** - All logs written to `runs/{run_id}/logs/pipeline.log`
6. **Verbose mode** - `-v` flag shows additional debug info

---

## Tasks / Subtasks

- [ ] **Task 1: Create ProgressReporter class** (AC: #1-4)
  - [ ] 1.1: Create `src/core/progress-reporter.ts`
  - [ ] 1.2: Wrap ora for consistent styling
  - [ ] 1.3: Add message formatting methods
  - [ ] 1.4: Support different output modes

- [ ] **Task 2: Implement spinner management** (AC: #1)
  - [ ] 2.1: Create start/stop spinner methods
  - [ ] 2.2: Handle concurrent operations
  - [ ] 2.3: Update spinner text dynamically
  - [ ] 2.4: Support nested spinners

- [ ] **Task 3: Implement status icons** (AC: #2)
  - [ ] 3.1: Define icon constants
  - [ ] 3.2: Use chalk for coloring
  - [ ] 3.3: Create succeed/warn/fail methods
  - [ ] 3.4: Handle CI environments (no colors)

- [ ] **Task 4: Implement frame messages** (AC: #3)
  - [ ] 4.1: Format generation messages
  - [ ] 4.2: Include frame index and total
  - [ ] 4.3: Include audit score
  - [ ] 4.4: Handle retries and failures

- [ ] **Task 5: Implement summary output** (AC: #4)
  - [ ] 5.1: Calculate statistics
  - [ ] 5.2: Format summary box
  - [ ] 5.3: Include timing information
  - [ ] 5.4: Show rates (retry, reject)

- [ ] **Task 6: Implement file logging** (AC: #5)
  - [ ] 6.1: Create log file on init
  - [ ] 6.2: Write all messages to file
  - [ ] 6.3: Include timestamps
  - [ ] 6.4: Use JSON format for structured logs

- [ ] **Task 7: Implement verbose mode** (AC: #6)
  - [ ] 7.1: Check verbose flag
  - [ ] 7.2: Show debug messages in verbose mode
  - [ ] 7.3: Hide debug in normal mode
  - [ ] 7.4: Always write debug to file

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test spinner lifecycle
  - [ ] 8.2: Test message formatting
  - [ ] 8.3: Test log file creation
  - [ ] 8.4: Test verbose mode filtering

---

## Dev Notes

### ProgressReporter Class

```typescript
// src/core/progress-reporter.ts
import ora, { Ora } from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

interface ProgressReporterOptions {
  runPath: string;
  verbose?: boolean;
}

export class ProgressReporter {
  private spinner: Ora | null = null;
  private logFile: string;
  private verbose: boolean;
  private startTime: Date;

  constructor(options: ProgressReporterOptions) {
    this.logFile = path.join(options.runPath, 'logs', 'pipeline.log');
    this.verbose = options.verbose ?? false;
    this.startTime = new Date();

    // Ensure log directory exists
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  // === Spinner Methods ===

  start(message: string): void {
    this.spinner = ora({
      text: message,
      color: 'cyan'
    }).start();
    this.log('START', message);
  }

  update(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
    this.log('UPDATE', message);
  }

  succeed(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    } else {
      console.log(chalk.green('✔'), message);
    }
    this.log('SUCCESS', message);
  }

  warn(message: string): void {
    if (this.spinner) {
      this.spinner.warn(chalk.yellow(message));
      this.spinner = null;
    } else {
      console.log(chalk.yellow('⚠'), message);
    }
    this.log('WARN', message);
  }

  fail(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    } else {
      console.log(chalk.red('✖'), message);
    }
    this.log('FAIL', message);
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
    this.log('INFO', message);
  }

  // === Frame Progress ===

  frameGenerating(frameIndex: number, totalFrames: number): void {
    this.start(`Generating frame ${frameIndex}/${totalFrames}...`);
  }

  frameGenerated(
    frameIndex: number,
    totalFrames: number,
    score: number
  ): void {
    this.succeed(chalk.green(
      `[GEN] Frame ${frameIndex}/${totalFrames} Generated (Audit Score: ${score.toFixed(2)})`
    ));
  }

  frameAutoAligned(
    frameIndex: number,
    totalFrames: number,
    driftPixels: number
  ): void {
    this.warn(chalk.yellow(
      `[WARN] Frame ${frameIndex}/${totalFrames} Auto-Aligned (Drift: ${driftPixels > 0 ? '+' : ''}${driftPixels}px)`
    ));
  }

  frameRejected(
    frameIndex: number,
    totalFrames: number,
    reason: string
  ): void {
    this.fail(chalk.red(
      `[FAIL] Frame ${frameIndex}/${totalFrames} Rejected (${reason})`
    ));
  }

  frameRetrying(
    frameIndex: number,
    totalFrames: number,
    attempt: number
  ): void {
    this.update(`Generating frame ${frameIndex}/${totalFrames}... (retry ${attempt})`);
    this.log('RETRY', `Frame ${frameIndex} attempt ${attempt}`);
  }

  // === Summary ===

  summary(stats: {
    approved: number;
    rejected: number;
    total: number;
    retryRate: number;
    rejectRate: number;
    duration: number;
  }): void {
    const duration = this.formatDuration(stats.duration);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.bold('Batch Generation Complete'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✔ Approved: ${stats.approved}/${stats.total}`);
    if (stats.rejected > 0) {
      console.log(chalk.red(`✖ Rejected: ${stats.rejected}`));
    }
    console.log(`📊 Retry Rate: ${(stats.retryRate * 100).toFixed(1)}%`);
    console.log(`📊 Reject Rate: ${(stats.rejectRate * 100).toFixed(1)}%`);
    console.log(`⏱  Duration: ${duration}`);
    console.log('═══════════════════════════════════════════════════════');

    this.log('SUMMARY', JSON.stringify(stats));
  }

  // === Debug ===

  debug(message: string, data?: object): void {
    const fullMessage = data
      ? `${message}: ${JSON.stringify(data)}`
      : message;

    // Always log to file
    this.log('DEBUG', fullMessage);

    // Only show in console if verbose
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${fullMessage}`));
    }
  }

  // === Private ===

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({
      timestamp,
      level,
      message
    }) + '\n';

    fs.appendFileSync(this.logFile, entry);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }
}
```

### Usage Example

```typescript
const reporter = new ProgressReporter({
  runPath: 'runs/20260118_blaze_idle_abc123',
  verbose: options.verbose
});

// Start generation
reporter.start('Initializing run...');
await initialize();
reporter.succeed('Run initialized');

// Generate frames
for (let i = 0; i < frameCount; i++) {
  reporter.frameGenerating(i, frameCount);

  const result = await generateFrame(i);

  if (result.status === 'approved') {
    if (result.autoAligned) {
      reporter.frameAutoAligned(i, frameCount, result.driftPixels);
    } else {
      reporter.frameGenerated(i, frameCount, result.score);
    }
  } else if (result.status === 'retrying') {
    reporter.frameRetrying(i, frameCount, result.attempt);
    i--; // Re-process
  } else {
    reporter.frameRejected(i, frameCount, result.reason);
  }
}

// Summary
reporter.summary({
  approved: 7,
  rejected: 1,
  total: 8,
  retryRate: 0.125,
  rejectRate: 0.125,
  duration: 135000
});
```

### Console Output Examples

**Normal mode:**
```
✔ Manifest validated
✔ Run initialized (20260118_blaze_idle_abc123)
✔ Anchor analyzed (baseline: 120px)
⠋ Generating frame 0/8...
✔ [GEN] Frame 0/8 Generated (Audit Score: 0.95)
⠋ Generating frame 1/8...
⚠ [WARN] Frame 1/8 Auto-Aligned (Drift: +4px)
⠋ Generating frame 2/8...
✔ [GEN] Frame 2/8 Generated (Audit Score: 0.91)
⠋ Generating frame 3/8... (retry 2)
✖ [FAIL] Frame 3/8 Rejected (SF01_IDENTITY_DRIFT)

═══════════════════════════════════════════════════════
Batch Generation Complete
═══════════════════════════════════════════════════════
✔ Approved: 7/8
✖ Rejected: 1
📊 Retry Rate: 12.5%
📊 Reject Rate: 12.5%
⏱  Duration: 2m 15s
═══════════════════════════════════════════════════════
```

**Verbose mode (-v):**
```
✔ Manifest validated
[DEBUG] Manifest loaded: {"character":"BLAZE","move":"idle_standard","version":"v1"}
✔ Run initialized (20260118_blaze_idle_abc123)
[DEBUG] Run path: runs/20260118_blaze_idle_abc123
[DEBUG] Created folders: approved, rejected, candidates, audit, logs, export, validation
✔ Anchor analyzed (baseline: 120px)
[DEBUG] Anchor analysis: {"baselineY":120,"rootX":64,"width":128,"height":128}
⠋ Generating frame 0/8...
[DEBUG] Generator params: {"seed":2847561,"temperature":1.0,"topP":0.95}
[DEBUG] API call duration: 2340ms
[DEBUG] Candidate saved: candidates/frame_0000_attempt_01.png
[DEBUG] Audit result: {"ssim":0.95,"palette":0.92,"baseline":0}
✔ [GEN] Frame 0/8 Generated (Audit Score: 0.95)
```

### Log File Format

```json
{"timestamp":"2026-01-18T14:00:00.000Z","level":"START","message":"Initializing run..."}
{"timestamp":"2026-01-18T14:00:01.500Z","level":"SUCCESS","message":"Run initialized"}
{"timestamp":"2026-01-18T14:00:02.000Z","level":"DEBUG","message":"Anchor analysis: {\"baselineY\":120}"}
{"timestamp":"2026-01-18T14:00:03.000Z","level":"START","message":"Generating frame 0/8..."}
{"timestamp":"2026-01-18T14:00:05.340Z","level":"DEBUG","message":"API call duration: 2340ms"}
{"timestamp":"2026-01-18T14:00:05.500Z","level":"SUCCESS","message":"[GEN] Frame 0/8 Generated (Audit Score: 0.95)"}
```

### Icon Constants

```typescript
const ICONS = {
  success: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  fail: chalk.red('✖'),
  info: chalk.blue('ℹ'),
  debug: chalk.gray('🔍'),
  spinner: '⠋'
};

const PREFIXES = {
  GEN: chalk.cyan('[GEN]'),
  WARN: chalk.yellow('[WARN]'),
  FAIL: chalk.red('[FAIL]'),
  DEBUG: chalk.gray('[DEBUG]')
};
```

### CI Environment Detection

```typescript
const isCI = process.env.CI || process.env.GITHUB_ACTIONS;

if (isCI) {
  // Disable colors and spinners
  chalk.level = 0;
  ora.enabled = false;
}
```

### Project Structure Notes

- New: `src/core/progress-reporter.ts`
- Dependencies: ora, chalk
- Used by: gen command, export service, all pipeline operations
- Tests: `test/core/progress-reporter.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.8]
- [Source: ora documentation]
- [Source: chalk documentation]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Console output formatting with established libraries (ora, chalk). Well-defined message patterns. Straightforward file logging.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
