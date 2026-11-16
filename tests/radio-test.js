// Radio: the parts that can be checked with no internet. The song-title blocks some stations mix into the sound must be
// cut out exactly (one byte off and the sound clicks or stops), playlists must lead to the real stream, stations this
// app cannot play must be left out, and a station can never be an address on this PC or the home network.
const path = require('path'), fs = require('fs');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const R = require(path.join(root, 'lib', 'radio.js')), net = require(path.join(root, 'lib', 'net.js'));

  /* ----- song titles are cut out of the sound, whatever way the bytes arrive ----- */
  const sound = n => Buffer.from(Array.from({ length: n }, (_, i) => (i * 7 + 3) & 255));
  const meta = t => { const body = Buffer.from("StreamTitle='" + t + "';"), blocks = Math.ceil(body.length / 16), b = Buffer.alloc(1 + blocks * 16); b[0] = blocks; body.copy(b, 1); return b; };
  const a = sound(40), b = sound(40).reverse(), c = sound(25);
  const wire = Buffer.concat([a, meta('Artist - Song One'), b, Buffer.from([0]), c]);          // a title, then an empty block
  const run = sizes => { const titles = [], strip = R.icyStripper(40, t => titles.push(t)), out = []; let i = 0, k = 0; while (i < wire.length) { const n = sizes[k++ % sizes.length]; out.push(strip(wire.subarray(i, i + n))); i += n; } return { out: Buffer.concat(out), titles }; };
  const want = Buffer.concat([a, b, c]);
  const whole = run([wire.length]), bytes = run([1]), odd = run([7, 13, 3, 41]);
  ok('radio: song titles are cut out of the sound cleanly', whole.out.equals(want) && bytes.out.equals(want) && odd.out.equals(want), [whole.out.length, bytes.out.length, odd.out.length, want.length].join(' '));
  ok('radio: the song title is read', whole.titles.join('|') === 'Artist - Song One' && bytes.titles.join('|') === 'Artist - Song One', whole.titles.join('|'));

  /* ----- playlists ----- */
  ok('radio: an .m3u playlist leads to the stream', R.parsePlaylist('#EXTM3U\r\n#EXTINF:-1,Some FM\r\nhttp://a.example:8000/live\r\n').url === 'http://a.example:8000/live');
  ok('radio: a .pls playlist leads to the stream', R.parsePlaylist('[playlist]\nNumberOfEntries=1\nFile1=https://b.example/stream.mp3\nTitle1=B').url === 'https://b.example/stream.mp3');
  ok('radio: a segmented (HLS) playlist is recognised and not played', R.parsePlaylist('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6,\nseg1.ts').hls === true && !R.parsePlaylist('nothing here').url);

  /* ----- which directory entries become stations ----- */
  const base = { stationuuid: '9617a958-0601-11e8-ae97-52543be04c81', name: '  Some\tFM  ', url_resolved: 'https://s.example/live', codec: 'MP3', bitrate: 128, hls: 0, countrycode: 'us', tags: 'news,talk,,local', clickcount: 5 };
  const s = R.norm(base);
  ok('radio: a directory entry becomes a station', s && s.name === 'Some FM' && s.cc === 'US' && s.tags.join() === 'news,talk,local' && s.kbps === 128, JSON.stringify(s));
  ok('radio: stations this app cannot play are left out', !R.norm(Object.assign({}, base, { hls: 1 })) && !R.norm(Object.assign({}, base, { codec: 'WMA' })) && !R.norm(Object.assign({}, base, { url_resolved: 'rtmp://s.example/live', url: '' })) && !R.norm(Object.assign({}, base, { stationuuid: 'x' })) && !R.norm(Object.assign({}, base, { name: ' ' })));
  ok('radio: the page is never given a station’s address', !('url' in R.pub(s)) && R.pub(s).id === s.id);
  ok('radio: there is a scanner category, and it filters out music stations', (() => { const c = R.CATS.find(x => x.id === 'scanner'); return !!c && c.want.test('SF Police Scanner') && c.not.test('Exclusively - The Police exclusive') && c.not.test('Crime Inc old time radio'); })());

  /* ----- a station can use any port, but never this PC or the home network ----- */
  const p1 = await net.safeUrl('http://93.184.216.34:8000/stream', { anyPort: true }), p2 = await net.safeUrl('http://93.184.216.34:8000/stream');
  const p3 = await net.safeUrl('http://127.0.0.1:8000/stream', { anyPort: true }), p4 = await net.safeUrl('http://192.168.1.1/stream', { anyPort: true }), p5 = await net.safeUrl('file:///c:/x.mp3', { anyPort: true });
  ok('radio: stations on unusual ports are allowed, pages are still held to 80 and 443', !!p1.url && !!p2.error, JSON.stringify([p1.error, p2.error]));
  ok('radio: a station cannot be this PC, the home network or a file', !!p3.error && !!p4.error && !!p5.error);

  const srv = rd('server.js'), lib = rd('lib/radio.js');

  /* ----- wiring ----- */
  ok('radio: saving favorites, recents and added stations needs POST', ['fav', 'recent', 'custom'].every(k => new RegExp("url === '/api/radio/" + k + "' && req\\.method === 'POST'").test(srv)));
  ok('radio: nothing is fetched while internet access is off', /async function search[\s\S]{0,200}if \(!net\.on\(\)\)/.test(lib) && /async function stream[\s\S]{0,80}if \(!net\.on\(\)\)/.test(lib));
  ok('radio: outgoing requests do not name the app', !/const UA = '[^']*Moundshroud/.test(lib));
  ok('radio: the tab is in the page, the tab order and the sidebar', /id="p-radio"/.test(rd('web/index.html')) && /\/web\/js\/radio\.js/.test(rd('web/index.html')) && /'music', 'radio'/.test(rd('web/js/main.js')) && /radio: '📻'/.test(rd('web/js/core.js')));
  ok('radio: the guide, the tour and the privacy page mention it', /id: 'radio'/.test(rd('web/js/guide.js')) && /\['tab:radio'\]/.test(rd('web/js/tutorial.js')) && /'Radio'/.test(rd('web/js/privacy.js')));
};
