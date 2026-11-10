# qnx-health-checker

A static health checker for **QNX 8.0** projects. Point it at a project directory
and it validates the build system (`common.mk`, variant Makefiles, CMake),
the OS-image buildfile (`.build` / `.bld`), and the source code for genuine
QNX API usage — then scores the project's readiness and tells you exactly
what to fix.

It runs entirely on the host. It needs **no QNX license, no SDP install, and
no QEMU** — it is pure static analysis, which is exactly the point: new QNX
developers currently get no feedback until they have spent the time on the
full SDP + target setup.

Built for the **QNX Global Hackathon 2026** (BlackBerry QNX, Devpost),
**Developer Tooling & Host Tools** lane.

## Install

Node.js 22 or newer. **Zero runtime dependencies.**

```sh
git clone https://github.com/charry99/qnx-health-checker.git
cd qnx-health-checker
# no install step — nothing to install
```

Or use it directly without cloning:

```sh
node bin/qnx-check.mjs <project-dir>
```

## Usage

```sh
qnx-check <project-dir> [--json] [--html <out.html>]
```

- Prints a terminal report and exits with a status code.
- `--json` prints the full report as JSON (and nothing else on stdout).
- `--html <file>` also writes a self-contained HTML report (inline CSS, no
  external assets).

Exit codes: `0` Ready · `1` Needs work · `2` Not a QNX project ·
`3` usage / I/O error — so it drops straight into CI:

```sh
qnx-check ./my-qnx-app || echo "project is not QNX-ready"
```

### Example — a healthy project

```sh
$ qnx-check fixtures/good-classic

QNX Health Checker — good-classic
Score: 100/100 [████████████████████]  Verdict: Ready

Categories:
  build-system  30/30
  buildfile     25/25
  source        30/30
  hygiene       15/15

Findings: 1 (0 errors, 0 warnings, 1 info)
QNX markers: ChannelCreate, MsgReceive, MsgReply, MsgSend, __QNXNTO__,
  dispatch_create, name_attach, name_open, resmgr_attach,
  sys/dispatch.h, sys/neutrino.h, sys/resmgr.h
```

### Example — a POSIX-only project that claims to be QNX

```sh
$ qnx-check fixtures/bad-posix

QNX Health Checker — bad-posix
Score: 20/100 [████░░░░░░░░░░░░░░░░]  Verdict: Not a QNX project

Categories:
  build-system   0/30
  buildfile      0/25
  source        20/30
  hygiene        0/15

Findings: 15 (3 errors, 11 warnings, 1 info)

  [ERROR] BLD-004 common.mk:1
    common.mk does not include qtargets.mk — the file that picks the CPU
    compiler and binary type is missing.
  [ERROR] IMG-001 templog.build:1
    Buildfile .bootstrap section has no startup-* program.
  [ERROR] IMG-005 templog.build:5
    Buildfile references io-pkt — SDP 8.0 uses io-sock only; io-pkt is
    the 7.x network stack.
  [WARN] SRC-001 (project)
    No QNX-specific API found in any source file — the code looks like
    plain POSIX.
  [WARN] SRC-003 src/templog.c:23
    src/templog.c selects SCHED_FIFO but never sets a thread priority.
  [WARN] IMG-004 templog.build:7
    Boot script runs "sensor-daemon", but no file with that name exists
    in the project.
  ...
```

### Example — a CMake + qcc project

```sh
$ qnx-check fixtures/cmake-qcc
Score: 100/100  Verdict: Ready
QNX markers: MsgSend, __QNXNTO__, name_open, sys/neutrino.h
```

## Scoring

Four categories, weighted to 100 points:

| Category | Weight | What it covers |
|---|---|---|
| build-system | 30 | `common.mk`, variant Makefiles, CMake toolchain |
| buildfile | 25 | `.build` / `.bld` OS-image files (only when present) |
| source | 30 | QNX API markers and beginner mistakes in `.c/.cpp/.h` |
| hygiene | 15 | LICENSE, README naming version / target / toolchain |

- `error` −10, `warning` −5, `info` −0 (informational only).
- Categories that don't apply to a project (e.g. no buildfile in a
  CMake-only app) are excluded and the score is re-weighted over the rest.
- **Verdict:** ≥ 80 Ready · 50–79 Needs work · < 50 Not a QNX project.
  A project with no QNX evidence at all (no markers, no `common.mk`, no
  buildfile, no QNX CMake setup) is capped at 19/100 and verdict
  "Not a QNX project", whatever the category maths say.

## Rules

### Build system (`common.mk`, variants)

| Rule | Severity | Check |
|---|---|---|
| BLD-001 | error | No `common.mk` and no `CMakeLists.txt` |
| BLD-002 | error | `common.mk` does not set `NAME` |
| BLD-003 | warning | `common.mk` does not set `INSTALLDIR` |
| BLD-004 | error | `common.mk` does not include `qtargets.mk` |
| BLD-005 | warning | `common.mk` does not include `qconfig.mk` |
| BLD-006 | warning | C++ standard flag (`-std=c++…`) in `CCFLAGS` — belongs in `CXXFLAGS` (QNX 7.1+) |
| BLD-007 | info | `common.mk` has no `PINFO` description block |
| BLD-008 | info | C++ sources present but no `CXXFLAGS` |
| VAR-001 | warning | Variant directory (`nto/<arch>[/o]`) has no `Makefile` |
| VAR-002 | warning | Variant `Makefile` does not include `common.mk` |
| VAR-003 | warning | `common.mk` exists but no variant Makefiles found |

### Buildfile (`.build` / `.bld`)

| Rule | Severity | Check |
|---|---|---|
| IMG-001 | error | `.bootstrap` section missing, or has no `startup-*` program |
| IMG-002 | error | `.bootstrap` section missing `procnto` |
| IMG-003 | error | No `[+script] .script` section |
| IMG-004 | warning | Boot script runs a binary that does not exist in the project |
| IMG-005 | error | References `io-pkt` — SDP 8.0 uses `io-sock` only |
| IMG-006 | warning | `[type=link]` entry with a missing or non-absolute target |

### Source (`.c` / `.cpp` / `.h`)

| Rule | Severity | Check |
|---|---|---|
| SRC-001 | warning | No QNX-specific API found — code looks like plain POSIX |
| SRC-002 | info | QNX markers found (lists them) |
| SRC-003 | warning | `SCHED_FIFO` / `SCHED_RR` / `SCHED_SPORADIC` without a priority set |
| SRC-004 | warning | `ChannelCreate` without a `MsgReceive` loop in the same file |
| SRC-005 | warning | `MsgSend` with a hardcoded numeric channel id (use `name_open` + `ConnectAttach`) |

### CMake

| Rule | Severity | Check |
|---|---|---|
| CMK-001 | warning | `CMakeLists.txt` references no QNX toolchain |
| CMK-002 | info | CMake project references a QNX toolchain (`qcc` / `QNX` / `nto` target) |

### Hygiene

| Rule | Severity | Check |
|---|---|---|
| HYG-001 | warning | No `LICENSE` file (the hackathon requires a detectable open-source license) |
| HYG-002 | warning | No `README` |
| HYG-003 | warning | README does not name the QNX version (expected QNX 8.0 / SDP 8.0) |
| HYG-004 | warning | README does not name a target (QEMU, x86_64, aarch64, Raspberry Pi) |
| HYG-005 | warning | README does not name the toolchain (qcc, q++, gcc, cmake, …) |

## What it validates against

- **QNX version:** SDP 8.0 (QNX Everywhere, free for non-commercial use).
- **Targets:** QEMU (x86_64) and aarch64 — the paths the QNX 8.0 Quick Start
  supports. Variant directories `nto/x86_64`, `nto/aarch64le` (and
  `armv7`/`armv8`/`ppcbe`) are recognised.
- **Toolchain:** `qcc` / `q++` (GCC 12 in SDP 8.0), `mkifs` buildfiles.
- **Strong QNX markers** (the evidence that code genuinely targets QNX):
  `sys/neutrino.h`, `sys/dispatch.h`, `sys/resmgr.h` (+ `sys/siginfo.h`,
  `sys/procfs.h`, `sys/iofunc.h`, `hw/inout.h`); `ChannelCreate`,
  `MsgSend`/`MsgReceive`/`MsgReply`, `name_attach`/`name_open`,
  `resmgr_attach`, `dispatch_create`, `SchedSet`/`SchedCtl`,
  `InterruptAttach`, `ThreadCtl`, `mmap_device_io`, `__QNXNTO__`,
  `io-sock`. Plain POSIX (`pthread_*`, sockets, `timer_create`) is
  explicitly treated as weak evidence — the hackathon rules allow
  POSIX-compatible code only when the QNX connection is demonstrated.

## How it maps to the hackathon's host-tool evidence rules

The official rules (qnx.devpost.com/rules §4) say a host-based tool qualifies
if it "builds, tests, analyzes, or otherwise supports software targeting
QNX 8.0", and accept as evidence "QNX-specific source code or APIs; QNX
libraries, headers, buildfiles, toolchains, system images, or configuration
files in the repository". This tool is exactly that: it **analyzes** QNX
buildfiles, Makefiles, CMake toolchain files and source, and its output names
the QNX buildfiles, APIs and headers it found. The fixtures in this repo
(`fixtures/good-classic`, `fixtures/bad-posix`, `fixtures/cmake-qcc`) are the
demo: run the checker against them and the output is the evidence.

## Tests

```sh
npm test
```

60 tests, one per rule against synthetic projects plus integration tests
for the three fixtures and the CLI (`--json`, `--html`, exit codes).
All tests must pass before a release.

## Notes and simplifications

- The buildfile parser is heuristic, not a full `mkifs` parser: it reads
  `.bootstrap`, `[+script] .script` and `[type=link]` sections with regular
  expressions. Unusual attribute spellings may be missed.
- IMG-004 (boot script binary missing) uses a conservative allowlist of
  system binaries and drivers shipped in a QNX image (`startup-*`,
  `procnto`, `devc-*`, `devb-*`, `io-sock`, `slogger2`, common shell
  utilities, …). A binary from an external package will be flagged — the
  hint says to build it into the project or remove it.
- Variant-directory detection recognises `nto/<arch>` with
  `x86_64`, `aarch64`, `aarch64le`, `armv7`, `armv8`, `ppcbe`. Other
  layouts (e.g. Momentics-managed projects with different trees) may
  trigger VAR-003; that rule is a warning, not an error.
- No QNX facts beyond the research in `../research.md` were invented. Where
  a rule's exact detail was uncertain (e.g. the full SDP 8.0 target list),
  the conservative version was encoded and flagged here.

## License

MIT — see `LICENSE`.
