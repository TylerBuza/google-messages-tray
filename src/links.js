'use strict';

function isCompanionUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      ['https://messages.google.com', 'https://accounts.google.com'].includes(url.origin);
  } catch { return false; }
}

function getExternalUrl(value, base) {
  if (typeof value !== 'string' || !value.trim() || value.length > 16384) return null;
  try {
    const url = new URL(value, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return isCompanionUrl(url.href) ? null : url.href;
  } catch { return null; }
}

// Only the Messages top frame gets link interception. Authentication remains
// normal Chrome navigation; the bridge accepts safe HTTP(S) URLs, never commands.
function installLinkRouting() {
  if (location.origin !== 'https://messages.google.com' || window.top !== window) return;
  const route = url => window.__messagesTrayExternal(url).catch(() => {});
  const onClick = event => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (event.type === 'click' && event.button !== 0) return;
    const anchor = event.composedPath().find(node => node?.matches?.('a[href]'));
    if (!anchor) return;
    const external = getExternalUrl(anchor.href, location.href);
    if (!external) return;
    event.preventDefault(); event.stopImmediatePropagation(); route(external);
  };
  window.addEventListener('click', onClick, true);
  window.addEventListener('auxclick', onClick, true);
  const nativeOpen = window.open;
  window.open = function(url, ...args) {
    const external = getExternalUrl(url, location.href);
    if (external) { route(external); return null; }
    return nativeOpen.call(this, url, ...args);
  };
}

module.exports = { isCompanionUrl, getExternalUrl, installLinkRouting };
