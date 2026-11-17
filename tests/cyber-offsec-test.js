// The two Cyber labs that do real security work (Reverse engineering, Cracker): their hashes must match the standard
// ones exactly, and the program-file readers must read a real header correctly. A wrong hash silently finds nothing,
// so these are checked against Node's own crypto and against hand-built PE/ELF headers.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = async function (ok) {
  const H = require(path.join(__dirname, '..', 'web', 'js', 'cyber-crack.js'));
  const R = require(path.join(__dirname, '..', 'web', 'js', 'cyber-reverse.js'));
  const h = (algo, s) => crypto.createHash(algo).update(s, 'utf8').digest('hex');

  /* ---- the hashes ---- */
  ok('cracker: MD5 matches the standard (abc, empty, long, accented)',
    H.md5('abc') === '900150983cd24fb0d6963f7d28e17f72' && H.md5('') === 'd41d8cd98f00b204e9800998ecf8427e' &&
    H.md5('a'.repeat(1000)) === h('md5', 'a'.repeat(1000)) && H.md5('héllo') === h('md5', 'héllo'), H.md5('abc'));
  ok('cracker: SHA-1 matches the standard (it turns bits left)', H.sha1('abc') === 'a9993e364706816aba3e25717850c26c9cd0d89d' &&
    H.sha1('x'.repeat(500)) === h('sha1', 'x'.repeat(500)), H.sha1('abc'));
  ok('cracker: SHA-256 matches the standard (it turns bits right — this is the one that was wrong)',
    H.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' &&
    H.sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' &&
    H.sha256('héllo wörld') === h('sha256', 'héllo wörld'), H.sha256('abc'));
  ok('cracker: Windows NTLM matches the standard (MD4 of the password in UTF-16)',
    H.ntlm('password') === '8846f7eaee8fb117ad06bdd830b7586c' && H.ntlm('') === '31d6cfe0d16ae931b73c59d7e0c089c0', H.ntlm('password'));

  /* ---- guessing ---- */
  ok('cracker: a hash type is recognised by its length', H.detect('a'.repeat(32)) === 'md5' && H.detect('a'.repeat(40)) === 'sha1' &&
    H.detect('a'.repeat(64)) === 'sha256' && H.detect('a'.repeat(128)) === 'sha512' && H.detect('nonsense') === '');
  const rules = H.rulesOf('password', { digits: true, symbols: true, leet: true, case: true });
  ok('cracker: the patterns include the word, its capitals, digits and leet',
    rules.includes('password') && rules.includes('Password') && rules.includes('PASSWORD') && rules.includes('password1') &&
    rules.includes('password123') && rules.includes('password!') && rules.includes('p455w0rd'), rules.length + ' patterns');
  ok('cracker: the built-in wordlist holds the passwords people really use', H.WORDS.includes('password') && H.WORDS.includes('letmein') && H.WORDS.length >= 100);
  ok('cracker: every hash except SHA-512 can be guessed in plain JavaScript, at speed', ['md5', 'ntlm', 'sha1', 'sha256'].every(a => !!H.ALGOS[a].fn) && !H.ALGOS.sha512.fn);

  /* ---- the program-file reader ---- */
  const pe = Buffer.alloc(1024);
  pe.write('MZ', 0, 'latin1'); pe.writeUInt32LE(0x80, 0x3c); pe.write('PE\0\0', 0x80, 'latin1');
  pe.writeUInt16LE(0x8664, 0x84); pe.writeUInt16LE(1, 0x86); pe.writeUInt32LE(0x5f000000, 0x88); pe.writeUInt16LE(240, 0x94);
  const opt = 0x98; pe.writeUInt16LE(0x20b, opt); pe.writeUInt32LE(0x1000, opt + 16); pe.writeUInt32LE(3, opt + 68); pe.writeUInt32LE(16, opt + 108);
  const sh = opt + 240; pe.write('CODE', sh, 'latin1'); pe.writeUInt32LE(0x200, sh + 8); pe.writeUInt32LE(0x1000, sh + 12); pe.writeUInt32LE(0x200, sh + 16); pe.writeUInt32LE(0x400, sh + 20);
  Buffer.from('VirtualAlloc cmd.exe\x00').copy(pe, 600);
  const info = R.peInfo(new Uint8Array(pe));
  ok('reverse: a Windows .exe header is read (64-bit, one section, entry point)',
    !!info && info.format === 'PE' && info.bits === 64 && /x64/.test(info.machine) && info.sections.length === 1 &&
    info.sections[0].name === 'CODE' && info.entry === 0x1000, info && JSON.stringify({ bits: info.bits, e: info.entry }));

  const elf = Buffer.alloc(256);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]).copy(elf, 0);
  elf.writeUInt16LE(2, 16); elf.writeUInt16LE(62, 18); elf.writeBigUInt64LE(0x401000n, 24);
  const ei = R.elfInfo(new Uint8Array(elf));
  ok('reverse: a Linux ELF header is read (64-bit, x86-64, executable, entry point)',
    !!ei && ei.format === 'ELF' && ei.bits === 64 && ei.kind === 'executable' && /x86-64/.test(ei.machine) && ei.entry === 0x401000);

  const strs = R.stringsOf(Buffer.from('\x00\x01hello world\x00ab\x00secret-api\x00'), 5);
  ok('reverse: the readable text is pulled out with where it sits', strs.length === 2 && strs[0].s === 'hello world' &&
    strs[1].s === 'secret-api' && strs[1].at === 17, JSON.stringify(strs));

  const zeros = new Uint8Array(512), text = new TextEncoder().encode('the quick brown fox jumps over the lazy dog. '.repeat(40));
  ok('reverse: entropy tells padding from text from packed data',
    R.entropy(zeros) === 0 && R.entropy(text) > 3 && R.entropy(text) < 6, R.entropy(text).toFixed(2));

  const packed = new Uint8Array(8192); for (let i = 0; i < packed.length; i++) packed[i] = (i * 7 + 13) % 256;
  ok('reverse: a scrambled file is called out as packed', R.entropy(packed) > 7.9, R.entropy(packed).toFixed(2));

  const full = R.analyze(new Uint8Array(Buffer.concat([pe, Buffer.from('powershell -enc VirtualAlloc\x00')])));
  ok('reverse: the summary names the format and the suspicious names inside', full.format === 'PE' &&
    full.clues.some(c => c.k === 'powershell') && full.clues.some(c => c.k === 'VirtualAlloc') && full.notes.length >= 1);

  /* ---- wired into the Cyber tab ---- */
  const idx = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  const rel = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'relocate.js'), 'utf8');
  const lazy = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'lazy.js'), 'utf8');
  ok('cyber: both labs have a page in the Cyber tab and are loaded with it',
    /cyber-reverse\.js/.test(idx) && /cyber-crack\.js/.test(idx) && /cyber-reverse\.js/.test(lazy) && /cyber-crack\.js/.test(lazy) &&
    /\['re',/.test(rel) && /\['crack',/.test(rel) && /A\.cyberLabs\.re\(b\)/.test(rel) && /A\.cyberLabs\.crack\(b\)/.test(rel));
};
