/**
 * Pipeline doctor command - verify system dependencies
 */

import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import {
    checkNodeVersion,
    checkTexturePacker,
    checkTexturePackerLicense,
    checkChrome,
    checkEnvironment,
    checkGeminiAPI,
} from '../utils/dependency-checker.js';

export function registerDoctorCommand(program: Command): void {
    program
        .command('doctor')
        .description('Verify system dependencies before running pipeline')
        .action(async () => {
            logger.info('Running system dependency checks...');
            console.log('\n🔍 System Dependency Checks\n');

            const checks = await Promise.all([
                checkNodeVersion(),
                checkTexturePacker(),
                checkTexturePackerLicense(),
                checkChrome(),
                checkEnvironment(),
                checkGeminiAPI(),
            ]);

            // Display results
            for (const check of checks) {
                const icon = check.status === 'PASS' ? '✅' : '❌';
                console.log(`${icon} ${check.name}: ${check.message}`);
                if (check.fix) {
                    console.log(`   💡 Fix: ${check.fix}`);
                }
            }

            const passed = checks.filter(c => c.status === 'PASS').length;
            const failed = checks.filter(c => c.status === 'FAIL').length;

            console.log(`\n📊 Summary: ${passed} passed, ${failed} failed\n`);
            logger.info({ passed, failed }, 'Doctor command summary');

            if (failed > 0) {
                process.exit(1);
                return;
            }
        });
}
