# Story 8.2: Implement `banana gen` Command

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to generate sprites with a single command,
**So that** I can kick off the full pipeline easily.

---

## Acceptance Criteria

### Generation Flow

1. **Manifest validation** - System validates the manifest
2. **Folder creation** - Creates run folder structure
3. **Anchor analysis** - Analyzes anchor image
4. **Frame generation** - Generates frames 0 through N
5. **Frame auditing** - Audits each frame
6. **Auto-alignment** - Auto-aligns drifted frames
7. **Frame storage** - Stores approved frames

### Progress Display

8. **Ora spinners** - Progress displayed with ora spinners
9. **Status messages** - Shows generation status, scores, and warnings
10. **Summary statistics** - Run completes with summary statistics
11. **Log output** - Logs written to `runs/{run_id}/logs/`

---

## Tasks / Subtasks

- [ ] **Task 1: Implement gen command handler** (AC: #1-7)
  - [ ] 1.1: Create `src/commands/gen.ts` with full implementation
  - [ ] 1.2: Parse command options (--move, --manifest, etc.)
  - [ ] 1.3: Initialize pipeline orchestrator
  - [ ] 1.4: Handle errors gracefully

- [ ] **Task 2: Implement manifest loading** (AC: #1)
  - [ ] 2.1: Locate manifest file (default or specified)
  - [ ] 2.2: Parse YAML to object
  - [ ] 2.3: Validate against Zod schema
  - [ ] 2.4: Report validation errors clearly

- [ ] **Task 3: Implement run initialization** (AC: #2, #3)
  - [ ] 3.1: Generate run ID
  - [ ] 3.2: Create run folder structure
  - [ ] 3.3: Analyze anchor image
  - [ ] 3.4: Create manifest.lock.json

- [ ] **Task 4: Implement generation loop** (AC: #4, #5, #6)
  - [ ] 4.1: Iterate through frame indices
  - [ ] 4.2: Generate each frame via adapter
  - [ ] 4.3: Audit generated frame
  - [ ] 4.4: Apply auto-alignment if needed
  - [ ] 4.5: Handle retry logic

- [ ] **Task 5: Implement progress spinners** (AC: #8, #9)
  - [ ] 5.1: Install and configure ora
  - [ ] 5.2: Show spinner for each operation
  - [ ] 5.3: Update text with current frame
  - [ ] 5.4: Show success/warning/error icons

- [ ] **Task 6: Implement status messages** (AC: #9)
  - [ ] 6.1: Format generation messages
  - [ ] 6.2: Include audit scores
  - [ ] 6.3: Show auto-align warnings
  - [ ] 6.4: Show failure reasons

- [ ] **Task 7: Implement summary output** (AC: #10, #11)
  - [ ] 7.1: Calculate summary statistics
  - [ ] 7.2: Format summary message
  - [ ] 7.3: Write summary to logs
  - [ ] 7.4: Display to console

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test successful generation flow
  - [ ] 8.2: Test manifest validation errors
  - [ ] 8.3: Test progress display
  - [ ] 8.4: Test log file creation

---

## Dev Notes

### Gen Command Implementation

```typescript
// src/commands/gen.ts
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { PipelineOrchestrator } from '../core/pipeline-orchestrator';
import { loadManifest } from '../core/manifest-loader';
import { logger } from '../core/logger';

interface GenOptions {
  move: string;
  manifest: string;
  interactive: boolean;
  frames?: number;
  skipValidation: boolean;
  allowValidationFail: boolean;
}

export function registerGenCommand(program: Command): void {
  program
    .command('gen')
    .description('Generate sprite sequence from manifest')
    .requiredOption('-m, --move <name>', 'Move name to generate')
    .option('--manifest <path>', 'Path to manifest file', 'manifest.yaml')
    .option('-i, --interactive', 'Launch Director Mode for review')
    .option('--frames <count>', 'Override frame count', parseInt)
    .option('--skip-validation', 'Skip Phaser validation')
    .option('--allow-validation-fail', 'Export despite validation failures')
    .action(async (options: GenOptions) => {
      await executeGen(options);
    });
}

async function executeGen(options: GenOptions): Promise<void> {
  const spinner = ora();

  try {
    // Load and validate manifest
    spinner.start('Loading manifest...');
    const manifest = await loadManifest(options.manifest);
    spinner.succeed('Manifest validated');

    // Find move configuration
    if (!manifest.moves?.[options.move]) {
      spinner.fail(`Move "${options.move}" not found in manifest`);
      process.exit(1);
    }

    // Initialize orchestrator
    const orchestrator = new PipelineOrchestrator(manifest, options.move);

    // Override frame count if specified
    if (options.frames) {
      orchestrator.setFrameCount(options.frames);
    }

    // Initialize run
    spinner.start('Initializing run...');
    const runId = await orchestrator.initialize();
    spinner.succeed(`Run initialized (${runId})`);

    // Analyze anchor
    spinner.start('Analyzing anchor image...');
    const analysis = await orchestrator.analyzeAnchor();
    spinner.succeed(`Anchor analyzed (baseline: ${analysis.baselineY}px)`);

    // Generation loop
    const frameCount = orchestrator.getFrameCount();
    let approvedCount = 0;
    let retryCount = 0;
    let rejectCount = 0;

    for (let i = 0; i < frameCount; i++) {
      spinner.start(`Generating frame ${i}/${frameCount}...`);

      const result = await orchestrator.generateFrame(i);

      if (result.status === 'approved') {
        approvedCount++;
        if (result.autoAligned) {
          spinner.warn(chalk.yellow(
            `Frame ${i}/${frameCount} Auto-Aligned (Drift: ${result.driftPixels}px)`
          ));
        } else {
          spinner.succeed(chalk.green(
            `Frame ${i}/${frameCount} Generated (Audit Score: ${result.score.toFixed(2)})`
          ));
        }
      } else if (result.status === 'retrying') {
        retryCount++;
        spinner.text = `Generating frame ${i}/${frameCount}... (retry ${result.attempt})`;
        i--; // Re-process this frame
      } else if (result.status === 'rejected') {
        rejectCount++;
        spinner.fail(chalk.red(
          `Frame ${i}/${frameCount} Rejected (${result.reason})`
        ));
      }
    }

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.bold('Batch Generation Complete'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✔ Approved: ${approvedCount}/${frameCount}`);
    if (rejectCount > 0) {
      console.log(chalk.red(`✖ Rejected: ${rejectCount}`));
    }
    console.log(`📊 Retry Rate: ${((retryCount / (approvedCount + rejectCount)) * 100).toFixed(1)}%`);
    console.log(`📊 Reject Rate: ${((rejectCount / frameCount) * 100).toFixed(1)}%`);
    console.log(`📁 Output: runs/${runId}/`);
    console.log('═══════════════════════════════════════════════════════');

    // Continue to Director or Export
    if (options.interactive) {
      await orchestrator.launchDirectorMode();
    }

    if (!options.skipValidation) {
      await orchestrator.runExport({
        allowValidationFail: options.allowValidationFail
      });
    }

  } catch (error) {
    spinner.fail('Generation failed');
    logger.error({ event: 'gen_error', error });
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
```

### Progress Message Format

```
⠋ Generating frame 2/8...
✔ Frame 2/8 Generated (Audit Score: 0.98)
⚠ Frame 3/8 Auto-Aligned (Drift: +4px)
✖ Frame 4/8 Rejected (SF01_IDENTITY_DRIFT)
```

### Summary Output Format

```
═══════════════════════════════════════════════════════
Batch Generation Complete
═══════════════════════════════════════════════════════
✔ Approved: 7/8
✖ Rejected: 1
📊 Retry Rate: 12.5%
📊 Reject Rate: 12.5%
📁 Output: runs/20260118_blaze_idle_abc123/
═══════════════════════════════════════════════════════
```

### Ora Spinner States

```typescript
const spinner = ora();

// Start with message
spinner.start('Loading manifest...');

// Success (green checkmark)
spinner.succeed('Manifest validated');

// Warning (yellow triangle)
spinner.warn('Frame auto-aligned due to drift');

// Failure (red X)
spinner.fail('Generation failed');

// Info (blue i)
spinner.info('Using default configuration');

// Update text during operation
spinner.text = 'Generating frame 3/8...';
```

### Run Folder Structure

Created at initialization:
```
runs/{run_id}/
├── manifest.lock.json
├── state.json
├── anchor_analysis.json
├── approved/
├── rejected/
├── candidates/
├── audit/
├── logs/
│   ├── pipeline.log
│   └── generation.log
├── export/
└── validation/
```

### Project Structure Notes

- New: `src/commands/gen.ts`
- New: `src/core/pipeline-orchestrator.ts`
- Dependencies: ora, chalk
- Tests: `test/commands/gen.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2]
- [Source: _bmad-output/project-context.md#CLI Output Patterns]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Core generation command integrating multiple subsystems. Complex progress display and error handling. Orchestrates anchor analysis, generation, auditing, and export phases.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
