// Repositories from GitHub: download one (the built-in list, or any link you paste), then every page in it is read by
// lib/docs.js so your own models can answer questions about it offline, citing the file the answer came from.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const net = require('./net'), docs = require('./docs'), safety = require('./safety');

const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'data', 'refs'), FILE = path.join(ROOT, 'data', 'refs.json');
const jobs = new Map();

/* the ready-made list: what it is, how big a download, and its licence, so nothing arrives as a surprise */
const BUILTIN = [
  { slug: 'payloads', name: 'PayloadsAllTheThings', repo: 'swisskyrepo/PayloadsAllTheThings', size: '23 MB', lic: 'MIT', about: 'Payloads, bypasses and notes for web app security and CTF work, sorted by attack type.' },
  { slug: 'hacktricks', name: 'HackTricks', repo: 'HackTricks-wiki/hacktricks', size: '1.1 GB', lic: 'CC BY-SA (wiki)', about: 'The HackTricks wiki: enumeration, privilege escalation, Active Directory, cloud, hardware, radio.' },
  { slug: 'awesome-hacking', name: 'Awesome Hacking', repo: 'Hack-with-Github/Awesome-Hacking', size: '1 MB', lic: 'CC0', about: 'A directory of hacking, pentest and security learning lists.' },
  { slug: 'awesome-pentest', name: 'Awesome Pentest', repo: 'enaqx/awesome-pentest', size: '1 MB', lic: 'see repo', about: 'Curated pentest tools, books, courses and resources.' },
  { slug: 'bugbounty', name: 'Awesome Bug Bounty', repo: 'djadmin/awesome-bug-bounty', size: '<1 MB', lic: 'CC0', about: 'Bug bounty programmes, write-ups, dorks and disclosure resources.' },
  { slug: 'seclists', name: 'SecLists', repo: 'danielmiessler/SecLists', size: '3.7 GB', lic: 'MIT', about: 'Wordlists: usernames, passwords, fuzzing strings and discovery lists. Big; take it only if you have the disk.' }
];

const readUser = () => { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(j) ? j.filter(x => x && x.slug && x.repo) : []; } catch (e) { return []; } };
const writeUser = list => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list)); fs.renameSync(tmp, FILE); } catch (e) { } };
const all = () => BUILTIN.map(b => Object.assign({ built: true }, b)).concat(readUser().filter(u => !BUILTIN.some(b => b.slug === u.slug)));
const find = s => all().find(c => c.slug === String(s || '').toLowerCase());
const dirOf = c => path.join(DIR, c.slug);

/* "https://github.com/owner/repo", "owner/repo", "git@github.com:owner/repo.git" ... -> { owner, repo } */
function parse(input) {
  let s = String(input || '').trim().replace(/\/+$/, '');
  if (!s) return null;
  s = s.replace(/^git@github\.com:/i, '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/i, '');
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s);
  return m ? { owner: m[1], repo: m[2], full: m[1] + '/' + m[2] } : null;
}

function count(dir) {
  let files = 0, bytes = 0;
  const walk = d => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { files++; try { bytes += fs.statSync(p).size; } catch (err) { } }
    }
  };
  walk(dir);
  return { files, bytes };
}

/* the safety check for one repository, kept in data\safety.json so the card can show a verdict straight away */
const scanning = new Set();
function scan(slug, dir) {
  if (scanning.has(slug)) return Promise.resolve(safety.get(slug));
  scanning.add(slug);
  return safety.scanTree(dir || dirOf(find(slug) || {})).then(res => { scanning.delete(slug); if (res && !res.error) return safety.save(slug, res); return safety.get(slug); }).catch(() => { scanning.delete(slug); return null; });
}
function check(slug) {
  const c = find(slug); if (!c) return Promise.resolve({ error: 'That library is not in the list.' });
  if (!fs.existsSync(dirOf(c))) return Promise.resolve({ error: 'Download it first.' });
  return scan(c.slug, dirOf(c)).then(s => ({ ok: true, safety: s, refs: status() }));
}

function status() {
  return all().map(c => {
    const dir = dirOf(c), on = fs.existsSync(dir), j = jobs.get(c.slug);
    const n = on ? count(dir) : { files: 0, bytes: 0 };
    const s = on ? safety.get(c.slug) : null;
    return {
      slug: c.slug, name: c.name, repo: c.repo, url: 'https://github.com/' + c.repo, about: c.about || '', size: c.size || '?', lic: c.lic || 'see repo',
      built: !!c.built, installed: on, files: n.files, bytes: n.bytes, dir, job: j ? { state: j.state, pct: j.pct, said: j.said } : null,
      safety: s ? { level: s.level, counts: s.counts, at: s.at, files: s.files, checking: scanning.has(c.slug) } : { level: '', checking: scanning.has(c.slug) }
    };
  });
}

function ensureSource() { try { docs.addSource(DIR); } catch (e) { } }

/* the message from git, turned into something readable in the card */
function watch(job, child, part, dir, then) {
  const line = l => {
    l = String(l).trim(); if (!l) return;
    const m = /(\d+)%/.exec(l); if (m) job.pct = +m[1];
    if (/Receiving objects|Resolving deltas|Counting objects|Compressing objects|Cloning into|Updating|Fast-forward/.test(l)) job.said = l.replace(/\s+/g, ' ').slice(0, 120);
    if (/fatal|error:/i.test(l)) job.said = l.slice(0, 160);
  };
  child.stderr.on('data', d => String(d).split(/\r?\n/).forEach(line));
  child.on('error', () => { job.state = 'failed'; job.said = 'git could not start. Is Git for Windows installed?'; });
  child.on('close', code => {
    if (code !== 0) { job.state = 'failed'; job.said = job.said || 'git failed.'; if (part) { try { fs.rmSync(part, { recursive: true, force: true }); } catch (e) { } } return; }
    if (part) { try { fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(part, dir); } catch (e) { job.state = 'failed'; job.said = 'The download finished but could not be moved into place.'; return; } }
    job.state = 'done'; job.pct = 100; job.said = then || 'Downloaded and indexed.';
    ensureSource(); docs.reindex().catch(() => { });
    /* every repository is checked for dangerous files as soon as it lands, without being asked */
    scan(job.slug, dir);
  });
}

/* download: either a slug from the list, or any GitHub link / owner/repo you paste */
function install(input) {
  if (!net.on()) return { error: 'Downloads need internet access. Turn it on in Settings, AI & power.' };
  const raw = String(input || '').trim();
  let c = find(raw);
  if (!c) {
    const p = parse(raw);
    if (!p) return { error: 'That is not a GitHub repository. Paste a link like https://github.com/owner/repo' };
    c = all().find(x => x.repo.toLowerCase() === p.full.toLowerCase());
    if (!c) {
      let slug = p.repo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'repo';
      if (all().some(x => x.slug === slug)) slug += '-' + Date.now().toString(36).slice(-3);
      c = { slug, name: p.repo, repo: p.full, size: '?', lic: 'see repo', about: 'Added by you.' };
      const users = readUser(); users.push({ slug: c.slug, name: c.name, repo: c.repo, about: c.about }); writeUser(users);
    }
  }
  const j = jobs.get(c.slug);
  if (j && (j.state === 'running' || j.state === 'refreshing')) return { error: 'That one is already busy.' };
  const dir = dirOf(c), part = dir + '.parting';
  try { fs.rmSync(part, { recursive: true, force: true }); } catch (e) { }
  fs.mkdirSync(DIR, { recursive: true });
  const job = { slug: c.slug, state: 'running', pct: 0, said: 'Starting git...' };
  jobs.set(c.slug, job);
  let child;
  try { child = cp.spawn('git', ['clone', '--depth', '1', '--single-branch', '--progress', 'https://github.com/' + c.repo + '.git', part], { windowsHide: true }); }
  catch (e) { job.state = 'failed'; job.said = 'git could not start. Is Git for Windows installed?'; return { error: job.said }; }
  watch(job, child, part, dir, 'Downloaded and indexed.');
  return { ok: true, refs: status() };
}

/* refresh an installed one: git pull, then re-index whatever changed */
function update(slug) {
  if (!net.on()) return { error: 'Refreshing needs internet access. Turn it on in Settings, AI & power.' };
  const c = find(slug); if (!c) return { error: 'That library is not in the list.' };
  if (!fs.existsSync(dirOf(c))) return { error: 'Download it first.' };
  const j = jobs.get(c.slug);
  if (j && (j.state === 'running' || j.state === 'refreshing')) return { error: 'That one is already busy.' };
  const job = { slug: c.slug, state: 'refreshing', pct: 0, said: 'Looking for changes...' };
  jobs.set(c.slug, job);
  let child;
  try { child = cp.spawn('git', ['-C', dirOf(c), 'pull', '--ff-only', '--progress'], { windowsHide: true }); }
  catch (e) { job.state = 'failed'; job.said = 'git could not start.'; return { error: job.said }; }
  watch(job, child, null, dirOf(c), 'Up to date, and re-indexed.');
  return { ok: true, refs: status() };
}

function remove(slug) {
  const c = find(slug); if (!c) return { error: 'That library is not in the list.' };
  const j = jobs.get(c.slug); if (j && (j.state === 'running' || j.state === 'refreshing')) return { error: 'That one is still busy.' };
  try { fs.rmSync(dirOf(c), { recursive: true, force: true }); } catch (e) { return { error: String(e.message).slice(0, 160) }; }
  jobs.delete(c.slug); safety.forget(c.slug);
  if (!c.built) writeUser(readUser().filter(x => x.slug !== c.slug));
  docs.reindex().catch(() => { });
  return { ok: true, refs: status() };
}

module.exports = { status, install, update, remove, check, parse, BUILTIN, DIR, ensureSource };
