# Story 8.1: Implement CLI Entry Point with Commander

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a single CLI binary that provides all pipeline commands,
**So that** I can run the entire workflow from the terminal.

---

## Acceptance Criteria

### CLI Structure

1. **Help display** - Running `banana --help` displays available commands
2. **Command list** - Shows: gen, doctor, schema, inspect, validate, demo
3. **Version info** - Version information displayed in help
4. **CLI framework** - Built with Commander.js
5. **Entry point** - `bin.ts` as entry point with shebang `#!/usr/bin/env node`

---

## Tasks / Subtasks

- [ ] **Task 1: Create CLI entry point** (AC: #5)
  - [ ] 1.1: Create `src/bin.ts` with shebang
  - [ ] 1.2: Import Commander and configure program
  - [ ] 1.3: Set version from package.json
  - [ ] 1.4: Add to package.json bin field

- [ ] **Task 2: Configure Commander program** (AC: #1, #2, #3)
  - [ ] 2.1: Set program name and description
  - [ ] 2.2: Set version with -V flag
  - [ ] 2.3: Configure global options (--verbose, --config)
  - [ ] 2.4: Add help text customization

- [ ] **Task 3: Register gen command** (AC: #2)
  - [ ] 3.1: Create `src/commands/gen.ts`
  - [ ] 3.2: Define --move, --interactive, --frames options
  - [ ] 3.3: Wire to command handler
  - [ ] 3.4: Add command description

- [ ] **Task 4: Register doctor command** (AC: #2)
  - [ ] 4.1: Create `src/commands/doctor.ts`
  - [ ] 4.2: Define command options
  - [ ] 4.3: Wire to existing doctor implementation
  - [ ] 4.4: Add command description

- [ ] **Task 5: Register schema command** (AC: #2)
  - [ ] 5.1: Create `src/commands/schema.ts`
  - [ ] 5.2: Define --output option
  - [ ] 5.3: Wire to schema display
  - [ ] 5.4: Add command description

- [ ] **Task 6: Register inspect command** (AC: #2)
  - [ ] 6.1: Create `src/commands/inspect.ts`
  - [ ] 6.2: Define run_id argument
  - [ ] 6.3: Define --frame, --diagnostic options
  - [ ] 6.4: Wire to inspect implementation

- [ ] **Task 7: Register validate and demo commands** (AC: #2)
  - [ ] 7.1: Create `src/commands/validate.ts`
  - [ ] 7.2: Create `src/commands/demo.ts`
  - [ ] 7.3: Define options for each
  - [ ] 7.4: Wire to implementations

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test --help shows all commands
  - [ ] 8.2: Test --version shows version
  - [ ] 8.3: Test unknown command shows error
  - [ ] 8.4: Test global options work

---

## Dev Notes

### CLI Entry Point

```typescript
#!/usr/bin/env node
// src/bin.ts
import { Command } from 'commander';
import { version } from '../package.json';
import { registerGenCommand } from './commands/gen';
import { registerDoctorCommand } from './commands/doctor';
import { registerSchemaCommand } from './commands/schema';
import { registerInspectCommand } from './commands/inspect';
import { registerValidateCommand } from './commands/validate';
import { registerDemoCommand } from './commands/demo';

const program = new Command();

program
  .name('banana')
  .description('AI-powered sprite sheet generation pipeline')
  .version(version, '-V, --version', 'Output the current version')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--config <path>', 'Path to config file');

// Register all commands
registerGenCommand(program);
registerDoctorCommand(program);
registerSchemaCommand(program);
registerInspectCommand(program);
registerValidateCommand(program);
registerDemoCommand(program);

// Custom help
program.addHelpText('after', `
Examples:
  $ banana gen --move=idle_standard      Generate idle animation
  $ banana gen --move=walk --interactive Generate with Director review
  $ banana doctor                        Check dependencies
  $ banana demo                          Run sample generation

Documentation:
  https://docs.example.com/sprite-pipeline
`);

// Parse and execute
program.parse();
```

### Command Registration Pattern

```typescript
// src/commands/gen.ts
import { Command } from 'commander';
import { runGeneration } from '../core/pipeline-orchestrator';
import { logger } from '../core/logger';

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
    .action(async (options) => {
      try {
        await runGeneration({
          move: options.move,
          manifestPath: options.manifest,
          interactive: options.interactive ?? false,
          frameCount: options.frames,
          skipValidation: options.skipValidation ?? false,
          allowValidationFail: options.allowValidationFail ?? false
        });
      } catch (error) {
        logger.error({ event: 'gen_command_error', error });
        process.exit(1);
      }
    });
}
```

### Package.json Configuration

```json
{
  "name": "sprite-pipeline",
  "version": "0.1.0",
  "bin": {
    "banana": "./dist/bin.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node ./dist/bin.js"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}
```

### Help Output

```
Usage: banana [options] [command]

AI-powered sprite sheet generation pipeline

Options:
  -V, --version          Output the current version
  -v, --verbose          Enable verbose logging
  --config <path>        Path to config file
  -h, --help             Display help for command

Commands:
  gen [options]          Generate sprite sequence from manifest
  doctor                 Check system dependencies
  schema                 Display manifest schema
  inspect <run_id>       Inspect run artifacts
  validate <run_id>      Run Phaser validation tests
  demo                   Run sample generation
  help [command]         Display help for command

Examples:
  $ banana gen --move=idle_standard      Generate idle animation
  $ banana gen --move=walk --interactive Generate with Director review
  $ banana doctor                        Check dependencies
  $ banana demo                          Run sample generation

Documentation:
  https://docs.example.com/sprite-pipeline
```

### Command Files Structure

```
src/
├── bin.ts                    # Entry point
├── commands/
│   ├── gen.ts               # Generate command
│   ├── doctor.ts            # Doctor command
│   ├── schema.ts            # Schema command
│   ├── inspect.ts           # Inspect command
│   ├── validate.ts          # Validate command
│   └── demo.ts              # Demo command
└── core/
    └── pipeline-orchestrator.ts
```

### Global Options Handling

```typescript
// Access global options in command handlers
function getGlobalOptions(program: Command) {
  const opts = program.opts();
  return {
    verbose: opts.verbose ?? false,
    configPath: opts.config ?? null
  };
}

// In command handler
.action(async (options, command) => {
  const globalOpts = getGlobalOptions(command.parent);
  if (globalOpts.verbose) {
    logger.level = 'debug';
  }
  // ...
});
```

### Project Structure Notes

- New: `src/bin.ts`
- New: `src/commands/gen.ts`
- New: `src/commands/doctor.ts`
- New: `src/commands/schema.ts`
- New: `src/commands/inspect.ts`
- New: `src/commands/validate.ts`
- New: `src/commands/demo.ts`
- Modify: `package.json` (add bin field)
- Tests: `test/cli/bin.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1]
- [Source: Commander.js documentation]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Well-defined CLI structure with Commander.js. Standard command registration pattern. No complex decision logic.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
