'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { readPhoneBatteryWarning, createPhoneBatteryWatcher } = require('../src/phone-battery');

test('recognizes the actual Google Messages device warning without reading texts', () => {
  const { document } = new JSDOM('<mws-conversations-list></mws-conversations-list><mw-banner><mw-information-banner title="Phone battery low" content="Connect phone to a charger"></mw-information-banner></mw-banner>').window;
  assert.equal(readPhoneBatteryWarning(document), true);
});
test('clears immediately when the warning disappears, including dismissal', () => {
  const { document } = new JSDOM('<mw-banner><mw-information-banner title="Phone battery low"></mw-information-banner></mw-banner>').window;
  assert.equal(readPhoneBatteryWarning(document), true);
  document.querySelector('mw-information-banner').remove();
  assert.equal(readPhoneBatteryWarning(document), false);
});
test('ignores hidden banners and clears a charging/non-battery status banner', () => {
  const { document } = new JSDOM('<mw-banner><mw-information-banner title="Phone battery low"></mw-information-banner></mw-banner>').window;
  const banner = document.querySelector('mw-information-banner');
  banner.hidden = true; assert.equal(readPhoneBatteryWarning(document), false);
  banner.hidden = false; banner.parentElement.style.display = 'none'; assert.equal(readPhoneBatteryWarning(document), false);
  banner.parentElement.style.display = ''; banner.setAttribute('title', 'Phone is charging');
  assert.equal(readPhoneBatteryWarning(document), false);
});
test('ordinary SMS text and banners embedded inside a message never set the phone indicator', () => {
  const { document } = new JSDOM('<mws-conversations-list><mws-conversation-list-item><span class="snippet-text">Phone battery low</span></mws-conversation-list-item></mws-conversations-list><mws-message-wrapper><mw-information-banner title="Phone battery low"></mw-information-banner></mws-message-wrapper>').window;
  assert.equal(readPhoneBatteryWarning(document), false);
});
test('supports the warning title element and common English title variants', () => {
  for (const title of ["Your phone's battery is low", 'Your phone’s battery is low.', 'Phone battery is running low', 'Low phone battery']) {
    const { document } = new JSDOM('<mw-banner><mw-information-banner><h2 class="title"></h2></mw-information-banner></mw-banner>').window;
    document.querySelector('.title').textContent = title;
    assert.equal(readPhoneBatteryWarning(document), true, title);
  }
});
test('deduplicates state callbacks and never retains an old warning', () => {
  const { document } = new JSDOM('<mw-banner></mw-banner>').window;
  const states = [], watcher = createPhoneBatteryWatcher(document, state => states.push(state));
  watcher.scan(); watcher.scan();
  document.querySelector('mw-banner').innerHTML = '<mw-information-banner title="Phone battery low"></mw-information-banner>';
  watcher.scan(); watcher.scan();
  document.querySelector('mw-information-banner').remove(); watcher.scan();
  assert.deepEqual(states, [false, true, false]);
});
test('reports unavailable status for an unpaired/unloaded page rather than guessing phone charge', () => {
  const { document } = new JSDOM('<main>Pair your phone</main>').window;
  assert.equal(readPhoneBatteryWarning(document), null);
});
