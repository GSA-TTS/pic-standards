const path = require('path');
const { ValidationUtils } = require('./utils/validation-utils'); // Destructure ValidationUtils

function validateJsonFiles() {
  const utils = new ValidationUtils({ strict: false });
  
  utils.log('🔍 Starting JSON validation process...');
  
  // Load NEPA schema
  const schemaPath = path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  const validate = utils.loadSchema(schemaPath);
  utils.log(`📋 Schema loaded: ${schemaPath}`);
  
  // Search directories for JSON files
  const searchDirs = [
    path.join(__dirname, '../src/json'),
    path.join(__dirname, '../src/sample-data'),
    path.join(__dirname, '../examples'),
    path.join(__dirname, '../test/data'),
    path.join(__dirname, '../data')
  ];
  
  const jsonFiles = utils.findFiles(
    searchDirs, 
    ['.json'], 
    ['schema', 'package', 'lock']
  );
  
  utils.log(`📁 Found ${jsonFiles.length} JSON files to validate`);
  
  if (jsonFiles.length === 0) {
    utils.log('ℹ️  No JSON data files found to validate. Searched in:');
    searchDirs.forEach(dir => {
      utils.log(`   - ${dir} ${require('fs').existsSync(dir) ? '(exists)' : '(not found)'}`);
    });
    utils.log('✅ Schema validation completed successfully - no data files to validate');
    return;
  }

  // NEPA schema record types
  const nepaRecordTypes = [
    'projects', 'processes', 'documents', 'public_comments',
    'public_engagement_events', 'case_events', 'gis_data',
    'user_roles', 'legal_structures', 'decision_elements',
    'process_models', 'decision_payloads'
  ];

  // Validate files
  const results = [];
  let totalRecords = 0;
  const recordCounts = {};

  for (const filePath of jsonFiles) {
    const result = utils.validateFile(filePath, validate, null); // Pass null as transformer
    results.push(result);

    if (result.isValid && result.data) {
      const { counts, total } = utils.countRecords(result.data, nepaRecordTypes);
      totalRecords += total;
      
      Object.entries(counts).forEach(([type, count]) => {
        recordCounts[type] = (recordCounts[type] || 0) + count;
      });

      utils.log(`  ✅ Valid (${total} total records)`);
    } else {
      utils.log(`  ❌ Invalid`, 'error');
    }
  }

  const success = utils.printSummary(results, totalRecords, recordCounts);
  process.exit(success ? 0 : 1);
}

validateJsonFiles();
