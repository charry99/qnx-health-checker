#!/usr/bin/env node
// qnx-check — CLI entry point.
// Usage: qnx-check <project-dir> [--json] [--html out.html]
// Exit codes: 0 Ready, 1 Needs work, 2 Not a QNX project, 3 usage / I/O error.
import { stat, writeFile } from 'node:fs/promises';
import { analyzeProject, exitCodeFor, renderTerminal, renderHtml } from '../src/index.mjs';

function usage() {
  return [
    'Usage: qnx-check <project-dir> [--json] [--html <out.html>]',
    '',
    'Analyzes a QNX 8.0 project directory and scores its readiness.',
    '  --json            Print the full report as JSON (nothing else on stdout)',
    '  --html <file>     Also write a self-contained HTML report to <file>',
    '',
    'Exit codes: 0 Ready, 1 Needs work, 2 Not a QNX project, 3 usage / I/O error.',
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let dir = null;
  let json = false;
  let htmlOut = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') json = true;
    else if (a === '--html') {
      htmlOut = args[++i];
      if (!htmlOut) { console.error('qnx-check: --html needs a file path'); console.error(usage()); process.exit(3); }
    } else if (a === '--help' || a === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (a.startsWith('-')) {
      console.error(`qnx-check: unknown option ${a}`);
      console.error(usage());
      process.exit(3);
    } else if (!dir) {
      dir = a;
    } else {
      console.error('qnx-check: only one project directory is accepted');
      console.error(usage());
      process.exit(3);
    }
  }
  if (!dir) {
    console.error('qnx-check: missing project directory');
    console.error(usage());
    process.exit(3);
  }
  let st;
  try {
    st = await stat(dir);
  } catch {
    console.error(`qnx-check: cannot access ${dir}`);
    process.exit(3);
  }
  if (!st.isDirectory()) {
    console.error(`qnx-check: ${dir} is not a directory`);
    process.exit(3);
  }

  const report = await analyzeProject(dir);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderTerminal(report));
  }
  if (htmlOut) {
    await writeFile(htmlOut, renderHtml(report), 'utf8');
    if (!json) console.log(`\nHTML report written to ${htmlOut}`);
  }
  process.exit(exitCodeFor(report.verdict));
}

main().catch((err) => {
  console.error(`qnx-check: ${err.message}`);
  process.exit(3);
});
