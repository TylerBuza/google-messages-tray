'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createWatcher } = require('../src/watcher');
test('baselines old unread messages and notifies new unread text without opening chats', () => {
  const dom = new JSDOM('<mws-conversation-list-item class="unread"><a href="/web/conversations/1"><span class="name">Bank</span><span class="snippet-text">Old code 123456</span></a></mws-conversation-list-item>');
  const { document } = dom.window;
  const messages = [], watcher = createWatcher(document, item => messages.push(item));
  watcher.scan(); assert.equal(messages.length, 0);
  document.querySelector('.snippet-text').textContent = 'Your code is 654321';
  watcher.scan(); watcher.scan();
  assert.deepEqual(messages, [{ title: 'Bank', body: 'Your code is 654321', source: 'list' }]);
  document.querySelector('mws-conversation-list-item').className = '';
  document.querySelector('.snippet-text').textContent = 'Read elsewhere';
  watcher.scan(); assert.equal(messages.length, 1);
  document.querySelector('mws-conversation-list-item').className = 'unread';
  document.querySelector('.snippet-text').textContent = 'You: outgoing text';
  watcher.scan(); assert.equal(messages.length, 1);
});
test('waits for delayed list load and picks up new conversations after baseline', () => {
  const { document } = new JSDOM('<main></main>').window;
  const messages = [], watcher = createWatcher(document, item => messages.push(item));
  watcher.scan();
  document.querySelector('main').innerHTML = '<mws-conversation-list-item class="unread"><a href="/web/conversations/1"><span class="snippet-text">Old text</span></a></mws-conversation-list-item>';
  watcher.scan(); assert.equal(messages.length, 0);
  document.querySelector('main').insertAdjacentHTML('beforeend', '<mws-conversation-list-item class="unread"><a href="/web/conversations/2"><span class="name">Friend</span><span class="snippet-text">Hello</span></a></mws-conversation-list-item>');
  watcher.scan(); assert.equal(messages.length, 1);
});
