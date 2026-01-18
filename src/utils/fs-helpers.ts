/**
 * File system helper utilities
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';

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
