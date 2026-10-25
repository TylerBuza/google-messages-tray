# Privacy and local security

Messages Tray is a local desktop companion, not a messaging provider. Google Messages and Google Chrome retain their own network behavior, privacy policies, and account controls.

## What the companion reads and keeps

- It reads notification titles/bodies and, as a fallback, visible unread conversation snippets in its dedicated Google Messages page.
- Notification contents and detected verification codes are held in memory to display popups and avoid immediate duplicates. There is no message database, message log, analytics, advertising SDK, or app-operated forwarding server.
- Copying happens only after you click Copy or select the last-code tray shortcut. It does not read or monitor the clipboard. The last-code shortcut expires after five minutes. Popup hover can extend a popup's lifetime.
- Windows clipboard history and cloud clipboard synchronization are outside this app's control. A copied verification code can remain there after the app exits.
- The companion suppresses its own popups on Windows lock and clears its last-code shortcut. It cannot promise that Chrome's native/service-worker notifications will never appear.

## Dedicated Chrome profile

Chrome stores authentication, pairing, cache, and browser data under:

```text
%APPDATA%\messages-tray\chrome-profile
```

This is separate from your normal Chrome profile. Cookies are not imported from it. Treat the dedicated profile as sensitive: someone with access to it or your running session may be able to access messages. Unpair through Google's Device pairing controls before handing over a computer. Quitting/deleting the EXE does not delete the profile or necessarily revoke pairing.

## Local debugging interface

The companion controls **only its own Chrome instance** using a random loopback debugging port bound to `127.0.0.1`. It does not intentionally expose a service on your LAN or operate an external backend. The Chrome debugging interface is **not an authenticated security boundary** against other local programs or users that can reach the port. Such programs may be able to inspect/control the dedicated browser profile and read messages.

Use only on a trusted PC. Do not use the dedicated profile for banking, email, or unrelated browsing. Quit the app when not needed. Do not forward or expose the debugging port. Shutdown requests close this dedicated Chrome instance; they do not close your normal Chrome windows.

## X-to-tray helper

A bundled PowerShell/C# Windows helper installs a low-level mouse hook while the app runs. It ignores mouse movement and checks left-button events against the companion's Chrome process and native caption-button bounds. It swallows that window's X click to hide the window and taskbar entry instead of closing Chrome. It records no mouse history, sends no input data to a server, and installs no keyboard hook. Windows removes the hook when its helper exits.

## External connections

Google Chrome / Google Messages connect to Google normally. The companion adds no telemetry, remote OTP processing, or automatic update checker. GitHub-hosted documentation images/badges and links can create requests when viewed in a browser; npm/build tools download dependencies when building. The synthetic smoke test fulfills its test page request locally, but Chrome itself may still make background connections.

## Practical precautions

- Keep Windows, Chrome, Electron, and dependencies updated.
- Use Windows lock and a protected user account. Do not treat this app as a secure vault for 2FA.
- Do not publish your profile, cookies, pairing artifacts, real texts, or real OTPs in an issue.
- Prefer phishing-resistant passkeys/security keys when your service supports them. This app improves convenience; it does not improve SMS authentication security.
