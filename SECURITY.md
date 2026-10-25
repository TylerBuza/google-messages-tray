# Security policy

This is an early, best-effort desktop companion. Only the latest release receives fixes; there is no guaranteed response or patch timeline.

## Report privately

Please use **GitHub → Security → Report a vulnerability** on this repository for exploitable security issues:

https://github.com/TylerBuza/google-messages-tray/security/advisories/new

Do not post real texts, OTPs, cookies, paired profiles, or account credentials. Include a minimal synthetic reproduction, affected version, Windows/Chrome versions, and impact. If private reporting is unavailable, open an issue asking for a private reporting channel **without publishing exploit details**.

Normal notification bugs and compatibility issues belong in public issues with synthetic examples.

## Known trust boundaries

- A random loopback Chrome debugging port is not protection from other local software/users. See [PRIVACY.md](PRIVACY.md).
- The dedicated Chrome profile contains sensitive session/pairing information.
- Page-supplied notification text must remain untrusted. Local popups render it as text, not HTML; remote pages receive no Node.js bridge.
- The Windows mouse helper must remain scoped to this app's Chrome PID and close-button hit area. It must never record input or affect unrelated applications.
- Windows clipboard history/cloud clipboard can retain copied codes. The app does not secure or erase the clipboard.
- Releases are unsigned. Checksums alone do not establish publisher authenticity.
