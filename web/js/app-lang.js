// App language: one setting (Settings › Voice & sound › Language) that decides which language Moundshroud speaks in
// (read-aloud, buddy, lessons) and answers the chat in. It also filters the voice list to that language. Nothing
// leaves this PC: only the voices already installed in Windows are used.
(() => {
  const KEY = 'lang';
  /* tag, English name, native name, a sample line in that language (spoken by the Preview button) */
  const L = [
    ['en', 'English', 'English', 'Hello! This is how I sound when I read to you.'],
    ['es', 'Spanish', 'Español', '¡Hola! Así suena mi voz cuando te leo.'],
    ['fr', 'French', 'Français', 'Bonjour ! Voici ma voix quand je te fais la lecture.'],
    ['de', 'German', 'Deutsch', 'Hallo! So klingt meine Stimme, wenn ich dir vorlese.'],
    ['it', 'Italian', 'Italiano', 'Ciao! Ecco come suono quando ti leggo ad alta voce.'],
    ['pt', 'Portuguese', 'Português', 'Olá! Esta é a minha voz quando te leio em voz alta.'],
    ['nl', 'Dutch', 'Nederlands', 'Hallo! Zo klinkt mijn stem als ik je voorlees.'],
    ['sv', 'Swedish', 'Svenska', 'Hej! Så här låter min röst när jag läser för dig.'],
    ['no', 'Norwegian', 'Norsk', 'Hei! Slik høres stemmen min ut når jeg leser for deg.'],
    ['da', 'Danish', 'Dansk', 'Hej! Sådan lyder min stemme, når jeg læser højt for dig.'],
    ['fi', 'Finnish', 'Suomi', 'Hei! Tältä ääneni kuulostaa, kun luen sinulle.'],
    ['is', 'Icelandic', 'Íslenska', 'Halló! Svona hljómar röddin mín þegar ég les fyrir þig.'],
    ['pl', 'Polish', 'Polski', 'Cześć! Tak brzmi mój głos, gdy ci czytam.'],
    ['cs', 'Czech', 'Čeština', 'Ahoj! Takhle zní můj hlas, když ti předčítám.'],
    ['sk', 'Slovak', 'Slovenčina', 'Ahoj! Takto znie môj hlas, keď ti čítam.'],
    ['hu', 'Hungarian', 'Magyar', 'Szia! Így hangzik a hangom, amikor felolvasok neked.'],
    ['ro', 'Romanian', 'Română', 'Bună! Așa sună vocea mea când îți citesc.'],
    ['bg', 'Bulgarian', 'Български', 'Здравей! Така звучи гласът ми, когато ти чета.'],
    ['hr', 'Croatian', 'Hrvatski', 'Bok! Ovako zvuči moj glas kad ti čitam.'],
    ['sr', 'Serbian', 'Српски', 'Здраво! Овако звучи мој глас када ти читам.'],
    ['sl', 'Slovenian', 'Slovenščina', 'Živjo! Tako zveni moj glas, ko ti berem.'],
    ['el', 'Greek', 'Ελληνικά', 'Γεια σου! Έτσι ακούγεται η φωνή μου όταν σου διαβάζω.'],
    ['ru', 'Russian', 'Русский', 'Привет! Так звучит мой голос, когда я тебе читаю.'],
    ['uk', 'Ukrainian', 'Українська', 'Привіт! Так звучить мій голос, коли я тобі читаю.'],
    ['tr', 'Turkish', 'Türkçe', 'Merhaba! Sana okurken sesim böyle duyuluyor.'],
    ['ar', 'Arabic', 'العربية', 'مرحبًا! هكذا يبدو صوتي عندما أقرأ لك.'],
    ['he', 'Hebrew', 'עברית', 'שלום! כך נשמע הקול שלי כשאני מקריא לך.'],
    ['hi', 'Hindi', 'हिन्दी', 'नमस्ते! जब मैं आपको पढ़कर सुनाता हूँ तो मेरी आवाज़ ऐसी लगती है।'],
    ['th', 'Thai', 'ไทย', 'สวัสดี! นี่คือเสียงของฉันเวลาอ่านให้คุณฟัง'],
    ['vi', 'Vietnamese', 'Tiếng Việt', 'Xin chào! Đây là giọng của tôi khi đọc cho bạn nghe.'],
    ['id', 'Indonesian', 'Bahasa Indonesia', 'Halo! Beginilah suaraku saat membacakan untukmu.'],
    ['ja', 'Japanese', '日本語', 'こんにちは！読み上げるときの私の声はこんな感じです。'],
    ['ko', 'Korean', '한국어', '안녕하세요! 제가 읽어 드릴 때 목소리는 이렇습니다.'],
    ['zh', 'Chinese', '中文', '你好！我为你朗读时，声音是这样的。'],
    ['ca', 'Catalan', 'Català', 'Hola! Així sona la meva veu quan et llegeixo.'],
    ['cy', 'Welsh', 'Cymraeg', 'Helo! Dyma fy llais pan fyddaf yn darllen i chi.']
  ];
  const by = {}; L.forEach(x => { by[x[0]] = x; });
  const get = () => { let t = ''; try { t = ls.get(KEY, 'en') || 'en'; } catch (e) { } return by[t] ? t : 'en'; };
  const row = t => by[t] || by.en;
  const name = () => row(get())[1];
  const greeting = () => row(get())[3];
  /* a voice's language, as the short code ('en' for en-US, en_GB and so on) */
  const code = v => String((v && v.lang) || '').toLowerCase().replace('_', '-').split('-')[0];
  const matches = v => !!v && code(v) === get();
  const voices = list => (list || []).filter(matches);
  /* the best installed voice for the chosen language: an on-device one first */
  const pick = list => { const v = voices(list); return v.filter(x => x.localService || x.piper)[0] || v[0] || null; };
  const apply = t => { try { document.documentElement.lang = t; } catch (e) { } };
  const set = t => {
    if (!by[t]) t = 'en';
    try { ls.set(KEY, t); } catch (e) { }
    apply(t);
    try { window.dispatchEvent(new Event('oa-lang')); } catch (e) { }
    return t;
  };
  const opts = () => L.slice().sort((a, b) => a[1].localeCompare(b[1])).map(x => '<option value="' + x[0] + '"' + (x[0] === get() ? ' selected' : '') + '>' + x[1] + (x[2] !== x[1] ? ' (' + x[2] + ')' : '') + '</option>').join('');
  A.language = { list: L, get, set, name, native: () => row(get())[2], greeting, code, matches, voices, pick, opts, tag: get };
  apply(get());
})();
