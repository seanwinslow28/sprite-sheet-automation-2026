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

// Placeholder commands - to be implemented in subsequent stories
program
    .command('gen')
    .description('Generate sprite animation from manifest')
    .action(() => {
        logger.info({ command: 'gen' }, 'gen command - to be implemented');
    });

program
    .command('director')
    .description('Analyze and plan sprite generation')
    .action(() => {
        logger.info({ command: 'director' }, 'director command - to be implemented');
    });

program
    .command('export')
    .description('Export sprites to texture atlas')
    .action(() => {
        logger.info({ command: 'export' }, 'export command - to be implemented');
    });

program
    .command('inspect')
    .description('Inspect run artifacts and logs')
    .action(() => {
        logger.info({ command: 'inspect' }, 'inspect command - to be implemented');
    });

program.parse();
