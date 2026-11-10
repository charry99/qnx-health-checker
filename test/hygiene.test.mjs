// Tests for the hygiene rules (HYG-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, ids } from './helpers.mjs';

test('HYG-001: no LICENSE file', async () => {
  const r = await analyzeFiles({ 'README.md': '# x\nTargets QNX SDP 8.0 on QEMU x86_64, built with qcc.\n' });
  assert.ok(ids(r).has('HYG-001'));
});

test('HYG-001: LICENSE present is fine', async () => {
  const r = await analyzeFiles({
    'LICENSE': 'MIT License\n',
    'README.md': '# x\nTargets QNX SDP 8.0 on QEMU x86_64, built with qcc.\n',
  });
  assert.ok(!ids(r).has('HYG-001'));
});

test('HYG-002: no README', async () => {
  const r = await analyzeFiles({ 'LICENSE': 'MIT License\n' });
  assert.ok(ids(r).has('HYG-002'));
  // README-dependent checks must not fire when there is no README.
  assert.ok(!ids(r).has('HYG-003'));
  assert.ok(!ids(r).has('HYG-004'));
  assert.ok(!ids(r).has('HYG-005'));
});

test('HYG-003: README without a QNX version', async () => {
  const r = await analyzeFiles({
    'LICENSE': 'MIT\n',
    'README.md': '# x\nA project for QNX on QEMU x86_64, built with qcc.\n',
  });
  assert.ok(ids(r).has('HYG-003'));
});

test('HYG-004: README without a target', async () => {
  const r = await analyzeFiles({
    'LICENSE': 'MIT\n',
    'README.md': '# x\nTargets QNX SDP 8.0, built with qcc.\n',
  });
  assert.ok(ids(r).has('HYG-004'));
});

test('HYG-005: README without a toolchain', async () => {
  const r = await analyzeFiles({
    'LICENSE': 'MIT\n',
    'README.md': '# x\nTargets QNX SDP 8.0 on QEMU x86_64.\n',
  });
  assert.ok(ids(r).has('HYG-005'));
});

test('full README: no HYG findings', async () => {
  const r = await analyzeFiles({
    'LICENSE': 'MIT\n',
    'README.md': '# x\nTargets QNX SDP 8.0 on QEMU x86_64, built with qcc.\n',
  });
  for (const id of ['HYG-001', 'HYG-002', 'HYG-003', 'HYG-004', 'HYG-005']) {
    assert.ok(!ids(r).has(id), `unexpected ${id}`);
  }
});
