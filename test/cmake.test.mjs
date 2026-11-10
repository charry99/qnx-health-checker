// Tests for the CMake rules (CMK-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, ids } from './helpers.mjs';

test('CMK-001: CMakeLists.txt with no QNX toolchain reference', async () => {
  const r = await analyzeFiles({
    'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\nproject(x C)\nadd_executable(x src/main.c)\n',
    'src/main.c': 'int main(void){return 0;}\n',
  });
  assert.ok(ids(r).has('CMK-001'));
  assert.ok(!ids(r).has('CMK-002'));
});

test('CMK-002: CMakeLists.txt with qcc toolchain is fine', async () => {
  const r = await analyzeFiles({
    'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\nproject(x C)\nset(CMAKE_SYSTEM_NAME QNX)\nset(CMAKE_C_COMPILER qcc)\nadd_executable(x src/main.c)\n',
    'src/main.c': 'int main(void){return 0;}\n',
  });
  assert.ok(ids(r).has('CMK-002'));
  assert.ok(!ids(r).has('CMK-001'));
});

test('CMK-002: toolchain evidence may live in a .cmake file', async () => {
  const r = await analyzeFiles({
    'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\nproject(x C)\nset(CMAKE_TOOLCHAIN_FILE cmake/qnx-toolchain.cmake)\nadd_executable(x src/main.c)\n',
    'cmake/qnx-toolchain.cmake': 'set(CMAKE_SYSTEM_NAME QNX)\nset(CMAKE_C_COMPILER qcc)\n',
    'src/main.c': 'int main(void){return 0;}\n',
  });
  assert.ok(ids(r).has('CMK-002'));
  assert.ok(!ids(r).has('CMK-001'));
});

test('no CMake files: no CMK findings', async () => {
  const r = await analyzeFiles({
    'common.mk': 'NAME=x\nINSTALLDIR=usr/bin\ninclude qconfig.mk\ninclude $(MKFILES_ROOT)/qtargets.mk\n',
  });
  assert.ok(![...ids(r)].some((id) => id.startsWith('CMK-')));
});
