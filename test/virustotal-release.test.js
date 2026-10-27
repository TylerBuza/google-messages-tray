'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTag, releaseAsset, analysisUrl, reportSection, replaceSection } = require('../scripts/virustotal-release');
const hash = 'a'.repeat(64);
const release = { tag_name: 'v1.0.3', draft: false, assets: [{ name: 'Messages-Tray-1.0.3.exe', digest: `sha256:${hash}`, size: 100 }] };

test('accepts version tags, not workflow injection or arbitrary release references', () => {
  assert.equal(validateTag('v1.0.3'), 'v1.0.3');
  for (const value of ['main', '', 'v1.0.3; echo nope', '../../main']) assert.throws(() => validateTag(value));
});
test('requires the exact published EXE and a GitHub SHA-256 digest', () => {
  assert.deepEqual(releaseAsset(release, 'v1.0.3'), { name: 'Messages-Tray-1.0.3.exe', sha256: hash, size: 100 });
  assert.throws(() => releaseAsset({ ...release, draft: true }, 'v1.0.3'));
  assert.throws(() => releaseAsset({ ...release, assets: [] }, 'v1.0.3'));
  assert.throws(() => releaseAsset({ ...release, assets: [{ name: 'Messages-Tray-1.0.3.exe' }] }, 'v1.0.3'));
});
test('accepts only the actual VirusTotal analysis origin and path', () => {
  const url = 'https://www.virustotal.com/gui/file-analysis/example-id==/detection';
  assert.equal(analysisUrl(`scan-assets/Messages-Tray-1.0.3.exe=${url}`), url);
  for (const output of ['', 'file=https://evil.example/report', 'file=https://www.virustotal.com.evil.example/gui/file-analysis/test/detection', 'file=javascript:alert(1)', `file=${url},other=${url}`]) assert.throws(() => analysisUrl(output));
});
test('lookup-only notes explicitly avoid implying a submission or clean result', () => {
  const section = reportSection(releaseAsset(release, 'v1.0.3'));
  assert.match(section, /SHA-256 lookup only/);
  assert.match(section, /automated submission has not been recorded/);
  assert.match(section, new RegExp(`/gui/file/${hash}/detection`));
  assert.doesNotMatch(section, /\*\*Submitted for analysis:\*\*/);
});
test('successful-upload notes describe submission, not a completed scan', () => {
  const url = 'https://www.virustotal.com/gui/file-analysis/test/detection';
  const section = reportSection(releaseAsset(release, 'v1.0.3'), url, '2026-10-27T00:00:00.000Z');
  assert.match(section, /Submitted for analysis/);
  assert.match(section, /not a completed-scan or clean verdict/);
  assert.match(section, /2026-10-27T00:00:00.000Z/);
});
test('report updates preserve release notes and do not duplicate or overwrite malformed sections', () => {
  const section = reportSection(releaseAsset(release, 'v1.0.3'));
  const first = replaceSection('# Original release notes\n', section);
  assert.equal(replaceSection(first, section), first);
  assert.ok(first.startsWith('# Original release notes\n'));
  assert.throws(() => replaceSection('notes <!-- virustotal:start --> partial', section));
});
