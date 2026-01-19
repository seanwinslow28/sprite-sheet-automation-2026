/**
 * Color utility functions for palette analysis and visualization
 * Per Story 7.8: Palette issue detection and legalization
 */

/**
 * RGB color representation
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculate Euclidean distance between two colors
 */
export function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Check if a color is within tolerance of any palette color
 */
export function isInPalette(color: RGB, palette: RGB[], tolerance = 5): boolean {
  return palette.some((p) => colorDistance(color, p) <= tolerance);
}

/**
 * Find the nearest color in a palette using Euclidean RGB distance
 */
export function findNearestPaletteColor(color: RGB, palette: RGB[]): RGB {
  if (palette.length === 0) {
    return color;
  }

  let nearest = palette[0];
  let minDistance = colorDistance(color, palette[0]);

  for (const p of palette) {
    const dist = colorDistance(color, p);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = p;
    }
  }

  return nearest;
}

/**
 * Pixel position
 */
export interface PixelPosition {
  x: number;
  y: number;
}

/**
 * Analyze an image and find all off-palette pixels
 */
export async function findOffPalettePixels(
  imageBase64: string,
  palette: RGB[],
  tolerance = 5
): Promise<PixelPosition[]> {
  const img = new Image();
  img.src = `data:image/png;base64,${imageBase64}`;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const offPixels: PixelPosition[] = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const a = imageData.data[idx + 3];

      // Skip fully transparent pixels
      if (a === 0) continue;

      if (!isInPalette({ r, g, b }, palette, tolerance)) {
        offPixels.push({ x, y });
      }
    }
  }

  return offPixels;
}

/**
 * Correct off-palette pixels by snapping them to nearest palette color
 */
export async function legalizeColors(
  imageBase64: string,
  offPixels: PixelPosition[],
  palette: RGB[]
): Promise<string> {
  const img = new Image();
  img.src = `data:image/png;base64,${imageBase64}`;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageBase64;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (const { x, y } of offPixels) {
    const idx = (y * canvas.width + x) * 4;
    const color: RGB = {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
    };

    const nearest = findNearestPaletteColor(color, palette);
    imageData.data[idx] = nearest.r;
    imageData.data[idx + 1] = nearest.g;
    imageData.data[idx + 2] = nearest.b;
    // Preserve alpha
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}
