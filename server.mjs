import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { classifyHostLine, ipv4Addresses } from './session.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const upstream = join(root, 'upstream', 'ns2jb');
const nxhid = join(root, 'upstream', 'nxhid-release');
const expectedCommit = '95f5525089273c5fce0b95047f3600f8442e96ae';
const expectedBootstrapHash = '2261f65fb9ec0ed708ce0f0b6da5057168f706e541d956f658a3c2655e9e8c36';
const expectedSenderHash = 'bd6439788048b8fd1c637cff5f63a5dcef9436db8519bdee8ed6a0ded39ecd31';
const expectedNroHash = '88e016a11c296760cfdee9624f7fcd63dc20b21b9dc3d9b923d64fa6152605a3';
const port = Number(process.env.SWITCH2_WIZARD_PORT || 39381);
const bind = process.env.SWITCH2_WIZARD_BIND || '127.0.0.1';
const session = { status: 'idle', stage: 0, command: '', events: [], hostIp: '', verified: false };
const transfer = { status: 'idle', mode: '', switchIp: '', message: '' };
const ftpInstall = { status: 'idle', switchIp: '', message: '', backup: '' };
let child = null;
let sender = null;
let uploader = null;

function matchesHash(path, expected) {
  try { return createHash('sha256').update(readFileSync(path)).digest('hex') === expected; }
  catch { return false; }
}

function nxhidReady() {
  return matchesHash(join(nxhid, 'client', 'nxhid.py'), expectedSenderHash) &&
    matchesHash(join(nxhid, 'switch', 'nxhid', 'nxhid.nro'), expectedNroHash);
}

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
  return { ...session, events: [...session.events], transfer: { ...transfer }, ftpInstall: { ...ftpInstall }, nxhidReady: nxhidReady(), upstreamReady: upstreamReady(), hostAddresses: ipv4Addresses(networkInterfaces()), expectedCommit };
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
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
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

function sendNxhid(switchIp, mode) {
  transfer.status = 'running'; transfer.mode = mode; transfer.switchIp = switchIp;
  transfer.message = mode === 'probe' ? 'Sending one test line.' : 'Sending the pinned bootstrap. Keep both consoles awake and leave the editor open.';
  event('system', `NXHID ${mode} transfer started to original Switch at ${switchIp}.`);
  const args = [join(nxhid, 'client', 'nxhid.py'), switchIp, 'text'];
  if (mode === 'probe') args.push('PRINT "USB OK"');
  else args.push('--delay', '0.02', '--newline-sequence', 'ENTER,HOME,CTRL+DELETE', '--file', join(upstream, 'bootstrap.bas'));
  sender = spawn('python3', args, { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let errorText = '';
  sender.stderr.setEncoding('utf8');
  sender.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-400); });
  sender.on('error', error => {
    transfer.status = 'failed'; transfer.message = error.message;
    event('error', `NXHID sender could not start: ${error.message}`); sender = null;
  });
  sender.on('close', code => {
    if (transfer.status !== 'failed') {
      transfer.status = code === 0 ? 'sent' : 'failed';
      transfer.message = code === 0
        ? (mode === 'probe' ? 'Test line sent. Confirm it appears correctly on the Switch 2.' : 'Transfer finished. Check the full program on the Switch 2, then save it as NS2.')
        : (errorText.trim() || `Sender stopped with code ${code}.`);
      event(code === 0 ? 'system' : 'error', `NXHID ${mode}: ${transfer.message}`);
    }
    sender = null;
  });
}

function installNxhidOverFtp(options) {
  ftpInstall.status = 'running'; ftpInstall.switchIp = options.switchIp;
  ftpInstall.message = 'Uploading and reading back the NXHID app from the original Switch SD card.';
  ftpInstall.backup = '';
  event('system', `NXHID FTP install started to original Switch at ${options.switchIp}:${options.port}.`);
  uploader = spawn('python3', [join(root, 'scripts', 'upload_nxhid_ftp.py')], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 });
  let output = '', errors = '';
  uploader.stdout.setEncoding('utf8'); uploader.stderr.setEncoding('utf8');
  uploader.stdout.on('data', chunk => { output = (output + chunk).slice(-2000); });
  uploader.stderr.on('data', chunk => { errors = (errors + chunk).slice(-400); });
  uploader.stdin.end(JSON.stringify(options));
  uploader.on('error', error => {
    ftpInstall.status = 'failed'; ftpInstall.message = error.message;
    event('error', `NXHID FTP upload could not start: ${error.message}`); uploader = null;
  });
  uploader.on('close', code => {
    if (ftpInstall.status !== 'failed') {
      let result;
      try { result = JSON.parse(output); } catch { result = { status: 'failed', error: errors.trim() || 'FTP uploader returned no result.' }; }
      ftpInstall.status = code === 0 && result.status !== 'failed' ? 'installed' : 'failed';
      ftpInstall.backup = typeof result.backup === 'string' ? result.backup : '';
      ftpInstall.message = ftpInstall.status === 'installed'
        ? (result.status === 'already_installed' ? 'NXHID is already installed with the verified file.' : `NXHID uploaded and read back successfully.${ftpInstall.backup ? ` Previous file saved as ${ftpInstall.backup}.` : ''} Close the FTP app, then launch NXHID in full application mode.`)
        : (result.error || errors.trim() || `FTP uploader stopped with code ${code}.`);
      event(ftpInstall.status === 'installed' ? 'system' : 'error', `NXHID FTP: ${ftpInstall.message}`);
    }
    uploader = null;
  });
}

const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]]);
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
    if (child || sender || uploader) return json(res, 409, { error: 'A transfer or host session is already running.' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'Request too large.' }); }
    let hostIp;
    try { hostIp = JSON.parse(body).hostIp; } catch { return json(res, 400, { error: 'Invalid request.' }); }
    if (!ipv4Addresses(networkInterfaces()).includes(hostIp)) return json(res, 400, { error: 'Choose an address assigned to this computer.' });
    start(hostIp);
    return json(res, 202, snapshot());
  }
  if (req.method === 'POST' && pathname === '/api/nxhid/send') {
    if (!allowedOrigin(req) || req.headers['x-switch2-local'] !== '1') return json(res, 403, { error: 'Open the LAN wizard to send through NXHID.' });
    if (!upstreamReady() || !matchesHash(join(upstream, 'bootstrap.bas'), expectedBootstrapHash)) return json(res, 409, { error: 'Pinned bootstrap is missing or changed.' });
    if (!nxhidReady()) return json(res, 409, { error: 'Verified NXHID release is missing. Run sh scripts/fetch-nxhid.sh.' });
    if (sender || child || uploader) return json(res, 409, { error: 'A transfer or host session is already running.' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 256) return json(res, 413, { error: 'Request too large.' }); }
    let switchIp, mode, editorReady;
    try { ({ switchIp, mode, editorReady } = JSON.parse(body)); } catch { return json(res, 400, { error: 'Invalid request.' }); }
    if (typeof switchIp !== 'string' || !privateIp(switchIp)) return json(res, 400, { error: 'Enter the original Switch IP shown by NXHID.' });
    if (!['probe', 'bootstrap'].includes(mode) || editorReady !== true) return json(res, 400, { error: 'Confirm the target editor is open and select a valid transfer.' });
    sendNxhid(switchIp, mode);
    return json(res, 202, snapshot());
  }
  if (req.method === 'POST' && pathname === '/api/nxhid/install') {
    if (!allowedOrigin(req) || req.headers['x-switch2-local'] !== '1') return json(res, 403, { error: 'Open the LAN wizard to install NXHID over FTP.' });
    if (!nxhidReady()) return json(res, 409, { error: 'Verified NXHID release is missing. Run sh scripts/fetch-nxhid.sh.' });
    if (sender || child || uploader) return json(res, 409, { error: 'A transfer or host session is already running.' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 512) return json(res, 413, { error: 'Request too large.' }); }
    let options;
    try { options = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid request.' }); }
    const { switchIp, port = 5000, username = '', password = '', ftpReady } = options;
    if (typeof switchIp !== 'string' || !privateIp(switchIp)) return json(res, 400, { error: 'Enter the original Switch private LAN IP.' });
    if (!Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, { error: 'Enter the FTP port shown on the original Switch.' });
    if (typeof username !== 'string' || username.length > 64 || typeof password !== 'string' || password.length > 128) return json(res, 400, { error: 'Invalid FTP credentials.' });
    if (ftpReady !== true) return json(res, 400, { error: 'Confirm the FTP server is running on the original Switch.' });
    installNxhidOverFtp({ switchIp, port, username, password });
    return json(res, 202, snapshot());
  }
  const file = files.get(pathname);
  if (req.method !== 'GET' || !file) return json(res, 404, { error: 'Not found.' });
  const [name, type] = file;
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'" });
  res.end(readFileSync(join(root, 'public', name)));
});

server.listen(port, bind, () => console.log(`LAN wizard: http://${bind}:${port}/`));
