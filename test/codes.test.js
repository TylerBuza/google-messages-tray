'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCode, MessageGate } = require('../src/codes');

test('recognizes common numeric verification formats', () => {
  for (const [text, expected] of [
    ['Your Google verification code is 123456.', '123456'],
    ["G-482917 is your Google verification code. Don't share it with anyone.", '482917'],
    ['123456 is your verification code. Do not share it.', '123456'],
    ['Security code: 4829', '4829'],
    ['Your one-time passcode: 123-456', '123456'],
    ['Your sign-in code is 123 456.', '123456'],
    ['OTP 12345678 expires in 10 minutes.', '12345678'],
    ['In 2026, your verification code is 678901', '678901']
  ]) assert.equal(extractCode(text), expected, text);
});
test('does not grab arbitrary text, phones, or URLs', () => {
  for (const text of ['Meet me at 1234 Main Street', 'Order 123456 delivered', 'Your code: +15551234567', 'Verify at https://example.com/123456', 'Code not available']) {
    assert.equal(extractCode(text), null, text);
  }
  assert.equal(extractCode(null), null);
});
test('deduplicates within the short delivery window only', () => {
  const gate = new MessageGate(20000);
  assert.equal(gate.accept('Bank', 'Code 123456', 0), true);
  assert.equal(gate.accept('Bank', 'Code 123456', 100), false);
  assert.equal(gate.accept('Bank', 'Code 654321', 200), true);
  assert.equal(gate.accept('Bank', 'Code 123456', 21000), true);
});
