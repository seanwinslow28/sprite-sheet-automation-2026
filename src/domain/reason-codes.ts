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

// Hard Fail Codes - immediate rejection, per Story 3.3
export const HF01_DIMENSION_MISMATCH = 'HF01_DIMENSION_MISMATCH';     // Canvas size incorrect
export const HF02_FULLY_TRANSPARENT = 'HF02_FULLY_TRANSPARENT';       // No visible content
export const HF03_IMAGE_CORRUPTED = 'HF03_IMAGE_CORRUPTED';           // File unreadable
export const HF04_WRONG_COLOR_DEPTH = 'HF04_WRONG_COLOR_DEPTH';       // Not 32-bit RGBA
export const HF05_FILE_SIZE_INVALID = 'HF05_FILE_SIZE_INVALID';       // Size outside bounds
export const HF_NO_ALPHA = 'HF_NO_ALPHA';                             // No alpha channel (true_alpha mode)

// Soft Fail Codes - retry possible, per Stories 3.4-3.10
export const SF01_IDENTITY_DRIFT = 'SF01_IDENTITY_DRIFT';             // SSIM below threshold
export const SF02_PALETTE_DRIFT = 'SF02_PALETTE_DRIFT';               // Palette fidelity below threshold
export const SF03_ALPHA_HALO = 'SF03_ALPHA_HALO';                     // Alpha artifact severity high
export const SF04_BASELINE_DRIFT = 'SF04_BASELINE_DRIFT';             // Baseline position drift
export const SF04_TEMPORAL_FLICKER = 'SF04_TEMPORAL_FLICKER';         // MAPD above threshold
export const SF05_PIXEL_NOISE = 'SF05_PIXEL_NOISE';                   // Orphan pixel count high
export const SF_FRINGE_RISK = 'SF_FRINGE_RISK';                       // Chroma fringe detected
