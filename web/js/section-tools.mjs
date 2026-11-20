import { modal, button } from './section-ui.mjs';
import {
  reader,
  openings,
  elements,
  words,
  colors,
  deepSky,
  tunes,
  savedArticles
} from './section-collections.mjs';
import {
  score,
  wave,
  observing,
  diagram,
  article,
  calendar,
  math,
  measure,
  renderDiagram
} from './section-instruments.mjs';
A.renderNoteDiagram = renderDiagram;

const sections = {
  kitchen: [['Recipe finder', (s) => reader(s, 'recipes')]],
  coding: [['MDN reference', (s) => reader(s, 'mdn')]],
  teach: [['JavaScript course', (s) => reader(s, 'javascript')]],
  study: [['Missing Semester lessons', (s) => reader(s, 'semester')]],
  lab: [
    ['SQL workbook', (s) => reader(s, 'sql')],
    ['Compare elements', elements]
  ],
  lib: [
    ['Programming Historian', (s) => reader(s, 'history')],
    ['Saved articles', savedArticles]
  ],
  sky: [
    ['Deep-sky finder', deepSky],
    ['Observing planner', observing]
  ],
  play: [['Chess opening explorer', openings]],
  lang: [['Common-word flashcards', words]],
  music: [
    ['Traditional tune book', tunes],
    ['ABC score editor', score],
    ['Waveform practice', wave]
  ],
  studio: [['Named color picker', colors]],
  notes: [['Mermaid diagram', diagram]],
  web: [['Article reader', article]],
  cal: [['Plain-English reminder', calendar]],
  calc: [['Engineering calculator', math]],
  globe: [['Map measurements', measure]]
};
const bar = document.getElementById('section-actions');
new ResizeObserver(() => {
  bar.parentElement.style.setProperty('--section-actions-height', bar.offsetHeight + 'px');
}).observe(bar);
function update(tab) {
  const actions = sections[tab] || [];
  const hasWorkshop = tab === 'coding' || tab === 'teach';
  bar.hidden = !actions.length && !hasWorkshop;
  bar.replaceChildren(
    ...(hasWorkshop ? [button('Debug workshop', () => A.cybertab.go('workshop'))] : []),
    ...actions.map(([label, open]) =>
      button(label, () => {
        const screen = modal(label);
        screen.run(() => open(screen));
      })
    )
  );
}
A.on('tab:show', update);
update(A.cur);

A.on('lab:compare', () => {
  const screen = modal('Compare elements');
  screen.run(() => elements(screen));
});
