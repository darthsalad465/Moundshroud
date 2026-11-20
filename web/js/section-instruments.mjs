import { api, node, button, table, script } from './section-ui.mjs';

function control(box, label, tag = 'input', value = '') {
  const wrapper = node('label', label + ' '),
    field = node(tag);
  field.value = value;
  wrapper.append(field);
  box.append(wrapper);
  return field;
}
function work(s, data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/web/js/section-worker.js');
    const finish = (fn, result) => {
      clearTimeout(timeout);
      worker.terminate();
      s.signal.removeEventListener('abort', abort);
      fn(result);
    };
    const abort = () => finish(reject, Error('Closed.'));
    const timeout = setTimeout(() => finish(reject, Error('Calculation exceeded the time limit.')), 10000);
    s.signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e) => (e.data.error ? finish(reject, Error(e.data.error)) : finish(resolve, e.data));
    worker.onerror = (e) => finish(reject, Error(e.message));
    worker.postMessage(data);
  });
}
export async function sqlWorkbench(s) {
  const box = node('details');
  box.open = true;
  box.append(node('summary', 'Survey database · SQL practice'));
  const sql = control(box, 'SQL query', 'textarea', 'SELECT * FROM Survey LIMIT 10;');
  const result = node('div', null, 'sf-scroll');
  let database;
  const run = button('Run on practice database', () =>
    s.run(async () => {
      run.disabled = true;
      try {
        database ??= (await api('survey')).database;
        const { tables } = await work(s, { kind: 'sql', query: sql.value, database });
        result.replaceChildren(...tables.map((t) => table(t.columns, t.values)));
        if (!tables.length)
          result.textContent =
            'Statement completed. Each run starts with a fresh copy of the survey database.';
      } finally {
        run.disabled = false;
      }
    })
  );
  box.append(run, result);
  s.body.prepend(box);
}
export async function math(s) {
  const f = node('form'),
    input = control(f, 'Expression', 'input', '2 inch to cm');
  input.placeholder = 'det([[1,2],[3,4]])';
  const submit = node('button', 'Calculate', 'pri'),
    result = node('output');
  result.setAttribute('aria-live', 'polite');
  f.append(submit);
  s.body.append(f, result);
  f.onsubmit = (e) => {
    e.preventDefault();
    s.run(async () => {
      submit.disabled = true;
      result.textContent = '';
      try {
        result.textContent = (await work(s, { kind: 'math', expression: input.value })).value;
      } finally {
        submit.disabled = false;
      }
    });
  };
}
export async function score(s, initial) {
  await script('/web/vendor/abcjs/abcjs.js');
  const input = control(
    s.body,
    'ABC notation',
    'textarea',
    initial || 'X:1\nT:Morning scale\nM:4/4\nL:1/8\nK:C\nCDEF GABc | cBAG FEDC |'
  );
  input.rows = 7;
  input.maxLength = 60000;
  const paper = node('div', null, 'sf-score'),
    actions = node('div', null, 'sf-row');
  s.body.append(actions, paper);
  let tune, audio;
  function stop() {
    if (audio) {
      audio.close().catch(() => {});
      audio = null;
    }
  }
  s.signal.addEventListener('abort', stop, { once: true });
  function render() {
    stop();
    paper.replaceChildren();
    tune = ABCJS.renderAbc(paper, input.value, { responsive: 'resize', add_classes: true })[0];
  }
  actions.append(
    button('Render score', () => s.run(render)),
    button('Play score', () =>
      s.run(async () => {
        render();
        if (!tune) throw Error('Enter a valid ABC tune.');
        const track = tune.setUpAudio({}),
          meter = tune.getMeterFraction();
        const scale = tune.millisecondsPerMeasure(track.tempo) / 1000 / (meter.num / meter.den);
        audio = new AudioContext();
        const ctx = audio;
        await ctx.resume();
        const gain = ctx.createGain();
        gain.gain.value = 0.09;
        gain.connect(ctx.destination);
        const start = ctx.currentTime + 0.04;
        for (const channel of track.tracks)
          for (const n of channel) {
            if (n.cmd !== 'note' || n.duration <= 0) continue;
            const onset = start + n.start * scale,
              duration = Math.max(0.015, n.duration * scale);
            const osc = ctx.createOscillator(),
              env = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 440 * Math.pow(2, (n.pitch - 69) / 12);
            env.gain.setValueAtTime(0.001, onset);
            env.gain.exponentialRampToValueAtTime(0.65, onset + Math.min(0.01, duration / 3));
            env.gain.exponentialRampToValueAtTime(0.001, onset + duration);
            osc.connect(env).connect(gain);
            osc.start(onset);
            osc.stop(onset + duration + 0.01);
          }
      })
    ),
    button('Stop', stop)
  );
  render();
}
export async function wave(s) {
  const [{ default: WaveSurfer }, { default: Regions }] = await Promise.all([
    import('/web/vendor/wavesurfer/wave.mjs'),
    import('/web/vendor/wavesurfer/regions.mjs')
  ]);
  const file = control(s.body, 'Audio recording');
  file.type = 'file';
  file.accept = 'audio/*';
  const plot = node('div'),
    actions = node('div', null, 'sf-row');
  s.body.append(plot, actions);
  const regions = Regions.create(),
    wave = WaveSurfer.create({
      container: plot,
      height: 120,
      waveColor: '#8f9dd4',
      progressColor: '#615ac6',
      plugins: [regions]
    });
  let selected = null;
  const loop = control(actions, 'Loop selection');
  loop.type = 'checkbox';
  loop.checked = true;
  actions.append(
    button('Play / pause', () => s.run(() => wave.playPause())),
    button('Play selection', () =>
      s.run(() => {
        if (!selected) throw Error('Drag across the waveform to select a phrase.');
        return wave.play(selected.start, loop.checked ? undefined : selected.end);
      })
    )
  );
  regions.enableDragSelection({ color: 'rgba(100,140,245,.25)' });
  regions.on('region-created', (r) => {
    if (selected && selected !== r) selected.remove();
    selected = r;
  });
  regions.on('region-out', (r) => {
    if (loop.checked && r === selected && wave.isPlaying()) wave.setTime(r.start);
  });
  const current = A.musicLib?.state().cur;
  if (current) {
    actions.prepend(
      button('Open ' + current.t, () =>
        s.run(async () => {
          const player = A.musicLib;
          player.pause();
          regions.clearRegions();
          selected = null;
          if (current.my) {
            const recording = await MLMine.blob(current.i);
            if (!recording) throw Error('Recording unavailable.');
            await wave.loadBlob(recording);
          } else await wave.load('/web/music/' + current.i);
          s.status.textContent = 'Drag across the waveform to select a phrase.';
        })
      )
    );
  }
  file.onchange = () =>
    s.run(async () => {
      if (!file.files[0]) return;
      regions.clearRegions();
      selected = null;
      await wave.loadBlob(file.files[0]);
      s.status.textContent = 'Drag across the waveform to select a phrase.';
    });
  s.signal.addEventListener('abort', () => wave.destroy(), { once: true });
}
export async function observing(s) {
  await script('/web/vendor/astronomy/astronomy.js');
  const f = node('form'),
    loc = A.sky?.loc() || {},
    row = node('div', null, 'sf-row');
  f.append(row);
  const lat = control(row, 'Latitude', 'input', loc.lat ?? ''),
    lon = control(row, 'Longitude', 'input', loc.lon ?? '');
  for (const [input, max] of [
    [lat, 90],
    [lon, 180]
  ]) {
    input.type = 'number';
    input.step = 'any';
    input.min = -max;
    input.max = max;
    input.required = true;
  }
  const date = control(row, 'Start date');
  date.type = 'date';
  date.required = true;
  const now = new Date();
  date.value = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  f.append(node('button', 'Find rise and set times', 'pri'));
  const out = node('div', null, 'sf-scroll');
  s.body.append(f, out);
  function draw() {
    const observer = new Astronomy.Observer(+lat.value, +lon.value, 0),
      start = new Date(date.value + 'T00:00:00');
    const rows = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].map((b) => [
      b,
      ...[1, -1].map((sign) => {
        const event = Astronomy.SearchRiseSet(b, observer, sign, start, 2);
        return event ? event.date.toLocaleString() : 'No event in 48 hours';
      })
    ]);
    out.replaceChildren(table(['Body', 'Next rise · local time', 'Next set · local time'], rows));
  }
  f.onsubmit = (e) => {
    e.preventDefault();
    s.run(draw);
  };
  if (lat.value && lon.value) draw();
}
export async function renderDiagram(box, code) {
  if (!code.trim() || code.length > 20000) throw Error('Enter a diagram of 1–20,000 characters.');
  if (/%%\s*\{|^\s*---/.test(code)) throw Error('Use diagram syntax without configuration directives.');
  await script('/web/vendor/mermaid/mermaid.js');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    theme: 'neutral',
    suppressErrorRendering: true
  });
  const { svg } = await mermaid.render('mermaid-' + crypto.randomUUID(), code);
  const img = node('img');
  img.alt = 'Diagram preview';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  box.replaceChildren(img);
}
export async function diagram(s) {
  const input = control(s.body, 'Diagram source', 'textarea', 'flowchart LR\n  Idea --> Draft --> Review');
  input.rows = 7;
  const preview = node('div'),
    actions = node('div', null, 'sf-row');
  s.body.append(actions, preview);
  actions.append(
    button('Preview', () => s.run(() => renderDiagram(preview, input.value))),
    button('Insert into current note', () =>
      s.run(async () => {
        await renderDiagram(preview, input.value);
        const ne = document.getElementById('ne');
        if (document.getElementById('npv').style.display === 'block')
          document.querySelector('#nbar [data-a=pv]').click();
        ne.setRangeText(
          '\n\n' +
            String.fromCharCode(96).repeat(3) +
            'mermaid\n' +
            input.value +
            '\n' +
            String.fromCharCode(96).repeat(3) +
            '\n',
          ne.selectionStart,
          ne.selectionEnd,
          'end'
        );
        ne.dispatchEvent(new Event('input', { bubbles: true }));
        s.close();
        ne.focus();
      })
    )
  );
  await renderDiagram(preview, input.value);
}
export async function article(s) {
  await script('/web/vendor/readability/Readability.js');
  const f = node('form'),
    url = control(f, 'Article URL');
  url.type = 'url';
  url.required = true;
  const currentAddress = A.lib?.current?.().url;
  if (/^https?:\/\//i.test(currentAddress)) url.value = currentAddress;
  f.append(node('button', 'Read article', 'ib'));
  s.body.append(f);
  const file = control(s.body, 'Or open saved HTML');
  file.type = 'file';
  file.accept = '.html,.htm,text/html';
  const preview = node('article');
  let current;
  const save = button('Save to offline Library', () =>
    s.run(async () => {
      if (!current) return;
      save.disabled = true;
      try {
        const r = await api('reader-save', current);
        s.status.textContent = r.indexed
          ? 'Saved in Library → Saved articles.'
          : 'Saved in Library. My Files can reindex this article for search.';
      } catch (e) {
        save.disabled = false;
        throw e;
      }
    })
  );
  save.disabled = true;
  s.body.append(save, preview);
  function extract(html, source) {
    const doc = document.implementation.createHTMLDocument(''),
      template = doc.createElement('template');
    template.innerHTML = html;
    doc.body.replaceChildren(template.content.cloneNode(true));
    const title = doc.body.querySelector('title')?.textContent;
    if (title) doc.title = title;
    const read = new Readability(doc, { charThreshold: 50, serializer: (el) => el }).parse();
    if (!read?.textContent.trim()) throw Error('No readable article text found.');
    for (const el of read.content.querySelectorAll('br,p,h1,h2,h3,h4,li,blockquote,pre')) el.after('\n\n');
    const content = read.content.textContent.trim();
    if (content.length > 180000) throw Error('This article exceeds the 180,000-character reading limit.');
    current = { title: read.title || 'Saved article', content, url: source };
    save.disabled = false;
    const text = node('div', current.content);
    text.style.whiteSpace = 'pre-wrap';
    preview.replaceChildren(node('h3', current.title), text);
  }
  function reset() {
    save.disabled = true;
    current = null;
    preview.replaceChildren();
  }
  let serial = 0;
  f.onsubmit = (e) => {
    e.preventDefault();
    const id = ++serial;
    reset();
    s.run(async () => {
      const r = await api('reader-html', { url: url.value });
      if (id === serial) extract(r.html, r.url);
    });
  };
  file.onchange = () => {
    const id = ++serial;
    reset();
    s.run(async () => {
      const picked = file.files[0];
      if (!picked) return;
      if (picked.size > 3e6) throw Error('Choose an HTML file under 3 MB.');
      const html = await picked.text();
      if (id === serial) extract(html, picked.name);
    });
  };
}
export async function calendar(s) {
  const { parse } = await import('/web/vendor/chrono/chrono.mjs');
  const f = node('form'),
    input = control(f, 'Reminder', 'input', 'Call Sam next Friday at 4 pm');
  f.append(node('button', 'Preview reminder', 'ib'));
  const output = node('p');
  let draft;
  const edit = button('Review in Calendar', () => {
    if (draft) {
      s.close();
      A.cal.draftReminder(draft.title, draft.at);
    }
  });
  edit.disabled = true;
  s.body.append(f, output, edit);
  input.oninput = () => {
    edit.disabled = true;
    draft = null;
    output.textContent = '';
  };
  f.onsubmit = (e) => {
    e.preventDefault();
    const [match] = parse(input.value, new Date(), { forwardDate: true });
    if (!match) {
      output.textContent = 'Include a date or time.';
      return;
    }
    const at = match.start.date(),
      title =
        (
          input.value.slice(0, match.index) +
          ' ' +
          input.value.slice(match.index + match.text.length)
        ).trim() || 'Reminder';
    draft = { title, at };
    output.textContent = title + ' · ' + at.toLocaleString();
    edit.disabled = false;
  };
}
export async function measure(s) {
  const { area, distance } = await import('/web/vendor/turf/turf.mjs');
  const map = A.globe?.measurementMap();
  if (!map) throw Error('Wait for the globe to load, then open Map measurements.');
  if (A.globe.measurementClick) throw Error('Finish the active measurement using Done on the globe.');
  const mode = control(s.body, 'Measure', 'select');
  mode.add(new Option('Draw a polygon', 'polygon'));
  mode.add(new Option('Saved places within a radius', 'radius'));
  const radius = control(s.body, 'Radius (km)', 'input', '100');
  radius.type = 'number';
  radius.min = '.01';
  radius.step = 'any';
  radius.disabled = true;
  mode.onchange = () => (radius.disabled = mode.value !== 'radius');
  s.body.append(
    button('Choose points on globe', () =>
      s.run(() => {
        if (mode.value === 'radius' && (!radius.value || !radius.checkValidity()))
          throw Error('Enter a positive radius.');
        const polygon = mode.value === 'polygon',
          km = +radius.value,
          points = [],
          id = 'section-measure';
        s.close();
        const overlay = node('div', null, 'sf-map-controls'),
          message = node(
            'div',
            polygon ? 'Click the polygon vertices on the globe.' : 'Click the center of the search radius.'
          );
        overlay.append(message);
        map.getContainer().append(overlay);
        const old = map.getCanvas().style.cursor;
        map.getCanvas().style.cursor = 'crosshair';
        const stop = () => {
          A.globe.measurementClick = null;
          unsubscribe();
          for (const layer of ['fill', 'line', 'dots'])
            if (map.getLayer(id + layer)) map.removeLayer(id + layer);
          if (map.getSource(id)) map.removeSource(id);
          map.getCanvas().style.cursor = old;
          overlay.remove();
        };
        const unsubscribe = A.on('tab:hide', (tab) => {
          if (tab === 'globe') stop();
        });
        function redraw() {
          const features = points.map((p) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: p }
          }));
          if (polygon && points.length >= 2)
            features.push({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: points }
            });
          if (polygon && points.length >= 3) {
            const geometry = { type: 'Polygon', coordinates: [[...points, points[0]]] };
            features.push({ type: 'Feature', properties: {}, geometry });
            message.textContent =
              (area(geometry) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) +
              ' km² · ' +
              points.length +
              ' vertices';
          } else if (!polygon && points.length) {
            const pins = A.globe
              .savedPlaces()
              .map((p) => ({ ...p, km: distance(points[0], [p.lon, p.lat]) }))
              .filter((p) => p.km <= km)
              .sort((a, b) => a.km - b.km);
            message.textContent = pins.length
              ? pins.map((p) => p.name + ' (' + p.km.toFixed(1) + ' km)').join(' · ')
              : 'No saved places within ' + km + ' km.';
          } else
            message.textContent = polygon
              ? points.length + ' vertices · click at least three points.'
              : 'Click a center point.';
          map.getSource(id).setData({ type: 'FeatureCollection', features });
        }
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        for (const [suffix, type, geom, paint] of [
          ['fill', 'fill', 'Polygon', { 'fill-color': '#5cf3ca', 'fill-opacity': 0.25 }],
          ['line', 'line', 'LineString', { 'line-color': '#5cf3ca', 'line-width': 3 }],
          ['dots', 'circle', 'Point', { 'circle-color': '#5cf3ca', 'circle-radius': 4 }]
        ])
          map.addLayer({ id: id + suffix, source: id, type, filter: ['==', ['geometry-type'], geom], paint });
        A.globe.measurementClick = (ll) => {
          if (!polygon) points.length = 0;
          points.push([ll.lng, ll.lat]);
          redraw();
          return true;
        };
        overlay.append(
          button('Undo point', () => {
            points.pop();
            redraw();
          }),
          button('Done', stop)
        );
        overlay.addEventListener('click', (e) => e.stopPropagation());
      })
    )
  );
}
