#!/usr/bin/env node
'use strict';

// Refresh the README's generated app reference from the shipped app metadata.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const version = read('VERSION').trim();
const main = read('web/js/main.js');
const guide = read('web/js/guide.js');
const readmePath = path.join(root, 'README.md');
const begin = '<!-- BEGIN GENERATED APP REFERENCE -->';
const end = '<!-- END GENERATED APP REFERENCE -->';

const wantedMatch = main.match(/const wanted\s*=\s*\[([\s\S]*?)\]/);
if (!wantedMatch) throw new Error('Could not find the main navigation list in web/js/main.js');
const ids = [...wantedMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const labels = new Map();
const jsRoot = path.join(root, 'web', 'js');
for (const name of fs.readdirSync(jsRoot).filter(name => name.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(jsRoot, name), 'utf8');
  for (const match of source.matchAll(/A\.registerTab\(\s*'([^']+)'\s*,\s*'([^']+)'/g)) {
    if (!labels.has(match[1])) labels.set(match[1], match[2]);
  }
  for (const match of source.matchAll(/toolTab\(\s*'([^']+)'\s*,\s*'([^']+)'/g)) {
    if (!labels.has(match[1])) labels.set(match[1], match[2]);
  }
  for (const match of source.matchAll(/studio\(\s*'[^']+'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g)) {
    if (!labels.has(match[1])) labels.set(match[1], match[2]);
  }
}
const pretty = id => id.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const sections = ids.map(id => labels.get(id) || pretty(id));
const guideDate = (guide.match(/const GUIDE_UPDATED\s*=\s*'([^']+)'/) || [])[1] || 'not specified';

const generated = [
  begin,
  '## Live app reference',
  '',
  `- **App version:** ${version}`,
  `- **In-app Guide last updated:** ${guideDate}`,
  '',
  '### Main sections',
  '',
  sections.map(label => `- ${label}`).join('\n'),
  '',
  '> This section is generated from the app version, navigation, and Guide metadata whenever a release is built or code is pushed to GitHub. Edit the surrounding README sections for setup, privacy, and feature explanations.',
  end,
].join('\n');

let readme = read('README.md');
const startAt = readme.indexOf(begin);
const endAt = readme.indexOf(end);
if ((startAt < 0) !== (endAt < 0) || (startAt >= 0 && endAt < startAt)) {
  throw new Error('README generated-section markers are missing or out of order');
}
if (startAt >= 0) readme = readme.slice(0, startAt) + generated + readme.slice(endAt + end.length);
else {
  const anchor = '## What’s included';
  const at = readme.indexOf(anchor);
  if (at < 0) throw new Error(`Could not find README insertion point: ${anchor}`);
  readme = readme.slice(0, at) + generated + '\n\n' + readme.slice(at);
}
readme = readme.replace(/\n*$/, '\n');
fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`README app reference updated for Moundshroud ${version} (${sections.length} sections).`);
