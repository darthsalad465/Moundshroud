// Coding › Playground worker: runs the built-in interpreters (esoteric languages, Scheme, Prolog, Forth, BASIC) off the
// page, so the page stays responsive and a program that loops forever is stopped by ending this worker.
importScripts('/web/js/esolangs.js', '/web/js/esolangs-words.js', '/web/js/minilangs.js');
self.onmessage = e => {
  const { lang, code, input, ms } = e.data || {};
  postMessage(self.Esolangs.run(lang, code, input, { ms }));
};
