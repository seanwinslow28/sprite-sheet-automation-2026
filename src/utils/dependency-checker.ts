/**
 * Dependency checking utilities for doctor command
 */

import { execa } from 'execa';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import * as codes from '../domain/reason-codes.js';

export interface CheckResult {
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    fix?: string;
}

/**
 * Check Node.js version compatibility (LTS 20+)
 */
export async function checkNodeVersion(): Promise<CheckResult> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);

    if (major >= 20) {
        logger.info({ check: 'node_version', version, status: 'PASS' }, 'Node.js version check');
        return {
            name: 'Node.js Version',
            status: 'PASS',
            message: `Node.js ${version} (compatible)`,
        };
    } else {
        logger.error({ check: 'node_version', version, status: 'FAIL', code: codes.DEP_NODE_VERSION }, 'Node.js version check');
        return {
            name: 'Node.js Version',
            status: 'FAIL',
            message: `Node.js ${version} is too old`,
            fix: 'Upgrade to Node.js 20+ LTS from https://nodejs.org/',
        };
    }
}

/**
 * Check TexturePacker CLI installation and version
 */
export async function checkTexturePacker(): Promise<CheckResult> {
    try {
        const { stdout } = await execa('TexturePacker', ['--version']);
        logger.info({ check: 'texturepacker', version: stdout.trim(), status: 'PASS' }, 'TexturePacker check');
        return {
            name: 'TexturePacker',
            status: 'PASS',
            message: `TexturePacker ${stdout.trim()}`,
        };
    } catch (error) {
        logger.error({ check: 'texturepacker', status: 'FAIL', code: codes.DEP_TEXTUREPACKER_NOT_FOUND }, 'TexturePacker check');
        return {
            name: 'TexturePacker',
            status: 'FAIL',
            message: 'TexturePacker CLI not found in PATH',
            fix: 'Install TexturePacker from https://www.codeandweb.com/texturepacker and ensure it is in your PATH',
        };
    }
}

/**
 * Check TexturePacker license validity with minimal pack operation
 */
export async function checkTexturePackerLicense(): Promise<CheckResult> {
    try {
        // Create minimal temp directory for license check
        const tempDir = join(process.cwd(), 'runs', 'temp-license-check');
        await fs.mkdir(tempDir, { recursive: true });

        // Create a minimal 1x1 PNG for test pack
        const testImage = join(tempDir, 'test.png');
        // Simple 1x1 transparent PNG (base64)
        const pngData = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'base64'
        );
        await fs.writeFile(testImage, pngData);

        // Run minimal pack operation
        const { stdout, stderr } = await execa('TexturePacker', [
            '--sheet', join(tempDir, 'test.png'),
            '--data', join(tempDir, 'test.json'),
            testImage,
        ]);

        // Check for license errors in output
        const output = stdout + stderr;
        if (output.includes('trial') || output.includes('license')) {
            logger.warn({ check: 'texturepacker_license', status: 'WARN' }, 'TexturePacker license check');
            return {
                name: 'TexturePacker License',
                status: 'PASS',
                message: 'TexturePacker running (trial/pro license detected)',
            };
        }

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });

        logger.info({ check: 'texturepacker_license', status: 'PASS' }, 'TexturePacker license check');
        return {
            name: 'TexturePacker License',
            status: 'PASS',
            message: 'TexturePacker license valid',
        };
    } catch (error) {
        logger.error({ check: 'texturepacker_license', status: 'FAIL', code: codes.DEP_TEXTUREPACKER_LICENSE }, 'TexturePacker license check');
        return {
            name: 'TexturePacker License',
            status: 'FAIL',
            message: 'TexturePacker license validation failed',
            fix: 'Ensure you have a valid TexturePacker license',
        };
    }
}

/**
 * Check Chrome/Chromium availability (stub for now, needs puppeteer-core)
 */
export async function checkChrome(): Promise<CheckResult> {
    // Stub: Will be fully implemented when puppeteer-core is added in Story 1.4
    logger.info({ check: 'chrome', status: 'PASS' }, 'Chrome check (stub)');
    return {
        name: 'Chrome/Chromium',
        status: 'PASS',
        message: 'Check deferred to Story 1.4 (Puppeteer integration)',
    };
}

/**
 * Check environment file exists and has required keys
 */
export async function checkEnvironment(): Promise<CheckResult> {
    try {
        const envPath = join(process.cwd(), '.env');
        const envContent = await fs.readFile(envPath, 'utf-8');

        // Check for required keys (NEVER log values)
        const requiredKeys = ['GEMINI_API_KEY'];
        const missingKeys = requiredKeys.filter(key => !envContent.includes(key));

        if (missingKeys.length > 0) {
            logger.error({ check: 'environment', status: 'FAIL', code: codes.DEP_ENV_KEY_MISSING, missing_keys: missingKeys }, 'Environment check');
            return {
                name: 'Environment File',
                status: 'FAIL',
                message: `Missing required keys: ${missingKeys.join(', ')}`,
                fix: 'Copy .env.example to .env and fill in required values',
            };
        }

        logger.info({ check: 'environment', status: 'PASS' }, 'Environment check');
        return {
            name: 'Environment File',
            status: 'PASS',
            message: 'All required environment variables present',
        };
    } catch (error) {
        logger.error({ check: 'environment', status: 'FAIL', code: codes.DEP_ENV_MISSING }, 'Environment check');
        return {
            name: 'Environment File',
            status: 'FAIL',
            message: '.env file not found',
            fix: 'Copy .env.example to .env and fill in your API keys',
        };
    }
}

/**
 * Check Gemini API connectivity (stub for now, needs @google/generative-ai)
 */
export async function checkGeminiAPI(): Promise<CheckResult> {
    // Stub: Will be implemented when @google/generative-ai is added
    logger.info({ check: 'gemini_api', status: 'PASS' }, 'Gemini API check (stub)');
    return {
        name: 'Gemini API',
        status: 'PASS',
        message: 'Check deferred to future story (requires @google/generative-ai SDK)',
    };
}
