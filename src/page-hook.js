'use strict';

// Runs in the remote page's MAIN world. No Node APIs or app bridge are exposed.
// Capture Google's own notification text rather than opening/marking chats read.
function installNotificationHook() {
  if (window.__messagesTrayHook) return;
  window.__messagesTrayHook = true;
  const emit = (title, options = {}) => {
    window.postMessage({ type: 'messages-tray-notification', title: String(title || 'New message'),
      body: String(options.body || ''), tag: String(options.tag || '') }, location.origin);
  };
  class TrayNotification extends EventTarget {
    static get permission() { return 'granted'; }
    static requestPermission(callback) {
      if (typeof callback === 'function') callback('granted');
      return Promise.resolve('granted');
    }
    static get maxActions() { return 2; }
    constructor(title, options = {}) {
      super();
      this.title = title; this.body = options.body || ''; this.tag = options.tag || '';
      emit(title, options);
      setTimeout(() => { this.dispatchEvent(new Event('show')); this.onshow?.(new Event('show')); }, 0);
    }
    close() { this.dispatchEvent(new Event('close')); this.onclose?.(new Event('close')); }
  }
  Object.defineProperty(window, 'Notification', { configurable: true, value: TrayNotification });
  // Some versions of Messages route notifications through a service worker.
  if (window.ServiceWorkerRegistration) {
    ServiceWorkerRegistration.prototype.showNotification = function(title, options) {
      emit(title, options); return Promise.resolve();
    };
  }
}

module.exports = { installNotificationHook };
