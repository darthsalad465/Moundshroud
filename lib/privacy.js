// Privacy: one place that knows everything that can leave this PC, and keeps the app window from phoning home.
//
// Moundshroud itself only goes online when you ask it to (internet access, the Claude key, News). The window it runs in
// is Microsoft Edge in "app mode" with its own private profile (edge-profile), and a browser left to itself talks to
// its maker: usage statistics, crash reports, sync and automatic sign-in to a Microsoft account, cloud spell-check of
// what you type, search suggestions, page prefetching, translation, and scanning the home network for TVs to cast to.
// Two things switch those off for this window only (your normal Edge is not touched):
//   - EDGE_ARGS: command-line switches the launcher passes when it opens the window;
//   - edgePrefs(): settings written into the app's own profile while that window is closed.
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..'), PROFILE = path.join(ROOT, 'edge-profile');

/* the same list is in Listener.cs and open-moundshroud.ps1 (they launch the window); keep the three in step */
const EDGE_ARGS = [
  '--no-first-run', '--no-default-browser-check', '--disable-background-mode',
  '--disable-background-networking',         // no background fetches (field trials, prefetch, component checks)
  '--disable-component-update',
  '--disable-domain-reliability',            // no network-error reports to Microsoft/Google
  '--no-pings',                              // no hyperlink-auditing pings
  '--disable-breakpad', '--no-report-upload', // crash dumps are never uploaded
  '--metrics-recording-only',                // usage statistics are never sent
  '--disable-default-apps',
  '--disable-features=Translate,MediaRouter,DialMediaRouteProvider,OptimizationHints,AutofillServerCommunication,msEdgeShoppingUI,msUndersideButton,msShowCopilotButtonInToolbar,msEdgeEnhanceImages,msSpeechRecognitionOnline'
];

/* settings written into the window's own profile (Default/Preferences). Only done while that window is closed,
   because a running browser rewrites its settings file on exit. */
const PREFS = {
  enable_do_not_track: true,                                   // asks sites not to track (the Do Not Track header)
  profile: { block_third_party_cookies: true },               // no third-party cookies when a news link is opened
  spellcheck: { use_spelling_service: false },                // spelling is checked on this PC, not in Microsoft's cloud
  search: { suggest_enabled: false },
  alternate_error_pages: { enabled: false },
  net: { network_prediction_options: 2 },                     // no prefetching of pages you have not opened
  translate: { enabled: false },
  autofill: { profile_enabled: false, credit_card_enabled: false },
  credentials_enable_service: false,
  payments: { can_make_payment_enabled: false },
  safebrowsing: { scout_reporting_enabled: false },
  url_keyed_anonymized_data_collection: { enabled: false }
};
/* signing the window out of a Microsoft account (and keeping it out) is the person's decision, made on the Privacy page */
const SIGNOUT = { signin: { allowed: false, allowed_on_next_startup: false }, sync: { requested: false } };
const CHOICE = path.join(ROOT, 'data', 'privacy.json');
const choice = () => { try { return JSON.parse(fs.readFileSync(CHOICE, 'utf8')); } catch (e) { return {}; } };
function setChoice(patch) { const c = Object.assign(choice(), patch); try { fs.mkdirSync(path.dirname(CHOICE), { recursive: true }); fs.writeFileSync(CHOICE, JSON.stringify(c)); } catch (e) { } return c; }
function merge(dst, src) { for (const k of Object.keys(src)) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) { if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {}; merge(dst[k], src[k]); } else dst[k] = src[k]; } return dst; }
function windowOpen() {
  const lock = path.join(PROFILE, 'lockfile');
  if (!fs.existsSync(lock)) return false;
  try { fs.unlinkSync(lock); return false; } catch (e) { return true; }     // a running Edge holds it open, so it cannot be removed
}
let last = { at: 0, ok: false, note: '' };
function edgePrefs() {
  const file = path.join(PROFILE, 'Default', 'Preferences');
  if (!fs.existsSync(path.join(PROFILE, 'Default'))) return (last = { at: Date.now(), ok: false, note: 'The app window has not been opened yet.' });
  if (windowOpen()) return (last = { at: Date.now(), ok: false, note: 'The window is open; its settings are locked down the next time Moundshroud starts.' });
  try {
    let p = {}; try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { p = {}; }
    const before = JSON.stringify(p);
    merge(p, PREFS); if (choice().signout) merge(p, SIGNOUT);
    if (JSON.stringify(p) !== before) { fs.copyFileSync(file, file + '.before-privacy'); fs.writeFileSync(file, JSON.stringify(p)); }
    return (last = { at: Date.now(), ok: true, note: 'Locked down.' });
  } catch (e) { return (last = { at: Date.now(), ok: false, note: 'Could not update the window settings: ' + e.message }); }
}
/* what the window's profile says right now (read-only), for the Privacy page */
function edgeState() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(PROFILE, 'Default', 'Preferences'), 'utf8'));
    const get = (o, k) => k.split('.').reduce((a, x) => a && a[x], o);
    const checks = [['enable_do_not_track', true], ['profile.block_third_party_cookies', true], ['spellcheck.use_spelling_service', false], ['search.suggest_enabled', false], ['net.network_prediction_options', 2], ['translate.enabled', false]];
    return { done: checks.filter(([k, v]) => get(p, k) === v).length, of: checks.length, signedIn: !!(p.account_info && p.account_info.length) };
  } catch (e) { return { done: 0, of: 6, signedIn: false }; }
}
function status(extra) { return Object.assign({ edge: edgeState(), lastPatch: last, args: EDGE_ARGS, signout: !!choice().signout, windowOpen: windowOpen() }, extra || {}); }

module.exports = { EDGE_ARGS, edgePrefs, edgeState, status, setChoice, choice };
