# Positioning and launch copy

## Product position

**Category:** unofficial Google Messages desktop tray companion for Windows.

**Core audience:** Android + Windows users who work at a keyboard and regularly receive SMS sign-in/verification codes. Secondary audience: people who want Messages available without another visible browser tab.

**Differentiator:** not simply a web wrapper. The useful workflow is incoming text → desktop popup → explicit Copy code → paste into the service you are already using, with the Messages window tucked away.

**Tagline:** Your texts in the tray. Your verification codes, one click away.

**Search-friendly title:** Google Messages Tray for Windows — Desktop Notifications & OTP Copy.

**Repository slug:** `google-messages-tray`.

**Visual assets:** `assets/icon.png` / `assets/icon.ico` are the original app mark. `docs/images/social-preview.png` is a 1280×640 share image with a fictional notification. It can be uploaded in GitHub repository Settings → Social preview. Regenerate it with `python scripts/generate-social.py` after `npm run demo` (optional Pillow dependency).

**Relevant search phrases:** Google Messages for Windows, Google Messages system tray, copy SMS verification code on PC, Android SMS desktop notifications, OTP copy Windows. Use them naturally; do not keyword-stuff or imply Google endorsement.

## Short description

An unofficial, open-source Windows tray app for Google Messages. Hide the Messages window, get desktop text popups, and copy detected verification codes with one click. Uses installed Chrome and a separate profile; no browser extension or app subscription.

## Suggested announcement

> I built Google Messages Tray because I was tired of finding a browser tab just to copy a sign-in code.
>
> It keeps Google Messages in the Windows tray, shows incoming-text popups, and adds a Copy button when it recognizes a numeric verification code. Clicking X hides the window; double-clicking the tray brings it back.
>
> It's open source (MIT), portable, and uses installed Chrome with a separate profile. No app analytics or message-forwarding server. It's also an unofficial public beta: Google site changes can break detection, and the Windows EXE is currently unsigned.
>
> Source and download: https://github.com/TylerBuza/google-messages-tray
>
> Feedback on real-world notification compatibility is welcome. Please use fictional texts when reporting bugs.

## Useful next steps (not automatically posted)

1. Gather a few real-world compatibility reports before promoting widely. Verify SMS arrival, Copy, X-to-tray, lock handling, and that normal Chrome windows are unaffected.
2. Record a short demo using a fictional message: popup → Copy → paste into a harmless local text field → X → tray restore. Never show a real account, phone number, or OTP.
3. Share where self-promotion is permitted: a relevant Windows/Android community, a personal GitHub/social post, or a Show HN-style post once the workflow is reliable. Disclose that you made it. Do not spam support threads.
4. Ask for concrete compatibility feedback, not stars. Use GitHub issues and releases to document limitations and fixes.
5. Prioritize notification reliability, memory footprint, code signing, and local-debugging security before app-store distribution or broad claims.

## Do not claim

- Official Google app, endorsed by Google, or a way around Google's sign-in controls.
- Guaranteed SMS/OTP delivery, universal 2FA support, or improved SMS security.
- Native Windows toast history / Do Not Disturb integration.
- Zero network traffic, zero resource use, end-to-end privacy beyond Google's behavior, or protection from other local processes.
- Signed installer, auto-updater, cross-platform support, or features not shipped.
