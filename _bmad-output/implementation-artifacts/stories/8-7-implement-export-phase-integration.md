# Story 8.7: Implement Export Phase Integration

Status: done

---

## Story

**As an** operator,
**I want** the CLI to automatically run export and validation after approval,
**So that** I get game-ready assets without additional commands.

---

## Acceptance Criteria

### Export Flow

1. **Frame renaming** - Renames frames to 4-digit padded format
2. **TexturePacker** - Invokes TexturePacker with locked flags
3. **Phaser tests** - Runs Phaser micro-tests (TEST-02, TEST-03, TEST-04)
4. **Results reporting** - Reports validation results
5. **Status marking** - Marks run as "release-ready" or "validation-failed"
6. **Output location** - Output placed in `runs/{run_id}/export/`
7. **Skip validation** - `--skip-validation` flag bypasses Phaser tests
8. **Allow fail** - `--allow-validation-fail` allows export despite failures

---

## Tasks / Subtasks

- [x] **Task 1: Create ExportService** (AC: #1-6)
  - [x] 1.1: Create `src/core/export-service.ts`
  - [x] 1.2: Define export options interface
  - [x] 1.3: Create run method with all steps
  - [x] 1.4: Handle errors at each step

- [x] **Task 2: Implement frame renaming** (AC: #1)
  - [x] 2.1: Read approved frames from folder
  - [x] 2.2: Rename to 4-digit padded format
  - [x] 2.3: Create export input folder
  - [x] 2.4: Maintain frame order

- [x] **Task 3: Implement TexturePacker invocation** (AC: #2)
  - [x] 3.1: Build command with locked flags
  - [x] 3.2: Execute via execa
  - [x] 3.3: Capture stdout/stderr
  - [x] 3.4: Handle failure without losing frames

- [x] **Task 4: Implement Phaser validation** (AC: #3, #7)
  - [x] 4.1: Check skip-validation flag
  - [x] 4.2: Run TEST-02 (Pivot)
  - [x] 4.3: Run TEST-03 (Trim Jitter)
  - [x] 4.4: Run TEST-04 (Suffix)
  - [x] 4.5: Collect results

- [x] **Task 5: Implement result reporting** (AC: #4)
  - [x] 5.1: Format validation results
  - [x] 5.2: Display pass/fail for each test
  - [x] 5.3: Show failure details
  - [x] 5.4: Write to logs

- [x] **Task 6: Implement status marking** (AC: #5)
  - [x] 6.1: Determine final status
  - [x] 6.2: Update state.json
  - [x] 6.3: Create summary.json
  - [x] 6.4: Mark release-ready or validation-failed

- [x] **Task 7: Implement validation bypass** (AC: #7, #8)
  - [x] 7.1: Check --skip-validation flag
  - [x] 7.2: Check --allow-validation-fail flag
  - [x] 7.3: Log bypass/override warnings
  - [x] 7.4: Mark appropriately in status

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test frame renaming
  - [x] 8.2: Test TexturePacker invocation
  - [x] 8.3: Test validation integration
  - [x] 8.4: Test skip/allow flags

---

## Dev Notes

### ExportService Implementation

```typescript
// src/core/export-service.ts
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { PhaserValidator } from './phaser-validator';
import { logger } from './logger';

interface ExportOptions {
  skipValidation?: boolean;
  allowValidationFail?: boolean;
}

interface ExportResult {
  success: boolean;
  atlasPath?: string;
  jsonPath?: string;
  validationResults?: ValidationResult[];
  releaseReady: boolean;
}

export class ExportService {
  private runPath: string;
  private manifest: Manifest;
  private spinner = ora();

  constructor(runPath: string, manifest: Manifest) {
    this.runPath = runPath;
    this.manifest = manifest;
  }

  async run(options: ExportOptions = {}): Promise<ExportResult> {
    try {
      // Step 1: Prepare frames
      this.spinner.start('Preparing frames for export...');
      const exportInputDir = await this.prepareFrames();
      this.spinner.succeed('Frames prepared');

      // Step 2: Run TexturePacker
      this.spinner.start('Running TexturePacker...');
      const { atlasPath, jsonPath } = await this.runTexturePacker(exportInputDir);
      this.spinner.succeed(`Atlas exported (${path.basename(atlasPath)}, ${path.basename(jsonPath)})`);

      // Step 3: Run validation (unless skipped)
      let validationResults: ValidationResult[] = [];
      let validationPassed = true;

      if (!options.skipValidation) {
        this.spinner.start('Running Phaser validation...');

        const validator = new PhaserValidator(
          path.join(this.runPath, 'export'),
          this.manifest
        );

        validationResults = await validator.runAllTests();
        validationPassed = validationResults.every(r => r.passed);

        if (validationPassed) {
          this.spinner.succeed(`Validation passed (${validationResults.length}/${validationResults.length} tests)`);
        } else {
          const failed = validationResults.filter(r => !r.passed).length;
          this.spinner.fail(`Validation failed (${failed}/${validationResults.length} tests failed)`);
        }

        // Show details
        this.displayValidationResults(validationResults);
      } else {
        console.log(chalk.yellow('⚠️ Validation skipped (--skip-validation)'));
      }

      // Step 4: Determine status
      const releaseReady = validationPassed || options.allowValidationFail === true;

      if (!validationPassed && options.allowValidationFail) {
        console.log(chalk.yellow('⚠️ Proceeding despite validation failures (--allow-validation-fail)'));
      }

      // Step 5: Update state
      await this.updateStatus(releaseReady, validationResults);

      // Step 6: Show summary
      this.displaySummary(atlasPath, jsonPath, releaseReady);

      return {
        success: true,
        atlasPath,
        jsonPath,
        validationResults,
        releaseReady
      };

    } catch (error) {
      this.spinner.fail('Export failed');
      logger.error({ event: 'export_error', error });
      throw error;
    }
  }

  private async prepareFrames(): Promise<string> {
    const approvedDir = path.join(this.runPath, 'approved');
    const exportInputDir = path.join(this.runPath, 'export', 'input');

    await fs.ensureDir(exportInputDir);

    // Get approved frames
    const files = await fs.readdir(approvedDir);
    const frameFiles = files.filter(f => f.endsWith('.png')).sort();

    // Create move subfolder for proper naming
    const moveName = this.manifest.identity.move;
    const moveDir = path.join(exportInputDir, moveName);
    await fs.ensureDir(moveDir);

    // Copy with 4-digit naming
    for (let i = 0; i < frameFiles.length; i++) {
      const paddedIndex = String(i).padStart(4, '0');
      const destPath = path.join(moveDir, `${paddedIndex}.png`);
      await fs.copy(
        path.join(approvedDir, frameFiles[i]),
        destPath
      );
    }

    return exportInputDir;
  }

  private async runTexturePacker(inputDir: string): Promise<{ atlasPath: string; jsonPath: string }> {
    const character = this.manifest.identity.character.toLowerCase();
    const move = this.manifest.identity.move;
    const outputName = `${character}_${move}`;
    const outputDir = path.join(this.runPath, 'export');

    // Locked flags from Compliance Kit
    const args = [
      '--format', 'phaser',
      '--trim-mode', 'Trim',
      '--extrude', '1',
      '--shape-padding', '2',
      '--border-padding', '2',
      '--disable-rotation',
      '--alpha-handling', 'ReduceBorderArtifacts',
      '--max-size', '2048',
      '--trim-sprite-names',
      '--prepend-folder-name',
      '--data', path.join(outputDir, `${outputName}.json`),
      '--sheet', path.join(outputDir, `${outputName}.png`),
      inputDir
    ];

    try {
      const result = await execa('TexturePacker', args);

      // Log output
      await fs.writeFile(
        path.join(this.runPath, 'logs', 'texturepacker.log'),
        `${result.command}\n\n${result.stdout}\n\n${result.stderr}`
      );

      return {
        atlasPath: path.join(outputDir, `${outputName}.png`),
        jsonPath: path.join(outputDir, `${outputName}.json`)
      };

    } catch (error) {
      // Preserve approved frames on failure
      logger.error({
        event: 'texturepacker_error',
        error,
        note: 'Approved frames preserved in approved/'
      });
      throw error;
    }
  }

  private displayValidationResults(results: ValidationResult[]): void {
    console.log('');
    for (const result of results) {
      const icon = result.passed ? chalk.green('✔') : chalk.red('✖');
      console.log(`  ${icon} ${result.testName}: ${result.passed ? 'PASS' : 'FAIL'}`);
      if (!result.passed && result.message) {
        console.log(chalk.gray(`      ${result.message}`));
      }
    }
    console.log('');
  }

  private displaySummary(atlasPath: string, jsonPath: string, releaseReady: boolean): void {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    if (releaseReady) {
      console.log(chalk.green.bold('✅ Export Complete - Release Ready'));
    } else {
      console.log(chalk.yellow.bold('⚠️ Export Complete - Validation Failed'));
    }
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📦 Atlas: ${path.relative('.', atlasPath)}`);
    console.log(`📋 JSON:  ${path.relative('.', jsonPath)}`);
    console.log('═══════════════════════════════════════════════════════');
  }

  private async updateStatus(
    releaseReady: boolean,
    validationResults: ValidationResult[]
  ): Promise<void> {
    const summaryPath = path.join(this.runPath, 'summary.json');

    const summary = {
      runId: path.basename(this.runPath),
      completedAt: new Date().toISOString(),
      releaseReady,
      validation: {
        skipped: validationResults.length === 0,
        passed: validationResults.every(r => r.passed),
        tests: validationResults.map(r => ({
          name: r.testName,
          passed: r.passed,
          message: r.message
        }))
      }
    };

    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }
}
```

### TexturePacker Locked Flags

```typescript
const LOCKED_FLAGS = [
  '--format', 'phaser',
  '--trim-mode', 'Trim',
  '--extrude', '1',
  '--shape-padding', '2',
  '--border-padding', '2',
  '--disable-rotation',
  '--alpha-handling', 'ReduceBorderArtifacts',
  '--max-size', '2048',
  '--trim-sprite-names',
  '--prepend-folder-name'
];

// These flags CANNOT be overridden by manifest
```

### Frame Naming Convention

Input structure:
```
export/input/
└── idle_standard/
    ├── 0000.png
    ├── 0001.png
    ├── 0002.png
    └── ...
```

Output structure:
```
export/
├── blaze_idle_standard.png
├── blaze_idle_standard.json
└── input/
    └── ...
```

### Console Output

```
⠋ Preparing frames for export...
✔ Frames prepared
⠋ Running TexturePacker...
✔ Atlas exported (blaze_idle.png, blaze_idle.json)
⠋ Running Phaser validation...
✔ Validation passed (3/3 tests)

  ✔ TEST-02 Pivot: PASS
  ✔ TEST-03 Trim Jitter: PASS
  ✔ TEST-04 Suffix: PASS

═══════════════════════════════════════════════════════
✅ Export Complete - Release Ready
═══════════════════════════════════════════════════════
📦 Atlas: runs/20260118_blaze_idle_abc123/export/blaze_idle.png
📋 JSON:  runs/20260118_blaze_idle_abc123/export/blaze_idle.json
═══════════════════════════════════════════════════════
```

### Project Structure Notes

- New: `src/core/export-service.ts`
- Integrates: PhaserValidator (Story 5.7)
- Integrates: TexturePacker via execa
- Tests: `test/core/export-service.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.7]
- [Source: _bmad-output/implementation-artifacts/stories/5-2] (TexturePacker)
- [Source: _bmad-output/implementation-artifacts/stories/5-7] (Phaser Tests)

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Well-defined export pipeline with TexturePacker integration. Clear step sequence with known flags. Straightforward file operations and process execution.

### Debug Log References

N/A

### Completion Notes List

- export-service.ts orchestrates TexturePacker export and Phaser validation
- ExportOptions for skip-validation, allow-validation-fail
- Frame collection from approved folder
- Atlas exporter with locked TexturePacker flags
- Phaser micro-tests via phaser-test-harness
- Summary generation with validation results

### File List

- `src/core/export-service.ts` - Export orchestration
- `src/core/export/atlas-exporter.ts` - TexturePacker wrapper
- `src/core/validation/phaser-test-harness.ts` - Phaser tests
- `test/core/export-service.test.ts` - Export tests
