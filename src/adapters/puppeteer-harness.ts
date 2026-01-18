/**
 * Puppeteer harness for headless Chrome browser automation
 * Used for Phaser WebGL validation in headless environment
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { Result, SystemError } from '../core/result.js';
import * as codes from '../domain/reason-codes.js';
import { logger } from '../utils/logger.js';

export interface PuppeteerConfig {
    executablePath?: string;
    timeout?: number;
}

export interface SpikeResult {
    status: 'PASS' | 'FAIL';
    framesPlayed?: number;
    errors: string[];
    consoleLogs: string[];
}

/**
 * Launch headless Chrome with WebGL support
 */
export async function launchBrowser(
    config: PuppeteerConfig = {}
): Promise<Result<Browser, SystemError>> {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: config.executablePath || findChrome(),
            args: [
                '--use-gl=swiftshader',      // Software WebGL
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',   // Prevents /dev/shm issues
            ],
        });

        logger.info({ browser: 'launched' }, 'Puppeteer browser launched');
        return Result.ok(browser);
    } catch (error: any) {
        logger.error({ error: error.message, code: codes.SYS_PUPPETEER_LAUNCH_FAILED }, 'Browser launch failed');
        return Result.err({
            code: codes.SYS_PUPPETEER_LAUNCH_FAILED,
            message: 'Failed to launch headless Chrome',
            attempted: `Puppeteer launch with executablePath: ${config.executablePath || 'auto'}`,
            fix: 'Ensure Chrome or Chromium is installed and accessible',
        });
    }
}

/**
 * Find Chrome executable path (simple heuristic for Windows)
 */
function findChrome(): string {
    // Common Chrome paths on Windows
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH || '',
    ];

    // Return first valid path or empty string for auto-detection
    return paths.find(p => p.length > 0) || '';
}

/**
 * Run Phaser test scene and capture results
 */
export async function runPhaserTest(
    browser: Browser,
    htmlPath: string,
    outputDir: string
): Promise<Result<SpikeResult, SystemError>> {
    let page: Page | null = null;

    try {
        page = await browser.newPage();

        // Capture console logs
        const consoleLogs: string[] = [];
        const errors: string[] = [];

        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            logger.debug({ type: msg.type(), text }, 'Browser console');
        });

        page.on('pageerror', (err) => {
            const error = err as Error;
            errors.push(error.message);
            logger.error({ error: error.message }, 'Page error');
        });

        // Navigate to test scene
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });

        // Wait for spike completion signal
        await page.waitForFunction(
            'window.__SPIKE_COMPLETE__ === true',
            { timeout: 30000 }
        );

        // Get result from page
        const result: any = await page.evaluate('window.__SPIKE_RESULT__');

        // Capture screenshot
        const screenshotPath = `${outputDir}/screenshot.png`;
        await fs.mkdir(dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath });
        logger.info({ screenshot: screenshotPath }, 'Screenshot captured');

        // Write console logs
        const consoleLogPath = `${outputDir}/console.log`;
        await fs.writeFile(
            consoleLogPath,
            consoleLogs.map((log, i) => `[${i}] ${log}`).join('\n'),
            'utf-8'
        );
        logger.info({ console_log: consoleLogPath }, 'Console logs saved');

        await page.close();

        return Result.ok({
            status: result?.status || (errors.length > 0 ? 'FAIL' : 'PASS'),
            framesPlayed: result?.frames_played,
            errors,
            consoleLogs,
        });

    } catch (error: any) {
        if (page) {
            await page.close().catch(() => { });
        }

        logger.error({ error: error.message, code: codes.SYS_ANIMATION_FAILED }, 'Phaser test failed');
        return Result.err({
            code: codes.SYS_ANIMATION_FAILED,
            message: 'Phaser test execution failed',
            attempted: `Run test scene at ${htmlPath}`,
            fix: 'Check console logs and verify Phaser scene configuration',
        });
    }
}
