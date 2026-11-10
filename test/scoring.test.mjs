// Integration tests: scores and verdicts for the three fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analyzeProject } from '../src/index.mjs';
import { FIXTURES, ids } from './helpers.mjs';

const fixture = (name) => path.join(FIXTURES, name);

test('good-classic fixture: 100/100, Ready, no errors or warnings', async () => {
  const r = await analyzeProject(fixture('good-classic'));
  assert.equal(r.score, 100);
  assert.equal(r.verdict, 'Ready');
  assert.equal(r.counts.errors, 0);
  assert.equal(r.counts.warnings, 0);
  assert.ok(r.markers.includes('ChannelCreate'));
  assert.ok(r.markers.includes('MsgSend'));
  assert.ok(r.markers.includes('MsgReceive'));
  assert.ok(r.markers.includes('resmgr_attach'));
  assert.ok(r.markers.includes('name_attach'));
  assert.ok(r.markers.includes('__QNXNTO__'));
});

test('bad-posix fixture: 20/100, Not a QNX project', async () => {
  const r = await analyzeProject(fixture('bad-posix'));
  assert.equal(r.score, 20);
  assert.equal(r.verdict, 'Not a QNX project');
  const found = ids(r);
  for (const id of ['BLD-003', 'BLD-004', 'BLD-005', 'BLD-006', 'VAR-003',
    'IMG-001', 'IMG-004', 'IMG-005', 'SRC-001', 'SRC-003',
    'HYG-001', 'HYG-003', 'HYG-004', 'HYG-005']) {
    assert.ok(found.has(id), `expected ${id}`);
  }
  assert.equal(r.counts.errors, 3); // BLD-004, IMG-001, IMG-005
  assert.equal(r.markers.length, 0);
});

test('cmake-qcc fixture: 100/100, Ready, CMK-002 present', async () => {
  const r = await analyzeProject(fixture('cmake-qcc'));
  assert.equal(r.score, 100);
  assert.equal(r.verdict, 'Ready');
  assert.equal(r.counts.errors, 0);
  assert.equal(r.counts.warnings, 0);
  assert.ok(ids(r).has('CMK-002'));
  assert.ok(r.markers.includes('MsgSend'));
  assert.ok(r.markers.includes('name_open'));
});

test('empty directory: Not a QNX project with BLD-001', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(path.join(tmpdir(), 'qnx-empty-'));
  try {
    const r = await analyzeProject(dir);
    assert.equal(r.verdict, 'Not a QNX project');
    assert.ok(ids(r).has('BLD-001'));
    assert.ok(r.score <= 19, `empty dir must score at most 19, got ${r.score}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
