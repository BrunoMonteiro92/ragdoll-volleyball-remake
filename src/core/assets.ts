/** Path of an asset served from public/assets/. */
export const assetUrl = (path: string) => `assets/${path}`;

/** Path of a rasterized frame of a sprite from FFDec. */
export const spriteFrame = (defineSpriteDir: string, frame = 1) =>
  assetUrl(`sprites/${defineSpriteDir}/${frame}.png`);
