'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findChrome, ChromeHost, windowHelperPath } = require('../src/chrome-host');
test('finds installed Chrome rather than using an embedded browser', () => {
  const chrome = findChrome();
  assert.ok(chrome && fs.existsSync(chrome));
  assert.match(chrome, /Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/i);
});
test('reports Chrome missing when no install paths are available', () => {
  assert.equal(findChrome({}), undefined);
});
test('explicit restore activates the Chrome page before the native foreground request', async () => {
  const calls = [];
  const host = new ChromeHost({});
  host.page = { isClosed: () => false, bringToFront: async () => { calls.push('activate-page'); } };
  host.controller = { command: async value => { calls.push(value); return { foreground: true }; } };
  assert.deepEqual(await host.show(), { foreground: true });
  assert.deepEqual(calls, ['activate-page', 'show']);
});
test('native restore still runs if Chrome page activation fails', async () => {
  const calls = [];
  const host = new ChromeHost({});
  host.page = { isClosed: () => false, bringToFront: async () => { throw new Error('Temporary Chrome activation failure'); } };
  host.controller = { command: async value => { calls.push(value); return { foreground: true }; } };
  await host.show();
  assert.deepEqual(calls, ['show']);
});
test('Windows helper is a real bundled script, not an oversized encoded command', () => {
  assert.ok(fs.existsSync(windowHelperPath()));
  assert.match(windowHelperPath(), /src[\\/]window-helper\.ps1$/);
});
test('packaged helper resolves outside ASAR so PowerShell can load it', () => {
  const result = windowHelperPath('C:\\Example\\resources\\app.asar\\src');
  assert.equal(result, 'C:\\Example\\resources\\app.asar.unpacked\\src\\window-helper.ps1');
});
