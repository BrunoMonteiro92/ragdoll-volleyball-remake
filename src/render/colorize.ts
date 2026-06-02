import { ColorMatrixFilter } from "pixi.js";

/**
 * Reproduces the original's ADDITIVE ColorTransform (redOffset/greenOffset/blueOffset)
 * via ColorMatrixFilter: identity matrix + offset in the 5th column (0..1 = offset/255).
 * rgbOffset = 0xRRGGBB (each byte is the additive offset of that channel, 0..255).
 */
export function applyAdditive(f: ColorMatrixFilter, rgbOffset: number): void {
  const r = ((rgbOffset >> 16) & 0xff) / 255;
  const g = ((rgbOffset >> 8) & 0xff) / 255;
  const b = (rgbOffset & 0xff) / 255;
  // prettier-ignore
  f.matrix = [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
}

export function additiveColorMatrix(rgbOffset: number): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  applyAdditive(f, rgbOffset);
  return f;
}
