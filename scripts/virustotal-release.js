'use strict';
// Submit only published release EXEs. Never upload a working tree or profile.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const START = '<!-- virustotal:start -->';
const END = '<!-- virustotal:end -->';
function validateTag(tag) {
  if (!/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(tag || '')) throw new Error('Expected a version tag such as v1.0.3');
  return tag;
}
function releaseAsset(release, tag) {
  validateTag(tag);
  if (release.draft || release.tag_name !== tag) throw new Error('Only the selected published release may be submitted');
  const name = `Messages-Tray-${tag.slice(1)}.exe`;
  const asset = release.assets?.find(item => item.name === name);
  if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw new Error('Published EXE with a GitHub SHA-256 digest is required');
  return { name, sha256: asset.digest.slice(7), size: asset.size };
}
function analysisUrl(output) {
  const parts = (output || '').split(',').filter(Boolean);
  if (parts.length !== 1) throw new Error('Expected exactly one submitted EXE and its analysis URL');
  const separator = parts[0].indexOf('=');
  if (separator <= 0) throw new Error('Missing submitted filename');
  const url = new URL(parts[0].slice(separator + 1));
  if (url.origin !== 'https://www.virustotal.com' || !/^\/gui\/file-analysis\/[A-Za-z0-9_=-]+\/detection$/.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('Invalid VirusTotal analysis URL');
  return url.href;
}
function reportSection(asset, submittedUrl = null, time = new Date().toISOString()) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !/^Messages-Tray-[A-Za-z0-9.-]+\.exe$/.test(asset.name)) throw new Error('Invalid release asset metadata');
  const report = `https://www.virustotal.com/gui/file/${asset.sha256}/detection`;
  const status = submittedUrl
    ? `**Submitted for analysis:** ${time}\n\n[Submission / analysis status](${submittedUrl}). Submission success is not a completed-scan or clean verdict; check the live report for engine results.`
    : '**SHA-256 lookup only:** automated submission has not been recorded for this release. The lookup may be unavailable until VirusTotal has analyzed the file.';
  return `${START}\n## VirusTotal\n\n[Look up \`${asset.name}\` on VirusTotal](${report})\n\nSHA-256: \`${asset.sha256}\`\n\n${status}\n\nScanner results are not a safety guarantee. Review detections before running the file. Unsigned applications and native hooks can trigger heuristic detections. VirusTotal submissions can be shared with security vendors; only this already-public release EXE is submitted.\n${END}`;
}
function replaceSection(body, section) {
  body = body || '';
  const start = body.indexOf(START), end = body.indexOf(END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) throw new Error('Malformed existing VirusTotal section; refusing to overwrite release notes');
  return start < 0 ? `${body.trimEnd()}\n\n${section}\n` : body.slice(0, start) + section + body.slice(end + END.length);
}
function gh(args, input) { return execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024 }); }
function run(mode) {
  const repo = process.env.GH_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) throw new Error('GH_REPO is required');
  const tag = validateTag(process.env.RELEASE_TAG);
  const endpoint = `repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const release = JSON.parse(gh(['api', endpoint]));
  const asset = releaseAsset(release, tag);
  if (mode === 'prepare') {
    fs.mkdirSync('scan-assets', { recursive: true });
    gh(['release', 'download', tag, '--repo', repo, '--pattern', asset.name, '--dir', 'scan-assets', '--clobber']);
    const bytes = fs.readFileSync(path.join('scan-assets', asset.name));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.sha256 || bytes.length !== asset.size) throw new Error('Downloaded EXE does not match GitHub release digest/size');
    if (process.env.GITHUB_OUTPUT) {
      const pattern = '^' + asset.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `release_pattern=${pattern}\n`);
    }
    console.log(`Verified published asset ${asset.name} (${asset.sha256})`);
    return;
  }
  if (!['lookup', 'submitted'].includes(mode)) throw new Error('Expected prepare, lookup, or submitted');
  // Never downgrade a previously recorded submission to a lookup-only section.
  if (mode === 'lookup' && release.body?.includes('**Submitted for analysis:**')) return;
  const section = reportSection(asset, mode === 'submitted' ? analysisUrl(process.env.VT_ANALYSIS) : null);
  const body = replaceSection(release.body, section);
  gh(['api', '--method', 'PATCH', `repos/${repo}/releases/${release.id}`, '--input', '-'], JSON.stringify({ body }));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${section}\n`);
  console.log(`Updated ${tag}: ${mode === 'submitted' ? 'submitted for analysis (not a verdict)' : 'hash lookup only (not a scan)'}`);
}

if (require.main === module) {
  try { run(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateTag, releaseAsset, analysisUrl, reportSection, replaceSection };
