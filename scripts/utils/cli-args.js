// Centralized CLI argument parser for validation scripts
function parseArgs(argv, spec = {}) {
  const args = {};
  argv.forEach((arg, i) => {
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
    }
  });
  // Apply defaults from spec
  Object.keys(spec).forEach(key => {
    if (!(key in args)) args[key] = spec[key];
  });
  return args;
}

module.exports = { parseArgs };
