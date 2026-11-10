// Tests for the buildfile (.build / .bld) rules (IMG-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, ids, GOOD_BUILD, GOOD_COMMON_MK } from './helpers.mjs';

const BASE = { 'common.mk': GOOD_COMMON_MK };

test('IMG-001: buildfile without a .bootstrap section', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': '[+script] .script = {\n    reopen\n}\n' });
  assert.ok(ids(r).has('IMG-001'));
});

test('IMG-001: .bootstrap without startup-*', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': '[virtual=x86_64,elf] .bootstrap = {\n    PATH=/proc/boot procnto-smp-instr\n}\n[+script] .script = {\n    reopen\n}\n' });
  assert.ok(ids(r).has('IMG-001'));
  assert.ok(!ids(r).has('IMG-002'), 'procnto is present, IMG-002 must not fire');
});

test('IMG-002: .bootstrap without procnto', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': '[virtual=x86_64,elf] .bootstrap = {\n    startup-x86_64\n}\n[+script] .script = {\n    reopen\n}\n' });
  assert.ok(ids(r).has('IMG-002'));
  assert.ok(!ids(r).has('IMG-001'), 'startup is present, IMG-001 must not fire');
});

test('IMG-003: buildfile without a [+script] .script section', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': '[virtual=x86_64,elf] .bootstrap = {\n    startup-x86_64\n    PATH=/proc/boot procnto-smp-instr\n}\n' });
  assert.ok(ids(r).has('IMG-003'));
});

test('IMG-004: boot script runs a binary that does not exist', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD.replace('testbin &', 'ghost-daemon &') });
  assert.ok(ids(r).has('IMG-004'));
});

test('IMG-004: script binary matching NAME does not fire', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD });
  assert.ok(!ids(r).has('IMG-004'));
});

test('IMG-004: known system binaries (drivers, io-sock) do not fire', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD });
  assert.ok(!ids(r).has('IMG-004'));
});

test('IMG-005: io-pkt in a buildfile is an error on SDP 8.0', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD.replace('io-sock', 'io-pkt') });
  assert.ok(ids(r).has('IMG-005'));
  assert.equal(r.findings.find((f) => f.id === 'IMG-005').severity, 'error');
});

test('IMG-005: io-sock is fine', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD });
  assert.ok(!ids(r).has('IMG-005'));
});

test('IMG-006: [type=link] with a non-absolute target', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': `${GOOD_BUILD}[type=link] /dev/console=ser1\n` });
  assert.ok(ids(r).has('IMG-006'));
});

test('IMG-006: absolute link targets are fine', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD });
  assert.ok(!ids(r).has('IMG-006'));
});

test('good buildfile: no IMG findings at all', async () => {
  const r = await analyzeFiles({ ...BASE, 'x.build': GOOD_BUILD });
  for (const id of ['IMG-001', 'IMG-002', 'IMG-003', 'IMG-004', 'IMG-005', 'IMG-006']) {
    assert.ok(!ids(r).has(id), `unexpected ${id}`);
  }
});
