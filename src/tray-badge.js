'use strict';

// Electron bitmap bytes are BGRA. Composite an antialiased red dot with a dark
// outline, without modifying the original icon or depending on a font renderer.
function addUnreadBadge(bitmap, width, height) {
  if (!Buffer.isBuffer(bitmap) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || bitmap.length !== width * height * 4) throw new Error('Invalid tray bitmap');
  const output = Buffer.from(bitmap);
  const size = Math.min(width, height);
  const cx = width - size * 0.23, cy = size * 0.23;
  const outer = size * 0.23, inner = size * 0.185;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let red = 0, border = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const distance = Math.hypot(x + (sx + 0.5) / 4 - cx, y + (sy + 0.5) / 4 - cy);
      if (distance <= inner) red++; else if (distance <= outer) border++;
    }
    if (!red && !border) continue;
    const i = (y * width + x) * 4;
    const coverage = (red + border) / 16;
    const color = [(red * 76 + border * 40), (red * 65 + border * 27), (red * 244 + border * 21)];
    const originalAlpha = output[i + 3] / 255;
    const alpha = coverage + originalAlpha * (1 - coverage);
    for (let channel = 0; channel < 3; channel++) {
      output[i + channel] = Math.round((color[channel] / 16 + output[i + channel] * originalAlpha * (1 - coverage)) / alpha);
    }
    output[i + 3] = Math.round(alpha * 255);
  }
  return output;
}

module.exports = { addUnreadBadge };
