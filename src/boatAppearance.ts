import type { Appearance } from '../shared/multiplayer.ts';
import { coatColors, hatColors, skinColors } from '../shared/multiplayer.ts';

// Recolour the painted clothing, keeping the original texture, lighting and boat.
// Cache only the variants currently encountered, never edit the source artwork.
const variants = new Map<string, HTMLCanvasElement>();
const heads = [[.48, .29], [.50, .29], [.50, .27], [.50, .29], [.53, .30], [.50, .31], [.50, .31], [.50, .30]];
function rgb(hex: string) { return [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)); }

export function boatAppearance(atlas: HTMLImageElement, appearance?: Appearance): CanvasImageSource {
  if (!appearance) return atlas;
  const key = `${appearance.coat}:${appearance.hat}:${appearance.skin}`;
  const existing = variants.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = atlas.naturalWidth; canvas.height = atlas.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(atlas, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const coat = rgb(coatColors[appearance.coat]);
  const hat = rgb(hatColors[appearance.hat]);
  const skin = rgb(skinColors[appearance.skin]);
  const cellW = canvas.width / 4, cellH = canvas.height / 2;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (pixels.data[i + 3] < 170) continue;
    const cell = Math.floor(y / cellH) * 4 + Math.floor(x / cellW);
    const px = (x % cellW) / cellW, py = (y % cellH) / cellH;
    const [hx, hy] = heads[cell];
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    let tint: number[] | null = null;
    let base = 90;
    if (((px - hx) / .085) ** 2 + ((py - hy) / .055) ** 2 < 1) tint = hat;
    else if (((px - .50) / .15) ** 2 + ((py - .45) / .17) ** 2 < 1 && g > r * .88 && g > b * 1.12) tint = coat;
    else if (px > .34 && px < .65 && py > .34 && py < .57 && r > g * 1.25 && g > b * 1.2) { tint = skin; base = 140; }
    if (!tint) continue;
    const light = (r * .3 + g * .59 + b * .11) / base;
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.min(255, tint[channel] * light);
  }
  ctx.putImageData(pixels, 0, 0);
  if (variants.size >= 24) variants.delete(variants.keys().next().value!);
  variants.set(key, canvas);
  return canvas;
}
