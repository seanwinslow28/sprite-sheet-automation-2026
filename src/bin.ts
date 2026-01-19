#!/usr/bin/env node
/**
 * CLI entry point using Commander.js
 * Project: banana - AI-powered sprite sheet generation pipeline
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerSpikeCommand } from './commands/spike.js';
import { registerRunCommand } from './commands/run.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerPromoteCommand } from './commands/promote.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerNewManifestCommand } from './commands/new-manifest.js';
import { registerGuideCommand } from './commands/guide.js';
import { registerDemoCommand } from './commands/demo.js';
import { registerGenCommand } from './commands/gen.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
    .name('banana')
    .description('AI-powered sprite sheet generation pipeline')
    .version(pkg.version, '-V, --version', 'Output the current version');

// Register commands
registerDoctorCommand(program);
registerSchemaCommand(program);
registerSpikeCommand(program);
registerRunCommand(program);
registerValidateCommand(program);
registerPromoteCommand(program);
registerInspectCommand(program);
registerCleanCommand(program);
registerNewManifestCommand(program);
registerGuideCommand(program);
registerDemoCommand(program);
registerGenCommand(program);

// Placeholder commands - to be implemented in subsequent stories
program
    .command('director')
    .description('Launch Director Mode standalone (normally use gen --interactive)')
    .action(() => {
        logger.info({ command: 'director' }, 'director command - use gen --interactive instead');
        console.log('Use: banana gen --move=<move> --interactive');
    });

program
    .command('export')
    .description('Export sprites to texture atlas (normally automatic after gen)')
    .action(() => {
        logger.info({ command: 'export' }, 'export command - export runs automatically after gen');
        console.log('Export runs automatically after generation.');
        console.log('For manual export, use: banana gen --move=<move>');
    });

program.parse();

