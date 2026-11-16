// News: headlines from many outlets, grouped into events.
//
// The point is reliability, so three rules run through this file:
//   1. Many sources, on purpose: wire services, public broadcasters, national papers and TV from the left, the centre
//      and the right, and outlets from other countries. AP, Reuters, CNN and USA Today no longer publish feeds that a
//      reader can use, so their headlines come through Google News's per-site search feeds (headline and link only).
//   2. A story is an event, not an article: articles about the same thing are grouped, and an event is ranked by how
//      many independent outlets report it, so one outlet's scoop or mistake cannot top the page on its own.
//   3. Opinion is not news: opinion, editorials and columns are labelled, never used as an event's headline, and not
//      counted as confirmation.
//   4. Christian and church news (Catholic, Orthodox, Protestant, ecumenical, Vatican) has its own sources, marked with
//      `faith`. They are grouped separately (C.faith) so they neither crowd the main page nor count as confirmation there.
// Nothing is fetched unless internet access is switched on (Settings, AI & power). What was fetched last is kept in
// data/news.json, so the last edition can still be read offline.
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https'), zlib = require('zlib'), crypto = require('crypto');
const net = require('./net');

const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, 'news.json'), PREFS = path.join(DATA, 'news-sources.json');
/* who we say we are: a plain, common feed-reader name (not 'Moundshroud', which would single this PC out). Tested: a browser
   name made some sites' bot filters refuse the feed, because the rest of the request does not look like a browser. */
const UA = 'Mozilla/5.0 (compatible; RSS reader)';
const UA_IMG = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const FAITH_H = 7 * 24;   // Christian news is grouped over a week
const KEEP_H = 14 * 24, CLUSTER_H = 48, MIN_GAP = 4 * 60 * 1000;   // two weeks are kept for searching; events are built from the last two days

/* lean: an approximate placement of US and UK outlets on the left-right spectrum, after the public media-bias charts
   (AllSides, Ad Fontes). L = left, LL = leans left, C = centre, LR = leans right, R = right, '' = not rated (most
   non-US outlets: the American spectrum does not map onto them). The user can change any of these in Sources.
   kind: wire, public (public broadcaster), paper, tv, digital, magazine, intl, opinion (mostly opinion), special. */
const G = site => 'https://news.google.com/rss/search?q=when:1d+site:' + site + '&hl=en-US&gl=US&ceid=US:en';
/* Christian outlets that block feed readers: the same Google News search, over three days (church outlets post less often) */
const GF = site => 'https://news.google.com/rss/search?q=when:3d+site:' + site + '&hl=en-US&gl=US&ceid=US:en';
const SOURCES = [
  { id: 'ap', name: 'Associated Press', country: 'US', kind: 'wire', lean: 'LL', via: 'google', feeds: [[G('apnews.com'), 'top']] },
  { id: 'reuters', name: 'Reuters', country: 'UK', kind: 'wire', lean: 'C', via: 'google', feeds: [[G('reuters.com'), 'top']] },
  { id: 'bbc', name: 'BBC News', country: 'UK', kind: 'public', lean: 'C', feeds: [['https://feeds.bbci.co.uk/news/rss.xml', 'top'], ['https://feeds.bbci.co.uk/news/world/rss.xml', 'world'], ['https://feeds.bbci.co.uk/news/business/rss.xml', 'business'], ['https://feeds.bbci.co.uk/news/technology/rss.xml', 'tech'], ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'science'], ['https://feeds.bbci.co.uk/news/health/rss.xml', 'health'], ['https://feeds.bbci.co.uk/sport/rss.xml', 'sports']] },
  { id: 'npr', name: 'NPR', country: 'US', kind: 'public', lean: 'LL', feeds: [['https://feeds.npr.org/1001/rss.xml', 'top'], ['https://feeds.npr.org/1004/rss.xml', 'world'], ['https://feeds.npr.org/1014/rss.xml', 'politics'], ['https://feeds.npr.org/1006/rss.xml', 'business']] },
  { id: 'pbs', name: 'PBS NewsHour', country: 'US', kind: 'public', lean: 'LL', feeds: [['https://www.pbs.org/newshour/feeds/rss/headlines', 'top']] },
  { id: 'nyt', name: 'The New York Times', country: 'US', kind: 'paper', lean: 'LL', feeds: [['https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'top'], ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'world'], ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'politics'], ['https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'business'], ['https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'tech'], ['https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', 'science'], ['https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', 'health'], ['https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml', 'opinion']] },
  { id: 'wapo', name: 'The Washington Post', country: 'US', kind: 'paper', lean: 'LL', feeds: [['https://www.washingtonpost.com/arcio/rss/category/politics/', 'politics'], ['https://www.washingtonpost.com/arcio/rss/category/world/', 'world'], ['https://www.washingtonpost.com/arcio/rss/category/national/', 'us'], ['https://www.washingtonpost.com/arcio/rss/category/business/', 'business'], ['https://www.washingtonpost.com/arcio/rss/category/opinions/', 'opinion']] },
  { id: 'wsj', name: 'The Wall Street Journal', country: 'US', kind: 'paper', lean: 'C', feeds: [['https://feeds.content.dowjones.io/public/rss/RSSWorldNews', 'world'], ['https://feeds.content.dowjones.io/public/rss/RSSUSnews', 'us'], ['https://feeds.content.dowjones.io/public/rss/RSSOpinion', 'opinion']] },
  { id: 'latimes', name: 'Los Angeles Times', country: 'US', kind: 'paper', lean: 'LL', feeds: [['https://www.latimes.com/world-nation/rss2.0.xml', 'top'], ['https://www.latimes.com/opinion/rss2.0.xml', 'opinion']] },
  { id: 'usatoday', name: 'USA Today', country: 'US', kind: 'paper', lean: 'LL', via: 'google', feeds: [[G('usatoday.com'), 'top']] },
  { id: 'cnn', name: 'CNN', country: 'US', kind: 'tv', lean: 'L', via: 'google', feeds: [[G('cnn.com'), 'top']] },
  { id: 'cbs', name: 'CBS News', country: 'US', kind: 'tv', lean: 'LL', feeds: [['https://www.cbsnews.com/latest/rss/main', 'top'], ['https://www.cbsnews.com/latest/rss/politics', 'politics'], ['https://www.cbsnews.com/latest/rss/world', 'world']] },
  { id: 'abc', name: 'ABC News', country: 'US', kind: 'tv', lean: 'LL', feeds: [['https://feeds.abcnews.com/abcnews/topstories', 'top'], ['https://feeds.abcnews.com/abcnews/politicsheadlines', 'politics']] },
  { id: 'nbc', name: 'NBC News', country: 'US', kind: 'tv', lean: 'LL', feeds: [['https://feeds.nbcnews.com/nbcnews/public/news', 'top']] },
  { id: 'fox', name: 'Fox News', country: 'US', kind: 'tv', lean: 'R', feeds: [['https://moxie.foxnews.com/google-publisher/latest.xml', 'top'], ['https://moxie.foxnews.com/google-publisher/politics.xml', 'politics'], ['https://moxie.foxnews.com/google-publisher/world.xml', 'world'], ['https://moxie.foxnews.com/google-publisher/opinion.xml', 'opinion']] },
  { id: 'newsmax', name: 'Newsmax', country: 'US', kind: 'tv', lean: 'R', feeds: [['https://www.newsmax.com/rss/Newsfront/16/', 'top']] },
  { id: 'nypost', name: 'New York Post', country: 'US', kind: 'paper', lean: 'LR', feeds: [['https://nypost.com/feed/', 'top'], ['https://nypost.com/opinion/feed/', 'opinion']] },
  { id: 'wexaminer', name: 'Washington Examiner', country: 'US', kind: 'digital', lean: 'LR', feeds: [['https://www.washingtonexaminer.com/feed', 'politics'], ['https://www.washingtonexaminer.com/opinion/feed', 'opinion']] },
  { id: 'wtimes', name: 'The Washington Times', country: 'US', kind: 'paper', lean: 'LR', feeds: [['https://www.washingtontimes.com/rss/headlines/news/', 'top']] },
  { id: 'dailywire', name: 'The Daily Wire', country: 'US', kind: 'digital', lean: 'R', feeds: [['https://www.dailywire.com/feeds/rss.xml', 'top']] },
  { id: 'natreview', name: 'National Review', country: 'US', kind: 'opinion', lean: 'R', feeds: [['https://www.nationalreview.com/feed/', 'politics']] },
  { id: 'hill', name: 'The Hill', country: 'US', kind: 'digital', lean: 'C', feeds: [['https://thehill.com/news/feed/', 'politics'], ['https://thehill.com/opinion/feed/', 'opinion']] },
  { id: 'politico', name: 'Politico', country: 'US', kind: 'digital', lean: 'LL', feeds: [['https://rss.politico.com/politics-news.xml', 'politics']] },
  { id: 'axios', name: 'Axios', country: 'US', kind: 'digital', lean: 'LL', feeds: [['https://www.axios.com/feeds/feed.rss', 'top']] },
  { id: 'semafor', name: 'Semafor', country: 'US', kind: 'digital', lean: 'C', feeds: [['https://www.semafor.com/rss.xml', 'top']] },
  { id: 'newsweek', name: 'Newsweek', country: 'US', kind: 'magazine', lean: 'C', feeds: [['https://www.newsweek.com/rss', 'top']] },
  { id: 'deseret', name: 'Deseret News', country: 'US', kind: 'paper', lean: 'C', feeds: [['https://www.deseret.com/arc/outboundfeeds/rss/', 'us']] },
  { id: 'rcp', name: 'RealClearPolitics', country: 'US', kind: 'opinion', lean: 'LR', feeds: [['https://www.realclearpolitics.com/index.xml', 'politics']] },
  { id: 'vox', name: 'Vox', country: 'US', kind: 'digital', lean: 'L', feeds: [['https://www.vox.com/rss/index.xml', 'politics']] },
  { id: 'bloomberg', name: 'Bloomberg', country: 'US', kind: 'digital', lean: 'LL', feeds: [['https://feeds.bloomberg.com/markets/news.rss', 'business']] },
  { id: 'cnbc', name: 'CNBC', country: 'US', kind: 'tv', lean: 'C', feeds: [['https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', 'business']] },
  { id: 'guardian', name: 'The Guardian', country: 'UK', kind: 'paper', lean: 'LL', feeds: [['https://www.theguardian.com/world/rss', 'world'], ['https://www.theguardian.com/us-news/rss', 'us'], ['https://www.theguardian.com/business/rss', 'business'], ['https://www.theguardian.com/technology/rss', 'tech'], ['https://www.theguardian.com/science/rss', 'science'], ['https://www.theguardian.com/sport/rss', 'sports'], ['https://www.theguardian.com/uk/commentisfree/rss', 'opinion']] },
  { id: 'independent', name: 'The Independent', country: 'UK', kind: 'paper', lean: 'LL', feeds: [['https://www.independent.co.uk/news/world/rss', 'world']] },
  { id: 'telegraph', name: 'The Telegraph', country: 'UK', kind: 'paper', lean: 'LR', feeds: [['https://www.telegraph.co.uk/rss.xml', 'top']] },
  { id: 'ft', name: 'Financial Times', country: 'UK', kind: 'paper', lean: 'C', feeds: [['https://www.ft.com/world?format=rss', 'world']] },
  { id: 'economist', name: 'The Economist', country: 'UK', kind: 'magazine', lean: 'LL', feeds: [['https://www.economist.com/the-world-this-week/rss.xml', 'world'], ['https://www.economist.com/finance-and-economics/rss.xml', 'business']] },
  { id: 'sky', name: 'Sky News', country: 'UK', kind: 'tv', lean: 'C', feeds: [['https://feeds.skynews.com/feeds/rss/world.xml', 'world']] },
  { id: 'aljazeera', name: 'Al Jazeera', country: 'Qatar', kind: 'intl', lean: '', feeds: [['https://www.aljazeera.com/xml/rss/all.xml', 'world']] },
  { id: 'dw', name: 'Deutsche Welle', country: 'Germany', kind: 'public', lean: '', feeds: [['https://rss.dw.com/rdf/rss-en-all', 'world']] },
  { id: 'france24', name: 'France 24', country: 'France', kind: 'public', lean: '', feeds: [['https://www.france24.com/en/rss', 'world']] },
  { id: 'lemonde', name: 'Le Monde', country: 'France', kind: 'paper', lean: '', feeds: [['https://www.lemonde.fr/en/rss/une.xml', 'world']] },
  { id: 'euronews', name: 'Euronews', country: 'EU', kind: 'tv', lean: '', feeds: [['https://www.euronews.com/rss', 'world']] },
  { id: 'rte', name: 'RTÉ', country: 'Ireland', kind: 'public', lean: '', feeds: [['https://www.rte.ie/feeds/rss/?index=/news/', 'world']] },
  { id: 'cbc', name: 'CBC News', country: 'Canada', kind: 'public', lean: '', feeds: [['https://www.cbc.ca/webfeed/rss/rss-topstories', 'top'], ['https://www.cbc.ca/webfeed/rss/rss-world', 'world']] },
  { id: 'abcau', name: 'ABC Australia', country: 'Australia', kind: 'public', lean: '', feeds: [['https://www.abc.net.au/news/feed/51120/rss.xml', 'world']] },
  { id: 'toi', name: 'The Times of Israel', country: 'Israel', kind: 'intl', lean: '', feeds: [['https://www.timesofisrael.com/feed/', 'world']] },
  { id: 'hindu', name: 'The Hindu', country: 'India', kind: 'paper', lean: '', feeds: [['https://www.thehindu.com/news/international/feeder/default.rss', 'world']] },
  { id: 'scmp', name: 'South China Morning Post', country: 'Hong Kong', kind: 'paper', lean: '', feeds: [['https://www.scmp.com/rss/91/feed', 'world']] },
  { id: 'japantimes', name: 'The Japan Times', country: 'Japan', kind: 'paper', lean: '', feeds: [['https://www.japantimes.co.jp/feed/', 'world']] },
  { id: 'straits', name: 'The Straits Times', country: 'Singapore', kind: 'paper', lean: '', feeds: [['https://www.straitstimes.com/news/world/rss.xml', 'world']] },
  { id: 'cna', name: 'CNA', country: 'Singapore', kind: 'tv', lean: '', feeds: [['https://www.channelnewsasia.com/rssfeeds/8395986', 'world']] },
  { id: 'africanews', name: 'Africanews', country: 'Africa', kind: 'tv', lean: '', feeds: [['https://www.africanews.com/feed/rss', 'world']] },
  { id: 'batimes', name: 'Buenos Aires Times', country: 'Argentina', kind: 'paper', lean: '', feeds: [['https://www.batimes.com.ar/feed', 'world']] },
  { id: 'mercopress', name: 'MercoPress', country: 'Uruguay', kind: 'digital', lean: '', feeds: [['https://mercopress.com/rss/', 'world']] },
  { id: 'nature', name: 'Nature', country: 'UK', kind: 'special', lean: '', feeds: [['https://www.nature.com/nature.rss', 'science']] },
  { id: 'sciencedaily', name: 'ScienceDaily', country: 'US', kind: 'special', lean: '', feeds: [['https://www.sciencedaily.com/rss/top/science.xml', 'science']] },
  { id: 'nasa', name: 'NASA', country: 'US', kind: 'special', lean: '', feeds: [['https://www.nasa.gov/news-release/feed/', 'science']] },
  { id: 'stat', name: 'STAT', country: 'US', kind: 'special', lean: '', feeds: [['https://www.statnews.com/feed/', 'health']] },
  { id: 'ars', name: 'Ars Technica', country: 'US', kind: 'special', lean: '', feeds: [['https://arstechnica.com/feed/', 'tech']] },
  { id: 'verge', name: 'The Verge', country: 'US', kind: 'special', lean: '', feeds: [['https://www.theverge.com/rss/index.xml', 'tech']] },
  { id: 'techcrunch', name: 'TechCrunch', country: 'US', kind: 'special', lean: '', feeds: [['https://techcrunch.com/feed/', 'tech']] },
  { id: 'espn', name: 'ESPN', country: 'US', kind: 'special', lean: '', feeds: [['https://www.espn.com/espn/rss/news', 'sports']] },

  /* ---- investigative newsrooms: the stories nobody else has yet ---- */
  { id: 'propublica', name: 'ProPublica', country: 'US', kind: 'investigative', lean: 'LL', feeds: [['https://www.propublica.org/feeds/propublica/main', 'us']] },
  { id: 'intercept', name: 'The Intercept', country: 'US', kind: 'investigative', lean: 'L', feeds: [['https://theintercept.com/feed/?rss', 'us']] },
  { id: 'bellingcat', name: 'Bellingcat', country: 'Netherlands', kind: 'investigative', lean: '', feeds: [['https://www.bellingcat.com/feed/', 'world']] },
  { id: 'icij', name: 'ICIJ', country: 'International', kind: 'investigative', lean: '', feeds: [['https://www.icij.org/feed/', 'world']] },
  { id: 'marshall', name: 'The Marshall Project', country: 'US', kind: 'investigative', lean: 'LL', feeds: [['https://www.themarshallproject.org/rss/recent.rss', 'us']] },
  { id: 'kffhealth', name: 'KFF Health News', country: 'US', kind: 'investigative', lean: '', feeds: [['https://kffhealthnews.org/feed/', 'health']] },
  { id: 'insideclimate', name: 'Inside Climate News', country: 'US', kind: 'investigative', lean: '', feeds: [['https://insideclimatenews.org/feed/', 'science']] },
  { id: 'grist', name: 'Grist', country: 'US', kind: 'investigative', lean: '', feeds: [['https://grist.org/feed/', 'science']] },
  { id: '404media', name: '404 Media', country: 'US', kind: 'investigative', lean: '', feeds: [['https://www.404media.co/rss/', 'tech']] },
  { id: 'restofworld', name: 'Rest of World', country: 'International', kind: 'investigative', lean: '', feeds: [['https://restofworld.org/feed/latest/', 'tech']] },
  { id: 'texastribune', name: 'The Texas Tribune', country: 'US', kind: 'investigative', lean: '', feeds: [['https://www.texastribune.org/feeds/main/', 'us']] },
  { id: 'calmatters', name: 'CalMatters', country: 'US', kind: 'investigative', lean: '', feeds: [['https://calmatters.org/feed/', 'us']] },
  { id: 'stateline', name: 'Stateline', country: 'US', kind: 'investigative', lean: '', feeds: [['https://stateline.org/feed/', 'us']] },
  { id: 'thecity', name: 'THE CITY (New York)', country: 'US', kind: 'investigative', lean: '', feeds: [['https://www.thecity.nyc/feed/', 'us']] },
  { id: 'maverick', name: 'Daily Maverick', country: 'South Africa', kind: 'investigative', lean: '', feeds: [['https://www.dailymaverick.co.za/dmrss/', 'world']] },
  { id: 'premiumtimes', name: 'Premium Times', country: 'Nigeria', kind: 'investigative', lean: '', feeds: [['https://www.premiumtimesng.com/feed', 'world']] },
  { id: 'rappler', name: 'Rappler', country: 'Philippines', kind: 'investigative', lean: '', feeds: [['https://www.rappler.com/feed/', 'world']] },
  { id: 'meduza', name: 'Meduza', country: 'Russia (in exile)', kind: 'investigative', lean: '', feeds: [['https://meduza.io/rss/en/all', 'world']] },
  { id: 'balkaninsight', name: 'Balkan Insight', country: 'Balkans', kind: 'investigative', lean: '', feeds: [['https://balkaninsight.com/feed/', 'world']] },

  /* ---- beat specialists: law, security, foreign policy, science, the press ---- */
  { id: 'scotusblog', name: 'SCOTUSblog', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.scotusblog.com/feed/', 'politics']] },
  { id: 'courthouse', name: 'Courthouse News', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.courthousenews.com/feed/', 'us']] },
  { id: 'justsecurity', name: 'Just Security', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.justsecurity.org/feed/', 'politics']] },
  { id: 'defenseone', name: 'Defense One', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.defenseone.com/rss/all/', 'politics']] },
  { id: 'warontherocks', name: 'War on the Rocks', country: 'US', kind: 'specialist', lean: '', feeds: [['https://warontherocks.com/feed/', 'world']] },
  { id: 'foreignpolicy', name: 'Foreign Policy', country: 'US', kind: 'specialist', lean: '', feeds: [['https://foreignpolicy.com/feed/', 'world']] },
  { id: 'cipherbrief', name: 'The Cipher Brief', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.thecipherbrief.com/feed', 'world']] },
  { id: 'diplomat', name: 'The Diplomat', country: 'Asia-Pacific', kind: 'specialist', lean: '', feeds: [['https://thediplomat.com/feed/', 'world']] },
  { id: 'nikkei', name: 'Nikkei Asia', country: 'Japan', kind: 'specialist', lean: '', feeds: [['https://asia.nikkei.com/rss/feed/nar', 'business']] },
  { id: 'politicoeu', name: 'Politico Europe', country: 'EU', kind: 'specialist', lean: '', feeds: [['https://www.politico.eu/feed/', 'world']] },
  { id: 'kyivind', name: 'The Kyiv Independent', country: 'Ukraine', kind: 'specialist', lean: '', feeds: [['https://kyivindependent.com/news-archive/rss/', 'world']] },
  { id: 'pravda', name: 'Ukrainska Pravda', country: 'Ukraine', kind: 'specialist', lean: '', feeds: [['https://www.pravda.com.ua/eng/rss/', 'world']] },
  { id: 'moscowtimes', name: 'The Moscow Times', country: 'Russia (in exile)', kind: 'specialist', lean: '', feeds: [['https://www.themoscowtimes.com/rss/news', 'world']] },
  { id: 'haaretz', name: 'Haaretz', country: 'Israel', kind: 'specialist', lean: '', feeds: [['https://www.haaretz.com/srv/haaretz-latest-headlines', 'world']] },
  { id: 'almonitor', name: 'Al-Monitor', country: 'Middle East', kind: 'specialist', lean: '', feeds: [['https://www.al-monitor.com/rss', 'world']] },
  { id: 'dawn', name: 'Dawn', country: 'Pakistan', kind: 'specialist', lean: '', feeds: [['https://www.dawn.com/feeds/home', 'world']] },
  { id: 'newhumanitarian', name: 'The New Humanitarian', country: 'International', kind: 'specialist', lean: '', feeds: [['https://www.thenewhumanitarian.org/rss/all.xml', 'world']] },
  { id: 'devex', name: 'Devex', country: 'International', kind: 'specialist', lean: '', feeds: [['https://www.devex.com/news/feed.rss', 'world']] },
  { id: 'crisisgroup', name: 'International Crisis Group', country: 'International', kind: 'specialist', lean: '', feeds: [['https://www.crisisgroup.org/rss.xml', 'world']] },
  { id: 'rand', name: 'RAND', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.rand.org/news/press.xml', 'politics']] },
  { id: 'therecord', name: 'The Record', country: 'US', kind: 'specialist', lean: '', feeds: [['https://therecord.media/feed/', 'tech']] },
  { id: 'bleeping', name: 'BleepingComputer', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.bleepingcomputer.com/feed/', 'tech']] },
  { id: 'krebs', name: 'Krebs on Security', country: 'US', kind: 'specialist', lean: '', feeds: [['https://krebsonsecurity.com/feed/', 'tech']] },
  { id: 'techreview', name: 'MIT Technology Review', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.technologyreview.com/feed/', 'tech']] },
  { id: 'ieee', name: 'IEEE Spectrum', country: 'US', kind: 'specialist', lean: '', feeds: [['https://spectrum.ieee.org/feeds/feed.rss', 'tech']] },
  { id: 'science', name: 'Science (AAAS)', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.science.org/rss/news_current.xml', 'science']] },
  { id: 'carbonbrief', name: 'Carbon Brief', country: 'UK', kind: 'specialist', lean: '', feeds: [['https://www.carbonbrief.org/feed/', 'science']] },
  { id: 'retraction', name: 'Retraction Watch', country: 'US', kind: 'specialist', lean: '', feeds: [['https://retractionwatch.com/feed/', 'science']] },
  { id: 'niemanlab', name: 'Nieman Lab', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.niemanlab.org/feed/', 'culture']] },
  { id: 'cjr', name: 'Columbia Journalism Review', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.cjr.org/feed', 'culture']] },

  /* ---- opinion: the argument from every side (everything here is labelled opinion and never counts as confirmation) ---- */
  { id: 'atlantic', name: 'The Atlantic', country: 'US', kind: 'magazine', lean: 'LL', feeds: [['https://www.theatlantic.com/feed/all/', 'opinion']] },
  { id: 'nation', name: 'The Nation', country: 'US', kind: 'opinion', lean: 'L', feeds: [['https://www.thenation.com/feed/?post_type=article', 'opinion']] },
  { id: 'tnr', name: 'The New Republic', country: 'US', kind: 'opinion', lean: 'L', feeds: [['https://www.newrepublic.com/rss.xml', 'opinion']] },
  { id: 'motherjones', name: 'Mother Jones', country: 'US', kind: 'opinion', lean: 'L', feeds: [['https://www.motherjones.com/feed/', 'opinion']] },
  { id: 'slowboring', name: 'Slow Boring', country: 'US', kind: 'opinion', lean: 'LL', feeds: [['https://www.slowboring.com/feed', 'opinion']] },
  { id: 'dispatch', name: 'The Dispatch', country: 'US', kind: 'opinion', lean: 'LR', feeds: [['https://www.thedispatch.com/feed/', 'opinion']] },
  { id: 'reason', name: 'Reason', country: 'US', kind: 'opinion', lean: 'LR', feeds: [['https://reason.com/feed/', 'opinion']] },
  { id: 'amconservative', name: 'The American Conservative', country: 'US', kind: 'opinion', lean: 'R', feeds: [['https://www.theamericanconservative.com/feed/', 'opinion']] },
  { id: 'projsynd', name: 'Project Syndicate', country: 'International', kind: 'opinion', lean: '', feeds: [['https://www.project-syndicate.org/rss', 'opinion']] },

  /* ---- fact-checkers ---- */
  { id: 'factcheckorg', name: 'FactCheck.org', country: 'US', kind: 'factcheck', lean: '', feeds: [['https://www.factcheck.org/feed/', 'politics']] },
  { id: 'snopes', name: 'Snopes', country: 'US', kind: 'factcheck', lean: '', feeds: [['https://www.snopes.com/feed/', 'us']] },
  { id: 'leadstories', name: 'Lead Stories', country: 'US', kind: 'factcheck', lean: '', feeds: [['https://leadstories.com/atom.xml', 'us']] },
  { id: 'checkyourfact', name: 'Check Your Fact', country: 'US', kind: 'factcheck', lean: '', feeds: [['https://checkyourfact.com/feed/', 'us']] },
  { id: 'bbcverify', name: 'BBC Verify', country: 'UK', kind: 'factcheck', lean: '', feeds: [['https://feeds.bbci.co.uk/news/reality_check/rss.xml', 'world']] },
  { id: 'poynter', name: 'Poynter', country: 'US', kind: 'specialist', lean: '', feeds: [['https://www.poynter.org/feed/', 'culture']] },

  /* ---- primary sources: what the institutions themselves publish ---- */
  { id: 'fed', name: 'Federal Reserve', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.federalreserve.gov/feeds/press_all.xml', 'business']] },
  { id: 'sec', name: 'SEC', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.sec.gov/news/pressreleases.rss', 'business']] },
  { id: 'doj', name: 'U.S. Justice Department', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.justice.gov/news/rss?type=press_release', 'us']] },
  { id: 'dod', name: 'U.S. Defense Department', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945', 'politics']] },
  { id: 'gao', name: 'GAO (Government Accountability Office)', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.gao.gov/rss/reports.xml', 'politics']] },
  { id: 'cbo', name: 'Congressional Budget Office', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.cbo.gov/publications/all/rss.xml', 'politics']] },
  { id: 'fedreg', name: 'Federal Register (final rules)', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D%5B%5D=RULE', 'politics']] },
  { id: 'fda', name: 'FDA', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml', 'health']] },
  { id: 'cisa', name: 'CISA security advisories', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.cisa.gov/cybersecurity-advisories/all.xml', 'tech']] },
  { id: 'bls', name: 'Bureau of Labor Statistics', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.bls.gov/feed/bls_latest.rss', 'business']] },
  { id: 'eia', name: 'U.S. Energy Information Administration', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.eia.gov/rss/todayinenergy.xml', 'business']] },
  { id: 'nhc', name: 'National Hurricane Center', country: 'US', kind: 'primary', lean: '', feeds: [['https://www.nhc.noaa.gov/index-at.xml', 'science']] },
  { id: 'usgs', name: 'USGS significant earthquakes', country: 'US', kind: 'primary', lean: '', feeds: [['https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom', 'science']] },
  { id: 'un', name: 'UN News', country: 'International', kind: 'primary', lean: '', feeds: [['https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'world']] },
  { id: 'eucomm', name: 'European Commission', country: 'EU', kind: 'primary', lean: '', feeds: [['https://ec.europa.eu/commission/presscorner/api/rss?language=en', 'world']] },
  { id: 'ecb', name: 'European Central Bank', country: 'EU', kind: 'primary', lean: '', feeds: [['https://www.ecb.europa.eu/rss/press.html', 'business']] },
  { id: 'boe', name: 'Bank of England', country: 'UK', kind: 'primary', lean: '', feeds: [['https://www.bankofengland.co.uk/rss/news', 'business']] },

  /* ---- Christian and church news (faith: vatican, catholic, orthodox, protestant, ecumenical) ----
     Feeds verified live 2026-11-14. These outlets are kept out of the general news events (a story two Catholic papers
     share is not "confirmed by two outlets" in the sense of the main page) and are grouped on their own in News > Christian.
     Left out because they duplicate another feed word for word: Catholic News Service and EWTN (= OSV News and CNA). */
  { id: 'vaticannews', name: 'Vatican News', country: 'Vatican City', kind: 'faith', faith: 'vatican', lean: '', feeds: [['https://www.vaticannews.va/en.rss.xml', 'top'], ['https://www.vaticannews.va/en/church.rss.xml', 'top'], ['https://www.vaticannews.va/en/world.rss.xml', 'world'], ['https://www.vaticannews.va/en/vatican-city.rss.xml', 'vatican']] },
  { id: 'usccb', name: 'U.S. Conference of Catholic Bishops', country: 'US', kind: 'primary', faith: 'catholic', lean: '', feeds: [['https://www.usccb.org/news/rss', 'us']] },
  { id: 'cnacatholic', name: 'Catholic News Agency', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.catholicnewsagency.com/rss/news.xml', 'top']] },
  { id: 'ncregister', name: 'National Catholic Register', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.ncregister.com/rss.xml', 'top']] },
  { id: 'osv', name: 'OSV News', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.osvnews.com/feed/', 'top']] },
  { id: 'crux', name: 'Crux', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://cruxnow.com/feed', 'top']] },
  { id: 'america', name: 'America Magazine', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.americamagazine.org/feed', 'top']] },
  { id: 'ncr', name: 'National Catholic Reporter', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.ncronline.org/rss.xml', 'top']] },
  { id: 'pillar', name: 'The Pillar', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.pillarcatholic.com/feed', 'top']] },
  { id: 'cwr', name: 'Catholic World Report', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.catholicworldreport.com/feed/', 'top']] },
  { id: 'catholicherald', name: 'Catholic Herald', country: 'UK', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://catholicherald.co.uk/feed/', 'top']] },
  { id: 'aleteia', name: 'Aleteia', country: 'International', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://aleteia.org/feed/', 'top']] },
  { id: 'zenit', name: 'Zenit', country: 'International', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://zenit.org/feed/', 'top']] },
  { id: 'angelus', name: 'Angelus News', country: 'US', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://angelusnews.com/feed/', 'us']] },
  { id: 'catholicleader', name: 'The Catholic Leader', country: 'Australia', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://catholicleader.com.au/feed/', 'world']] },
  { id: 'catholicweekly', name: 'The Catholic Weekly', country: 'Australia', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.catholicweekly.com.au/feed/', 'world']] },
  { id: 'jesuits', name: 'Jesuits Global', country: 'International', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.jesuits.global/feed/', 'world']] },
  { id: 'acn', name: 'Aid to the Church in Need', country: 'International', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.churchinneed.org/feed/', 'world']] },
  { id: 'lifesite', name: 'LifeSiteNews', country: 'Canada', kind: 'faith', faith: 'catholic', lean: '', feeds: [['https://www.lifesitenews.com/feed/', 'top']] },
  { id: 'catholicthing', name: 'The Catholic Thing', country: 'US', kind: 'opinion', faith: 'catholic', lean: '', feeds: [['https://www.thecatholicthing.org/feed/', 'opinion']] },
  { id: 'wherepeteris', name: 'Where Peter Is', country: 'US', kind: 'opinion', faith: 'catholic', lean: '', feeds: [['https://wherepeteris.com/feed/', 'opinion']] },
  { id: 'catholicexchange', name: 'Catholic Exchange', country: 'US', kind: 'opinion', faith: 'catholic', lean: '', feeds: [['https://catholicexchange.com/feed', 'opinion']] },
  { id: 'ucanews', name: 'UCA News', country: 'Asia', kind: 'faith', faith: 'catholic', lean: '', via: 'google', feeds: [[GF('ucanews.com'), 'world']] },
  { id: 'catholicculture', name: 'Catholic Culture', country: 'US', kind: 'faith', faith: 'catholic', lean: '', via: 'google', feeds: [[GF('catholicculture.org'), 'top']] },
  { id: 'fides', name: 'Agenzia Fides', country: 'Vatican City', kind: 'faith', faith: 'catholic', lean: '', via: 'google', feeds: [[GF('fides.org'), 'world']] },
  { id: 'tablet', name: 'The Tablet', country: 'UK', kind: 'faith', faith: 'catholic', lean: '', via: 'google', feeds: [[GF('thetablet.co.uk'), 'top']] },
  { id: 'icn', name: 'Independent Catholic News', country: 'UK', kind: 'faith', faith: 'catholic', lean: '', via: 'google', feeds: [[GF('indcatholicnews.com'), 'top']] },

  { id: 'oca', name: 'Orthodox Church in America', country: 'US', kind: 'primary', faith: 'orthodox', lean: '', feeds: [['https://www.oca.org/news/rss', 'top']] },
  { id: 'orthodoxtimes', name: 'Orthodox Times', country: 'Greece', kind: 'faith', faith: 'orthodox', lean: '', feeds: [['https://orthodoxtimes.com/feed/', 'top']] },
  { id: 'coptic', name: 'Coptic Orthodox Church', country: 'Egypt', kind: 'primary', faith: 'orthodox', lean: '', feeds: [['https://copticorthodox.church/en/feed', 'world']] },
  { id: 'orthochristian', name: 'OrthoChristian', country: 'Russia', kind: 'faith', faith: 'orthodox', lean: '', via: 'google', feeds: [[GF('orthochristian.com'), 'top']] },

  { id: 'christianitytoday', name: 'Christianity Today', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.christianitytoday.com/feed/', 'top']] },
  { id: 'christianpost', name: 'The Christian Post', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.christianpost.com/rss', 'top']] },
  { id: 'faithwire', name: 'Faithwire', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.faithwire.com/feed/', 'top']] },
  { id: 'christianheadlines', name: 'Christian Headlines', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.christianheadlines.com/rss/', 'top']] },
  { id: 'churchleaders', name: 'ChurchLeaders', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://churchleaders.com/feed', 'top']] },
  { id: 'charisma', name: 'Charisma News', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.charismanews.com/feed', 'top']] },
  { id: 'christiantoday', name: 'Christian Today', country: 'UK', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.christiantoday.com/rss.xml', 'top']] },
  { id: 'relevant', name: 'RELEVANT', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://relevantmagazine.com/feed/', 'culture']] },
  { id: 'lifeway', name: 'Lifeway Research', country: 'US', kind: 'special', faith: 'protestant', lean: '', feeds: [['https://research.lifeway.com/feed/', 'culture']] },
  { id: 'tgc', name: 'The Gospel Coalition', country: 'US', kind: 'opinion', faith: 'protestant', lean: '', feeds: [['https://www.thegospelcoalition.org/feed/', 'opinion']] },
  { id: 'erlc', name: 'ERLC (Southern Baptist ethics)', country: 'US', kind: 'opinion', faith: 'protestant', lean: '', feeds: [['https://erlc.com/feed/', 'opinion']] },
  { id: 'bng', name: 'Baptist News Global', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://baptistnews.com/feed/', 'top']] },
  { id: 'bapstandard', name: 'Baptist Standard', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://baptiststandard.com/feed/', 'top']] },
  { id: 'brnow', name: 'Biblical Recorder', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.brnow.org/feed/', 'top']] },
  { id: 'lcms', name: 'LCMS Reporter (Lutheran)', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://reporter.lcms.org/feed/', 'top']] },
  { id: 'livinglutheran', name: 'Living Lutheran (ELCA)', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.livinglutheran.org/feed/', 'top']] },
  { id: 'anglicannews', name: 'Anglican Communion News Service', country: 'International', kind: 'primary', faith: 'protestant', lean: '', feeds: [['https://www.anglicannews.org/rss', 'world']] },
  { id: 'anglicanink', name: 'Anglican Ink', country: 'UK', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://anglican.ink/feed/', 'top']] },
  { id: 'anglicanjournal', name: 'Anglican Journal', country: 'Canada', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://www.anglicanjournal.com/feed/', 'top']] },
  { id: 'livingchurch', name: 'The Living Church', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://livingchurch.org/feed/', 'top']] },
  { id: 'christiancentury', name: 'The Christian Century', country: 'US', kind: 'magazine', faith: 'protestant', lean: '', feeds: [['https://www.christiancentury.org/feed', 'top']] },
  { id: 'presoutlook', name: 'Presbyterian Outlook', country: 'US', kind: 'faith', faith: 'protestant', lean: '', feeds: [['https://pres-outlook.org/feed/', 'top']] },
  { id: 'baptistpress', name: 'Baptist Press', country: 'US', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('baptistpress.com'), 'top']] },
  { id: 'wng', name: 'WORLD', country: 'US', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('wng.org'), 'top']] },
  { id: 'cbn', name: 'CBN News', country: 'US', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('cbn.com'), 'top']] },
  { id: 'churchtimes', name: 'Church Times', country: 'UK', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('churchtimes.co.uk'), 'top']] },
  { id: 'umnews', name: 'UM News (United Methodist)', country: 'US', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('umnews.org'), 'top']] },
  { id: 'ens', name: 'Episcopal News Service', country: 'US', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('episcopalnewsservice.org'), 'top']] },
  { id: 'premierchristian', name: 'Premier Christian News', country: 'UK', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('premierchristian.news'), 'top']] },
  { id: 'evangelicalfocus', name: 'Evangelical Focus', country: 'Europe', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('evangelicalfocus.com'), 'world']] },
  { id: 'adventistreview', name: 'Adventist Review', country: 'International', kind: 'faith', faith: 'protestant', lean: '', via: 'google', feeds: [[GF('adventistreview.org'), 'top']] },

  { id: 'rns', name: 'Religion News Service', country: 'US', kind: 'faith', faith: 'ecumenical', lean: '', feeds: [['https://religionnews.com/feed/', 'top']] },
  { id: 'religionunplugged', name: 'Religion Unplugged', country: 'US', kind: 'faith', faith: 'ecumenical', lean: '', feeds: [['https://religionunplugged.com/news?format=rss', 'top']] },
  { id: 'wcrc', name: 'World Communion of Reformed Churches', country: 'International', kind: 'primary', faith: 'ecumenical', lean: '', feeds: [['https://wcrc.eu/feed', 'world']] },
  { id: 'morningstar', name: 'Morning Star News (persecution)', country: 'US', kind: 'faith', faith: 'ecumenical', lean: '', feeds: [['https://morningstarnews.org/feed/', 'world']] },
  { id: 'icc', name: 'International Christian Concern', country: 'US', kind: 'faith', faith: 'ecumenical', lean: '', feeds: [['https://www.persecution.org/feed/', 'world']] },
  { id: 'firstthings', name: 'First Things', country: 'US', kind: 'opinion', faith: 'ecumenical', lean: '', feeds: [['https://www.firstthings.com/feed', 'opinion']] }
];
const FAITH = { vatican: 'Vatican and the Pope', catholic: 'Catholic', orthodox: 'Orthodox', protestant: 'Protestant, evangelical and Anglican', ecumenical: 'Ecumenical and world church' };
const isFaith = s => !!(s && s.faith);

/* ============================ settings and the cache ============================ */
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, v) => { try { fs.mkdirSync(DATA, { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); } catch (e) { } };
/* google: fetch AP, Reuters, CNN and USA Today headlines through Google News (Google then sees those requests from this PC). Off unless chosen.
   pictures: download the pictures that come with stories (through Moundshroud, so no site can set cookies). On unless switched off. */
function prefs() { const p = readJson(PREFS, {}); return { off: Array.isArray(p.off) ? p.off : [], lean: p.lean && typeof p.lean === 'object' ? p.lean : {}, custom: Array.isArray(p.custom) ? p.custom : [], google: p.google === true, pictures: p.pictures !== false }; }
const prefsPublic = () => { const p = prefs(); return { google: p.google, pictures: p.pictures }; };
function sources() {
  const p = prefs();
  const custom = p.custom.filter(c => c && c.url && c.name).map((c, i) => ({ id: 'c_' + (c.id || i), name: String(c.name).slice(0, 60), country: c.country || '', kind: 'custom', lean: c.lean || '', feeds: [[c.url, c.sec || 'top']], custom: true }));
  return SOURCES.concat(custom).map(s => Object.assign({}, s, { lean: p.lean[s.id] !== undefined ? p.lean[s.id] : s.lean, on: !p.off.includes(s.id) && (s.via !== 'google' || p.google) }));
}
function savePrefs(patch) {
  const p = prefs();
  if (typeof patch.google === 'boolean') p.google = patch.google;
  if (typeof patch.pictures === 'boolean') p.pictures = patch.pictures;
  if (Array.isArray(patch.off)) p.off = patch.off.filter(x => typeof x === 'string').slice(0, 200);
  if (patch.lean && typeof patch.lean === 'object') Object.keys(patch.lean).forEach(k => { const v = patch.lean[k]; if (['', 'L', 'LL', 'C', 'LR', 'R'].includes(v)) p.lean[k] = v; else delete p.lean[k]; });
  if (Array.isArray(patch.custom)) p.custom = patch.custom.filter(c => c && /^https?:\/\//.test(c.url) && c.name).slice(0, 40).map((c, i) => ({ id: c.id || String(Date.now()) + i, name: String(c.name).slice(0, 60), url: String(c.url).slice(0, 500), lean: ['', 'L', 'LL', 'C', 'LR', 'R'].includes(c.lean) ? c.lean : '', country: String(c.country || '').slice(0, 30), sec: c.sec || 'top' }));
  writeJson(PREFS, p);
  return sources();
}

/* ============================ fetching ============================ */
function fetchFeed(url, state) {
  return new Promise(async res => {
    const chk = await net.safeUrl(url); if (chk.error) return res({ error: chk.error });
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const retry = u => go(u, 9, true);
    const go = (u, depth, bare) => {
      const mod = u.protocol === 'https:' ? https : http, h = { 'user-agent': UA, accept: bare ? '*/*' : 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'accept-encoding': 'gzip, deflate, br' };
      if (state && state.etag && depth === 0) h['if-none-match'] = state.etag;
      if (state && state.lm && depth === 0) h['if-modified-since'] = state.lm;
      const rq = mod.get(u, { headers: h, timeout: 15000 }, r => {
        if (r.statusCode === 304) { r.resume(); return fin({ same: true }); }
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 4) { r.resume(); let n; try { n = new URL(r.headers.location, u); } catch (e) { return fin({ error: 'bad redirect' }); } return go(n, depth + 1); }
        if (r.statusCode === 406 && !bare) { r.resume(); return retry(u); }          // some sites refuse the feed Accept header
        if (r.statusCode !== 200) { r.resume(); return fin({ error: 'HTTP ' + r.statusCode }); }
        const c = []; let n = 0;
        r.on('data', x => { n += x.length; if (n > 4e6) { rq.destroy(); return; } c.push(x); });
        r.on('end', () => {
          let b = Buffer.concat(c); const e = String(r.headers['content-encoding'] || '');
          try { if (e === 'gzip') b = zlib.gunzipSync(b); else if (e === 'deflate') b = zlib.inflateSync(b); else if (e === 'br') b = zlib.brotliDecompressSync(b); } catch (x) { }
          fin({ text: b.toString('utf8'), etag: r.headers.etag || '', lm: r.headers['last-modified'] || '' });
        });
        r.on('error', () => fin({ error: 'read error' }));
      });
      rq.on('timeout', () => { rq.destroy(); fin({ error: 'timed out' }); });
      rq.on('error', e => fin({ error: e.code || e.message }));
    };
    go(chk.url, 0);
  });
}

/* ============================ reading a feed ============================ */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é', egrave: 'è', aacute: 'á', oacute: 'ó', iacute: 'í', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', pound: '£', euro: '€', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•' };
const decode = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
  return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
});
const cdata = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const plain = s => decode(decode(cdata(s)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function tag(x, names) {
  for (const n of names) { const m = x.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); if (m) return m[1]; }
  return '';
}
function parse(xml) {
  const out = [], blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const x of blocks.slice(0, 120)) {
    const title = plain(tag(x, ['title']));
    let link = plain(tag(x, ['link']));
    if (!/^https?:/.test(link)) { const m = x.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i) || x.match(/<link[^>]*href=["']([^"']+)/i); link = m ? decode(m[1]) : ''; }
    if (!/^https?:/.test(link)) { const g = plain(tag(x, ['guid', 'id'])); if (/^https?:/.test(g)) link = g; }
    const rawDesc = tag(x, ['description', 'summary', 'content:encoded', 'content']);
    const desc = plain(rawDesc).slice(0, 600);
    const ds = plain(tag(x, ['pubDate', 'published', 'updated', 'dc:date', 'a10:updated']));
    const date = Date.parse(ds) || 0;
    let img = '';
    const im = x.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*(?:medium=["']image|type=["']image)/i) || x.match(/<media:thumbnail[^>]*url=["']([^"']+)/i) || x.match(/<media:content[^>]*url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)/i) || x.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i) || x.match(/<enclosure[^>]*type=["']image[^"']*["'][^>]*url=["']([^"']+)/i) || decode(cdata(rawDesc)).match(/<img[^>]*src=["']([^"']+)/i);
    if (im) img = decode(im[1]);
    if (img && !/^https:\/\//.test(img)) img = '';
    const cat = plain(tag(x, ['category']));
    if (title && link) out.push({ title, link, desc, date, img, cat });
  }
  return out;
}

/* ============================ telling news from opinion ============================ */
const OPINION_T = /^(opinion|op-ed|editorial|commentary|column|letters?|the editorial board|our view|my view|views?)\s*[:|\-–—]/i;
const OPINION_U = /\/(opinion|opinions|commentary|commentisfree|editorials?|op-ed|columnists?|columns|ideas|views|letters)(\/|$|-)/i;
const ANALYSIS = /^(analysis|explainer|fact check|news analysis)\s*[:|\-–—]/i;
function genre(a, src, sec) {
  if (sec === 'opinion') return 'opinion';
  if (OPINION_T.test(a.title) || OPINION_U.test(a.link) || /^(opinion|commentary|editorial)/i.test(a.cat || '')) return 'opinion';
  if (src.kind === 'opinion') return 'opinion';
  if (ANALYSIS.test(a.title) || /\banalysis\b/i.test(a.cat || '')) return 'analysis';
  return 'news';
}

/* ============================ the refresh ============================ */
let busy = null, lastRun = 0;
function load() { return readJson(CACHE, { at: 0, articles: [], feeds: {}, events: null }); }
async function refresh(force) {
  if (!net.on()) return { error: 'off' };
  if (busy) return busy;
  if (!force && Date.now() - lastRun < MIN_GAP) return { skipped: true };
  busy = (async () => {
    const C = load(), now = Date.now(), list = sources().filter(s => s.on), jobs = [];
    list.forEach(s => s.feeds.forEach(([url, sec]) => jobs.push({ s, url, sec })));
    const byLink = new Map(); (C.articles || []).forEach(a => { if (now - a.date < KEEP_H * 3600e3) byLink.set(a.src + '|' + a.link, a); });
    let i = 0, ok = 0, bad = 0, added = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const j = jobs[i++], st = C.feeds[j.url] || {};
        const r = await fetchFeed(j.url, st);
        if (r.error) { bad++; C.feeds[j.url] = Object.assign(st, { ok: false, err: r.error, at: now, src: j.s.id }); continue; }
        ok++;
        if (r.same) { C.feeds[j.url] = Object.assign(st, { ok: true, err: '', at: now, src: j.s.id }); continue; }
        let items = parse(r.text);
        C.feeds[j.url] = { ok: true, err: '', at: now, n: items.length, etag: r.etag, lm: r.lm, src: j.s.id };
        items.forEach(it => {
          if (j.s.via === 'google') it.desc = '';                                          // Google's description only repeats the headline
          if (j.s.via === 'google') it.title = it.title.replace(/\s+[-–—]\s+[^-–—]{2,40}$/, '');   // "Headline - AP News"
          if (!it.date || it.date > now + 3600e3) it.date = it.date ? now : 0;
          if (!it.date || now - it.date > KEEP_H * 3600e3) return;
          const k = j.s.id + '|' + it.link, old = byLink.get(k);
          if (old) {
            if (!old.secs.includes(j.sec)) old.secs.push(j.sec); if (!old.img && it.img) old.img = it.img;
            /* the outlet changed its headline after publishing: keep what it said before (journalists call these stealth edits) */
            const t2 = it.title.slice(0, 300); if (j.s.via !== 'google' && t2 && t2 !== old.title) { old.edits = (old.edits || []).concat({ t: old.title, at: now }).slice(-6); old.title = t2; }
            return;
          }
          byLink.set(k, { id: crypto.createHash('sha1').update(k).digest('hex').slice(0, 12), src: j.s.id, title: it.title.slice(0, 300), link: it.link, desc: it.desc === it.title ? '' : it.desc, date: it.date, img: it.img, secs: [j.sec], genre: genre(it, j.s, j.sec), via: j.s.via || '' });
          added++;
        });
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    /* one outlet can publish the same story under two links (two sections); keep the first */
    const seen = new Set(), arts = [...byLink.values()].sort((a, b) => b.date - a.date).filter(a => { const k = a.src + '|' + a.title.toLowerCase().replace(/[^a-z0-9]+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16000);
    /* Christian outlets are grouped on their own (a week of reports, since church outlets post less often), so they neither
       crowd the main page nor count as confirmation of its stories */
    const fset = new Set(sources().filter(isFaith).map(s => s.id));
    C.articles = arts; C.at = now; C.events = build(arts.filter(a => !fset.has(a.src)), now);
    C.faith = build(arts.filter(a => fset.has(a.src)), now, { hours: FAITH_H, gap: 72, faith: true });
    writeJson(CACHE, C); lastRun = now;
    return { ok: true, feeds: jobs.length, good: ok, failed: bad, added, articles: arts.length, events: C.events.events.length };
  })();
  try { return await busy; } finally { busy = null; }
}

/* ============================ grouping articles into events ============================ */
const STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself ' +
  'says said say new news update updates live latest watch video photos week day days year years time first last one two three after amid over could may might will just get gets got make makes made take takes like report reports reported according people man woman men women here how why what who ' +
  'monday tuesday wednesday thursday friday saturday sunday today yesterday tomorrow morning night am pm us uk via exclusive breaking opinion analysis').split(/\s+/));
function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}
const fold = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
function tokens(a) {
  const t = new Map(), add = (k, w) => t.set(k, (t.get(k) || 0) + w);
  const words = s => fold(s).toLowerCase().replace(/['’]s\b/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d{1,2}$/.test(w));
  words(a.title).forEach(w => add(stem(w), 2));
  words(a.desc.slice(0, 300)).forEach(w => add(stem(w), 1));
  /* names: capitalised words in the headline (not the first word), and runs of them, weigh the most */
  const caps = fold(a.title).replace(/['’]s\b/g, '').split(/\s+/).map(w => w.replace(/[^A-Za-z0-9.-]/g, '')).map((w, i) => (i > 0 && /^[A-Z][a-zA-Z.-]+$/.test(w) && !STOP.has(w.toLowerCase())) ? w.toLowerCase() : null);
  caps.forEach((w, i) => { if (w) { add('#' + w, 3); if (caps[i + 1]) add('#' + w + '_' + caps[i + 1], 3); } });
  return t;
}
function build(arts, now, opt) {
  opt = opt || {};
  const recent = arts.filter(a => now - a.date < (opt.hours || CLUSTER_H) * 3600e3);
  const N = recent.length || 1, df = new Map(), toks = recent.map(tokens);
  toks.forEach(t => t.forEach((v, k) => df.set(k, (df.get(k) || 0) + 1)));
  const maxDf = Math.max(8, N * .2);
  const vec = toks.map(t => {
    const v = new Map(); let n = 0;
    /* words only this article uses still count: they are what make an unrelated article look unrelated */
    t.forEach((tf, k) => { const d = df.get(k); if (d > maxDf) return; const w = (1 + Math.log(tf)) * Math.log(N / d) * (d === 1 ? .35 : 1); v.set(k, w); n += w * w; });
    n = Math.sqrt(n) || 1; v.forEach((w, k) => v.set(k, w / n)); return v;
  });
  /* candidate pairs share at least one useful word; their similarity is the dot product of the two vectors */
  const inv = new Map(); vec.forEach((v, i) => v.forEach((w, k) => { let l = inv.get(k); if (!l) inv.set(k, l = []); l.push(i); }));
  const edges = [];
  for (let i = 0; i < vec.length; i++) {
    const acc = new Map(), ent = new Map();
    vec[i].forEach((w, k) => { const l = inv.get(k); if (l.length > 80) return; for (const j of l) if (j > i) { acc.set(j, (acc.get(j) || 0) + w * vec[j].get(k)); if (k[0] === '#') ent.set(j, (ent.get(j) || 0) + 1); } });
    acc.forEach((s, j) => {
      if (Math.abs(recent[i].date - recent[j].date) > (opt.gap || 36) * 3600e3) return;
      const e = ent.get(j) || 0;
      if (s >= .42 || (s >= .3 && e >= 1) || (s >= .24 && e >= 2)) edges.push([s, i, j]);
    });
  }
  edges.sort((a, b) => b[0] - a[0]);
  /* merge the closest pairs first; two groups only join if the groups as a whole are about the same thing (this stops
     a chain of loosely related stories turning into one giant "event") */
  const grp = recent.map((_, i) => i), members = recent.map((_, i) => [i]), cent = vec.map(v => new Map(v));
  const find = i => { while (grp[i] !== i) { grp[i] = grp[grp[i]]; i = grp[i]; } return i; };
  const cos = (a, b) => { let s = 0, na = 0, nb = 0; a.forEach((w, k) => { na += w * w; const x = b.get(k); if (x) s += w * x; }); b.forEach(w => { nb += w * w; }); return s / (Math.sqrt(na * nb) || 1); };
  for (const [s, i, j] of edges) {
    const a = find(i), b = find(j); if (a === b) continue;
    if (cos(cent[a], cent[b]) < (members[a].length + members[b].length > 2 ? .36 : .24)) continue;
    if (members[a].length + members[b].length > 120) continue;
    const [big, small] = members[a].length >= members[b].length ? [a, b] : [b, a];
    grp[small] = big; members[big] = members[big].concat(members[small]); members[small] = [];
    cent[small].forEach((w, k) => cent[big].set(k, (cent[big].get(k) || 0) + w)); cent[small] = new Map();
  }
  /* a last check on every group: an article that only brushes the group's subject (a weekly column that mentions it, a
     related but different story) is let go, so it cannot be credited with breaking the story or inflate the count */
  for (let i = 0; i < members.length; i++) {
    if (find(i) !== i || members[i].length < 3) continue;
    const keep = [], drop = [];
    for (const k of members[i]) {
      const rest = new Map(cent[i]); vec[k].forEach((w, t) => rest.set(t, (rest.get(t) || 0) - w));   // the group without this article
      (cos(vec[k], rest) >= .2 ? keep : drop).push(k);
    }
    if (drop.length && keep.length >= 2) { members[i] = keep; drop.forEach(k => { grp[k] = k; members[k] = [k]; }); }
  }
  const srcs = sources(), S = Object.fromEntries(srcs.map(s => [s.id, s]));
  const events = [], singles = [];
  recent.forEach((_, i) => {
    if (find(i) !== i) return;
    const idx = members[i], list = idx.map(k => recent[k]).sort((a, b) => b.date - a.date);
    const outlets = [...new Set(list.filter(a => a.genre !== 'opinion').map(a => a.src))];
    if (outlets.length < 2) { list.forEach(a => singles.push(a.id)); return; }
    /* the headline: the most central straight-news article, preferring wire services and public broadcasters */
    const c = cent[i], rank = k => { const a = recent[k], s = S[a.src] || {}; return cos(vec[k], c) + (a.genre === 'news' ? .2 : -.5) + (s.kind === 'wire' ? .12 : s.kind === 'public' ? .08 : 0) + (a.desc ? .04 : 0); };
    const best = recent[idx.slice().sort((x, y) => rank(y) - rank(x))[0]];
    const withDesc = idx.map(k => recent[k]).filter(a => a.genre === 'news' && !a.via && a.desc && a.desc.length > 60).sort((x, y) => rank(recent.indexOf(y)) - rank(recent.indexOf(x)));
    const imgA = idx.map(k => recent[k]).filter(a => a.img).sort((x, y) => rank(recent.indexOf(y)) - rank(recent.indexOf(x)))[0];
    const secCount = {}; list.forEach(a => a.secs.forEach(sc => { if (sc !== 'top') secCount[sc] = (secCount[sc] || 0) + 1; }));
    const lean = { L: 0, LL: 0, C: 0, LR: 0, R: 0 }; outlets.forEach(o => { const l = (S[o] || {}).lean; if (lean[l] !== undefined) lean[l]++; });
    const countries = [...new Set(outlets.map(o => (S[o] || {}).country).filter(Boolean))];
    const first = Math.min(...list.map(a => a.date)), last = Math.max(...list.map(a => a.date));
    const fresh = list.filter(a => now - a.date < 2 * 3600e3).length;
    const r = Math.exp(-(now - last) / (14 * 3600e3));
    const score = (Math.pow(outlets.length, 1.25) + list.length * .15) * (.3 + r) * (1 + .08 * Math.min(countries.length, 5)) + (outlets.some(o => (S[o] || {}).kind === 'wire') ? .6 : 0);
    const top = [...c.entries()].filter(([k]) => k[0] !== '#' || !k.includes('_')).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k.replace(/^#/, ''));
    events.push({
      id: crypto.createHash('sha1').update(recent[idx.reduce((m, k) => recent[k].date < recent[m].date ? k : m, idx[0])].id).digest('hex').slice(0, 10),
      title: best.title, summary: (withDesc[0] || best).desc || '', img: imgA ? imgA.img : '', cat: opt.faith ? faithCategory(secCount, list) : category(secCount, list), faith: !!opt.faith, trads: opt.faith ? [...new Set(outlets.map(o => (S[o] || {}).faith).filter(Boolean))] : undefined,
      first, last, n: list.length, outlets, lean, countries, developing: fresh >= 2 && last - first > 2 * 3600e3, fresh, score: +score.toFixed(3), keys: top,
      articles: list.map(a => a.id)
    });
  });
  events.sort((a, b) => b.score - a.score);
  /* the expert desk: single articles worth a specialist's time, whoever else has (or has not) picked them up yet */
  const rById = new Map(recent.map(a => [a.id, a])), inBig = new Set(); events.forEach(e => { if (e.outlets.length >= 4) e.articles.forEach(id => inBig.add(id)); e.official = e.articles.some(id => { const a = rById.get(id); return a && (S[a.src] || {}).kind === 'primary'; }); });
  /* the source's kind only matters when the article carries a sign of real reporting; sport, culture, features and
     columns are pushed down; a story already covered by four or more outlets is in the events, not here */
  const W = { investigative: 1.8, primary: 1.6, specialist: 1.5, wire: 1.3, public: 1.15, paper: 1.1, special: 1 };
  if (opt.faith) return { at: now, events: events.slice(0, 300), singles: singles.slice(0, 1500), niche: [] };
  const scored = arts.filter(a => now - a.date < 72 * 3600e3 && a.genre !== 'opinion' && !NOT_EN(a.title)).map(a => {
    const s2 = S[a.src] || {}, txt = a.title + ' ' + (a.desc || '');
    const sig = Math.min(3, (txt.match(SIGNAL) || []).length), soft = SOFT.test(a.title), light = a.secs.every(x => x === 'sports' || x === 'culture');
    const base = sig ? 1 + .75 * sig : (s2.kind === 'primary' || s2.kind === 'investigative' ? .8 : .4);
    const sc = (W[s2.kind] || 1) * base * Math.exp(-(now - a.date) / (40 * 3600e3)) * (inBig.has(a.id) ? .4 : 1) * (soft ? .25 : 1) * (light ? .4 : 1) * (a.desc && a.desc.length > 120 ? 1.1 : 1);
    return { id: a.id, src: a.src, sc, sig };
  }).filter(x => x.sc > 1.2).sort((a, b) => b.sc - a.sc);
  const per = {}, niche = []; for (const x of scored) { if ((per[x.src] = (per[x.src] || 0) + 1) > 6) continue; niche.push(x.id); if (niche.length >= 260) break; }
  return { at: now, events: events.slice(0, 400), singles: singles.slice(0, 1500), niche };
}
/* words that mark reporting worth a second look: documents, courts, money, failures, official action */
const SIGNAL = /\b(investigation|investigative|exclusive|documents? (show|reveal|obtained)|records (show|reveal)|obtained by|leaked|whistle-?blowers?|lawsuits?|sued|sues|indict(ed|ment)|charged|charges|subpoena(ed|s)?|inspector general|audit|probe|report finds|study finds|data show|analysis of|foia|court filings?|settlement|recalls?|advisory|warning|sanctions?|ruling|verdict|contracts?|fraud|breach|vulnerabilit(y|ies)|resigns?|fired|ousted|cover-?up|misconduct|emergency|outbreak|seized|raid(ed)?|died|deaths?|killed|detain(ed|ees?)|abuse|corruption|bribe(ry|s)?|smuggl\w+|surveillance|spyware|exploit)\b/gi;
/* not what an expert desk is for: features, reviews, sport, how-tos, and columns ("..., By Name") */
const SOFT = /\b(book excerpt|excerpt|review|recipe|quiz|podcast|newsletter|horoscope|crossword|photos?:|watch:|gift guide|how to|guide to|what to watch|test match|premier league|super eagles|fixtures?)\b|,\s+by\s+[A-Z][a-z]+/i;
/* the expert desk is in English: a headline mostly made of Spanish, French or Portuguese function words is left out */
const NOT_EN = s => (String(s).toLowerCase().match(/(^|\s)(de|la|el|los|las|que|en|del|por|para|cómo|está|están|une|des|est|dans|pour|não|uma|com)(?=\s|$)/g) || []).length >= 3;
const KW = {
  politics: /\b(election|elections|senate|congress|parliament|president|prime minister|minister|lawmakers?|vote|voters|campaign|governor|republicans?|democrats?|supreme court|white house|legislation|bill)\b/i,
  business: /\b(stocks?|markets?|economy|economic|inflation|interest rates?|shares|earnings|company|companies|bank|banks|tariffs?|trade|prices|oil|investors?|profit|revenue|jobs report)\b/i,
  tech: /\b(ai|artificial intelligence|tech|technology|software|apple|google|microsoft|meta|openai|chips?|semiconductor|cyber|hackers?|app|smartphone|startup)\b/i,
  science: /\b(scientists?|study|research|space|nasa|planet|climate|species|fossil|telescope|physics|astronomers?|spacex|rocket)\b/i,
  health: /\b(health|disease|virus|vaccines?|hospital|cancer|outbreak|medical|drug|fda|who|patients?|doctors?)\b/i,
  culture: /\b(actor|actress|film|movie|singer|album|hollywood|celebrity|oscars?|grammys?|emmys?|netflix|broadway|box office|rapper|musician|tv series|star trek|star wars)\b/i,
  sports: /\b(match|league|cup|coach|nfl|nba|mlb|nhl|fifa|olympics?|tournament|championship|season|game|quarterback|striker|goal)\b/i
};
const US = /\b(U\.S\.|US|America|American|Americans|federal|FBI|ICE|DOJ|Pentagon|Congress|Senate|Trump|Supreme Court|White House|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Wisconsin|Wyoming|Chicago|Los Angeles|Houston|Tenn\.)\b/;
const ABROAD = /\b(Brazil|Brazilian|Bolsonaro|Lula|Mexico|Mexican|Canada|Canadian|Carney|UK|Britain|British|England|Scotland|Ireland|Irish|France|French|Macron|Germany|German|Italy|Italian|Spain|Spanish|Portugal|Netherlands|Dutch|Belgium|Poland|Polish|Ukraine|Ukrainian|Zelensky|Russia|Russian|Putin|Kremlin|Moscow|Israel|Israeli|Netanyahu|Gaza|Palestinian|Iran|Iranian|Iraq|Syria|Lebanon|Saudi|Yemen|Egypt|Turkey|Turkish|China|Chinese|Beijing|Xi|Taiwan|Hong Kong|Japan|Japanese|Korea|Korean|Kim Jong|India|Indian|Modi|Pakistan|Afghanistan|Australia|Australian|New Zealand|Nigeria|Kenya|South Africa|Sudan|Ethiopia|Congo|Argentina|Venezuela|Colombia|Chile|Peru|Cuba|Haiti|Vatican|EU|European|NATO|G20|UN|Hormuz)\b/;
/* church news: the Pope and the Vatican, or the church's own sections, otherwise the usual subject guess */
const PAPAL = /\b(pope|popes|papal|vatican|holy see|curia|conclave|cardinals?|apostolic|synod)\b|\bLeo XIV\b/i;
function faithCategory(secs, list) {
  const pa = list.filter(a => PAPAL.test(a.title)).length;
  if (pa >= Math.max(1, list.length * .5)) return 'vatican';
  return category(secs, list);
}
function category(secs, list) {
  const order = Object.entries(secs).sort((a, b) => b[1] - a[1]);
  if (order.length && order[0][1] >= 2 && order[0][0] !== 'world' && order[0][0] !== 'us') return order[0][0];
  const text = list.map(a => a.title).join(' ');
  let best = null, bn = 0;
  Object.entries(KW).forEach(([k, re]) => { const n = (text.match(new RegExp(re.source, 'gi')) || []).length; if (n > bn) { bn = n; best = k; } });
  if (best && bn >= Math.max(2, list.length * .35)) return best;
  /* general news: at home in the US, or the rest of the world? */
  const us = list.filter(a => US.test(a.title)).length, abroad = list.filter(a => ABROAD.test(a.title)).length;
  if (us >= Math.max(1, list.length * .3) && us > abroad) return 'us';
  if (order.length && order[0][0] !== 'world') return order[0][0];
  return 'world';
}

/* ============================ what the page asks for ============================ */
function snapshot() {
  const C = load(), srcs = sources(), S = Object.fromEntries(srcs.map(s => [s.id, s]));
  const byId = new Map((C.articles || []).map(a => [a.id, a.via ? Object.assign({}, a, { desc: '' }) : a]));
  const ev = (C.events && C.events.events) || [];
  const used = new Set();
  const events = ev.map(e => Object.assign({}, e, { articles: e.articles.map(id => { used.add(id); return byId.get(id); }).filter(Boolean) }));
  const singles = ((C.events && C.events.singles) || []).map(id => byId.get(id)).filter(Boolean);
  const niche = ((C.events && C.events.niche) || []).map(id => byId.get(id)).filter(Boolean);
  const fev = ((C.faith && C.faith.events) || []).map(e => Object.assign({}, e, { articles: e.articles.map(id => byId.get(id)).filter(Boolean) }));
  const fsingles = ((C.faith && C.faith.singles) || []).map(id => byId.get(id)).filter(Boolean);
  const faith = { events: fev, singles: fsingles, n: (C.articles || []).filter(a => isFaith(S[a.src]) && Date.now() - a.date < FAITH_H * 3600e3).length };
  const feeds = C.feeds || {};
  const acc = accessMap();
  const status = srcs.map(s => { const fs2 = s.feeds.map(([u]) => feeds[u]).filter(Boolean); return { access: acc[s.id] || null, id: s.id, name: s.name, country: s.country, kind: s.kind, faith: s.faith || '', lean: s.lean, on: s.on, via: s.via || '', custom: !!s.custom, feeds: s.feeds.length, ok: fs2.filter(f => f.ok).length, err: (fs2.find(f => !f.ok) || {}).err || '', at: Math.max(0, ...fs2.map(f => f.at || 0)), url: s.custom ? s.feeds[0][0] : '' }; });
  return { at: C.at || 0, internet: net.on(), events, singles, niche, faith, sources: status, articles: (C.articles || []).length, prefs: prefsPublic() };
}

/* ============================ pictures ============================
   The app's security policy only lets the page show pictures from the app itself (so no page can load trackers). News
   pictures therefore come through here: only addresses that appeared in the feeds, only https, only images, only while
   internet access is on; each is kept in data/news-img so the edition still has its pictures offline. */
const IMGDIR = path.join(DATA, 'news-img');
let imgSet = null, imgSetAt = 0;
function knownImage(u) {
  const C = load();
  if (!imgSet || imgSetAt !== C.at) { imgSet = new Set((C.articles || []).map(a => a.img).filter(Boolean)); imgSetAt = C.at; }
  return imgSet.has(u);
}
/* any: an address the user chose to load (pictures in an email), not one from the feeds */
function image(u, res, any) {
  const send = (code, body, type) => { res.writeHead(code, { 'content-type': type || 'text/plain', 'cache-control': code === 200 ? 'private, max-age=604800' : 'no-store' }); res.end(body); };
  if (!/^https:\/\//.test(u || '') || (!any && !knownImage(u))) return send(404, 'unknown image');
  const key = crypto.createHash('sha1').update(u).digest('hex'), file = path.join(IMGDIR, key);
  try { const b = fs.readFileSync(file), t = fs.readFileSync(file + '.t', 'utf8'); return send(200, b, t); } catch (e) { }
  if (!net.on() || (!any && !prefs().pictures)) return send(404, 'offline');
  (async () => {
    const chk = await net.safeUrl(u); if (chk.error) return send(404, 'refused');
    const go = (url, depth) => {
      const rq = https.get(url, { headers: { 'user-agent': UA_IMG, accept: 'image/avif,image/webp,image/*;q=0.8' }, timeout: 12000 }, r => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 3) { r.resume(); let n; try { n = new URL(r.headers.location, url); } catch (e) { return send(404, 'bad'); } if (n.protocol !== 'https:') return send(404, 'bad'); return go(n, depth + 1); }
        const type = String(r.headers['content-type'] || '');
        if (r.statusCode !== 200 || !/^image\/(jpeg|png|webp|gif|avif)/.test(type)) { r.resume(); return send(404, 'not an image'); }
        const c = []; let n = 0;
        r.on('data', x => { n += x.length; if (n > 2.5e6) { rq.destroy(); return; } c.push(x); });
        r.on('end', () => {
          const b = Buffer.concat(c); send(200, b, type);
          try { fs.mkdirSync(IMGDIR, { recursive: true }); fs.writeFileSync(file, b); fs.writeFileSync(file + '.t', type); prune(); } catch (e) { }
        });
        r.on('error', () => send(404, 'error'));
      });
      rq.on('timeout', () => { rq.destroy(); send(404, 'timeout'); });
      rq.on('error', () => { if (!res.headersSent) send(404, 'error'); });
    };
    go(chk.url, 0);
  })();
}
let pruneAt = 0;
function prune() {
  if (Date.now() - pruneAt < 60000) return; pruneAt = Date.now();
  try {
    const f = fs.readdirSync(IMGDIR).filter(x => !x.endsWith('.t')).map(x => ({ x, t: fs.statSync(path.join(IMGDIR, x)).mtimeMs })).sort((a, b) => b.t - a.t);
    f.slice(600).forEach(o => { try { fs.unlinkSync(path.join(IMGDIR, o.x)); fs.unlinkSync(path.join(IMGDIR, o.x + '.t')); } catch (e) { } });   // about 60 MB at most
  } catch (e) { }
}

/* ============================ can it be read? ============================
   For each outlet, the newest article is fetched through the in-app reader and judged: the whole article came back
   (full), the site asked for a subscription or only a teaser came back (subscription), or the site refused (blocked).
   Moundshroud does not get around paywalls; this tells you which outlets you can read here, and the News page points
   you to free reports of the same story when one is behind a paywall. */
const ACCESS = path.join(DATA, 'news-access.json');
const PAYWALL = /(subscribe (now )?to (continue|read|keep reading|unlock)|subscribers? only|for subscribers|already a subscriber|this (article|story|content) is (only )?(available|for) (to )?(subscribers|members)|you have reached your (free )?(article )?limit|create a free account to (continue|read)|sign in to (continue|read)|to continue reading|start your (free )?trial|unlock this article|become a (subscriber|member) to)/i;
let accessBusy = null;
const accessMap = () => readJson(ACCESS, {});
async function checkAccess(force) {
  if (!net.on()) return { error: 'off' };
  if (accessBusy) return accessBusy;
  accessBusy = (async () => {
    const C = load(), A0 = accessMap(), now = Date.now(), jobs = [];
    sources().filter(s => s.on && s.via !== 'google').forEach(s => {
      if (!force && A0[s.id] && now - A0[s.id].at < 3 * 86400e3) return;
      const a = (C.articles || []).filter(x => x.src === s.id).sort((x, y) => y.date - x.date)[0];
      if (a) jobs.push({ s, a });
    });
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const { s, a } = jobs[i++];
        let r; try { r = await net.page(a.link); } catch (e) { r = { error: e.message }; }
        const text = String((r && r.text) || ''), chars = text.length;
        const st = r && r.error ? 'blocked' : PAYWALL.test(text) ? 'paywall' : chars >= 3500 ? 'full' : chars >= 1200 ? 'partial' : 'blocked';
        A0[s.id] = { st, chars, at: now, err: r && r.error ? String(r.error).slice(0, 80) : '' };
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    writeJson(ACCESS, A0);
    const n = k => Object.values(A0).filter(x => x.st === k).length;
    return { ok: true, checked: jobs.length, full: n('full'), partial: n('partial'), paywall: n('paywall'), blocked: n('blocked') };
  })();
  try { return await accessBusy; } finally { accessBusy = null; }
}

/* search the whole two-week archive: words must all appear; "quoted phrases" must appear as written; -word excludes */
function search(q, sources) {
  const C = load(), S = Object.fromEntries(sources().map(s => [s.id, s]));
  const phrases = [], neg = []; let rest = String(q || '').toLowerCase().replace(/"([^"]+)"/g, (m, p) => { phrases.push(p.trim()); return ' '; });
  const words = rest.split(/\s+/).filter(Boolean).filter(w => { if (w[0] === '-' && w.length > 1) { neg.push(w.slice(1)); return false; } return true; });
  if (!words.length && !phrases.length) return { items: [], total: 0 };
  const hits = (C.articles || []).filter(a => { const t = (a.title + ' ' + (a.desc || '') + ' ' + ((S[a.src] || {}).name || '')).toLowerCase(); return words.every(w => t.includes(w)) && phrases.every(p => t.includes(p)) && !neg.some(w => t.includes(w)); });
  hits.sort((a, b) => b.date - a.date);
  return { items: hits.slice(0, 300).map(a => a.via ? Object.assign({}, a, { desc: '' }) : a), total: hits.length, from: (C.articles || []).reduce((m, a) => Math.min(m, a.date), Date.now()) };
}

/* ============================ research: any topic, from the archive and the web ============================
   The News archive, plus a web search (DuckDuckGo, through the same internet switch), and the readable text of the best
   few articles, so the local AI can write an overview from those sources only. Nothing here runs with internet off
   except the archive. */
async function research(q) {
  q = String(q || '').trim().slice(0, 200); if (!q) return { error: 'empty' };
  const arch = search(q, sources), S = Object.fromEntries(sources().map(s => [s.id, s]));
  const archive = (arch.items || []).slice(0, 15).map(a => ({ title: a.title, url: a.link, outlet: (S[a.src] || {}).name || a.src, date: a.date, desc: a.desc || '', src: a.src, via: a.via || '' }));
  if (!net.on()) return { q, archive, web: [], pages: [], internet: false };
  const [w1, w2] = await Promise.all([net.search(q + ' news', 10).catch(() => ({})), net.search(q, 10).catch(() => ({}))]);
  const seen = new Set(archive.map(a => a.url)), web = [];
  [].concat((w1 && w1.results) || [], (w2 && w2.results) || []).forEach(r => { if (r && r.url && !seen.has(r.url) && web.length < 14) { seen.add(r.url); web.push({ title: r.title, url: r.url, snippet: r.snippet || '', outlet: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })() }); } });
  /* read the most promising pages: fresh news reports first, then the web results, a few at a time */
  const toRead = archive.filter(a => !a.via).slice(0, 4).map(a => ({ url: a.url, title: a.title, outlet: a.outlet })).concat(web.slice(0, 6).map(w => ({ url: w.url, title: w.title, outlet: w.outlet })));
  const pages = (await Promise.all(toRead.map(async t => {
    const p = await Promise.race([net.page(t.url).catch(() => null), new Promise(r => setTimeout(() => r(null), 15000))]);
    if (!p || p.error || !p.text || p.text.length < 600 || PAYWALL.test(p.text.slice(0, 6000)) && p.text.length < 5000) return null;
    return { url: t.url, title: t.title || p.title, outlet: t.outlet, text: p.text.replace(/\s+/g, ' ').slice(0, 4500) };
  }))).filter(Boolean);
  return { q, archive, web, pages, internet: true };
}

/* the Privacy page: forget every downloaded story and picture (choices, follows and beats are kept) */
function forget() { try { fs.unlinkSync(CACHE); } catch (e) { } try { fs.rmSync(IMGDIR, { recursive: true, force: true }); } catch (e) { } imgSet = null; return { ok: true }; }

module.exports = { research, checkAccess, search: q => search(q, sources), forget, prefsPublic, refresh, snapshot, sources, savePrefs, parse, build, genre, tokens, image, SOURCES, FAITH };
