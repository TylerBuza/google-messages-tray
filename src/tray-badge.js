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

// An amber battery badge in the opposite (bottom-left) corner. Colors are BGRA;
// the dark battery outline/low-charge segment is drawn without platform fonts.
function addLowBatteryBadge(bitmap, width, height) {
  if (!Buffer.isBuffer(bitmap) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || bitmap.length !== width * height * 4) throw new Error('Invalid tray bitmap');
  const output = Buffer.from(bitmap), size = Math.min(width, height);
  const cx = size * 0.235, cy = height - size * 0.235;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let dark = 0, amber = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const dx = (x + (sx + 0.5) / 4 - cx) * 32 / size;
      const dy = (y + (sy + 0.5) / 4 - cy) * 32 / size;
      const distance = Math.hypot(dx, dy);
      if (distance > 7.5) continue;
      const shell = dx >= -4.4 && dx <= 3.1 && Math.abs(dy) <= 2.7;
      const hollow = dx > -3.3 && dx < 2 && Math.abs(dy) < 1.6;
      const terminal = dx >= 3.1 && dx <= 4.5 && Math.abs(dy) <= 1.3;
      const lowCharge = dx >= -3.3 && dx <= -1.8 && Math.abs(dy) <= 1.6;
      if (distance > 6.4 || (shell && !hollow) || terminal || lowCharge) dark++; else amber++;
    }
    if (!dark && !amber) continue;
    const i = (y * width + x) * 4, coverage = (dark + amber) / 16;
    const color = [amber * 63 + dark * 40, amber * 192 + dark * 27, amber * 250 + dark * 21];
    const originalAlpha = output[i + 3] / 255, alpha = coverage + originalAlpha * (1 - coverage);
    for (let channel = 0; channel < 3; channel++) output[i + channel] = Math.round((color[channel] / 16 + output[i + channel] * originalAlpha * (1 - coverage)) / alpha);
    output[i + 3] = Math.round(alpha * 255);
  }
  return output;
}

function addTrayIndicators(bitmap, width, height, { unread = false, lowBattery = false } = {}) {
  let output = Buffer.from(bitmap);
  if (unread) output = addUnreadBadge(output, width, height);
  if (lowBattery) output = addLowBatteryBadge(output, width, height);
  return output;
}

module.exports = { addUnreadBadge, addLowBatteryBadge, addTrayIndicators };
