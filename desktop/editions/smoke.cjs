'use strict';

const assert = require('node:assert/strict');
const { app } = require('electron');

module.exports = (win, edition) => {
  const timer = setTimeout(() => { console.error('Edition startup timed out'); app.exit(1); }, 50_000);
  win.webContents.once('did-fail-load', (_event, _code, error) => { console.error(error); app.exit(1); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const evaluate = script => win.webContents.executeJavaScript(script);
      if (edition.id === 'cyber') {
        assert.equal(await evaluate("document.querySelector('h1').textContent"), 'Security report review');
        const actual = await evaluate(`(async () => {
          const report = new File([JSON.stringify({
            vulnerabilities: [{ type: 'Example', url: 'https://example.test/', severity: 'medium', remediation: '<img src=x>' }]
          })], 'test.json', { type:'application/json' });
          const selected = new DataTransfer();
          selected.items.add(report);
          const input = document.querySelector('#current');
          input.files = selected.files;
          input.dispatchEvent(new Event('change'));
          for (let i=0; i<20 && !document.querySelector('#findings details'); i++) await new Promise(r => setTimeout(r, 25));
          return { title: document.querySelector('#findings summary')?.textContent, images: document.querySelectorAll('#findings img').length };
        })()`);
        assert.deepEqual(actual, { title: 'Example · medium', images: 0 });
      } else {
        const primary = JSON.stringify(edition.tabs[0]);
        const actual = await evaluate(`(async () => {
          for (let i=0; i<100; i++) {
            const active = document.querySelector('main section.panel.on');
            if (typeof A !== 'undefined' && A.cur === ${primary} && active?.id === 'p-' + ${primary} && active.children.length) {
              return { title: document.title, tabs: Object.keys(A.tabs).sort(), active: active.id };
            }
            await new Promise(r => setTimeout(r, 100));
          }
          return { current: typeof A === 'undefined' ? null : A.cur, active: document.querySelector('main section.panel.on')?.id, title: document.title };
        })()`);
        assert.equal(actual.title, edition.name);
        assert.deepEqual(actual.tabs, [...edition.tabs].sort(), JSON.stringify(actual));
        assert.equal(actual.active, 'p-' + edition.tabs[0]);
        for (const tab of edition.tabs.slice(1)) {
          const selected = await evaluate(`(async () => {
            const target = ${JSON.stringify(tab)};
            await A.showTab(target);
            const panel = document.getElementById('p-' + target);
            return A.cur === target && !!panel?.classList.contains('on') && !!panel.children.length;
          })()`);
          assert.equal(selected, true, 'Secondary tab: ' + tab);
        }
        const routes = { library: '/api/lib/books', studio: '/api/art/status', chess: '/api/sf/status',
          office: '/api/office/status', media: '/api/radio' };
        const response = await evaluate(`fetch(${JSON.stringify(routes[edition.id])}).then(async r => [r.status, !!await r.json()])`);
        assert.deepEqual(response, [200, true], 'Primary workspace backend');
        for (const unavailable of ['/api/artex/status', '/api/pcshell/shells', '/api/deepeye/status', '/api/sample-lab/analyze']) {
          assert.equal(await evaluate(`fetch(${JSON.stringify(unavailable)}).then(r => r.status)`), 404);
        }
      }
      clearTimeout(timer);
      console.log('Verified ' + edition.name);
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
};
