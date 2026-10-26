'use strict';

// Conservative fallback for Google's conversation-list UI. Never click a chat.
// The first snapshot (including old unread texts) is baseline, not a notification.
function createWatcher(document, notify, onUnreadChange = () => {}) {
  let baseline = false;
  const seen = new Map();
  // Remember observed rows when Google's virtual list scrolls them out of the DOM.
  const unreadSeen = new Map();
  let lastUnread;
  const selector = 'mws-conversation-list-item, mw-conversation-list-item';
  function reportUnread(count) {
    if (count !== lastUnread) { lastUnread = count; onUnreadChange(count); }
  }
  function scan() {
    const rows = [...document.querySelectorAll(selector)];
    if (!rows.length) {
      if (document.querySelector('mws-conversations-list, mw-conversations-list')) {
        unreadSeen.clear(); reportUnread(0);
      } else reportUnread(null);
      return;
    }
    for (const row of rows) {
      const link = row.querySelector('a[href*="/conversations/"]');
      const id = link?.getAttribute('href') || row.getAttribute('data-conversation-id');
      if (!id) continue;
      const flagSelector = '[data-e2e-is-unread], [data-is-unread]';
      const flag = row.matches(flagSelector) ? row : row.querySelector(flagSelector);
      const explicit = flag?.getAttribute('data-e2e-is-unread') ?? flag?.getAttribute('data-is-unread');
      const unread = explicit === 'true' || (explicit !== 'false' && (
        row.matches('.unread') || Boolean(row.querySelector('.unread, .unread-indicator, .unread-dot'))));
      unreadSeen.set(id, unread);
      const name = row.querySelector('.name, .conversation-name, [data-e2e-conversation-name]')?.textContent?.trim() || 'New message';
      const body = row.querySelector('.snippet-text, .snippet, [data-e2e-conversation-snippet]')?.textContent?.trim();
      if (!body) continue;
      const previous = seen.get(id);
      seen.set(id, body);
      if (baseline && unread && previous !== body && !/^You:\s/i.test(body)) notify({ title: name, body, source: 'list' });
    }
    reportUnread([...unreadSeen.values()].filter(Boolean).length);
    baseline = true;
  }
  return { scan };
}

module.exports = { createWatcher };
