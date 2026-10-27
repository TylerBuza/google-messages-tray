'use strict';

function choosePopupSlot(popups, title, limit = 3) {
  const same = [...popups.values()].find(popup => !popup.closing && popup.data.title === title);
  if (same) return { action: same.hovered ? 'defer' : 'reuse', popup: same };
  if (popups.size < limit) return { action: 'create' };
  const oldest = [...popups.values()].find(popup => !popup.closing && !popup.hovered);
  return oldest ? { action: 'reuse', popup: oldest } : { action: 'skip' };
}

// Remove synchronously BEFORE invoking close: Electron's closed event can arrive
// later. Never wait for an asynchronous close to shrink a collection in a loop.
function detachPopup(popups, id, close = () => {}) {
  const popup = popups.get(id);
  if (!popup) return null;
  popups.delete(id);
  popup.closing = true;
  close(popup);
  return popup;
}

function stackPopupBounds(sizes, area, gap = 12, margin = 16) {
  let bottom = area.y + area.height - margin;
  return sizes.map(size => {
    const bounds = { x: area.x + area.width - size.width - margin, y: bottom - size.height, width: size.width, height: size.height };
    bottom = bounds.y - gap;
    return bounds;
  });
}

module.exports = { choosePopupSlot, detachPopup, stackPopupBounds };
