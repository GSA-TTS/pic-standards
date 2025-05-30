/**
 * YAML file validation against NEPA schema
 * Handles YAML-specific parsing and validation requirements
 */
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { ValidationUtils } = require('./utils/validation-utils');

/**
 * Main function to validate YAML files.
 */
async function validateYamlFiles() {
  const utils = new ValidationUtils({ strict: false }); 
  
  utils.log('🔍 Starting YAML validation process...');

  // Load NEPA schema
  const schemaPath = path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  const validate = utils.loadSchema(schemaPath);
  utils.log(`📋 Schema loaded: ${schemaPath}`);

  // Search directories for YAML files
  const searchDirs = [
    path.join(__dirname, '../src/yaml'), // Standard YAML data
    path.join(__dirname, '../src/sample-data'), // Sample data might include YAML
    path.join(__dirname, '../examples'), // Examples might include YAML
    path.join(__dirname, '../test/data'), // Test data might include YAML
    path.join(__dirname, '../data') // General data directory
  ];
  
  const yamlFiles = utils.findFiles(
    searchDirs, 
    ['.yaml', '.yml'], 
    ['schema', 'package', 'lock'] // Exclude schema files, package files, etc.
  );
  
  utils.log(`📁 Found ${yamlFiles.length} YAML files to validate`);

  if (yamlFiles.length === 0) {
    utils.log('ℹ️  No YAML data files found to validate. Searched in:');
    searchDirs.forEach(dir => {
      utils.log(`   - ${dir} ${fs.existsSync(dir) ? '(exists)' : '(not found)'}`);
    });
    utils.log('✅ Schema validation completed successfully - no data files to validate');
    return;
  }
  
  // NEPA schema record types (consistent with JSON validation)
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

  for (const filePath of yamlFiles) {
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
} // Closing brace for validateYamlFiles function

// Execute the validation
if (require.main === module) {
  validateYamlFiles().catch(err => {
    console.error('Unhandled error in YAML validation:', err);
    process.exit(1);
  });
}
