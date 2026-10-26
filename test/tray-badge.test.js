'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { addUnreadBadge } = require('../src/tray-badge');

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
