'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { addUnreadBadge, addLowBatteryBadge, addTrayIndicators } = require('../src/tray-badge');

test('draws an opaque red dot in the top-right without changing the original icon', () => {
  const original = Buffer.alloc(32 * 32 * 4);
  const badged = addUnreadBadge(original, 32, 32);
  const center = (7 * 32 + 24) * 4;
  assert.deepEqual([...badged.subarray(center, center + 4)], [76, 65, 244, 255]);
  assert.deepEqual([...badged.subarray((28 * 32 + 4) * 4, (28 * 32 + 4) * 4 + 4)], [0, 0, 0, 0]);
  assert.ok(original.every(value => value === 0));
});
test('keeps unaffected pixels and produces partially covered antialiased edges', () => {
  const original = Buffer.alloc(32 * 32 * 4, 255);
  const badged = addUnreadBadge(original, 32, 32);
  assert.deepEqual([...badged.subarray(0, 4)], [255, 255, 255, 255]);
  assert.ok(badged.some(value => value > 0 && value < 255));
});
test('rejects invalid image sizes', () => {
  assert.throws(() => addUnreadBadge(Buffer.alloc(4), 32, 32), /Invalid tray bitmap/);
  assert.throws(() => addUnreadBadge(Buffer.alloc(0), 0, 0), /Invalid tray bitmap/);
});
test('phone battery is an amber glyph in the bottom-left, opposite the unread dot', () => {
  const original = Buffer.alloc(32 * 32 * 4);
  const battery = addLowBatteryBadge(original, 32, 32);
  const at = (x, y) => [...battery.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
  assert.deepEqual(at(7, 24), [63, 192, 250, 255]);
  assert.deepEqual(at(3, 24), [40, 27, 21, 255]);
  assert.deepEqual(at(24, 7), [0, 0, 0, 0]);
  assert.ok(original.every(value => value === 0));
});
test('both indicators coexist and clearing either preserves the other', () => {
  const original = Buffer.alloc(32 * 32 * 4);
  const both = addTrayIndicators(original, 32, 32, { unread: true, lowBattery: true });
  const red = addTrayIndicators(original, 32, 32, { unread: true });
  const battery = addTrayIndicators(original, 32, 32, { lowBattery: true });
  const at = (image, x, y) => [...image.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
  assert.deepEqual(at(both, 24, 7), at(red, 24, 7));
  assert.deepEqual(at(both, 7, 24), at(battery, 7, 24));
  assert.deepEqual(at(red, 7, 24), [0, 0, 0, 0]);
  assert.deepEqual(at(battery, 24, 7), [0, 0, 0, 0]);
  assert.deepEqual(addTrayIndicators(original, 32, 32), original);
});
test('battery compositing rejects invalid buffers', () => {
  assert.throws(() => addLowBatteryBadge(Buffer.alloc(4), 32, 32), /Invalid tray bitmap/);
});
