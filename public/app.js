const $ = id => document.getElementById(id);
const local = ['localhost', '127.0.0.1'].includes(location.hostname) || location.port === '39381';
const requiredSystem = '23.0.1';
const requiredSmile = '4.4.9';
const params = new URLSearchParams(location.search);
let activeStep = 1;
let state = null;
let deviceConfirmed = false;

function validIp(value) {
  const pieces = value.trim().split('.');
  return pieces.length === 4 && pieces.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function showStep(step) {
  activeStep = step;
  document.querySelectorAll('.step').forEach(button => button.classList.toggle('active', Number(button.dataset.step) === step));
  document.querySelectorAll('.step-panel').forEach(panel => panel.classList.toggle('visible', Number(panel.dataset.panel) === step));
}

function markSteps() {
  const done = [deviceConfirmed, deviceConfirmed && $('bootstrap-ready').checked, deviceConfirmed && $('bootstrap-ready').checked && !!state?.upstreamReady, state?.status === 'verified'];
  document.querySelectorAll('.step').forEach((button, index) => button.classList.toggle('done', !!done[index]));
  const checks = [
    [deviceConfirmed, 'Versions entered and manually confirmed'],
    [$('bootstrap-ready').checked, 'NS2 saved in SmileBASIC slot 0'],
    [!!state?.upstreamReady, 'Pinned upstream host available on this LAN computer'],
    [!!$('host-ip').value, 'Host LAN address selected']
  ];
  $('run-checks').replaceChildren(...checks.map(([ok, label]) => {
    const row = document.createElement('div'); row.textContent = label; row.classList.toggle('ok', ok); return row;
  }));
  $('start-run').disabled = !checks.every(([ok]) => ok) || ['waiting', 'connected'].includes(state?.status);
  $('run-note').textContent = state?.status === 'verified' ? 'FS demo verified by upstream host.' : state?.status === 'failed' ? 'Host stopped. Review the event log and restart the console before retrying.' : 'Only start after the Switch 2 is freshly booted and SmileBASIC is open.';
}

function renderState(data) {
  state = data;
  $('host-dot').classList.add('connected');
  $('host-label').textContent = 'LAN companion connected';
  $('host-detail').textContent = data.upstreamReady ? 'Pinned ns2jb checkout is ready.' : 'Run sh scripts/fetch-upstream.sh on the host.';
  $('local-controls').hidden = false;
  $('companion-address-field').hidden = true;
  $('open-local').hidden = true;
  const select = $('host-ip');
  const old = select.value;
  select.replaceChildren(...data.hostAddresses.map(ip => new Option(ip, ip)));
  if (data.hostAddresses.includes(old)) select.value = old;
  else if (data.hostAddresses.includes(localStorage.getItem('switch2-host-ip'))) select.value = localStorage.getItem('switch2-host-ip');
  select.onchange = () => { localStorage.setItem('switch2-host-ip', select.value); markSteps(); };
  $('session-heading').textContent = ({ idle: 'Ready for a session', waiting: 'Waiting for Switch 2', connected: 'Switch 2 connected', verified: 'FS demo verified', failed: 'Host session stopped' })[data.status] || 'Host status unknown';
  $('session-message').textContent = data.status === 'verified' ? 'Upstream verified its FS demo. Restart the console when finished.' : data.status === 'waiting' ? 'On Switch 2, enter the three short Direct mode commands. Then enter the fresh host command below.' : data.status === 'failed' ? 'Review the last event. The demo did not pass.' : 'The event log below records host output from an actual run.';
  const stage = Math.min(4, Math.max(0, Number(data.stage) || 0));
  $('progress-fill').style.width = (stage * 25) + '%';
  $('progress-count').textContent = stage ? `${stage}/4` : '—';
  $('progress-label').textContent = stage ? 'Upstream reported stage' : 'Run progress starts when the host reports a stage';
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(stage));
  $('switch-command').hidden = !data.command;
  $('start-command').textContent = data.command || '';
  $('event-count').textContent = String(data.events.length);
  $('event-log').replaceChildren(...(data.events.length ? data.events.slice(-12).map(item => {
    const li = document.createElement('li'); li.className = item.kind === 'error' ? 'error' : '';
    const time = document.createElement('time'); time.textContent = new Date(item.time).toLocaleTimeString();
    const message = document.createElement('span'); message.textContent = item.message;
    li.append(time, message); return li;
  }) : [(() => { const li = document.createElement('li'); li.textContent = 'No session started'; return li; })()]));
  document.body.classList.toggle('success', data.status === 'verified');
  markSteps();
}

async function refresh() {
  if (!local) return;
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Host unavailable');
    renderState(await response.json());
  } catch {
    state = null;
    $('host-dot').classList.remove('connected');
    $('host-label').textContent = 'Local companion disconnected';
    $('host-detail').textContent = 'Start node server.mjs on your NAS or computer.';
    markSteps();
  }
}

function updateCompanionLink() {
  let value = $('companion-address').value.trim();
  try {
    if (value && !/^https?:\/\//i.test(value)) value = 'http://' + value;
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    if (url.username || url.password) throw new Error();
    if (!url.port) url.port = '39381';
    localStorage.setItem('switch2-companion-url', url.origin + url.pathname);
    for (const [key, id] of [['system', 'system-version'], ['smile', 'smile-version'], ['console', 'console-ip']]) {
      if ($(id).value.trim()) url.searchParams.set(key, $(id).value.trim());
    }
    $('open-local').href = url.href;
  } catch { $('open-local').href = 'http://127.0.0.1:39381/'; }
}

document.querySelectorAll('.step').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.step))));
for (const [id, key] of [['system-version', 'system'], ['smile-version', 'smile'], ['console-ip', 'console']]) {
  $(id).value = params.get(key) || localStorage.getItem('switch2-' + key) || '';
  $(id).addEventListener('input', () => { localStorage.setItem('switch2-' + key, $(id).value); deviceConfirmed = false; markSteps(); updateCompanionLink(); });
}
$('bootstrap-ready').checked = localStorage.getItem('switch2-bootstrap') === 'true';
$('bootstrap-ready').addEventListener('change', () => { localStorage.setItem('switch2-bootstrap', String($('bootstrap-ready').checked)); markSteps(); });
$('check-device').addEventListener('click', () => {
  const okay = $('system-version').value.trim() === requiredSystem && $('smile-version').value.trim() === requiredSmile && validIp($('console-ip').value);
  deviceConfirmed = okay;
  $('device-result').textContent = okay ? 'Values match the pinned procedure. These are your entries, not automatic device detection.' : 'Enter system 23.0.1, SmileBASIC 4.4.9, and a valid console IP.';
  $('device-result').classList.toggle('error', !okay);
  markSteps();
  if (okay) showStep(2);
});
$('ping-device').addEventListener('click', async () => {
  if (!validIp($('console-ip').value)) { $('device-result').textContent = 'Enter a valid private LAN IP first.'; return; }
  if (!local) { showStep(3); $('device-result').textContent = 'Open the LAN wizard first; the public page cannot ping your console.'; return; }
  $('device-result').textContent = 'Checking from this host…';
  try {
    const response = await fetch('/api/check-device', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Switch2-Local': '1' }, body: JSON.stringify({ address: $('console-ip').value.trim() }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $('device-result').textContent = result.reachable ? 'IP responds from this host. Identity and versions still need manual confirmation.' : 'No ping reply. Check the IP and LAN; some devices block ping.';
  } catch (error) { $('device-result').textContent = error.message || 'Reachability check failed.'; }
});
$('to-host').addEventListener('click', () => { if ($('bootstrap-ready').checked) showStep(3); else alert('First confirm that NS2 is saved in SmileBASIC slot 0.'); });
$('refresh-host').addEventListener('click', refresh);
$('start-run').addEventListener('click', async () => {
  const hostIp = $('host-ip').value;
  if (!hostIp) return;
  $('start-run').disabled = true;
  try {
    const response = await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Switch2-Local': '1' }, body: JSON.stringify({ hostIp }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not start the host.');
    renderState(result);
  } catch (error) { $('run-note').textContent = error.message; $('run-note').classList.add('error'); await refresh(); }
});
$('copy-command').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('start-command').textContent); $('copy-command').textContent = 'Copied'; } catch { $('copy-command').textContent = 'Select and copy the command'; } });
const suggestedHost = params.get('host');
$('companion-address').value = suggestedHost || localStorage.getItem('switch2-companion-url') || '';
$('companion-address').addEventListener('input', updateCompanionLink);
updateCompanionLink();
if (local) { refresh(); setInterval(refresh, 1200); } else { $('session-message').textContent = 'Enter your NAS LAN address in step 3 and open the companion wizard.'; }
markSteps();
