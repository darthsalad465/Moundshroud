// Match the optional integration's server interface in the desktop distribution.
const unavailable = () => ({
  installed: false,
  up: false,
  error: 'ARTEX is unavailable in the desktop edition.'
});

module.exports = {
  PORT: 8787,
  installed: () => false,
  status: unavailable,
  start: unavailable,
  stop: unavailable,
  stopAll() {}
};
