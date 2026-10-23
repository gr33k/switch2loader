import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { classifyHostLine, ipv4Addresses } from './session.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const upstream = join(root, 'upstream', 'ns2jb');
const expectedCommit = '95f5525089273c5fce0b95047f3600f8442e96ae';
const port = Number(process.env.SWITCH2_WIZARD_PORT || 39381);
const bind = process.env.SWITCH2_WIZARD_BIND || '127.0.0.1';
const session = { status: 'idle', stage: 0, command: '', events: [], hostIp: '', verified: false };
let child = null;

function upstreamReady() {
  if (!existsSync(join(upstream, 'run.cjs'))) return false;
  try {
    return execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 2000 }).trim() === expectedCommit;
  } catch { return false; }
}

function event(kind, message) {
  session.events.push({ time: new Date().toISOString(), kind, message });
  if (session.events.length > 50) session.events.shift();
}

function snapshot() {
  return { ...session, events: [...session.events], upstreamReady: upstreamReady(), hostAddresses: ipv4Addresses(networkInterfaces()), expectedCommit };
}

function json(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

function allowedOrigin(req) {
  const allowedHosts = ['127.0.0.1', 'localhost', ...ipv4Addresses(networkInterfaces())];
  return allowedHosts.some(host => req.headers.origin === `http://${host}:${port}` || req.headers.origin === `https://${host}:${port}`);
}

function privateIp(value) {
  const bytes = value.split('.').map(Number);
  return bytes.length === 4 && bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255) &&
    (bytes[0] === 10 || (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31) || (bytes[0] === 192 && bytes[1] === 168));
}

function parseStream(stream, kind) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    pending += chunk;
    while (pending.includes('\n')) {
      const at = pending.indexOf('\n');
      const line = pending.slice(0, at).trim();
      pending = pending.slice(at + 1);
      if (!line) continue;
      event(kind, line);
      const result = classifyHostLine(line);
      if (result.stage) session.stage = Math.max(session.stage, result.stage);
      if (result.command) session.command = result.command;
      if (result.verified) session.verified = true;
      if (result.connected && session.status === 'waiting') session.status = 'connected';
    }
  });
  stream.on('end', () => { if (pending.trim()) event(kind, pending.trim()); });
}

function start(hostIp) {
  session.status = 'waiting'; session.stage = 0; session.command = ''; session.events = []; session.hostIp = hostIp; session.verified = false;
  event('system', `Starting pinned ns2jb host on ${hostIp}:39380`);
  child = spawn(process.execPath, [join(upstream, 'run.cjs'), hostIp], { cwd: upstream, stdio: ['ignore', 'pipe', 'pipe'] });
  parseStream(child.stdout, 'stdout');
  parseStream(child.stderr, 'stderr');
  child.on('error', error => { session.status = 'failed'; event('error', error.message); child = null; });
  child.on('close', code => {
    if (session.status !== 'failed') session.status = code === 0 && session.verified ? 'verified' : 'failed';
    event(session.status === 'verified' ? 'success' : 'error', session.status === 'verified' ? 'FS execution verified by upstream host.' : `Host process stopped with code ${code}. Keep the upstream runs folder and restart the console before retrying.`);
    child = null;
  });
}

const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]]);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, snapshot());
  if (req.method === 'POST' && pathname === '/api/check-device') {
    if (!allowedOrigin(req) || req.headers['x-switch2-local'] !== '1') return json(res, 403, { error: 'Open the LAN wizard to check this address.' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 256) return json(res, 413, { error: 'Request too large.' }); }
    let address;
    try { address = JSON.parse(body).address; } catch { return json(res, 400, { error: 'Invalid request.' }); }
    if (typeof address !== 'string' || !privateIp(address)) return json(res, 400, { error: 'Enter a private LAN IPv4 address.' });
    const flags = process.platform === 'darwin' ? ['-c', '1', '-W', '2000', address] : ['-c', '1', '-W', '2', address];
    return execFile('ping', flags, { timeout: 3000 }, error => json(res, 200, { reachable: !error, address, note: 'Ping confirms reachability only; it cannot identify the console or its software versions.' }));
  }
  if (req.method === 'POST' && pathname === '/api/start') {
    if (!allowedOrigin(req) || req.headers['x-switch2-local'] !== '1') return json(res, 403, { error: 'Open the LAN wizard and use its Start button.' });
    if (!upstreamReady()) return json(res, 409, { error: 'Pinned upstream checkout is missing. Run sh scripts/fetch-upstream.sh.' });
    if (child) return json(res, 409, { error: 'A host session is already running.' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'Request too large.' }); }
    let hostIp;
    try { hostIp = JSON.parse(body).hostIp; } catch { return json(res, 400, { error: 'Invalid request.' }); }
    if (!ipv4Addresses(networkInterfaces()).includes(hostIp)) return json(res, 400, { error: 'Choose an address assigned to this computer.' });
    start(hostIp);
    return json(res, 202, snapshot());
  }
  const file = files.get(pathname);
  if (req.method !== 'GET' || !file) return json(res, 404, { error: 'Not found.' });
  const [name, type] = file;
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'" });
  res.end(readFileSync(join(root, 'public', name)));
});

server.listen(port, bind, () => console.log(`LAN wizard: http://${bind}:${port}/`));
