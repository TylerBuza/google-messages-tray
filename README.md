<p><img src="assets/icon.png" width="80" height="80" alt="Messages Tray logo: a blue speech bubble on a dark rounded square" /></p>

# Google Messages Tray for Windows

**Your texts in the tray. Your verification codes, one click away.**

[![Download for Windows](https://img.shields.io/badge/Download-Windows%20x64-8db6ff?logo=windows)](https://github.com/TylerBuza/google-messages-tray/releases/latest)
[![MIT license](https://img.shields.io/github/license/TylerBuza/google-messages-tray)](LICENSE)
[![Build](https://github.com/TylerBuza/google-messages-tray/actions/workflows/ci.yml/badge.svg)](https://github.com/TylerBuza/google-messages-tray/actions/workflows/ci.yml)
[![Public beta](https://img.shields.io/badge/status-public%20beta-f0c674)](#known-limitations)

**Messages Tray** is an unofficial, open-source **Google Messages desktop companion for Windows**. Keep your Android phone's texts available in the system tray—without a tab in your normal Chrome window—and copy detected SMS verification codes directly from desktop notification popups.

<p align="center">
  <img src="docs/images/notification-demo.png" width="380" alt="Google Messages Tray desktop popup showing a fictional verification text and a Copy 123456 button" />
  <br /><sub>Actual app popup, using a fictional sender and test code. No real messages shown.</sub>
</p>

## Why use it?

- **No regular Chrome tab.** Messages runs in a separate Chrome app window that hides completely to the tray.
- **Copy verification codes.** Detected numeric OTP / 2FA codes get a one-click **Copy** button.
- **Click X, keep receiving.** The app's close button hides the window instead of shutting down Messages.
- **Open only when you need it.** Double-click the tray icon to read or reply in Google's familiar web interface.
- **Portable Windows app.** No browser extension, administrator access, or installer required. Starting with Windows is optional.
- **Local companion, open source.** No app analytics, message-forwarding service, or subscription. Google Messages itself still connects to Google.

Built for Android users who work on Windows and are tired of reaching for their phone—or hunting for a browser tab—every time a website sends a sign-in code.

## Download and get started

**[Download the latest Windows x64 EXE →](https://github.com/TylerBuza/google-messages-tray/releases/latest)**

Requires **Windows 10/11 x64**, installed **Google Chrome**, and an Android phone using Google Messages. This is a **public beta**, not an official Google product.

1. Download `Messages-Tray-<version>.exe` from **Releases** and keep it in a stable folder.
2. Run it. A separate Chrome app window opens for Google Messages.
3. Sign into Google and complete phone pairing. Your normal Chrome profile is not reused.
4. **Click X** or **Hide to tray**. The window and taskbar entry disappear; Messages keeps running.
5. Request a verification text. If its preview contains a recognized code, click **Copy [code]** in the popup.

**Double-click the tray icon** to open Messages again. Right-click it for a demo notification, pause, optional startup, or **Quit Messages Tray**. Windows may put the icon in the **^** overflow area.

> **Unsigned download:** Windows may show a SmartScreen warning. Releases are not code-signed. Check the published SHA-256 checksum, inspect the source, or build it yourself; do not run a binary you do not trust. A checksum verifies file integrity, not publisher identity or safety.

<details>
<summary>Upgrading from an earlier version</summary>

Quit the old version using its tray menu before launching the new EXE. Pairing stays in the same dedicated Chrome profile. If you enabled **Start with Windows**, disable it in the old version first, then enable it in the new version from its final file location. Existing browser data is not deleted during upgrades.

</details>

## What runs on your PC?

Messages Tray is a small-purpose Electron controller plus a **real, installed Chrome instance**, using a dedicated profile. Electron is used for the tray and notification UI—not for Google sign-in. Google still controls account access.

- Google's page notifications feed the companion's popups, with an unread-conversation-list fallback.
- A local Windows helper turns a mouse click on this app's X button into **hide to tray**. Other Chrome windows are not changed.
- Verification-code recognition runs locally. Copying is explicit; messages are not forwarded to an app server.
- The dedicated browser profile is sensitive. Chrome is controlled through a **loopback-only debugging port**, accessible to other software on your PC. See [Privacy & security](PRIVACY.md) before using it on a shared or untrusted computer.

There is no subscription, extension, or app backend. There **is** an Electron + Chrome memory footprint; this is not advertised as a lightweight replacement for a browser.

## Known limitations

- **Best-effort notification detection.** Google has no public Messages notification API for this use. Site changes, service-worker notifications, pairing issues, network interruptions, and sleep can interrupt or duplicate delivery. Do not rely on it as your only way to receive an important code.
- **Custom desktop popups, not Windows Notification Center toasts.** They last about 18 seconds, stack up to three, and pause while hovered. They do not enter notification history. Windows Do Not Disturb does not control them; use **Pause notifications** in the tray.
- **Numeric codes only:** 4–8 digits, including `123 456` and `123-456`. Detection is heuristic; check the code before using it. Alphanumeric codes or codes missing from Google's preview need manual copying.
- **Mouse X hides; Alt+F4 does not.** Keyboard Alt+F4 and Chrome's system-menu Close are not intercepted. Minimizing alone may leave a taskbar icon.
- Clicking a popup opens the existing Messages window, not necessarily the sender's thread. No conversations are automatically opened to fetch codes.
- An active, visible conversation can suppress Google's notifications. Hide the window for background use, and keep notifications enabled in Google's Messages settings.
- Locking Windows suppresses companion popups and clears the in-memory last-code shortcut. Suppressed texts are not replayed after unlock. Other site permissions are denied for the Messages origin.
- Subsequent launches start minimized, then hide; a brief taskbar flash is possible. The tray indicates that the app is running, not that your phone is connected.
- The release is unsigned and currently Windows x64 only. Google sign-in/phone pairing and real incoming SMS require a live user test; automated tests use synthetic messages.

Need help? See [troubleshooting](docs/TROUBLESHOOTING.md) or [report a bug](https://github.com/TylerBuza/google-messages-tray/issues/new/choose). **Never attach real verification codes, texts, pairing QR codes, cookies, or browser profiles.**

## Build from source

Requires Node.js 24+, npm, Windows, and installed Google Chrome.

```powershell
git clone https://github.com/TylerBuza/google-messages-tray.git
cd google-messages-tray
npm ci
npm test
npm start
```

```powershell
npm run build                  # portable EXE in release/
npm start -- --smoke-test      # synthetic Chrome → popup → X-to-tray integration test
npm run demo                   # regenerate the fictional-message screenshot
```

The smoke test uses a disposable Chrome profile and locally fulfilled page content. It tests code copying UI and the native X callback without moving the physical pointer, signing in, reading real texts, or modifying the clipboard. Chrome can still make its own background network requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture and test details.

## Contributing and security

Bug reports, reproducible Google DOM changes, notification compatibility improvements, and accessibility work are welcome. Read [Contributing](CONTRIBUTING.md), [Security policy](SECURITY.md), and [Privacy](PRIVACY.md).

**License:** [MIT](LICENSE). Google Messages and Google Chrome are trademarks of Google LLC. This independent project is not affiliated with, endorsed by, or supported by Google.
