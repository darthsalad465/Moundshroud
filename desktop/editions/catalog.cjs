'use strict';

const editions = {
  library: {
    name: 'Moundshroud Library', tabs: ['lib', 'web'],
    description: 'Offline books, archives and research.',
    routes: ['lib', 'search', 'web', 'net', 'bible', 'chessbooks', 'file/read', 'chat']
  },
  studio: {
    name: 'Moundshroud Studio', tabs: ['studio', 'photos', 'albums'],
    description: 'Image, audio and video creation.',
    routes: ['art', 'video', 'music', 'studio', 'photos', 'albums', 'paint', 'composer', 'toolkit',
      'convert', 'convlib', 'media', 'godot', 'modellab', 'models', 'forge', 'finetune', 'tts', 'ocr',
      'file', 'pick-folder', 'office/open', 'storybook/pdf', 'practice', 'heretic', 'chat']
  },
  cyber: {
    name: 'Moundshroud Cyber', tabs: [],
    description: 'Offline security report review and file integrity checks.',
    routes: []
  },
  chess: {
    name: 'Moundshroud Chess and Games', tabs: ['play'],
    description: 'Chess, training, chess books and arcade games.',
    routes: ['sf', 'study/book', 'study/config', 'study/games', 'study/lessons',
      'chess', 'chessbooks', 'lichess', 'play', 'games', 'tts', 'chat']
  },
  office: {
    name: 'Moundshroud Office', tabs: ['docs', 'notes', 'offed', 'scan', 'meet'],
    description: 'Documents, notes, scanning and meeting notes.',
    routes: ['notes', 'office', 'files/read', 'files/text', 'docs', 'meet', 'meetings',
      'ocr', 'scan', 'transcribe', 'tts', 'convert', 'convlib', 'file', 'chat']
  },
  media: {
    name: 'Moundshroud Media', tabs: ['music', 'radio', 'tv'],
    description: 'Music, radio, TV and local playback.',
    routes: ['music', 'radio', 'tv', 'audio', 'nowplaying', 'ytdl']
  }
};

const common = ['status', 'ping', 'version', 'problems', 'models', 'modelcaps'];

function permits(edition, pathname) {
  if (edition === 'cyber') return false;
  const profile = editions[edition];
  if (!profile) return false;
  if (edition === 'library' && (pathname === '/wiki' || pathname.startsWith('/wiki/'))) return true;
  if (!pathname.startsWith('/api/')) return false;
  const route = pathname.slice(5);
  return common.includes(route) || profile.routes.some(prefix => route === prefix || route.startsWith(prefix + '/'));
}

module.exports = { editions, permits };
