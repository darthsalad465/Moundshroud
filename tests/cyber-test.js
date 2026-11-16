// The Cyber Toolkit: the offline tools work, host input cannot be smuggled into a command, and the tools are wired in.
const path = require('path'), fs = require('fs');
module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const C = require(path.join(root, 'lib', 'cybertools.js'));
  ok('cyber: a host name cannot smuggle a shell command', !C.okHost('a.com; rm -rf /') && !C.okHost('a.com && calc') && !C.okHost('`x`') && C.okHost('example.com') && C.okHost('8.8.8.8'));
  const id = C.hashId({ hash: '5f4dcc3b5aa765d61d8327deb882cf99' });
  ok('cyber: a hash is identified by its shape', id.guesses[0].name === 'MD5' && id.length === 32);
  const mk = C.hashMake({ text: 'password' });
  ok('cyber: hashing is correct and repeatable', mk.hashes.md5 === '5f4dcc3b5aa765d61d8327deb882cf99' && mk.hashes.sha256 === '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8');
  const cr = C.hashCrack({ hash: '5f4dcc3b5aa765d61d8327deb882cf99' });
  ok('cyber: a common password is cracked, a strong hash is not', cr.cracked && cr.password === 'password' && !C.hashCrack({ hash: 'a'.repeat(64) }).cracked);
  ok('cyber: the port list names common services', C.PORTS[443] === 'HTTPS (secure web)' && C.PORTS[22].startsWith('SSH'));
  const srv = rd('server.js'), page = rd('web/js/cyber-tools.js'), act = rd('web/js/actions.js'), rel = rd('web/js/relocate.js');
  ok('cyber: the tools that reach another computer need POST', /req\.method === 'POST' && \/\^\\\/api\\\/cyber\\\/\(dns\|reverse\|portscan/.test(srv));
  ok('cyber: the Toolkit is a Cyber sub-tab and loads its page', /'kit', '🧰 Toolkit'/.test(rel) && /kit: b => A.cyberTools.render/.test(rel) && /cyber-tools\.js/.test(rd('web/index.html')));
  ok('cyber: all 17 tools, with a tutorial and the Ask-the-AI button', (page.match(/\n      id: '/g) || []).length === 17 && /function aiBox/.test(page) && /Packet capture \(Wireshark\)/.test(page) && /\u{1F393} What it is/u.test(page));
  ok('cyber: the local AI can run the tools', /fn\('security_tool'/.test(act) && /async security_tool/.test(act) && /A\.cyberTools\.run/.test(act));
  ok('cyber: the guide and tour explain the Toolkit', /id: 'cybertoolkit'/.test(rd('web/js/guide.js')) && /Security Toolkit/.test(rd('web/js/tutorial.js')));
};
