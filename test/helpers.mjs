// Shared helpers for the qnx-health-checker tests.
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeProject } from '../src/index.mjs';

export const FIXTURES = new URL('../fixtures/', import.meta.url).pathname;

export async function makeProject(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'qnx-check-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}

export function ids(report) {
  return new Set(report.findings.map((f) => f.id));
}

export function byId(report, id) {
  return report.findings.filter((f) => f.id === id);
}

export async function analyzeFiles(files) {
  const dir = await makeProject(files);
  try {
    return await analyzeProject(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const GOOD_COMMON_MK = `ifndef QCONFIG
QCONFIG=qconfig.mk
endif
include $(QCONFIG)
INSTALLDIR=usr/bin
define PINFO
PINFO DESCRIPTION=Test binary.
endef
NAME=testbin
CCFLAGS=-O2
include $(MKFILES_ROOT)/qtargets.mk
`;

export const GOOD_BUILD = `[virtual=x86_64,elf] .bootstrap = {
    startup-x86_64
    PATH=/proc/boot procnto-smp-instr
}
[+script] .script = {
    io-sock -d e1000 -ptcpip &
    reopen
    testbin &
}
[type=link] /dev/console=/dev/ser1
`;
