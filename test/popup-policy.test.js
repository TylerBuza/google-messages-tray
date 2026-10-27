'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { choosePopupSlot, detachPopup, stackPopupBounds } = require('../src/popup-policy');

test('a 10,000-message burst reuses at most three popup slots', () => {
  const popups = new Map(); let created = 0;
  for (let i = 0; i < 10000; i++) {
    const title = `Fictional chat ${i % 7}`;
    const slot = choosePopupSlot(popups, title);
    if (slot.action === 'create') {
      const id = ++created; popups.set(id, { id, data: { title }, hovered: false });
    } else {
      assert.equal(slot.action, 'reuse');
      popups.delete(slot.popup.id); slot.popup.data = { title }; popups.set(slot.popup.id, slot.popup);
    }
    assert.ok(popups.size <= 3);
  }
  assert.equal(created, 3);
});
test('same-chat bursts coalesce and hovered messages are deferred instead of changing under the pointer', () => {
  const popup = { id: 1, data: { title: 'Example chat' }, hovered: false };
  const popups = new Map([[1, popup]]);
  assert.deepEqual(choosePopupSlot(popups, 'Example chat'), { action: 'reuse', popup });
  popup.hovered = true;
  assert.deepEqual(choosePopupSlot(popups, 'Example chat'), { action: 'defer', popup });
  assert.equal(choosePopupSlot(popups, 'Different chat').action, 'create');
});
test('full decks replace a non-hovered slot, never an active hovered code', () => {
  const values = [1, 2, 3].map(id => ({ id, data: { title: `Chat ${id}` }, hovered: id === 1 }));
  const popups = new Map(values.map(popup => [popup.id, popup]));
  assert.equal(choosePopupSlot(popups, 'New chat').popup.id, 2);
  values.forEach(popup => { popup.hovered = true; });
  assert.equal(choosePopupSlot(popups, 'New chat').action, 'skip');
});
test('retirement shrinks the map before an asynchronous close callback', async () => {
  const popup = { id: 1, data: { title: 'Example' } };
  const popups = new Map([[1, popup]]);
  let finishClose;
  const closed = new Promise(resolve => { finishClose = resolve; });
  detachPopup(popups, 1, () => { assert.equal(popups.size, 0); queueMicrotask(finishClose); });
  assert.equal(popup.closing, true); assert.equal(popups.size, 0);
  assert.equal(detachPopup(popups, 1), null);
  await closed;
});
test('stacks actual popup heights without fixed-height gaps', () => {
  assert.deepEqual(stackPopupBounds([{ width: 380, height: 142 }, { width: 380, height: 184 }], { x: 100, y: 50, width: 1200, height: 900 }), [
    { x: 904, y: 792, width: 380, height: 142 },
    { x: 904, y: 596, width: 380, height: 184 }
  ]);
});
