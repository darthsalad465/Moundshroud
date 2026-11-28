'use strict';

const levels = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];
const byId = id => document.getElementById(id);
const reports = {};

function readReport(raw) {
  const report = JSON.parse(raw);
  if (!Array.isArray(report?.vulnerabilities)) throw new Error('Choose a Deep Eye JSON report.');
  const findings = new Map();
  let incomplete = 0;
  for (const item of report.vulnerabilities) {
    let url;
    try { url = new URL(item?.url); } catch { incomplete++; continue; }
    if (!['https:', 'http:'].includes(url.protocol) || typeof item.type !== 'string' || !item.type.trim()) {
      incomplete++;
      continue;
    }
    url.username = url.password = url.hash = '';
    url.searchParams.sort();
    const type = item.type.trim();
    const severity = String(item.severity ?? '').toLowerCase();
    const finding = {
      type, severity: levels.includes(severity) ? severity : 'unknown',
      location: url.origin + url.pathname,
      remediation: typeof item.remediation === 'string' ? item.remediation : ''
    };
    const key = JSON.stringify([type, url.href, String(item.parameter ?? '')]);
    const prior = findings.get(key);
    if (!prior || levels.indexOf(finding.severity) < levels.indexOf(prior.severity)) findings.set(key, finding);
  }
  return { findings, incomplete, target: typeof report.target === 'string' ? report.target : '' };
}

function draw() {
  const current = reports.current;
  const baseline = reports.baseline;
  const comparable = current && baseline && !current.incomplete && !baseline.incomplete && current.target === baseline.target;
  const rows = [];
  const findings = byId('findings');
  findings.replaceChildren();
  if (current) {
    for (const [key, finding] of current.findings) {
      const previous = comparable ? baseline.findings.get(key) : null;
      const change = !comparable ? '' : !previous ? 'New' : previous.severity !== finding.severity ? 'Severity changed' : 'Unchanged';
      rows.push({ ...finding, change });
    }
    if (comparable) for (const [key, finding] of baseline.findings) {
      if (!current.findings.has(key)) rows.push({ ...finding, change: 'Absent from current report' });
    }
  }
  rows.sort((a, b) => levels.indexOf(a.severity) - levels.indexOf(b.severity));
  const visible = rows.filter(row => !byId('severity').value || row.severity === byId('severity').value);
  byId('summary').textContent = !current ? 'Choose a current report.' :
    `${visible.length} findings match. ${baseline && !comparable ? 'Comparison requires matching targets and complete entries.' :
      comparable ? 'Verify absent findings before marking them resolved.' : ''}`;
  for (const row of visible.slice(0, 250)) {
    const card = document.createElement('details');
    const heading = document.createElement('summary');
    const place = document.createElement('p');
    const remediation = document.createElement('p');
    heading.textContent = [row.type, row.severity, row.change].filter(Boolean).join(' · ');
    place.textContent = row.location;
    remediation.textContent = row.remediation || 'No remediation provided.';
    card.append(heading, place, remediation);
    findings.append(card);
  }
  if (visible.length > 250) byId('summary').textContent += ' Showing the first 250. Filter by severity to narrow the list.';
}

for (const id of ['current', 'baseline']) {
  const input = byId(id);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    const status = byId(id + '-status');
    delete reports[id];
    status.textContent = '';
    draw();
    if (!file) return;
    try {
      if (file.size > 10 * 1024 ** 2) throw new Error('Reports must be at most 10 MiB.');
      const parsed = readReport(await file.text());
      if (input.files[0] !== file) return;
      reports[id] = parsed;
      status.textContent = `${parsed.findings.size} distinct findings${parsed.incomplete ? `, ${parsed.incomplete} incomplete entries` : ''}`;
    } catch (error) {
      if (input.files[0] !== file) return;
      status.textContent = error instanceof SyntaxError ? 'The report is not valid JSON.' : error.message;
    }
    draw();
  });
}
byId('severity').addEventListener('change', draw);
byId('hash').addEventListener('change', async event => {
  const input = event.target;
  const file = input.files[0];
  const output = byId('checksum');
  output.textContent = '';
  if (!file) return;
  if (file.size > 64 * 1024 ** 2) { output.textContent = 'Choose a file up to 64 MiB.'; return; }
  try {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    if (input.files[0] === file) output.textContent = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    if (input.files[0] === file) output.textContent = error.message;
  }
});
draw();
