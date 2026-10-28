'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createWatcher } = require('../src/watcher');
test('reports existing unread conversations immediately, without sending old-message popups', () => {
  const { document } = new JSDOM('<mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/1" data-e2e-is-unread="true"><span class="snippet-text">Old text</span></a></mws-conversation-list-item></mws-conversations-list>').window;
  const counts = [], messages = [];
  const watcher = createWatcher(document, message => messages.push(message), count => counts.push(count));
  watcher.scan(); watcher.scan();
  assert.deepEqual(counts, [1]); assert.equal(messages.length, 0);
  document.querySelector('a').setAttribute('data-e2e-is-unread', 'false');
  watcher.scan();
  assert.deepEqual(counts, [1, 0]);
});
test('tracks unread state even when a preview is absent, and explicit false overrides stale CSS', () => {
  const { document } = new JSDOM('<mws-conversation-list-item class="unread"><a href="/web/conversations/1" data-e2e-is-unread="false"></a></mws-conversation-list-item>').window;
  const counts = [];
  const watcher = createWatcher(document, () => {}, count => counts.push(count));
  watcher.scan();
  document.querySelector('a').setAttribute('data-e2e-is-unread', 'true'); watcher.scan();
  assert.deepEqual(counts, [0, 1]);
});
test('removed unread rows cannot keep the badge set when the remaining list is read', () => {
  const { document } = new JSDOM('<mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/1" data-e2e-is-unread="true"></a></mws-conversation-list-item><mws-conversation-list-item><a href="/web/conversations/2" data-e2e-is-unread="false"></a></mws-conversation-list-item></mws-conversations-list>').window;
  const counts = [];
  const watcher = createWatcher(document, () => {}, count => counts.push(count));
  watcher.scan();
  const unread = document.querySelector('mws-conversation-list-item'); unread.remove(); watcher.scan();
  assert.deepEqual(counts, [1, 0]);
  unread.querySelector('a').setAttribute('data-e2e-is-unread', 'false');
  document.querySelector('mws-conversations-list').appendChild(unread); watcher.scan();
  assert.deepEqual(counts, [1, 0]);
});
test('scrolling an unread row back into the current list restores the badge without replaying its text', () => {
  const { document } = new JSDOM('<mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/1" data-e2e-is-unread="true"><span class="snippet-text">Old fictional text</span></a></mws-conversation-list-item><mws-conversation-list-item><a href="/web/conversations/2" data-e2e-is-unread="false"></a></mws-conversation-list-item></mws-conversations-list>').window;
  const counts = [], messages = [];
  const watcher = createWatcher(document, item => messages.push(item), count => counts.push(count));
  watcher.scan();
  const unread = document.querySelector('mws-conversation-list-item'); unread.remove(); watcher.scan();
  document.querySelector('mws-conversations-list').appendChild(unread); watcher.scan();
  assert.deepEqual(counts, [1, 0, 1]); assert.equal(messages.length, 0);
});
test('unavailable and then rebuilt inbox does not resurrect a removed unread flag', () => {
  const { document } = new JSDOM('<main><mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/1" data-e2e-is-unread="true"></a></mws-conversation-list-item></mws-conversations-list></main>').window;
  const counts = [];
  const watcher = createWatcher(document, () => {}, count => counts.push(count));
  watcher.scan(); document.querySelector('main').innerHTML = ''; watcher.scan();
  document.querySelector('main').innerHTML = '<mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/2" data-e2e-is-unread="false"></a></mws-conversation-list-item></mws-conversations-list>';
  watcher.scan(); assert.deepEqual(counts, [1, null, 0]);
});
test('an empty loaded inbox clears a previously set badge', () => {
  const { document } = new JSDOM('<mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/1" data-e2e-is-unread="true"></a></mws-conversation-list-item></mws-conversations-list>').window;
  const counts = [];
  const watcher = createWatcher(document, () => {}, count => counts.push(count));
  watcher.scan(); document.querySelector('mws-conversation-list-item').remove(); watcher.scan();
  assert.deepEqual(counts, [1, 0]);
});
test('distinguishes an unavailable inbox from a loaded empty inbox', () => {
  const { document } = new JSDOM('<main></main>').window;
  const counts = [];
  const watcher = createWatcher(document, () => {}, count => counts.push(count));
  watcher.scan(); assert.deepEqual(counts, [null]);
  document.querySelector('main').innerHTML = '<mws-conversations-list></mws-conversations-list>';
  watcher.scan(); assert.deepEqual(counts, [null, 0]);
});
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
