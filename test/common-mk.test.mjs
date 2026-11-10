// Tests for the common.mk / variant-Makefile rules (BLD-*, VAR-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, ids, GOOD_COMMON_MK } from './helpers.mjs';

test('BLD-001: no common.mk and no CMakeLists.txt is an error', async () => {
  const r = await analyzeFiles({ 'src/main.c': 'int main(void){return 0;}\n' });
  assert.ok(ids(r).has('BLD-001'));
  assert.equal(r.findings.find((f) => f.id === 'BLD-001').severity, 'error');
});

test('BLD-001: skipped when a CMakeLists.txt is present', async () => {
  const r = await analyzeFiles({
    'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\nproject(x C)\nset(CMAKE_SYSTEM_NAME QNX)\nset(CMAKE_C_COMPILER qcc)\n',
    'src/main.c': 'int main(void){return 0;}\n',
  });
  assert.ok(!ids(r).has('BLD-001'));
});

test('BLD-002: common.mk without NAME', async () => {
  const r = await analyzeFiles({
    'common.mk': 'INSTALLDIR=usr/bin\ninclude $(MKFILES_ROOT)/qtargets.mk\n',
  });
  assert.ok(ids(r).has('BLD-002'));
});

test('BLD-003: common.mk without INSTALLDIR', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\ninclude $(MKFILES_ROOT)/qtargets.mk\ninclude qconfig.mk\n',
  });
  assert.ok(ids(r).has('BLD-003'));
});

test('BLD-004: common.mk without qtargets.mk', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\nINSTALLDIR=usr/bin\ninclude qconfig.mk\n',
  });
  assert.ok(ids(r).has('BLD-004'));
});

test('BLD-005: common.mk without qconfig.mk', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\nINSTALLDIR=usr/bin\ninclude $(MKFILES_ROOT)/qtargets.mk\n',
  });
  assert.ok(ids(r).has('BLD-005'));
});

test('BLD-005: QCONFIG=qconfig.mk + include $(QCONFIG) counts as included', async () => {
  const r = await analyzeFiles({ 'common.mk': GOOD_COMMON_MK });
  assert.ok(!ids(r).has('BLD-005'));
});

test('BLD-006: C++ standard flag in CCFLAGS', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\nINSTALLDIR=usr/bin\ninclude qconfig.mk\nCCFLAGS=-O2 -std=c++17\ninclude $(MKFILES_ROOT)/qtargets.mk\n',
  });
  assert.ok(ids(r).has('BLD-006'));
});

test('BLD-006: plain CCFLAGS are fine', async () => {
  const r = await analyzeFiles({ 'common.mk': GOOD_COMMON_MK });
  assert.ok(!ids(r).has('BLD-006'));
});

test('BLD-007: missing PINFO block is info', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\nINSTALLDIR=usr/bin\ninclude qconfig.mk\ninclude $(MKFILES_ROOT)/qtargets.mk\n',
  });
  const f = r.findings.find((x) => x.id === 'BLD-007');
  assert.ok(f && f.severity === 'info');
});

test('BLD-008: C++ sources without CXXFLAGS', async () => {
  const r = await analyzeFiles({
    'common.mk': GOOD_COMMON_MK,
    'src/main.cpp': 'int main(){return 0;}\n',
  });
  assert.ok(ids(r).has('BLD-008'));
});

test('VAR-001: variant dir without a Makefile', async () => {
  const r = await analyzeFiles({
    'common.mk': GOOD_COMMON_MK,
    'src/nto/x86_64/o/.keep': '',
  });
  assert.ok(ids(r).has('VAR-001'));
});

test('VAR-002: variant Makefile not including common.mk', async () => {
  const r = await analyzeFiles({
    'common.mk': GOOD_COMMON_MK,
    'src/nto/x86_64/o/Makefile': 'all:\n\techo hi\n',
  });
  assert.ok(ids(r).has('VAR-002'));
});

test('VAR-003: common.mk but no variant dirs at all', async () => {
  const r = await analyzeFiles({ 'common.mk': GOOD_COMMON_MK });
  assert.ok(ids(r).has('VAR-003'));
});

test('good common.mk + variant makefiles: no BLD/VAR findings', async () => {
  const r = await analyzeFiles({
    'common.mk': GOOD_COMMON_MK,
    'src/nto/x86_64/o/Makefile': 'include ../../../common.mk\n',
    'src/nto/aarch64le/o/Makefile': 'include ../../../common.mk\n',
  });
  for (const id of ['BLD-002', 'BLD-003', 'BLD-004', 'BLD-005', 'BLD-006', 'VAR-001', 'VAR-002', 'VAR-003']) {
    assert.ok(!ids(r).has(id), `unexpected ${id}`);
  }
});
