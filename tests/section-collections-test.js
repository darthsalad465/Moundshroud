const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

module.exports = function sectionCollectionChecks(ok) {
  const refs = require('../lib/refs');
  const { query } = require('../lib/section-collections');
  const original = refs.DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-tunes-'));
  try {
    refs.DIR = root;
    const dir = path.join(root, 'thesession-data');
    fs.mkdirSync(dir);
    const file = path.join(dir, 'thesession.db');
    const db = new DatabaseSync(file);
    try {
      // The collection stores numeric-looking IDs as text in a column without numeric affinity.
      db.exec('CREATE TABLE tunes(setting_id, name, type, meter, mode, abc)');
      db.prepare('INSERT INTO tunes VALUES (?,?,?,?,?,?)').run('43056','Example Jig','jig','6/8','Dmajor','DFA dAF|');
    } finally { db.close(); }
    const [hit] = query({id:'tunes', q:'example jig'}).items;
    const tune = query({id:'tunes', setting:hit.setting_id});
    ok('Tune book opens the exact text setting ID returned by search', tune.name === hit.name);
    ok('Tune settings produce playable ABC with meter, key and notes', tune.abc.includes('M:6/8\nL:1/8\nK:Dmajor\nDFA dAF|'));
  } finally {
    refs.DIR = original;
    fs.unlinkSync(path.join(root, 'thesession-data', 'thesession.db'));
    fs.rmdirSync(path.join(root, 'thesession-data'));
    fs.rmdirSync(root);
  }
};
