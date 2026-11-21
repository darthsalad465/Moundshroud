// Remote sessions are generated workspaces held in this browser. Session IDs never identify a network endpoint.
(() => {
  const levels = { beginner: ['Beginner', 2, 2], standard: ['Standard', 3, 4], advanced: ['Advanced', 4, 7], expert: ['Expert', 5, 10] };
  const exercises = {
    inventory: ['Asset inventory', 'Find the host whose inventory report requires follow-up.'],
    review: ['Recorded session review', 'Compare session records and find the host marked for follow-up.'],
    recovery: ['Service recovery review', 'Find the service health report marked for follow-up.']
  };
  const rooms = ['Workshop', 'Records office', 'Media room', 'Research desk', 'Help desk'];
  const systems = ['Windows workstation', 'Linux desktop', 'Linux server', 'Windows workstation', 'Linux desktop'];
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const action = (key, label, value = '') => '<button type="button" data-remote-action="' + key + '" data-remote-value="' + escape(value) + '">' + escape(label) + '</button>';
  const options = (entries, selected) => Object.entries(entries).map(([key, [label]]) =>
    '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + label + '</option>').join('');

  function generate(seed, level, track) {
    const [, hostCount, records] = levels[level];
    let value = Number(seed) >>> 0;
    const next = count => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return Math.floor(count * value / 4294967296);
    };
    const target = next(hostCount);
    const reference = 'LAB-' + (100000 + next(900000));
    const hosts = systems.slice(0, hostCount).map((system, index) => {
      const hostname = (system.startsWith('Windows') ? 'WIN' : 'LNX') + '-' + (index + 1) + '-' + (10 + next(90));
      const room = rooms[(index + next(rooms.length)) % rooms.length];
      const account = system.startsWith('Windows') ? 'lab-admin' : 'operator';
      const files = new Map([
        ['Desktop/readme.txt', hostname + '\n' + system + '\nAssigned user: ' + account + '\nWorkspace: ' + room],
        ['Documents/assignment.txt', exercises[track][1] + '\nInspect the records on this PC, then submit the matching host and reference from Remote Sessions.']
      ]);
      const directory = track === 'inventory' ? 'Documents' : 'Logs';
      const filename = track === 'inventory' ? 'inventory.txt' : track === 'review' ? 'sessions.log' : 'health.log';
      for (let row = 1; row <= records; row++) {
        files.set(directory + '/record-' + row + '.txt', 'Record ' + row + ' · ' + room + '\nReview: ' + (next(2) ? 'Scheduled' : 'Complete') + '\nSource: ' + hostname);
      }
      files.set(directory + '/' + filename, 'Source: ' + hostname + '\nType: ' + exercises[track][0] +
        '\nDisposition: ' + (index === target ? 'Follow-up required\nReference: ' + reference : 'Routine\nReference: LAB-' + (Number(reference.slice(4)) - index - 1)));
      return { hostname, system, room, account, files, history: [], view: 'desktop', cwd: 'Desktop', selected: '' };
    });
    return { seed, hosts, target: hosts[target].hostname, reference };
  }

  function create(open, tutorial) {
    let scenario, level = 'beginner', track = 'inventory', status = '', serial = 0, solved = false;
    function directory(host) {
      function draw() {
        host.innerHTML = `<div class="cd-content cd-remote-launcher"><h2>Remote Sessions</h2>
          <p>Open an assigned practice session. Each fictional PC has its own desktop, files, and command console.</p>
          <form data-remote-form="new" class="cd-remote-form">
            <label>Exercise <select name="track">${options(exercises, track)}</select></label>
            <label>Difficulty <select name="level">${options(levels, level)}</select></label>
            <label>Seed <input name="seed" placeholder="Random" maxlength="7" autocomplete="off"></label>
            <button type="submit" class="cd-primary">${scenario ? 'Generate another case' : 'Generate case'}</button>
          </form>
          ${tutorial() ? '<aside class="cd-tutorial-tip"><b>Tutorial</b><p>Pick an exercise and press Generate case. Then click a computer card. Open Files to look around, or Console to type commands.</p></aside>' : ''}
          ${scenario ? `<section class="cd-incident-brief"><h3>${exercises[track][0]}</h3><p>${exercises[track][1]}</p>
            <small>Seed ${scenario.seed.toString(36).toUpperCase()} · ${levels[level][0]} · ${solved ? 'Complete' : 'In progress'}</small></section>
            <div class="cd-case-grid">${scenario.hosts.map((pc, index) =>
              `<button type="button" data-remote-action="connect" data-remote-value="${index}"><i aria-hidden="true">▣</i><b>${pc.hostname}</b><small>${pc.system} · ${pc.room}</small><small>Open assigned session</small></button>`).join('')}</div>
            <form data-remote-form="answer" class="cd-remote-form"><label>Computer <select name="host" required><option value="">Select a PC</option>
            ${scenario.hosts.map(pc => '<option>' + pc.hostname + '</option>').join('')}</select></label>
            <label>Reference <input name="answer" required maxlength="24" placeholder="LAB-000000"></label>
            <button type="submit" ${solved ? 'disabled' : ''}>Verify finding</button></form>` : ''}
          <p data-remote-status role="status">${escape(status)}</p></div>`;
      }
      host.onclick = event => {
        const button = event.target.closest('[data-remote-action="connect"]');
        if (!button) return;
        const index = Number(button.dataset.remoteValue);
        const pc = scenario.hosts[index];
        open('remote-' + serial + '-' + index, pc);
      };
      host.onsubmit = event => {
        event.preventDefault();
        event.stopPropagation();
        const form = event.target;
        const data = new FormData(form);
        if (form.dataset.remoteForm === 'new') {
          const seed = data.get('seed').trim();
          const parsed = seed && /^[0-9a-z]{1,7}$/i.test(seed) ? parseInt(seed, 36) : NaN;
          if (seed && (!Number.isFinite(parsed) || parsed > 0xffffffff)) {
            host.querySelector('[data-remote-status]').textContent = 'Enter a base-36 seed within the 32-bit range, or leave the field blank.';
            return;
          }
          level = data.get('level');
          track = data.get('track');
          scenario = generate(seed ? parsed : crypto.getRandomValues(new Uint32Array(1))[0], level, track);
          serial++;
          solved = false;
          status = 'New case loaded.';
        } else if (scenario && !solved) {
          solved = data.get('host') === scenario.target && data.get('answer').trim().toUpperCase() === scenario.reference;
          status = solved ? 'Finding verified. Case complete.' : 'Check the report marked Follow-up required and try again.';
          if (!solved) { host.querySelector('[data-remote-status]').textContent = status; return; }
        }
        draw();
      };
      draw();
    }

    function desktop(host, pc) {
      let status = '';
      const dirs = ['Desktop', 'Documents', 'Logs'];
      const filename = name => /^[^\\/:*?"<>|\u0000-\u001f]{1,64}$/.test(name) && name !== '.' && name !== '..';
      function command(raw) {
        const [name, ...rest] = raw.trim().split(/\s+/);
        const arg = rest.join(' ');
        const path = arg.includes('/') ? arg.replace(/^\//, '') : pc.cwd + '/' + arg;
        const commands = {
          help: () => 'help  hostname  whoami  pwd  ls [folder]  cd <folder>  cat <file>  touch <file>  clear',
          hostname: () => pc.hostname, whoami: () => pc.account, pwd: () => '/' + pc.cwd,
          ls: () => arg === '/' ? dirs.join('  ') : [...pc.files.keys()].filter(file => file.startsWith((arg || pc.cwd) + '/')).map(file => file.split('/')[1]).join('  '),
          cd: () => dirs.includes(arg) ? (pc.cwd = arg, '') : 'Folder was not found.',
          cat: () => pc.files.get(path) ?? 'File was not found.',
          touch: () => {
            if (!filename(arg)) return 'Enter a filename in the current folder.';
            if (pc.files.has(path)) return '';
            if (pc.files.size >= 90) return 'The simulated disk is full.';
            pc.files.set(path, '');
            return '';
          }
        };
        if (name === 'clear') pc.history.length = 0;
        else if (name) {
          pc.history.push(pc.account + '@' + pc.hostname + '$ ' + raw + '\n' +
            (Object.hasOwn(commands, name) ? commands[name]() : 'Unknown command. Type help.'));
          if (pc.history.length > 40) pc.history.shift();
        }
      }

      function draw() {
        const fileList = [...pc.files.keys()].filter(path => path.startsWith(pc.cwd + '/'));
        host.innerHTML = `<section class="cd-remote-screen" data-remote-os="${pc.system.startsWith('Windows') ? 'windows' : 'linux'}">
          <header><strong>${pc.hostname}</strong><span>${pc.system} · ${pc.account}</span></header>
          <nav aria-label="Session applications">${['desktop', 'files', 'console'].map(view =>
            `<button type="button" data-remote-action="view" data-remote-value="${view}" aria-pressed="${pc.view === view}">${view[0].toUpperCase() + view.slice(1)}</button>`).join('')}</nav>
          ${pc.view === 'desktop' ? `<div class="cd-remote-wallpaper"><b>${pc.hostname}</b><span>${pc.room}</span>
            <div>${action('view', 'Open Files', 'files')} ${action('view', 'Open Console', 'console')}</div></div>` : ''}
          ${pc.view === 'files' ? `<div class="cd-remote-panel"><div class="cd-remote-folder">${dirs.map(dir => action('folder', dir, dir)).join(' ')} <strong>/${pc.cwd}</strong></div>
            <div class="cd-remote-files"><div>${fileList.map(file => action('file', file.split('/')[1], file)).join('') || '<p>No files here.</p>'}</div>
            <div>${pc.files.has(pc.selected) ? `<form data-remote-form="save"><label>${escape(pc.selected)}<textarea name="text" rows="6" maxlength="12000">${escape(pc.files.get(pc.selected))}</textarea></label><button type="submit">Save file</button></form>` : '<p>Choose a file to read or edit.</p>'}</div></div>
            <form class="cd-remote-form" data-remote-form="create"><label>New file <input name="filename" required maxlength="64"></label><button type="submit">Create file</button></form></div>` : ''}
          ${pc.view === 'console' ? `<div class="cd-remote-panel"><pre data-remote-output>${escape(pc.history.join('\n') || 'Type help to list commands.')}</pre>
            <form class="cd-remote-form" data-remote-form="command"><label>${pc.account}@${pc.hostname} <input name="command" aria-label="Command" autocomplete="off" maxlength="180" required></label><button type="submit">Run</button></form></div>` : ''}
          <p data-remote-status role="status">${escape(status)}</p></section>`;
        const output = host.querySelector('[data-remote-output]');
        if (output) output.scrollTop = output.scrollHeight;
      }
      host.onclick = event => {
        const control = event.target.closest('[data-remote-action]');
        if (!control) return;
        const { remoteAction, remoteValue } = control.dataset;
        if (remoteAction === 'view') pc.view = remoteValue;
        else if (remoteAction === 'folder') { pc.cwd = remoteValue; pc.selected = ''; }
        else if (remoteAction === 'file') pc.selected = remoteValue;
        status = '';
        draw();
        if (pc.view === 'console') host.querySelector('[name="command"]').focus();
        else [...host.querySelectorAll('[data-remote-action]')].find(button =>
          button.dataset.remoteAction === remoteAction && button.dataset.remoteValue === remoteValue)?.focus();
      };
      host.onsubmit = event => {
        event.preventDefault();
        event.stopPropagation();
        const kind = event.target.dataset.remoteForm;
        const data = new FormData(event.target);
        if (kind === 'command') command(data.get('command'));
        else if (kind === 'save' && pc.files.has(pc.selected)) {
          pc.files.set(pc.selected, data.get('text'));
          status = 'File saved on ' + pc.hostname + '.';
        } else if (kind === 'create') {
          const name = data.get('filename').trim();
          const path = pc.cwd + '/' + name;
          if (!filename(name) || pc.files.has(path) || pc.files.size >= 90) {
            host.querySelector('[data-remote-status]').textContent = 'Use an unused filename. Each PC can hold up to 90 files.';
            return;
          }
          pc.files.set(path, '');
          pc.selected = path;
          status = 'File created on ' + pc.hostname + '.';
        }
        draw();
        host.querySelector(kind === 'command' ? '[name="command"]' : 'textarea')?.focus();
      };
      draw();
    }
    return { directory, desktop };
  }
  A.cyberRemote = { create, generate };
})();
