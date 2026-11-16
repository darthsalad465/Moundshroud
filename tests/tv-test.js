// TV: the parts that can be checked with no internet. VLC's list is read without touching local files, links get
// readable names, channel lists are read with their categories, the video reader can only reach public web addresses
// through the gate, the page never sees an address, and YouTube results and links are read safely.
const path = require('path'), fs = require('fs');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const T = require(path.join(root, 'lib', 'tv.js')), Y = require(path.join(root, 'lib', 'youtube.js'));
  const srv = rd('server.js'), lib = rd('lib/tv.js');

  /* ----- VLC's list ----- */
  const ini = '[General]\nx=1\n\n[RecentsMRL]\nlist=https://a.example/x/index.m3u8, "https://b.example/list,1.m3u", file:///C:/v.mp4, http://c.example:88/p.php?id=one\ntimes=0, 0\n\n[Other]\nlist=https://no.example/\n';
  const links = T.parseVlc(ini, '<location>https://d.example/a?x=1&amp;y=2</location><location>file:///c:/a.mp3</location>');
  ok('tv: VLC’s web links are read, files on this PC and other settings are left out', links.join(' ') === 'https://a.example/x/index.m3u8 https://b.example/list,1.m3u http://c.example:88/p.php?id=one https://d.example/a?x=1&y=2', links.join(' '));

  /* ----- names ----- */
  const g = u => T.guessName(u);
  const names = [g('https://nl1.example/ArenaSport2HD/index.m3u8'), g('https://nl1.example/AS2HRHD/index.m3u8'), g('https://nl1.example/ArenaSport1BH/index.m3u8'), g('http://1.2.3.4/live/test_arenasport_dva/playlist.m3u8'), g('http://s.example/41/index.m3u8'), g('http://1.2.3.4:88/georgia_play.php?id=1plus1international')];
  ok('tv: a link the index does not know gets a readable name from its address', names.join(' | ') === 'Arena Sport 2 HD | Arena Sport 2 HD (Croatia) | Arena Sport 1 (Bosnia) | Arena Sport 2 | Channel 41 | 1+1 International', names.join(' | '));
  ok('tv: channel lists get plain names', T.listName('https://iptv-org.github.io/iptv/countries/us.m3u') === 'United States channels (iptv-org)' && T.listName('https://iptv-org.github.io/iptv/categories/sports.m3u') === 'Sports channels (iptv-org)' && T.listName('https://iptv-org.github.io/iptv/index.m3u') === 'Every free channel (iptv-org)');
  const sp = T.splitName('F1 Channel (1080p) [Geo-blocked]');
  ok('tv: quality and country limits are taken out of a name and kept as details', sp.name === 'F1 Channel' && sp.q === '1080p' && sp.geo === true, JSON.stringify(sp));
  const I = T.buildIndex([{ url: 'https://a.example/live/alpha/x.m3u8', name: 'Alpha' }, { url: 'https://b.example/live/alpha/x.m3u8', name: 'Alpha' }, { url: 'https://c.example/same/path.m3u8', name: 'One' }, { url: 'https://d.example/same/path.m3u8', name: 'Two' }], 1);
  const pa = I.byPath.get('/live/alpha/x.m3u8');
  ok('tv: the channel index matches the same path on another host only when the name agrees', !!pa && pa.name === 'Alpha' && I.byPath.get('/same/path.m3u8') === null && I.size === 4);

  /* ----- channel lists ----- */
  const chans = T.parseChannels('#EXTM3U\n#EXTINF:-1 tvg-id="Zed.us@SD" tvg-logo="https://l.example/z.png" tvg-name="x, y" group-title="Movies",00s Replay (720p)\n#EXTVLCOPT:http-user-agent=Special/1.0\nhttps://x.example/a.m3u8\n#EXTINF:-1,B, with comma\nhttps://x.example/b.m3u8\nhttps://x.example/a.m3u8\nrtmp://x.example/c\n');
  ok('tv: a channel list is read with names, categories, countries, logos and player options', chans.length === 2 && chans[0].name === '00s Replay' && chans[0].q === '720p' && chans[0].group === 'Movies' && chans[0].cc === 'US' && chans[0].logo === 'https://l.example/z.png' && chans[0].ua === 'Special/1.0' && chans[1].name === 'B, with comma' && !chans[1].ua && /^ch-[0-9a-f]{16}$/.test(chans[0].id), JSON.stringify(chans.map(c => [c.name, c.group, c.cc, c.ua])));
  ok('tv: a channel list is told apart from one stream’s own playlist', T.isChannelList('#EXTM3U\n#EXTINF:-1,A\nhttp://a.example/b') && !T.isChannelList('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts') && !T.isChannelList('<html>'));

  /* ----- the video reader ----- */
  const va = T.videoArgs(5555, 'https://a.example/x.m3u8', { ua: 'Special/1.0', ref: 'https://r.example/' }), wl = va[va.indexOf('-protocol_whitelist') + 1];
  ok('tv: the video reader may only use web addresses, and only through the gate', va[va.indexOf('-http_proxy') + 1] === 'http://127.0.0.1:5555' && wl.split(',').every(p => ['http', 'https', 'tcp', 'tls', 'crypto', 'httpproxy'].includes(p)) && !/file|concat|pipe|udp|rtp/.test(wl) && va[va.indexOf('-i') + 1] === 'https://a.example/x.m3u8' && va[va.indexOf('-user_agent') + 1] === 'Special/1.0' && va[va.indexOf('-referer') + 1] === 'https://r.example/', wl);
  {
    const port = await T.guardProxy(), ask = line => new Promise(res => { const c = require('net').connect(port, '127.0.0.1', () => c.write(line + '\r\nHost: x\r\n\r\n')); let d = ''; c.on('data', x => { d += x; c.destroy(); }); c.on('close', () => res(d.split('\r\n')[0])); c.on('error', () => res('error')); setTimeout(() => { c.destroy(); }, 4000); });
    const r = [await ask('CONNECT 127.0.0.1:47231 HTTP/1.1'), await ask('CONNECT 192.168.1.1:443 HTTP/1.1'), await ask('GET http://10.0.0.5/live.ts HTTP/1.1'), await ask('CONNECT localhost:80 HTTP/1.1')];
    ok('tv: the video gate refuses this PC and the home network', r.every(x => / 403 /.test(x)), r.join(' | '));
  }
  ok('tv: the page is never given a link’s address', !('url' in T.pub({ id: 'm-1', name: 'A', url: 'https://a.example/x.m3u8', logo: 'https://l.example/a.png' })) && T.pub({ id: 'm-1', name: 'A', url: 'https://a.example/x.m3u8', logo: 'https://l.example/a.png' }).logo === 1);

  /* ----- YouTube ----- */
  const html = '<script>var ytInitialData = {"a":{"b":[{"videoRenderer":{"videoId":"abcDEF12345","title":{"runs":[{"text":"A \\"quoted\\" title"}]},"ownerText":{"runs":[{"text":"Chan"}]},"lengthText":{"simpleText":"3:21"}}},{"videoRenderer":{"videoId":"bad"}},{"videoRenderer":{"videoId":"LIVEone_234","title":{"simpleText":"Live now"},"badges":[{"metadataBadgeRenderer":{"style":"BADGE_STYLE_TYPE_LIVE_NOW"}}]}}]}};</script>';
  const vids = Y.videos(Y.initialData(html));
  ok('tv: YouTube results are read from the page, with titles, channels, lengths and live streams', vids.length === 2 && vids[0].title === 'A "quoted" title' && vids[0].channel === 'Chan' && vids[0].len === '3:21' && vids[1].live === 1, JSON.stringify(vids));
  ok('tv: only real YouTube links are turned into videos', Y.idFrom('https://youtu.be/dQw4w9WgXcQ?t=3') === 'dQw4w9WgXcQ' && Y.idFrom('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && !Y.idFrom('https://evil.example/watch?v=dQw4w9WgXcQ'));
  ok('tv: YouTube plays in its privacy-enhanced player, which is the only outside page allowed in a frame', /frame-src[^;]*https:\/\/www\.youtube-nocookie\.com;/.test(srv) && !/frame-src[^;]*https:\/\/www\.youtube\.com/.test(srv) && /youtube-nocookie\.com\/embed\//.test(rd('web/js/tv.js')));

  /* ----- wiring ----- */
  ok('tv: saving, importing, renaming and opening links needs POST', /req\.method === 'POST' && \/\^\\\/api\\\/tv\\\/\(import\|add\|remove\|rename\|names\|open\)\$\//.test(srv));
  ok('tv: nothing opens another program', !/vlc\.exe['"]?\s*,\s*\[|spawn\(exe/.test(lib) && !/data-a="tvvlc"|vlc\/open/.test(rd('web/js/tv.js')));
  ok('tv: nothing is fetched while internet access is off', /async function video[\s\S]{0,80}if \(!net\.on\(\)\)/.test(lib) && /async function open[\s\S]{0,80}if \(!net\.on\(\)\)/.test(lib) && /async function search[\s\S]{0,80}if \(!net\.on\(\)\)/.test(rd('lib/youtube.js')));
  ok('tv: the tab is in the page, the tab order and the sidebar', /id="p-tv"/.test(rd('web/index.html')) && /\/web\/js\/tv\.js/.test(rd('web/index.html')) && /'radio', 'tv'/.test(rd('web/js/main.js')) && /tv: '📺'/.test(rd('web/js/core.js')));
  ok('tv: Esc leaves full screen first, then closes the player', /A\.tv && A\.cur === 'tv' && A\.tv\.escape/.test(rd('web/js/main.js')));
  ok('tv: the guide, the tour and the privacy page mention it', /id: 'tv'/.test(rd('web/js/guide.js')) && /\['tab:tv'\]/.test(rd('web/js/tutorial.js')) && /'TV and YouTube'/.test(rd('web/js/privacy.js')));
};
