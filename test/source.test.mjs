// Tests for the source-scan rules (SRC-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, ids } from './helpers.mjs';

test('SRC-001: POSIX-only source with no QNX markers', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <stdio.h>\n#include <pthread.h>\nint main(void){printf("hi\\n");return 0;}\n',
  });
  assert.ok(ids(r).has('SRC-001'));
  assert.ok(!ids(r).has('SRC-002'));
});

test('SRC-002: QNX markers are reported as info, SRC-001 does not fire', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <sys/neutrino.h>\nint main(void){int c=ChannelCreate(0);int rcv;char b[8];MsgReceive(c,&b,8,0);return 0;}\n',
  });
  assert.ok(ids(r).has('SRC-002'));
  assert.ok(!ids(r).has('SRC-001'));
  assert.ok(r.markers.includes('ChannelCreate'));
  assert.ok(r.markers.includes('sys/neutrino.h'));
  assert.ok(r.markers.includes('MsgReceive'));
});

test('SRC-002: resmgr/dispatch markers are detected', async () => {
  const r = await analyzeFiles({
    'src/srv.c': '#include <sys/dispatch.h>\n#include <sys/resmgr.h>\nint main(void){dispatch_t *d=dispatch_create();resmgr_attach(d,0,"/dev/x",0,0,0,0,0);return 0;}\n',
  });
  assert.ok(r.markers.includes('dispatch_create'));
  assert.ok(r.markers.includes('resmgr_attach'));
  assert.ok(r.markers.includes('sys/dispatch.h'));
});

test('SRC-003: SCHED_FIFO without a priority set', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <pthread.h>\nint main(void){pthread_attr_t a;pthread_attr_setschedpolicy(&a,SCHED_FIFO);return 0;}\n',
  });
  assert.ok(ids(r).has('SRC-003'));
});

test('SRC-003: SCHED_FIFO with pthread_setschedparam is fine', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <pthread.h>\nint main(void){pthread_attr_t a;struct sched_param p;p.sched_priority=10;pthread_attr_setschedpolicy(&a,SCHED_FIFO);pthread_attr_setschedparam(&a,&p);return 0;}\n',
  });
  assert.ok(!ids(r).has('SRC-003'));
});

test('SRC-004: ChannelCreate without a MsgReceive loop', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <sys/neutrino.h>\nint main(void){int c=ChannelCreate(0);(void)c;return 0;}\n',
  });
  assert.ok(ids(r).has('SRC-004'));
});

test('SRC-004: ChannelCreate with MsgReceive is fine', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <sys/neutrino.h>\nint main(void){int c=ChannelCreate(0);char b[8];MsgReceive(c,b,8,0);return 0;}\n',
  });
  assert.ok(!ids(r).has('SRC-004'));
});

test('SRC-005: MsgSend with a hardcoded numeric channel id', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <sys/neutrino.h>\nint main(void){char m[4];int r;MsgSend(3,m,4,&r,4);return 0;}\n',
  });
  assert.ok(ids(r).has('SRC-005'));
});

test('SRC-005: MsgSend on a connection id from name_open is fine', async () => {
  const r = await analyzeFiles({
    'src/main.c': '#include <sys/neutrino.h>\nint main(void){int coid=name_open("srv",0);char m[4];int r;MsgSend(coid,m,4,&r,4);return 0;}\n',
  });
  assert.ok(!ids(r).has('SRC-005'));
});

test('no source files: no SRC findings', async () => {
  const r = await analyzeFiles({ 'README.md': 'hello\n' });
  assert.ok(![...ids(r)].some((id) => id.startsWith('SRC-')));
});
