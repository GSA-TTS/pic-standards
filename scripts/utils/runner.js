const path = require('path');
const fs = require('fs');
const { ValidationUtils } = require('./validation-utils');
const { printEntityBreakdown } = require('./entity-reporting');
const errorReporting = require('./error-reporting');

async function runValidation({
  format = 'json',
  schemaPath,
  searchDirs = [],
  extensions = [],
  exclude = ['schema', 'package', 'lock'],
  verbose = false,
}) {
  const utils = new ValidationUtils({ strict: false, verbose });
  utils.log(`🔍 Starting ${format.toUpperCase()} validation process...`);

  const resolvedSchema = schemaPath || path.join(__dirname, '../../src/jsonschema/nepa.schema.json');
  const validate = utils.loadSchema(resolvedSchema);
  utils.log(`📋 Schema loaded: ${resolvedSchema}`);

  const defaultDirs = [
    path.join(__dirname, '../../src', format),
    path.join(__dirname, '../../src/sample-data'),
    path.join(__dirname, '../../examples'),
    path.join(__dirname, '../../test/data'),
    path.join(__dirname, '../../data'),
  ];
  const dirs = searchDirs.length ? searchDirs : defaultDirs;

  const files = utils.findFiles(dirs, extensions, exclude);
  utils.log(`📁 Found ${files.length} ${format.toUpperCase()} files to validate`);

  if (files.length === 0) {
    utils.log('ℹ️  No data files found to validate. Searched in:');
    dirs.forEach(dir => utils.log(`   - ${dir} ${fs.existsSync(dir) ? '(exists)' : '(not found)'}`));
    utils.log('✅ Schema validation completed successfully - no data files to validate');
    return true;
  }

  const results = [];
  for (const filePath of files) {
    const result = utils.validateFile(filePath, validate, null);
    results.push(result);
    if (result.isValid && result.data) {
      printEntityBreakdown(result.data, utils.log.bind(utils));
      utils.log('  ✅ Valid');
    } else {
      utils.log('  ❌ Invalid', 'error');
      if (result.errors?.length) {
        utils.log('    Schema validation errors:', 'error');
        result.errors.forEach((err, idx) => {
          utils.log(`      [${idx + 1}] ${err.message} ${err.instancePath ? `(at ${err.instancePath})` : ''}`, 'error');
        });
      }
    }
  }

  const success = errorReporting.printOperationSummary(
    results.every(r => r.isValid),
    `${format.toUpperCase()} validation`
  );
  return success;
}

module.exports = { runValidation };
