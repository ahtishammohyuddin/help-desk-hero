// Run with: node --test game/tests/cards.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanName, clockTime, DISCLAIMER, formatDate, NAME_MAX, postText } from '../src/cards.js';

test('names are tidied and too-short names are refused', () => {
  assert.equal(cleanName('  Ahtisham   Mohyuddin '), 'Ahtisham Mohyuddin');
  assert.equal(cleanName('A'), '');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(null), '');
  assert.equal(cleanName('Sa\u0000na\n'), 'Sana');
  assert.equal(cleanName('x'.repeat(80)).length, NAME_MAX);
});

test('dates and times are written the same way everywhere', () => {
  assert.equal(formatDate(new Date(2026, 9, 15)), '15 October 2026');
  assert.equal(clockTime(65), '1:05');
  assert.equal(clockTime(0), '0:00');
  assert.equal(clockTime(-3), '0:00');
});

test('the certificate disclaimer says it is not an accredited certification', () => {
  assert.match(DISCLAIMER, /training game/);
  assert.match(DISCLAIMER, /not an accredited certification/);
});

test('post text uses only the real shift numbers and says it is a game', () => {
  const summary = { solved: 1, firstTryRate: 100, strongest: null };
  const one = postText(summary, { shiftNumber: 2, rankName: 'Intern' });
  assert.match(one, /shift 2 in Help Desk Hero, a 3D browser game/);
  assert.match(one, /- 1 ticket solved/);
  assert.match(one, /- 100% right first time/);
  assert.doesNotMatch(one, /Strongest|badge/);

  const many = postText({ solved: 7, firstTryRate: 71, strongest: 'Hardware' }, { shiftNumber: 3, rankName: 'L1 Support', badgeNames: ['First fix', 'On a roll'] });
  assert.match(many, /- 7 tickets solved/);
  assert.match(many, /- Strongest topic: Hardware/);
  assert.match(many, /- New badges: First fix, On a roll/);
});

test('certificate ID: same details give the same ID, different details a different one', async () => {
  const { certificateId, CERT_SIGNER } = await import('../src/cards.js');
  const base = { name: 'Ahtisham', date: new Date(2026, 9, 16), solved: 120, firstTryRate: 82, shifts: 14 };
  const id = certificateId(base);
  assert.match(id, /^HDH-20261016-[0-9A-F]{6}$/);
  assert.equal(certificateId({ ...base }), id);
  assert.notEqual(certificateId({ ...base, name: 'Sana' }), id);
  assert.notEqual(certificateId({ ...base, solved: 121 }), id);
  assert.ok(CERT_SIGNER.caption.includes('creator'));
});
