'use strict';
let currentRevision;
function reportSize() {
  if (currentRevision !== undefined) window.popup.resize(Math.ceil(document.body.getBoundingClientRect().height), currentRevision);
}
window.popup.onMessage(data => {
  currentRevision = data.revision;
  document.getElementById('sender').textContent = data.title;
  document.getElementById('body').textContent = data.body;
  const copy = document.getElementById('copy');
  copy.hidden = !data.code;
  copy.textContent = data.code ? `Copy ${data.code}` : 'Copy code';
  reportSize();
});
new ResizeObserver(reportSize).observe(document.body);
document.getElementById('copy').onclick = async () => {
  const revision = currentRevision;
  const result = await window.popup.copy(revision);
  if (revision === currentRevision) document.getElementById('copy').textContent = result ? 'Copied ✓' : 'Could not copy';
};
document.getElementById('dismiss').onclick = () => window.popup.close();
document.getElementById('open').onclick = () => window.popup.open();
document.getElementById('message').onclick = () => window.popup.open();
document.addEventListener('mouseenter', () => window.popup.hover(true));
document.addEventListener('mouseleave', () => window.popup.hover(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.popup.close(); });
