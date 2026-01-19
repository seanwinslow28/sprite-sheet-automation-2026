/**
 * CRC32 implementation with precomputed lookup table
 * Per Story 2.3: Reproducible seed generation for frame attempts
 */

// Precomputed CRC32 lookup table (IEEE polynomial 0xEDB88320)
const CRC32_TABLE = new Uint32Array(256);

// Initialize table on module load
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC32_TABLE[i] = c;
}

/**
 * Calculate CRC32 hash of a string
 */
export function crc32(str: string): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < str.length; i++) {
        crc = CRC32_TABLE[(crc ^ str.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Calculate seed for frame generation
 * Attempt 1: deterministic CRC32 seed
 * Attempt 2+: undefined (API randomizes)
 */
export function calculateSeed(
    runId: string,
    frameIndex: number,
    attemptIndex: number
): number | undefined {
    // Only use fixed seed for attempt 1
    if (attemptIndex > 1) {
        return undefined; // Let API randomize to escape failure modes
    }

    // Build seed input string
    const input = `${runId}::${frameIndex}::${attemptIndex}`;
    return crc32(input);
}

/**
 * Get seed policy description for logging
 */
export function describeSeedPolicy(attemptIndex: number): string {
    return attemptIndex === 1 ? 'fixed_crc32' : 'random';
}
