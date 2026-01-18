/**
 * Spike command - validate Puppeteer + Phaser integration
 */

import { Command } from 'commander';
import { join } from 'path';
import { launchBrowser, runPhaserTest } from '../adapters/puppeteer-harness.js';
import { logger } from '../utils/logger.js';

export function registerSpikeCommand(program: Command): void {
    program
        .command('spike')
        .description('Run Puppeteer + Phaser validation spike')
        .action(async () => {
            console.log('\n🧪 Running Engine Truth Spike: Puppeteer + Phaser\n');
            logger.info('Starting spike test');

            const htmlPath = join(process.cwd(), 'test-fixtures', 'phaser-test-scene.html');
            const outputDir = join(process.cwd(), 'runs', 'spike');

            // Launch browser
            const browserResult = await launchBrowser();
            if (!browserResult.isOk()) {
                const error = browserResult.unwrapErr();
                console.error(`❌ ${error.message}`);
                console.error(`   💡 Fix: ${error.fix}`);
                process.exit(1);
                return;
            }

            const browser = browserResult.unwrap();

            try {
                // Run Phaser test
                const testResult = await runPhaserTest(browser, htmlPath, outputDir);

                if (!testResult.isOk()) {
                    const error = testResult.unwrapErr();
                    console.error(`❌ ${error.message}`);
                    console.error(`   💡 Fix: ${error.fix}`);
                    process.exit(1);
                    return; // Ensure we stop here
                }

                const result = testResult.unwrap();

                // Display results
                console.log(`\n📊 Results:`);
                console.log(`   Status: ${result.status}`);
                console.log(`   Frames Played: ${result.framesPlayed || 'N/A'}`);
                console.log(`   Errors: ${result.errors.length}`);
                console.log(`   Console Logs: ${result.consoleLogs.length} messages`);
                console.log(`\n📁 Artifacts:`);
                console.log(`   Screenshot: ${outputDir}/screenshot.png`);
                console.log(`   Console Log: ${outputDir}/console.log`);

                if (result.status === 'PASS') {
                    console.log(`\n✅ SPIKE PASSED: Phaser + Puppeteer integration validated\n`);
                    process.exit(0);
                } else {
                    console.log(`\n❌ SPIKE FAILED: Check artifacts for details\n`);
                    if (result.errors.length > 0) {
                        console.log(`Errors:`);
                        result.errors.forEach(err => console.log(`   - ${err}`));
                    }
                    process.exit(1);
                }

            } finally {
                await browser.close();
                logger.info('Browser closed');
            }
        });
}
