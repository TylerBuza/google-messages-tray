'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { isCompanionUrl, getExternalUrl, installLinkRouting } = require('../src/links');
const { ChromeHost } = require('../src/chrome-host');

test('keeps only actual HTTPS Messages and Google sign-in origins internal', () => {
  assert.equal(isCompanionUrl('https://messages.google.com/web/conversations'), true);
  assert.equal(isCompanionUrl('https://accounts.google.com/ServiceLogin'), true);
  for (const url of ['https://messages.google.com.evil.example/', 'http://messages.google.com/', 'https://messages.google.com:8443/', 'https://user:pass@accounts.google.com/', 'not a url']) assert.equal(isCompanionUrl(url), false, url);
});
test('routes normal web URLs but never passes executable schemes or credentials to the OS', () => {
  assert.equal(getExternalUrl('https://example.org/a?b=1#c'), 'https://example.org/a?b=1#c');
  assert.equal(getExternalUrl('//example.org/', 'https://messages.google.com/'), 'https://example.org/');
  assert.equal(getExternalUrl('/web/conversations/1', 'https://messages.google.com/'), null);
  assert.equal(getExternalUrl('https://accounts.google.com/ServiceLogin'), null);
  for (const value of ['javascript:alert(1)', 'file:///C:/Windows/notepad.exe', 'data:text/html,test', 'cmd:calc', 'mailto:test@example.org', 'https://user:pass@example.org/', '', undefined]) assert.equal(getExternalUrl(value), null, String(value));
});
function fixture() {
  const dom = new JSDOM('<a id="external" href="https://example.org/test" target="_blank"><span>Example link</span></a><a id="internal" href="/web/conversations/test">Conversation</a>', { url: 'https://messages.google.com/web/conversations', runScripts: 'outside-only' });
  const external = [], native = [];
  dom.window.__messagesTrayExternal = async url => { external.push(url); };
  dom.window.open = (...args) => { native.push(args); return 'native-window'; };
  dom.window.eval(`(() => { const isCompanionUrl = ${isCompanionUrl.toString()}; const getExternalUrl = ${getExternalUrl.toString()}; (${installLinkRouting.toString()})(); })()`);
  return { dom, external, native };
}
test('intercepts normal, modified, and middle clicks on external links', () => {
  const { dom, external } = fixture();
  for (const options of [{ type: 'click', button: 0 }, { type: 'click', button: 0, ctrlKey: true }, { type: 'auxclick', button: 1 }]) {
    const event = new dom.window.MouseEvent(options.type, { bubbles: true, cancelable: true, ...options });
    dom.window.document.querySelector('#external span').dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  assert.deepEqual(external, ['https://example.org/test', 'https://example.org/test', 'https://example.org/test']);
  assert.equal(dom.window.location.pathname, '/web/conversations');
  dom.window.close();
});
test('leaves internal link events and Google sign-in windows alone', () => {
  const { dom, external, native } = fixture();
  let internalWasPrevented;
  dom.window.document.addEventListener('click', event => { internalWasPrevented = event.defaultPrevented; event.preventDefault(); });
  dom.window.document.querySelector('#internal').dispatchEvent(new dom.window.MouseEvent('click', { button: 0, bubbles: true, cancelable: true }));
  assert.equal(internalWasPrevented, false);
  assert.equal(dom.window.open('https://accounts.google.com/ServiceLogin'), 'native-window');
  assert.equal(native.length, 1); assert.equal(external.length, 0);
  dom.window.close();
});
test('routes window.open web links without creating a dedicated-profile tab', () => {
  const { dom, external, native } = fixture();
  assert.equal(dom.window.open('https://example.org/new-window'), null);
  assert.deepEqual(external, ['https://example.org/new-window']); assert.equal(native.length, 0);
  dom.window.close();
});
test('default-browser callback validates source, safe URL, and duplicate deliveries', async () => {
  const opened = [];
  const host = new ChromeHost({ onExternalLink: async url => { opened.push(url); } });
  host.page = { url: () => 'https://messages.google.com/web/conversations' };
  await host.openExternal('https://example.org/test'); await host.openExternal('https://example.org/test');
  await host.openExternal('file:///C:/Windows/notepad.exe');
  host.page = { url: () => 'https://untrusted.example/' };
  await host.openExternal('https://example.org/another');
  assert.deepEqual(opened, ['https://example.org/test']);
});
