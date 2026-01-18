/**
 * Reason codes taxonomy for error classification
 * 
 * HFxx - Hard Fail (immediate reject)
 * SFxx - Soft Fail (retry possible)
 * SYS_xx - System errors
 * DEP_xx - Dependency errors
 */

// Dependency Error Codes
export const DEP_NODE_VERSION = 'DEP_NODE_VERSION';
export const DEP_TEXTUREPACKER_NOT_FOUND = 'DEP_TEXTUREPACKER_NOT_FOUND';
export const DEP_TEXTUREPACKER_LICENSE = 'DEP_TEXTUREPACKER_LICENSE';
export const DEP_CHROME_NOT_FOUND = 'DEP_CHROME_NOT_FOUND';
export const DEP_WEBGL_UNAVAILABLE = 'DEP_WEBGL_UNAVAILABLE';
export const DEP_ENV_MISSING = 'DEP_ENV_MISSING';
export const DEP_ENV_KEY_MISSING = 'DEP_ENV_KEY_MISSING';
export const DEP_GEMINI_UNAVAILABLE = 'DEP_GEMINI_UNAVAILABLE';

// System Error Codes
export const SYS_PUPPETEER_LAUNCH_FAILED = 'SYS_PUPPETEER_LAUNCH_FAILED';
export const SYS_WEBGL_UNAVAILABLE = 'SYS_WEBGL_UNAVAILABLE';
export const SYS_PHASER_LOAD_FAILED = 'SYS_PHASER_LOAD_FAILED';
export const SYS_ANIMATION_FAILED = 'SYS_ANIMATION_FAILED';

// Hard Fail Codes (to be expanded in future stories)
export const HF01 = 'HF01'; // Placeholder

// Soft Fail Codes (to be expanded in future stories)
export const SF01 = 'SF01'; // Placeholder
