'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function fixture(copy) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../src/popup.html'), 'utf8'), { runScripts: 'outside-only' });
  let receive;
  const sizes = [];
  dom.window.ResizeObserver = class { observe() {} };
  dom.window.document.body.getBoundingClientRect = () => ({ height: 151.5 });
  dom.window.popup = { onMessage: handler => { receive = handler; }, resize: (...args) => sizes.push(args), copy, open() {}, close() {}, hover() {} };
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../src/popup.js'), 'utf8'));
  return { dom, sizes, receive: data => receive(data) };
}
test('reports the actual content height and payload revision, including messages without codes', () => {
  const { dom, sizes, receive } = fixture(async () => true);
  receive({ title: 'Example', body: 'Fictional message', code: null, revision: 7 });
  assert.deepEqual(sizes, [[152, 7]]);
  assert.equal(dom.window.document.getElementById('copy').hidden, true);
  dom.window.close();
});
test('a delayed Copy response cannot overwrite a newer verification code button', async () => {
  let finishCopy; const revisions = [];
  const { dom, receive } = fixture(revision => { revisions.push(revision); return new Promise(resolve => { finishCopy = resolve; }); });
  receive({ title: 'Example', body: 'Code 123456', code: '123456', revision: 1 });
  const pending = dom.window.document.getElementById('copy').onclick();
  receive({ title: 'Example', body: 'Code 654321', code: '654321', revision: 2 });
  finishCopy(true); await pending;
  assert.deepEqual(revisions, [1]);
  assert.equal(dom.window.document.getElementById('copy').textContent, 'Copy 654321');
  dom.window.close();
});
