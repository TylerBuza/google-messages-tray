'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findChrome } = require('../src/chrome-host');
test('finds installed Chrome rather than using an embedded browser', () => {
  const chrome = findChrome();
  assert.ok(chrome && fs.existsSync(chrome));
  assert.match(chrome, /Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/i);
});
test('reports Chrome missing when no install paths are available', () => {
  assert.equal(findChrome({}), undefined);
});
