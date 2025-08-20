// Deprecation shim - file discovery consolidated into file-utils.js

const { findFiles, findJsonFiles } = require('./file-utils');

// Warn once at module load to make migration visible in CI logs (skip during tests)
if (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV !== 'test') {
	console.warn('[DEPRECATED] scripts/utils/fileFinder.js is deprecated. Use scripts/utils/file-utils.js -> findFiles/findJsonFiles instead.');
}

module.exports = { findFiles, findJsonFiles };
