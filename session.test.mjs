import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHostLine, ipv4Addresses } from './session.mjs';

test('only exact upstream completion marks a run verified', () => {
  assert.equal(classifyHostLine('FS execution verified. Original instructions restored and scratch cleaned up.').verified, true);
  assert.equal(classifyHostLine('FS execution verified maybe').verified, false);
  assert.equal(classifyHostLine('4/4 complete').stage, 4);
  assert.equal(classifyHostLine('V=START(1,2,3)').command, 'V=START(1,2,3)');
});

test('host choices exclude loopback and duplicates', () => {
  assert.deepEqual(ipv4Addresses({ a: [{ family: 'IPv4', internal: false, address: '192.168.1.10' }], b: [{ family: 'IPv4', internal: false, address: '192.168.1.10' }, { family: 'IPv4', internal: true, address: '127.0.0.1' }] }), ['192.168.1.10']);
});
