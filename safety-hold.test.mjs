import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

test('LAN API refuses FS execution while safety hold is active', async () => {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: import.meta.dirname,
    env: { ...process.env, SWITCH2_WIZARD_BIND: '127.0.0.1', SWITCH2_WIZARD_PORT: String(port) },
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let state;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`${base}/api/state`);
        if (response.ok) { state = await response.json(); break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(state, 'companion started');
    assert.equal(state.fsDemoSafetyHold, true);
    const response = await fetch(`${base}/api/start`, {
      method: 'POST',
      headers: { Origin: base, 'X-Switch2-Local': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostIp: '127.0.0.1' })
    });
    assert.equal(response.status, 423);
    assert.match((await response.json()).error, /paused/);
    const after = await (await fetch(`${base}/api/state`)).json();
    assert.equal(after.status, 'idle');
    assert.equal(after.stage, 0);
    assert.equal(after.command, '');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
});
