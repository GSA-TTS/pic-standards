/**
 * File system utilities for validation scripts
 */
const fs = require('fs');
const path = require('path');

/**
 * Recursively find files under `dir` matching provided extensions.
 * Accepts a string path or an array of paths.
 * Returns absolute paths. Non-existent dirs return [].
 * Synchronous and resilient for tests.
 * @param {string|string[]} dir
 * @param {string[]} exts
 * @returns {string[]}
 */
function findFiles(dir, exts = ['.json', '.yaml', '.yml']) {
	// Support array of directories/paths
	if (Array.isArray(dir)) {
		let aggregate = [];
		for (const d of dir) {
			aggregate = aggregate.concat(findFiles(d, exts));
		}
		return aggregate;
	}

	if (!dir) return [];
	const resolved = path.resolve(dir);
	if (!fs.existsSync(resolved)) return [];

	const results = [];
	let stat;
	try {
		stat = fs.statSync(resolved);
	} catch (e) {
		return results;
	}

	if (stat.isFile()) {
		if (exts.includes(path.extname(resolved).toLowerCase())) results.push(resolved);
		return results;
	}

	const entries = fs.readdirSync(resolved);
	for (const entry of entries) {
		const full = path.join(resolved, entry);
		let s;
		try {
			s = fs.statSync(full);
		} catch (e) {
			// ignore unreadable entries
			continue;
		}
		if (s.isDirectory()) {
			results.push(...findFiles(full, exts));
		} else if (exts.includes(path.extname(full).toLowerCase())) {
			results.push(path.resolve(full));
		}
	}
	return results;
}

/**
 * Convenience: find only .json files
 * Accepts a single path or an array of paths.
 * @param {string|string[]} dir
 * @returns {string[]}
 */
function findJsonFiles(dir) {
	if (Array.isArray(dir)) {
		let aggregate = [];
		for (const d of dir) {
			aggregate = aggregate.concat(findJsonFiles(d));
		}
		return aggregate;
	}
	return findFiles(dir, ['.json']);
}

/**
 * Check that a directory exists and is a directory.
 * Returns true if dir exists and is a directory, false otherwise.
 * @param {string} dir
 * @returns {boolean}
 */
function ensureDirectory(dir) {
  if (!dir) return false;
  try {
    const s = fs.statSync(dir);
    return s.isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Resolve a project-relative path to an absolute path. Uses process.cwd().
 * @param {string} p
 * @returns {string}
 */
function resolveProjectPath(p) {
  if (!p) return path.resolve();
  return path.resolve(process.cwd(), p);
}

// Final exports: include existing helpers and the new utilities.
// Ensure we export a single object (avoid duplicated module.exports assignments).
module.exports = {
  // ...existing exported helpers (e.g. ensureDirectory, resolveProjectPath) ...
  ensureDirectory,
  resolveProjectPath,
  // file discovery helpers added for consolidation
  findFiles,
  findJsonFiles
};
