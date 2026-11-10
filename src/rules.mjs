// Rule definitions for qnx-health-checker.
// Every rule is grounded in research.md §4/§5/§9 — no QNX facts invented here.
// A finding: { id, category, severity, message, file, line, hint }
// severity: 'error' (blocks a working build/image), 'warning' (likely wrong),
//           'info' (evidence / observation, no score penalty).
import {
  isSourceFile, isBuildfile, isMakefile, findFirst, lineOf, stripMakeComment,
} from './scan.mjs';

// ---------------------------------------------------------------------------
// QNX marker knowledge (research.md §5.5)
// ---------------------------------------------------------------------------

export const STRONG_HEADERS = [
  'sys/neutrino.h', 'sys/dispatch.h', 'sys/resmgr.h', 'sys/siginfo.h',
  'sys/procfs.h', 'sys/iofunc.h', 'hw/inout.h',
];

export const STRONG_FUNCTIONS = [
  'ChannelCreate', 'ChannelDestroy', 'ConnectAttach', 'ConnectDetach',
  'MsgSend', 'MsgSendv', 'MsgSendPulse', 'MsgReceive', 'MsgReceivev',
  'MsgReceivePulse', 'MsgReply', 'MsgReplyv', 'MsgRead', 'MsgWrite',
  'name_attach', 'name_open', 'name_close', 'ChannelCreatePulsePool',
  'resmgr_attach', 'dispatch_create', 'dispatch_block', 'dispatch_handler',
  'resmgr_block', 'SchedSet', 'SchedGet', 'SchedInfo', 'SchedYield',
  'SchedCtl', 'InterruptAttach', 'InterruptWait', 'InterruptAttachEvent',
  'ThreadCtl', 'mmap_device_io', 'mmap_device_memory', 'TimerCreate',
  'ClockTime', 'ClockAdjust', 'slog2f', 'devctl',
];

export const STRONG_MACROS = ['__QNXNTO__'];

// Tokens the QNX boot script is allowed to run without the binary existing
// in the project (system commands / drivers shipped in the OS image).
const KNOWN_SYSTEM_TOKENS = new Set([
  'slogger2', 'slog2info', 'slog2', 'mqueue', 'pipe', 'seedres', 'random',
  'ls', 'cp', 'mkdir', 'echo', 'sleep', 'sh', 'ksh', 'reopen', 'display',
  'on', 'waitfor', 'slay', 'pidin', 'hogs', 'sin', 'use', 'dumper',
  'mount', 'umount', 'ln', 'cat', 'chmod', 'chown', 'date', 'uname',
  'hostname', 'ifconfig', 'route', 'inetd', 'telnetd', 'sshd', 'ftpd',
  'syslogd', 'cron', 'login', 'getty', 'tinit', 'procmgr', 'tracelogger',
]);

function isKnownSystemToken(tok) {
  if (KNOWN_SYSTEM_TOKENS.has(tok)) return true;
  if (tok.endsWith('.so') || tok.endsWith('.dll')) return true;
  return /^(startup-|procnto|devc-|devb-|fs-|cam-|io-|pci-|enum-|devf-|usb)/.test(tok);
}

const QNX_ARCH_DIRS = ['x86_64', 'aarch64', 'aarch64le', 'armv7', 'armv8', 'ppcbe'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finding(id, category, severity, message, file, line, hint) {
  return { id, category, severity, message, file: file ?? null, line: line ?? null, hint: hint ?? null };
}

function makeAssignments(content) {
  // Returns Map of VAR -> value for simple `VAR = value` / `VAR := value` /
  // `VAR ?= value` lines in a makefile (comments stripped).
  const map = new Map();
  for (const raw of content.split('\n')) {
    const line = stripMakeComment(raw).trim();
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*[:?+]?=\s*(.*)$/.exec(line);
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

function includesQtargets(content) {
  return /include\s+.*qtargets\.mk/.test(content);
}

function includesQconfig(content) {
  if (/include\s+.*qconfig\.mk/.test(content)) return true;
  // Canonical pattern: QCONFIG=qconfig.mk + `include $(QCONFIG)`.
  if (/\bQCONFIG\s*[:?]?=\s*qconfig\.mk/.test(content) &&
      /include\s+\$\(\s*QCONFIG\s*\)/.test(content)) return true;
  return false;
}

/** Scan source files for strong QNX markers; returns Map marker -> [{file, line}]. */
export function scanMarkers(sourceFiles) {
  const hits = new Map();
  const add = (marker, file, line) => {
    if (!hits.has(marker)) hits.set(marker, []);
    hits.get(marker).push({ file, line });
  };
  for (const f of sourceFiles) {
    for (const h of STRONG_HEADERS) {
      const re = new RegExp(`#\\s*include\\s*<${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`);
      const hit = findFirst(f.content, re);
      if (hit) add(h, f.rel, hit.line);
    }
    for (const fn of STRONG_FUNCTIONS) {
      const re = new RegExp(`\\b${fn}\\s*\\(`);
      const hit = findFirst(f.content, re);
      if (hit) add(fn, f.rel, hit.line);
    }
    for (const macro of STRONG_MACROS) {
      const hit = findFirst(f.content, new RegExp(`\\b${macro}\\b`));
      if (hit) add(macro, f.rel, hit.line);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function checkCommonMk(ctx) {
  const out = [];
  const { commonMk, hasCmake, sourceFiles } = ctx;
  if (!commonMk) {
    if (!hasCmake) {
      out.push(finding('BLD-001', 'build-system', 'error',
        'No common.mk found and no CMakeLists.txt — nothing tells the QNX build system how to build this project.',
        null, null,
        'Add a common.mk (NAME, INSTALLDIR, qconfig.mk + qtargets.mk includes) or a CMakeLists.txt with a qcc toolchain.'));
    }
    return out;
  }
  const { rel, content } = commonMk;
  const vars = makeAssignments(content);
  if (!vars.get('NAME')) {
    out.push(finding('BLD-002', 'build-system', 'error',
      'common.mk does not set NAME — the build system does not know what binary to produce.',
      rel, 1, 'Set NAME=<binary-name> in common.mk.'));
  }
  if (!vars.get('INSTALLDIR')) {
    out.push(finding('BLD-003', 'build-system', 'warning',
      'common.mk does not set INSTALLDIR — the install location of the built binary is undefined.',
      rel, 1, 'Set INSTALLDIR=usr/bin (or the target path for your binary).'));
  }
  if (!includesQtargets(content)) {
    out.push(finding('BLD-004', 'build-system', 'error',
      'common.mk does not include qtargets.mk — the file that picks the CPU compiler and binary type is missing.',
      rel, 1, 'Add: include $(MKFILES_ROOT)/qtargets.mk'));
  }
  if (!includesQconfig(content)) {
    out.push(finding('BLD-005', 'build-system', 'warning',
      'common.mk does not include qconfig.mk — root paths and compiler macros are undefined.',
      rel, 1, 'Add:\nifndef QCONFIG\nQCONFIG=qconfig.mk\nendif\ninclude $(QCONFIG)'));
  }
  const ccflags = findFirst(content, /^\s*CCFLAGS\s*[:+]?=\s*(.*)$/m);
  if (ccflags && /-std=(c|gnu)\+\+/.test(ccflags.match[1])) {
    out.push(finding('BLD-006', 'build-system', 'warning',
      `CCFLAGS sets a C++ standard (${ccflags.match[1].trim()}) — in QNX 7.1+ CCFLAGS applies to the C compiler only.`,
      rel, ccflags.line, 'Move C++ flags to CXXFLAGS.'));
  }
  const hasCpp = sourceFiles.some((f) => /\.(cpp|cc|cxx)$/i.test(f.rel));
  if (hasCpp && !vars.has('CXXFLAGS')) {
    out.push(finding('BLD-008', 'build-system', 'info',
      'C++ sources are present but common.mk sets no CXXFLAGS.',
      rel, 1, 'Set CXXFLAGS for your C++ sources (e.g. CXXFLAGS=-O2 -std=c++17).'));
  }
  if (!/^\s*define\s+PINFO/m.test(content)) {
    out.push(finding('BLD-007', 'build-system', 'info',
      'common.mk has no PINFO description block.',
      rel, 1, 'Optional: add a PINFO DESCRIPTION for the binary.'));
  }
  return out;
}

function checkVariants(ctx) {
  const out = [];
  const { dirs, files, commonMk } = ctx;
  const fileSet = new Set(files.map((f) => f.rel));
  // Variant dirs look like <...>/nto/<arch>[/o]
  const variantDirs = dirs.filter((d) => {
    const parts = d.split('/');
    const nto = parts.indexOf('nto');
    return nto !== -1 && QNX_ARCH_DIRS.includes(parts[nto + 1]);
  });
  for (const vd of variantDirs) {
    const candidates = [`${vd}/Makefile`, `${vd}/o/Makefile`];
    if (!candidates.some((c) => fileSet.has(c))) {
      out.push(finding('VAR-001', 'build-system', 'warning',
        `Variant directory ${vd} has no Makefile — the target it claims will not build.`,
        null, null, `Add ${vd}/o/Makefile containing: include ../../../common.mk (path adjusted to your tree).`));
    }
  }
  for (const f of files) {
    if (!isMakefile(f.rel)) continue;
    const parts = f.rel.split('/');
    const nto = parts.indexOf('nto');
    if (nto === -1 || !QNX_ARCH_DIRS.includes(parts[nto + 1])) continue;
    if (f.rel.endsWith('common.mk')) continue;
    if (!/common\.mk/.test(f.content)) {
      out.push(finding('VAR-002', 'build-system', 'warning',
        `Variant Makefile ${f.rel} does not include common.mk — it will not inherit the project settings.`,
        f.rel, 1, 'Add: include ../../../common.mk (path adjusted to your tree).'));
    }
  }
  if (commonMk && variantDirs.length === 0) {
    out.push(finding('VAR-003', 'build-system', 'warning',
      'common.mk exists but no variant Makefiles were found (expected nto/<arch>/o/Makefile).',
      commonMk.rel, 1, 'Run: addvariant nto x86_64 o (and aarch64le if you target ARM).'));
  }
  return out;
}

function checkBuildfiles(ctx) {
  const out = [];
  const { buildfiles, files, commonMk } = ctx;
  const projectNames = new Set(
    files.map((f) => f.rel.split('/').pop()),
  );
  const projectName = commonMk
    ? (makeAssignments(commonMk.content).get('NAME') || null) : null;

  for (const bf of buildfiles) {
    const { rel, content } = bf;
    const bootstrap = /\.bootstrap\s*=\s*\{([\s\S]*?)\}/.exec(content);
    if (!bootstrap) {
      out.push(finding('IMG-001', 'buildfile', 'error',
        `Buildfile ${rel} has no .bootstrap section — the boot image has no startup program or microkernel.`,
        rel, 1, 'Add a .bootstrap section with a startup-* program and procnto.'));
    } else {
      if (!/startup-\S+/.test(bootstrap[1])) {
        const hit = findFirst(content, /\.bootstrap/);
        out.push(finding('IMG-001', 'buildfile', 'error',
          `Buildfile ${rel} .bootstrap section has no startup-* program.`,
          rel, hit ? hit.line : 1, 'Add a startup-* binary for your target (e.g. startup-x86_64) to .bootstrap.'));
      }
      if (!/\bprocnto/.test(bootstrap[1])) {
        const hit = findFirst(content, /\.bootstrap/);
        out.push(finding('IMG-002', 'buildfile', 'error',
          `Buildfile ${rel} .bootstrap section is missing procnto (the QNX microkernel / process manager).`,
          rel, hit ? hit.line : 1, 'Add procnto (e.g. PATH=/proc/boot procnto-smp-instr) to .bootstrap.'));
      }
    }
    const script = /\[\+script\]\s*\.script\s*=\s*\{([\s\S]*?)\}/.exec(content)
      || /\.script\s*=\s*\{([\s\S]*?)\}/.exec(content);
    if (!script) {
      out.push(finding('IMG-003', 'buildfile', 'error',
        `Buildfile ${rel} has no [+script] .script section — nothing will run at boot.`,
        rel, 1, 'Add:\n[+script] .script = {\n    reopen\n    <your-binary>\n}'));
    } else {
      const scriptStart = content.indexOf(script[0]);
      const scriptLines = script[1].split('\n');
      scriptLines.forEach((rawLine, i) => {
        const line = rawLine.split('#')[0].trim();
        if (!line) return;
        const tok = line.split(/\s+/)[0].replace(/[&;]$/, '');
        if (!tok || tok.includes('/')) return;
        if (isKnownSystemToken(tok)) return;
        if (projectName && tok === projectName) return;
        if (projectNames.has(tok)) return;
        const lineNo = lineOf(content, scriptStart) + i;
        out.push(finding('IMG-004', 'buildfile', 'warning',
          `Buildfile ${rel} boot script runs "${tok}", but no file with that name exists in the project.`,
          rel, lineNo, `Build "${tok}" into the project or remove it from the boot script.`));
      });
    }
    const ioPkt = findFirst(content, /\bio-pkt\b/);
    if (ioPkt) {
      out.push(finding('IMG-005', 'buildfile', 'error',
        `Buildfile ${rel} references io-pkt — SDP 8.0 uses io-sock only; io-pkt is the 7.x network stack.`,
        rel, ioPkt.line, 'Replace io-pkt with io-sock (e.g. io-sock -d e1000 -ptcpip ...).'));
    }
    const linkRe = /\[type=link\]\s*(\S+)\s*=\s*(\S*)/g;
    let lm;
    while ((lm = linkRe.exec(content)) !== null) {
      const target = lm[2];
      if (!target || !target.startsWith('/')) {
        out.push(finding('IMG-006', 'buildfile', 'warning',
          `Buildfile ${rel} has a [type=link] entry with a missing or non-absolute target ("${lm[1]} = ${target}").`,
          rel, lineOf(content, lm.index), 'Link targets should be absolute paths inside the image, e.g. /proc/boot/libc.so.'));
      }
    }
  }
  return out;
}

function checkSource(ctx) {
  const out = [];
  const { sourceFiles, markers } = ctx;
  if (sourceFiles.length === 0) return out;

  if (markers.size === 0) {
    out.push(finding('SRC-001', 'source', 'warning',
      'No QNX-specific API found in any source file — the code looks like plain POSIX. The hackathon rules warn that a submission must show it genuinely targets QNX 8.0, not merely name it in the README.',
      null, null,
      'Use a QNX API such as ChannelCreate/MsgSend (sys/neutrino.h), resmgr_attach (sys/resmgr.h), or guard QNX-only code with #ifdef __QNXNTO__.'));
  } else {
    const names = [...markers.keys()].sort();
    out.push(finding('SRC-002', 'source', 'info',
      `QNX markers found (${names.length}): ${names.join(', ')}.`,
      markers.get(names[0])[0].file, markers.get(names[0])[0].line, null));
  }

  for (const f of sourceFiles) {
    const schedHit = findFirst(f.content, /\bSCHED_(FIFO|RR|SPORADIC)\b/);
    if (schedHit) {
      const hasPriority = /(sched_param|sched_priority|pthread_setschedparam|pthread_attr_setschedparam|SchedSet)\b/.test(f.content);
      if (!hasPriority) {
        out.push(finding('SRC-003', 'source', 'warning',
          `${f.rel} selects ${schedHit.match[0]} but never sets a thread priority — the thread runs at the default priority and real-time behaviour is undefined.`,
          f.rel, schedHit.line,
          'Set the priority explicitly, e.g. pthread_attr_setschedparam(&attr, &param) with param.sched_priority set, or SchedSet().'));
      }
    }
    const chanHit = findFirst(f.content, /\bChannelCreate\s*\(/);
    if (chanHit && !/\bMsgReceive(v)?\s*\(/.test(f.content)) {
      out.push(finding('SRC-004', 'source', 'warning',
        `${f.rel} creates a channel with ChannelCreate but never calls MsgReceive — no thread will ever receive messages on it.`,
        f.rel, chanHit.line, 'Add a MsgReceive loop on the channel, or remove the ChannelCreate.'));
    }
    const hardSend = /MsgSend(v)?\s*\(\s*\d+\s*,/.exec(f.content);
    if (hardSend) {
      out.push(finding('SRC-005', 'source', 'warning',
        `${f.rel} calls MsgSend with a hardcoded numeric channel id — channel ids are only valid in the process that created them.`,
        f.rel, lineOf(f.content, hardSend.index),
        'Look the channel up by name (name_open) and connect with ConnectAttach, then MsgSend on the returned connection id.'));
    }
  }
  return out;
}

function checkCmake(ctx) {
  const out = [];
  const { cmakeFiles, cmakeLists } = ctx;
  if (!cmakeLists && cmakeFiles.length === 0) return out;
  const allText = [...(cmakeLists ? [cmakeLists] : []), ...cmakeFiles]
    .map((f) => f.content).join('\n');
  const evidence = /qcc|q\+\+|QNX|gcc_nto|ntox86|ntoaarch64|CMAKE_SYSTEM_NAME\s+QNX/i.test(allText);
  if (evidence) {
    const where = cmakeLists ?? cmakeFiles[0];
    out.push(finding('CMK-002', 'build-system', 'info',
      'CMake project references a QNX toolchain (qcc / QNX / nto target).',
      where.rel, 1, null));
  } else {
    const where = cmakeLists ?? cmakeFiles[0];
    out.push(finding('CMK-001', 'build-system', 'warning',
      'CMakeLists.txt does not reference a QNX toolchain — the build is not shown to target QNX 8.0.',
      where.rel, 1,
      'Set the QNX toolchain, e.g. CMAKE_SYSTEM_NAME QNX with CMAKE_C_COMPILER qcc, or a toolchain file using qcc -V gcc_ntox86_64.'));
  }
  return out;
}

function checkHygiene(ctx) {
  const out = [];
  const { files } = ctx;
  const hasLicense = files.some((f) => /^license(\..*)?$/i.test(f.rel.split('/').pop()) ||
    f.rel.toLowerCase() === 'copying');
  if (!hasLicense) {
    out.push(finding('HYG-001', 'hygiene', 'warning',
      'No LICENSE file — the hackathon requires a public repo with a detectable open-source license.',
      null, null, 'Add a LICENSE file (e.g. MIT) at the project root.'));
  }
  const readme = files.find((f) => /^readme(\..*)?$/i.test(f.rel.split('/').pop()));
  if (!readme) {
    out.push(finding('HYG-002', 'hygiene', 'warning',
      'No README — judges cannot tell what the project does or how to build it.',
      null, null, 'Add a README with a description and build/run instructions.'));
    return out;
  }
  const { rel, content } = readme;
  if (!/QNX\s*8(\.0)?|SDP\s*8/i.test(content)) {
    out.push(finding('HYG-003', 'hygiene', 'warning',
      'README does not name the QNX version it targets (expected QNX 8.0 / SDP 8.0).',
      rel, 1, 'State the QNX version, e.g. "Targets QNX SDP 8.0".'));
  }
  if (!/\b(QEMU|x86_64|aarch64|aarch64le|Raspberry\s*Pi|Pi\s*4|Pi\s*5)\b/i.test(content)) {
    out.push(finding('HYG-004', 'hygiene', 'warning',
      'README does not name a target (QEMU, x86_64, aarch64, Raspberry Pi).',
      rel, 1, 'State the target, e.g. "Runs on QEMU (x86_64)".'));
  }
  if (!/\b(qcc|q\+\+|gcc|cmake|QNX\s+Toolkit|Momentics)\b/i.test(content)) {
    out.push(finding('HYG-005', 'hygiene', 'warning',
      'README does not name the toolchain used to build the project.',
      rel, 1, 'State the toolchain, e.g. "Built with qcc (GCC 12) via the QNX SDP 8.0 toolchain".'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule registry — the full list, used by the README and the tests.
// ---------------------------------------------------------------------------

export const RULES = [
  { id: 'BLD-001', category: 'build-system', severity: 'error', title: 'No common.mk and no CMakeLists.txt' },
  { id: 'BLD-002', category: 'build-system', severity: 'error', title: 'common.mk does not set NAME' },
  { id: 'BLD-003', category: 'build-system', severity: 'warning', title: 'common.mk does not set INSTALLDIR' },
  { id: 'BLD-004', category: 'build-system', severity: 'error', title: 'common.mk does not include qtargets.mk' },
  { id: 'BLD-005', category: 'build-system', severity: 'warning', title: 'common.mk does not include qconfig.mk' },
  { id: 'BLD-006', category: 'build-system', severity: 'warning', title: 'C++ standard flag in CCFLAGS (belongs in CXXFLAGS)' },
  { id: 'BLD-007', category: 'build-system', severity: 'info', title: 'common.mk has no PINFO block' },
  { id: 'BLD-008', category: 'build-system', severity: 'info', title: 'C++ sources present but no CXXFLAGS' },
  { id: 'VAR-001', category: 'build-system', severity: 'warning', title: 'Variant directory has no Makefile' },
  { id: 'VAR-002', category: 'build-system', severity: 'warning', title: 'Variant Makefile does not include common.mk' },
  { id: 'VAR-003', category: 'build-system', severity: 'warning', title: 'No variant Makefiles found' },
  { id: 'CMK-001', category: 'build-system', severity: 'warning', title: 'CMakeLists.txt references no QNX toolchain' },
  { id: 'CMK-002', category: 'build-system', severity: 'info', title: 'CMake project references a QNX toolchain' },
  { id: 'IMG-001', category: 'buildfile', severity: 'error', title: 'Buildfile .bootstrap missing startup-* (or missing entirely)' },
  { id: 'IMG-002', category: 'buildfile', severity: 'error', title: 'Buildfile .bootstrap missing procnto' },
  { id: 'IMG-003', category: 'buildfile', severity: 'error', title: 'Buildfile has no [+script] .script section' },
  { id: 'IMG-004', category: 'buildfile', severity: 'warning', title: 'Boot script runs a binary that does not exist in the project' },
  { id: 'IMG-005', category: 'buildfile', severity: 'error', title: 'Buildfile references io-pkt (SDP 8.0 uses io-sock)' },
  { id: 'IMG-006', category: 'buildfile', severity: 'warning', title: '[type=link] entry with missing or non-absolute target' },
  { id: 'SRC-001', category: 'source', severity: 'warning', title: 'No QNX-specific API found (plain POSIX code)' },
  { id: 'SRC-002', category: 'source', severity: 'info', title: 'QNX markers found' },
  { id: 'SRC-003', category: 'source', severity: 'warning', title: 'SCHED_FIFO/RR/SPORADIC without a priority set' },
  { id: 'SRC-004', category: 'source', severity: 'warning', title: 'ChannelCreate without a MsgReceive loop' },
  { id: 'SRC-005', category: 'source', severity: 'warning', title: 'MsgSend with a hardcoded numeric channel id' },
  { id: 'HYG-001', category: 'hygiene', severity: 'warning', title: 'No LICENSE file' },
  { id: 'HYG-002', category: 'hygiene', severity: 'warning', title: 'No README' },
  { id: 'HYG-003', category: 'hygiene', severity: 'warning', title: 'README does not name the QNX version' },
  { id: 'HYG-004', category: 'hygiene', severity: 'warning', title: 'README does not name a target' },
  { id: 'HYG-005', category: 'hygiene', severity: 'warning', title: 'README does not name the toolchain' },
];

export const CHECKS = [
  checkCommonMk, checkVariants, checkBuildfiles, checkSource, checkCmake, checkHygiene,
];
