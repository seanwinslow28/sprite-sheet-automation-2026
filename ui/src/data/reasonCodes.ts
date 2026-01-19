/**
 * Reason Codes Reference - Audit flag codes and their descriptions
 * Per Story 7.7: Inspector Pane with flag descriptions
 */

export type ReasonCode =
  | 'HF01'
  | 'HF02'
  | 'HF03'
  | 'HF04'
  | 'HF05'
  | 'HF_IDENTITY_COLLAPSE'
  | 'SF01'
  | 'SF02'
  | 'SF03'
  | 'SF04'
  | 'SF_ALPHA_HALO'
  | 'SF_PIXEL_NOISE';

export interface ReasonCodeInfo {
  name: string;
  severity: 'hard' | 'soft';
  description: string;
  solution: string;
}

export const REASON_CODES: Record<ReasonCode, ReasonCodeInfo> = {
  HF01: {
    name: 'Dimension Mismatch',
    severity: 'hard',
    description: 'Frame size does not match target canvas size specified in manifest.',
    solution: 'Check canvas.target_size in manifest. Regenerate frame.',
  },
  HF02: {
    name: 'Alpha Missing',
    severity: 'hard',
    description: 'Image lacks an alpha channel for transparency.',
    solution: 'Ensure generator produces PNG with transparency.',
  },
  HF03: {
    name: 'Baseline Drift',
    severity: 'hard',
    description: 'Frame baseline differs from anchor by more than threshold.',
    solution: 'Use Nudge tool to align or regenerate with pose rescue.',
  },
  HF04: {
    name: 'Color Depth',
    severity: 'hard',
    description: 'Image is not 32-bit RGBA format.',
    solution: 'Check generator settings and post-processing.',
  },
  HF05: {
    name: 'File Size',
    severity: 'hard',
    description: 'File size outside expected bounds (too small or too large).',
    solution: 'Investigate for corruption or empty frames.',
  },
  HF_IDENTITY_COLLAPSE: {
    name: 'Identity Collapse',
    severity: 'hard',
    description: 'Two consecutive re-anchor attempts failed. Character identity lost.',
    solution: 'Improve anchor quality or adjust identity threshold.',
  },
  SF01: {
    name: 'Identity Drift',
    severity: 'soft',
    description: 'SSIM score below identity threshold. Character looks different.',
    solution: 'Use identity rescue prompt or re-anchor.',
  },
  SF02: {
    name: 'Palette Drift',
    severity: 'soft',
    description: 'Colors deviate from character palette.',
    solution: 'Use Patch tool to fix colors or tighten negative prompt.',
  },
  SF03: {
    name: 'Baseline Drift (Soft)',
    severity: 'soft',
    description: 'Minor baseline drift detected but within soft limit.',
    solution: 'Review alignment or use Nudge tool.',
  },
  SF04: {
    name: 'Temporal Flicker',
    severity: 'soft',
    description: 'Frame differs too much from adjacent frames for move type.',
    solution: 'Regenerate with tighter prompts or adjust thresholds.',
  },
  SF_ALPHA_HALO: {
    name: 'Alpha Halo',
    severity: 'soft',
    description: 'Fringe or halo artifacts detected around sprite edges.',
    solution: 'Apply post-process cleanup or use Patch tool.',
  },
  SF_PIXEL_NOISE: {
    name: 'Orphan Pixels',
    severity: 'soft',
    description: 'More than 15 isolated pixels detected.',
    solution: 'Regenerate at higher resolution or clean up manually.',
  },
};

/**
 * Get reason code info by code string
 */
export function getReasonCodeInfo(code: string): ReasonCodeInfo | undefined {
  return REASON_CODES[code as ReasonCode];
}

/**
 * Check if a code is a hard fail
 */
export function isHardFail(code: string): boolean {
  return code.startsWith('HF');
}

/**
 * Check if a code is a soft fail
 */
export function isSoftFail(code: string): boolean {
  return code.startsWith('SF');
}
