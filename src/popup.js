'use strict';
window.popup.onMessage(data => {
  document.getElementById('sender').textContent = data.title;
  document.getElementById('body').textContent = data.body;
  const copy = document.getElementById('copy');
  copy.hidden = !data.code;
  copy.textContent = data.code ? `Copy ${data.code}` : 'Copy code';
});
document.getElementById('copy').onclick = async () => {
  const result = await window.popup.copy();
  document.getElementById('copy').textContent = result ? 'Copied ✓' : 'Could not copy';
};
document.getElementById('dismiss').onclick = () => window.popup.close();
document.getElementById('open').onclick = () => window.popup.open();
document.getElementById('message').onclick = () => window.popup.open();
document.addEventListener('mouseenter', () => window.popup.hover(true));
document.addEventListener('mouseleave', () => window.popup.hover(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.popup.close(); });
