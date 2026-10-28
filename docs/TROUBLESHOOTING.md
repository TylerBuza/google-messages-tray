# Troubleshooting

## I cannot find the tray icon

Look in Windows' **^** hidden-icons area. Double-click the speech-bubble icon to show Messages. Right-click it for Hide, Test popup, Pause, Reload, optional startup, and Quit.

## Google says this browser or app may not be secure

Use the latest release and installed Google Chrome. Sign-in uses real Chrome with a separate profile, not the embedded Electron popup renderer. Quit any older running companion from its tray menu first. This app cannot override Google's account policies. QR pairing is being retired by Google and is not a promised fallback. Report the failure with a redacted screenshot and version numbers, not credentials.

## Sign-in completed but I see no texts

Complete Google's phone-pairing steps in the app window. Confirm Google Messages is your phone's messaging app, your phone is online, and the web page says it is connected. Signing into Google alone does not prove pairing is complete.

## No notification appears

1. Use tray → **Test Copy code popup**. This tests the local popup, not SMS delivery.
2. Make sure notifications are not paused in the tray.
3. Keep Google's Messages notifications enabled and hide the window using X or Hide to tray.
4. Send a fictional test text from another phone. Check whether it arrives in Google's page.
5. If it arrives but the companion stays silent, try tray → **Reload Messages**. A Google UI/notification implementation change may need a code fix.

Network, pairing, service-worker notifications, active conversations, sleep, and Google's DOM can affect detection. The app is not a guaranteed OTP channel.

## The code was not recognized

Supported patterns are numeric 4–8 digit codes (including `123 456` / `123-456`) in messages discussing verification, login, security, or similar context. Alphanumeric codes and truncated previews require manual copying. Heuristics can also select the wrong number: verify before using. Report synthetic examples only.

## Red tray badge but no unread conversations

Update to v1.0.5 or later. Earlier versions could keep an old unread flag after a conversation disappeared from the loaded list. The badge now uses the current list snapshot rather than a history of unread rows. It does not mark texts read or clear the badge merely because you open the window. In an older version, tray → Reload Messages resets that cached badge state, but save any draft first.

## X / minimizing / closing

Mouse-clicking X hides this app's Chrome window. The Hide button and tray Hide command also work. Minimizing is not the same as hiding. Alt+F4/system-menu Close are not intercepted and may close the dedicated browser; double-click the tray icon to reopen it. Use **Quit Messages Tray** to exit cleanly.

If an older version opens Messages behind other windows, update to v1.0.4 or later. Explicit open actions now dismiss pending popup previews, select the Messages page, and request native foreground activation. Chrome tooltips are excluded from restore/focus handling. This does not make Messages permanently always-on-top or make incoming notifications steal focus.

## Links and browser profiles

Web links clicked in messages open through Windows' default browser, not the dedicated Messages profile. If Chrome is your Windows default, this uses your normal Chrome instance/profile selection; the companion does not choose between multiple normal Chrome profiles. Change the default browser in Windows Settings if needed. Messages and Google account sign-in pages remain in the app. Only HTTP(S) URLs are passed to the operating system; file and executable schemes are never forwarded by the companion.

## Windows warned about the download

Published EXEs are unsigned; the Windows helper also uses PowerShell and a native mouse hook. Security products can flag such behavior. Do not broadly disable security protections. Inspect the source, verify release checksums, build locally, or choose not to run it if you do not trust it.

```powershell
Get-FileHash .\Messages-Tray-1.0.0.exe -Algorithm SHA256
```

Compare with `SHA256SUMS.txt` from the same release. This checks integrity, not whether the software is safe or the publisher is authenticated.

## Upgrade / uninstall

Disable Start with Windows in the old version, quit using its tray menu, and replace the EXE. Enable startup again only after placing the new EXE in its final folder. The app uses the same dedicated profile across upgrades, so pairing usually persists.

To stop using it: disable startup, unpair through Google's Device pairing controls, quit from the tray, and delete the EXE. The dedicated profile remains in `%APPDATA%\messages-tray\chrome-profile` unless you remove it yourself. Do not delete your normal Chrome profile.
