/**
 * File system helper utilities
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { constants } from 'fs';

/**
 * Atomic write using temp-then-rename pattern
 * Ensures file writes survive crashes and kill -9
 */
export async function writeJsonAtomic(
    filePath: string,
    data: unknown
): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const dir = dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, filePath);
}

/**
 * Redact sensitive values from an object for logging
 */
export function redactSecrets<T extends Record<string, unknown>>(obj: T): T {
    const sensitiveKeys = ['api_key', 'apiKey', 'token', 'secret', 'password', 'key'];
    const result: Record<string, unknown> = { ...obj };

    for (const key of Object.keys(result)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
            result[key] = redactSecrets(result[key] as Record<string, unknown>);
        }
    }

    return result as T;
}

/**
 * Check if a path exists and is accessible
 */
export async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a path exists and is writable
 */
export async function isWritable(path: string): Promise<boolean> {
    try {
        await fs.access(path, constants.W_OK);
        return true;
    } catch {
        return false;
    }
}
