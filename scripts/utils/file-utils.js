/**
 * File system utilities for validation scripts
 */
const fs = require('fs');
const path = require('path');

/**
 * Ensure directory exists
 * @param {string} dir - Directory path
 * @returns {boolean} True if directory exists
 */
function ensureDirectory(dir) {
  return fs.existsSync(dir);
}

/**
 * Resolve path relative to project root
 * @param {string} relativePath - Path relative to project root
 * @returns {string} Absolute path
 */
function resolveProjectPath(relativePath) {
  return path.join(__dirname, '..', '..', relativePath);
}

module.exports = {
  ensureDirectory,
  resolveProjectPath
};
