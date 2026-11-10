// CLI tests: exit codes, --json, --html, usage errors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIXTURES } from './helpers.mjs';

const run = promisify(execFile);
const CLI = new URL('../bin/qnx-check.mjs', import.meta.url).pathname;

async function runCli(args) {
  try {
    const { stdout, stderr } = await run('node', [CLI, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

test('CLI: good-classic exits 0 and prints Ready', async () => {
  const r = await runCli([path.join(FIXTURES, 'good-classic')]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Score: 100\/100/);
  assert.match(r.stdout, /Verdict: Ready/);
});

test('CLI: bad-posix exits 2 and prints Not a QNX project', async () => {
  const r = await runCli([path.join(FIXTURES, 'bad-posix')]);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /Score: 20\/100/);
  assert.match(r.stdout, /Verdict: Not a QNX project/);
});

test('CLI: cmake-qcc exits 0', async () => {
  const r = await runCli([path.join(FIXTURES, 'cmake-qcc')]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Verdict: Ready/);
});

test('CLI: --json prints a parseable report and nothing else', async () => {
  const r = await runCli([path.join(FIXTURES, 'good-classic'), '--json']);
  assert.equal(r.code, 0);
  const report = JSON.parse(r.stdout);
  assert.equal(report.score, 100);
  assert.equal(report.verdict, 'Ready');
  assert.ok(Array.isArray(report.findings));
});

test('CLI: --html writes a self-contained report', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qnx-html-'));
  try {
    const out = path.join(dir, 'report.html');
    const r = await runCli([path.join(FIXTURES, 'bad-posix'), '--html', out]);
    assert.equal(r.code, 2);
    const html = await readFile(out, 'utf8');
    assert.match(html, /QNX Health Check/);
    assert.match(html, /20<span/);
    assert.match(html, /\/100<\/span>/);
    assert.match(html, /Not a QNX project/);
    assert.match(html, /IMG-005/);
    assert.ok(!/src=|href="http/.test(html), 'HTML report must not reference external assets');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI: missing directory exits 3', async () => {
  const r = await runCli([]);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /missing project directory/);
});

test('CLI: nonexistent path exits 3', async () => {
  const r = await runCli(['/definitely/not/a/real/path']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /cannot access/);
});

test('CLI: unknown option exits 3', async () => {
  const r = await runCli([path.join(FIXTURES, 'good-classic'), '--bogus']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /unknown option/);
});
