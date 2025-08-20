/**
 * Minimal transformation utils kept for shared default-value helper.
 * Intentionally slim to reduce unused code surface for coverage.
 */

/**
 * Provides a default value for a given schema type.
 * @param {string} type - 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array'
 * @returns {*} default value or null for unknown types
 */
function getDefaultValueForType(type) {
  switch (type) {
    case 'string':
      return '';
    case 'integer':
      return 0;
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    default:
      return null;
  }
}

module.exports = { getDefaultValueForType };
