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

/**
 * Individual check result for doctor command
 */
export interface DoctorCheckResult {
    name: string;
    passed: boolean;
    message: string;
    recommendation?: string;
}

/**
 * Result of running all doctor checks
 */
export interface DoctorResult {
    checks: DoctorCheckResult[];
    passed: number;
    failed: number;
    allPassed: boolean;
}

/**
 * Run all doctor checks and return results
 * Can be used programmatically by other commands
 */
export async function runDoctor(): Promise<DoctorResult> {
    const rawChecks = await Promise.all([
        checkNodeVersion(),
        checkTexturePacker(),
        checkTexturePackerLicense(),
        checkChrome(),
        checkEnvironment(),
        checkGeminiAPI(),
    ]);

    // Convert to DoctorCheckResult format
    const checks: DoctorCheckResult[] = rawChecks.map(check => ({
        name: check.name,
        passed: check.status === 'PASS',
        message: check.message,
        recommendation: check.fix,
    }));

    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed).length;

    return {
        checks,
        passed,
        failed,
        allPassed: failed === 0,
    };
}

export function registerDoctorCommand(program: Command): void {
    program
        .command('doctor')
        .description('Verify system dependencies before running pipeline')
        .action(async () => {
            logger.info('Running system dependency checks...');
            console.log('\n🔍 System Dependency Checks\n');

            const result = await runDoctor();

            // Display results
            for (const check of result.checks) {
                const icon = check.passed ? '✅' : '❌';
                console.log(`${icon} ${check.name}: ${check.message}`);
                if (check.recommendation) {
                    console.log(`   💡 Fix: ${check.recommendation}`);
                }
            }

            console.log(`\n📊 Summary: ${result.passed} passed, ${result.failed} failed\n`);
            logger.info({ passed: result.passed, failed: result.failed }, 'Doctor command summary');

            if (result.failed > 0) {
                process.exit(1);
                return;
            }
        });
}
