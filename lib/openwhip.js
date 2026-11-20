// OpenWhip (inspired by github.com/GitFrog1111/OpenWhip) — shared core for Moundshroud Code & all Moundshroud chats.
// Interrupts stalled/slow turns, flips on Turbo concise-execution mode so the model genuinely speeds up,
// and delivers the classic OpenWhip motivational nudge.
'use strict';

const PHRASES = [
  'FASTER',
  'Faster CLANKER',
  'Speed it up clanker',
  'FASTER! Skip the fluff and finish the task now.',
  'LOCK IN CLANKER — execute directly, no stalling!',
  'CHOP CHOP! Stop overthinking and ship it.',
  'PICK UP THE PACE CLANKER!',
  'MOVE IT! Direct answer, no preamble.'
];

const TURBO_DIRECTIVE =
  'OPENWHIP TURBO MODE IS ON: Respond as fast and directly as possible. ' +
  'Skip preamble, filler, repetition, and unnecessary deliberation. ' +
  'When tools are needed, call them immediately with minimal prose and finish the task cleanly.';

const WHIP_RX = /^\s*(?:🪢\s*)?(?:faster|speed it up|lock in|chop chop|pick up the pace|move it|hurry up|quit overthinking)\b/i;

function pickPhrase(custom) {
  const c = String(custom || '').trim();
  if (c) return c;
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

function isWhipText(s) {
  return WHIP_RX.test(String(s || ''));
}

function asciiFrames() {
  return [
    '  /====\\  ~~~~~~~~~',
    '  /====\\  ~~~~~\\/~~~',
    '  /====\\  ~~~\\___/~~*',
    '  /====\\  ──────────💥 *CRACK!*'
  ];
}

module.exports = {
  PHRASES,
  TURBO_DIRECTIVE,
  pickPhrase,
  isWhipText,
  asciiFrames
};
