'use strict';

// Read only Google's own device-status banner, never conversation snippets or
// message text. This follows the warning, not navigator.getBattery (the PC).
function readPhoneBatteryWarning(document) {
  const excluded = 'mws-message-wrapper,mw-message-wrapper,mws-conversation-list-item,mw-conversation-list-item,mws-conversation-snippet,mw-conversation-container,[contenteditable="true"]';
  const banners = [...document.querySelectorAll('mw-information-banner,mws-information-banner')];
  for (const banner of banners) {
    if (banner.closest(excluded)) continue;
    let visible = true;
    for (let node = banner; node && node.nodeType === 1; node = node.parentElement) {
      const style = document.defaultView?.getComputedStyle(node);
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style?.display === 'none' || ['hidden', 'collapse'].includes(style?.visibility)) { visible = false; break; }
    }
    if (!visible) continue;
    const title = (banner.getAttribute('title') || banner.querySelector('.title')?.textContent || '').trim();
    if (/^(?:(?:your\s+)?phone(?:['’]s)?\s+battery\s+(?:(?:is\s+)?(?:running\s+)?)low|(?:your\s+)?phone\s+(?:has\s+)?low\s+battery|low\s+phone\s+battery)[.!]?$/i.test(title)) return true;
  }
  return document.querySelector('mws-conversations-list,mw-conversations-list,mw-banner,mw-information-banner,mws-information-banner') ? false : null;
}

function createPhoneBatteryWatcher(document, onChange) {
  let previous;
  return { scan() {
    const state = readPhoneBatteryWarning(document);
    if (state !== previous) { previous = state; onChange(state); }
  } };
}

module.exports = { readPhoneBatteryWarning, createPhoneBatteryWatcher };
