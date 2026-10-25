'use strict';

function extractCode(text) {
  if (typeof text !== 'string' || text.length > 20000) return null;
  // Only copy numeric candidates from messages that actually discuss verification.
  const context = /\b(code|otp|passcode|verification|verify|authentication|security|one[- ]time|login|sign[- ]?in|2fa)\b/i;
  if (!context.test(text)) return null;
  const candidates = [...text.matchAll(/(?<![\w+])(?:\d{3}[- ]\d{3}|\d{4,8})(?![\w]|[- ]\d)/g)];
  const scored = candidates.map(match => {
    const start = match.index;
    // Do not mistake numbers embedded in URLs for an OTP.
    const token = text.slice(0, start).split(/\s/).pop();
    if (/https?:\/\/|www\./i.test(token)) return null;
    const code = match[0].replace(/[- ]/g, '');
    if (/^(19|20)\d{2}$/.test(code) && candidates.length > 1) return null;
    const words = [...text.matchAll(new RegExp(context.source, 'gi'))];
    const distance = Math.min(...words.map(word => Math.abs(word.index - start)));
    return { code, score: distance + (code.length === 6 ? -10 : 0) };
  }).filter(Boolean).sort((a, b) => a.score - b.score);
  return scored[0]?.code || null;
}

class MessageGate {
  constructor(ttl = 20000) { this.ttl = ttl; this.seen = new Map(); }
  accept(title, body, now = Date.now()) {
    for (const [key, time] of this.seen) if (now - time > this.ttl) this.seen.delete(key);
    const key = `${title.trim().toLowerCase()}\n${body.trim()}`;
    if (this.seen.has(key)) return false;
    this.seen.set(key, now);
    return true;
  }
}

module.exports = { extractCode, MessageGate };
