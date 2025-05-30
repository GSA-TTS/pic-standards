/**
 * Script to remove additionalProperties: false constraints from JSON schema
 * Uses shared utilities for consistent file operations
 */
const {
  loadJsonFile,
  writeJsonFile,
  processObjectRecursively,
  PATHS
} = require('./utils/validation-utils');

/**
 * Remove additionalProperties constraints from schema
 * @param {string} schemaPath - Path to schema file (optional)
 * @returns {boolean} True if successful
 */
function removeAdditionalProperties(schemaPath = null) {
  const targetPath = schemaPath || PATHS.NEPA_SCHEMA;
  
  console.log(`Reading schema from ${targetPath}`);
  const schema = loadJsonFile(targetPath);
  if (!schema) {
    return false;
  }

  // Process schema recursively
  processObjectRecursively(schema, (obj) => {
    if (obj.hasOwnProperty('additionalProperties') && obj.additionalProperties === false) {
      console.log('Changing additionalProperties from false to true');
      obj.additionalProperties = true;
    }
  });

  console.log('Writing updated schema');
  const success = writeJsonFile(targetPath, schema);
  if (success) {
    console.log('Schema updated successfully');
  }
  
  return success;
}

// Run if script is executed directly
if (require.main === module) {
  const schemaPath = process.argv[2];
  const success = removeAdditionalProperties(schemaPath);
  process.exit(success ? 0 : 1);
}

module.exports = { removeAdditionalProperties };
