'use strict';

// Conservative fallback for Google's conversation-list UI. Never click a chat.
// The first snapshot (including old unread texts) is baseline, not a notification.
function createWatcher(document, notify) {
  let baseline = false;
  const seen = new Map();
  const selector = 'mws-conversation-list-item, mw-conversation-list-item';
  function scan() {
    const rows = [...document.querySelectorAll(selector)];
    if (!rows.length) return;
    for (const row of rows) {
      const link = row.querySelector('a[href*="/conversations/"]');
      const id = link?.getAttribute('href') || row.getAttribute('data-conversation-id');
      if (!id) continue;
      const name = row.querySelector('.name, .conversation-name, [data-e2e-conversation-name]')?.textContent?.trim() || 'New message';
      const body = row.querySelector('.snippet-text, .snippet, [data-e2e-conversation-snippet]')?.textContent?.trim();
      if (!body) continue;
      const unread = row.matches('.unread, [data-is-unread="true"]') ||
        Boolean(row.querySelector('.unread, .unread-indicator, .unread-dot, [data-is-unread="true"]'));
      const previous = seen.get(id);
      seen.set(id, body);
      if (baseline && unread && previous !== body && !/^You:\s/i.test(body)) notify({ title: name, body, source: 'list' });
    }
    baseline = true;
  }
  return { scan };
}

module.exports = { createWatcher };
