# VirusTotal release submissions

## One-time setup

1. Create a VirusTotal account and obtain your API key at https://www.virustotal.com/gui/my-apikey.
2. Open repository **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it **`VIRUSTOTAL_API_KEY`** and store the key there. Do not put it in source, issues, release notes, screenshots, or chat.

The workflow fails explicitly before downloading/submitting anything if the secret is missing. A failed workflow does not imply malware; read its failure reason.

## New releases

Publishing a release triggers **VirusTotal release submission**. It verifies the selected published EXE's digest and size against GitHub's asset metadata, then submits it using a commit-pinned VirusTotal upload action. The action supports the large-file upload endpoint needed for these roughly 100 MB EXEs. Release notes receive a submission time, analysis link, and SHA-256 report link only after the upload succeeds.

This workflow **submits for analysis**. It does not wait for all vendors, declare a file clean, or automatically remove/revoke a release based on detection counts. Check the live report, particularly for pending/time-out engines and potentially meaningful detections. Results can change after publication.

The key is injected only into the configuration check and pinned upload step. GitHub's built-in token has `contents: write` for release-note updates in this job; the workflow does not push source changes. The upload action is pinned at `936d8c5c00afe97d3d9a1af26d017cfdf26800a2` (v5); review changes before updating it.

## Existing releases

In **Actions → VirusTotal release submission → Run workflow**, select `main` and enter a published tag such as `v1.0.3`. Run older tags **one at a time** after the previous run finishes. You can also use:

```powershell
gh workflow run virustotal.yml --repo TylerBuza/google-messages-tray --ref main -f tag=v1.0.3
```

Repeat for `v1.0.2`, `v1.0.1`, and `v1.0.0` after each run completes. Manual runs use the current workflow and downloaded published assets, not an executable rebuilt from current source.

Runs are serialized and submissions spaced for the usual free public API rate limit. Account-specific daily quotas and upload limits still apply. A quota or service error should be retried later, not represented as a successful scan. GitHub concurrency retains only one pending run, so do not dispatch the entire backfill simultaneously.

## Report labels and reruns

- **SHA-256 lookup only:** the project has not recorded a successful automated submission for that release. A matching file may already exist on VirusTotal, or the link may not yet have a report.
- **Submitted for analysis:** an upload returned a valid analysis link. This is not proof that analysis completed or that vendors returned zero detections.
- A marked release-note section is replaced on reruns rather than accumulating duplicate badges. Original release notes are preserved. Lookup-only maintenance will not downgrade a recorded submission.

No “virus-free” or “safe” badge is generated. Checksums verify integrity, not safety or publisher identity. The EXEs remain unsigned.

## Disclosure

VirusTotal uploads can be retained and shared with security vendors. Only the exact, already-public release EXE is eligible; never upload the working tree, messages, profile data, or secrets. The workflow never invokes or executes the downloaded EXE.

Reference: [large-file uploads](https://docs.virustotal.com/reference/files-upload-url) and [pinned upload action](https://github.com/crazy-max/ghaction-virustotal/tree/936d8c5c00afe97d3d9a1af26d017cfdf26800a2).
