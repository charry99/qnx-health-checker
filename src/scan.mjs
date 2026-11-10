// File discovery for qnx-health-checker.
// Walks a project directory and reads the text files the rules care about.
// Skips VCS metadata, node_modules and build output dirs.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', '.cache', 'out', 'build', 'dist',
]);

const TEXT_EXTS = new Set([
  '.mk', '.build', '.bld', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh',
  '.txt', '.cmake', '.md',
]);

function isTextFile(name) {
  const lower = name.toLowerCase();
  if (lower === 'makefile' || lower === 'cmakelists.txt') return true;
  if (lower === 'license' || lower.startsWith('license.') ||
      lower === 'copying' || lower === 'readme' || lower.startsWith('readme.')) return true;
  return TEXT_EXTS.has(path.extname(lower));
}

export async function collectFiles(root) {
  const files = []; // { rel, abs, content, lines }
  const dirs = [];  // relative dir paths, posix-style
  async function walk(dir, relDir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        dirs.push(rel);
        await walk(abs, rel);
      } else if (entry.isFile() && isTextFile(entry.name)) {
        try {
          const content = await readFile(abs, 'utf8');
          files.push({ rel, abs, content, lines: content.split('\n') });
        } catch {
          // Unreadable / binary — skip silently.
        }
      }
    }
  }
  await walk(root, '');
  return { files, dirs };
}

export function isSourceFile(rel) {
  return /\.(c|cpp|cc|cxx|h|hpp|hh)$/i.test(rel);
}

export function isBuildfile(rel) {
  return /\.(build|bld)$/i.test(rel);
}

export function isMakefile(rel) {
  const base = path.posix.basename(rel).toLowerCase();
  return base === 'makefile' || base.endsWith('.mk');
}

/** 1-based line number of a byte offset inside file content. */
export function lineOf(content, index) {
  if (index == null || index < 0) return 1;
  return content.slice(0, index).split('\n').length;
}

/** First match of a regex in content; returns { line, match } or null. */
export function findFirst(content, regex) {
  const m = regex.exec(content);
  if (!m) return null;
  return { line: lineOf(content, m.index), match: m };
}

/** Strip `#` comments (make-style) from a line, keeping the code part. */
export function stripMakeComment(line) {
  const i = line.indexOf('#');
  return i === -1 ? line : line.slice(0, i);
}
