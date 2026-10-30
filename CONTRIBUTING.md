# Contributing

Thanks for helping make Google Messages more convenient on Windows.

## Local setup

Use Windows 10/11 x64, Node.js 24+, npm, and installed Google Chrome.

```powershell
npm ci
npm test
npm start -- --smoke-test
npm start
```

Never commit actual texts, OTPs, Chrome profiles, pairing codes, `.env` files, local settings, or built executables. Use fictional messages in fixtures and screenshots.

## Architecture

- `src/main.js`: Electron tray, popup lifecycle, explicit clipboard writes, lock-screen handling.
- `src/chrome-host.js`: dedicated installed Chrome process, loopback CDP connection, origin-checked page bindings, page observers.
- `src/page-hook.js`: page-world notification capture.
- `src/watcher.js`: conservative unread-list fallback; initial contents are baselined.
- `src/codes.js`: numeric verification-code heuristics and short deduplication gate.
- `src/tray-badge.js`: local bitmap compositing for the unread red-dot tray badge.
- `src/phone-battery.js`: metadata-only observation of Google's device warning, excluding message/conversation content. Do not substitute the PC's battery API or infer an Android charge percentage.
- `src/links.js`: safe HTTP(S) URL classification and message-link routing to the Windows default browser.
- `src/popup-policy.js`: bounded popup admission, hover-safe coalescing, synchronous slot retirement, and variable-height stacking. Never loop waiting for Electron's asynchronous `closed` event.
- `src/window-helper.ps1`: native Windows window visibility and process-scoped X mouse-click handling.
- `src/popup.*`: sandboxed local notification UI. Render remote values using `textContent`, never HTML.

Do not change the internal `messages-tray` package/profile name casually: existing users' sign-in state depends on that profile location. Public branding uses the repository/README title instead.

The PowerShell helper is unpacked via `build.asarUnpack` and launched with `-File`; do not embed its entire C# source in the command line. Foreground activation must target only real companion Chrome app windows, release temporary thread-input attachments, and never leave the window permanently topmost or alter system-wide focus policy. Smoke coverage must check native foreground state, not visibility alone.

## Test expectations

`npm test` runs code-detection, deduplication, DOM-baseline, notification-shim, and Chrome-discovery tests. These synthetic tests do not establish that every live Google Messages version works.

`npm start -- --smoke-test` launches a disposable Chrome profile, fulfills its test page locally, checks the notification-to-Copy-button UI, verifies native close-button hit testing using the real mouse-hook callback with a synthetic HWND/input record, and verifies hide/restore without closing Chrome. The real pointer is not moved and clipboard contents are not changed. The report is written to `%TEMP%\messages-tray-tests\smoke-report.json`. Desktop focus is not required for the synthetic close test. No real Google sign-in is performed; Chrome itself may make background network requests.

Changes to Chrome lifecycle or native window handling also need a manual check: sign in/pair, receive a fictional incoming SMS, copy a test code, click X, restore from tray, confirm regular Chrome is unaffected, lock/unlock Windows, and quit. Do not publish sensitive account evidence.

## Build and docs

```powershell
npm run build
npm run demo
npm run demo:tray
```

The portable EXE goes to `release/` and is not signed. `demo:tray` renders the real normal/unread/phone-battery/combined icon bitmaps and a compact comparison strip for the README/release notes without reading a profile. The committed `assets/icon.ico` and `.png` can be regenerated with `python scripts/generate-icon.py` (optional developer dependency: Pillow). End users and normal builds do not need Python.

Keep README claims tied to implemented behavior. Avoid promises such as guaranteed notification delivery, zero network access, zero memory cost, or official Google support.
