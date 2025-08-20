const path = require('path');
const { ValidationUtils } = require('./utils/validation-utils');
const { parseArgs } = require('./utils/cli-args'); // added: use centralized CLI parser
// Centralized error-reporting and entity-reporting are used via runner where needed

function validateJsonFiles(schemaPathOverride = null) {
  const utils = new ValidationUtils({ strict: false });
  utils.log('🔍 Starting JSON validation process...');

  // Load NEPA schema
  const schemaPath = schemaPathOverride || path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  utils.loadSchema(schemaPath);
  utils.log(`📋 Schema loaded: ${schemaPath}`);

  return schemaPath;
}

const { runValidation } = require('./utils/runner');

async function main() {
  const args = parseArgs(process.argv.slice(2)); // centralized parsing
  const verbose = !!(args.verbose || args.v);
  const debug = !!(args.debug || args.d);
  // If needed later, add support for positional args in cli-args or extract from args._
  const ok = await runValidation({
    format: 'json',
    extensions: ['.json'],
    verbose,
    debug
  });
  if (require.main === module) {
    process.exit(ok ? 0 : 1);
  }
  return ok;
}

if (require.main === module) {
  main();
}

module.exports = { main, validateJsonFiles };