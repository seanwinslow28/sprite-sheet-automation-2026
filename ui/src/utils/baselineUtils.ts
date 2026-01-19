/**
 * Baseline detection utilities for alignment visualization
 * Per Story 7.8: Alignment diff overlays
 */

/**
 * Result from baseline detection
 */
export interface BaselineResult {
  /** Y coordinate of detected baseline (bottommost opaque pixel) */
  baselineY: number;
  /** Image height in pixels */
  imageHeight: number;
  /** Whether detection succeeded */
  success: boolean;
}

/**
 * Detect the baseline Y coordinate of a sprite image
 * Baseline is defined as the Y coordinate of the bottommost non-transparent pixel
 * (matching anchor-analyzer.ts algorithm)
 */
export async function detectBaseline(imageBase64: string): Promise<BaselineResult> {
  const img = new Image();
  img.src = `data:image/png;base64,${imageBase64}`;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { baselineY: img.height, imageHeight: img.height, success: false };
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Scan from bottom to find first non-transparent row (alpha > 0)
  for (let y = canvas.height - 1; y >= 0; y--) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const alpha = imageData.data[idx + 3];
      if (alpha > 0) {
        return { baselineY: y, imageHeight: canvas.height, success: true };
      }
    }
  }

  // No opaque pixels found
  return { baselineY: canvas.height, imageHeight: canvas.height, success: false };
}

/**
 * Calculate baseline drift between two frames
 */
export function calculateBaselineDrift(
  anchorBaselineY: number,
  currentBaselineY: number
): { drift: number; direction: 'up' | 'down' | 'none' } {
  const drift = currentBaselineY - anchorBaselineY;

  if (drift > 0) {
    return { drift, direction: 'down' };
  } else if (drift < 0) {
    return { drift: Math.abs(drift), direction: 'up' };
  }

  return { drift: 0, direction: 'none' };
}

/**
 * Format drift for display
 */
export function formatDrift(drift: number, direction: 'up' | 'down' | 'none'): string {
  if (direction === 'none') {
    return '0px (aligned)';
  }

  const sign = direction === 'down' ? '+' : '-';
  const arrow = direction === 'down' ? '\u2193' : '\u2191'; // ↓ or ↑
  return `${sign}${drift}px ${arrow}`;
}
