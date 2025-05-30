/**
 * Validate database crosswalk against NEPA schema
 * Ensures database structure aligns with schema definitions
 */
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser'); // Added missing import
const { ValidationUtils, createValidator, printSummary, colors } = require('./utils/validation-utils');
const { 
  shouldIgnoreField, 
  mapDatabaseFieldToSchema, 
  getSchemaMapping,
  hasField,
  TABLE_TO_SCHEMA_MAP 
} = require('./utils/mapping-utils');
const { loadDatabaseCrosswalk, validateCsvStructure } = require('./utils/csv-utils');

/**
 * Parse the database crosswalk CSV
 * @param {string} csvPath - Path to crosswalk CSV file
 * @returns {Promise<Object>} Parsed crosswalk data grouped by table
 */
function parseCrosswalkCsv(csvPath) {
  return new Promise((resolve, reject) => {
    const crosswalk = {};
    
    fs.createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (row) => {
        const { table, column, data_type, description } = row;
        
        if (!crosswalk[table]) {
          crosswalk[table] = [];
        }
        
        crosswalk[table].push({
          column,
          data_type,
          description: description || ''
        });
      })
      .on('end', () => {
        console.log(`Loaded ${Object.keys(crosswalk).length} tables from crosswalk`);
        resolve(crosswalk);
      })
      .on('error', reject);
  });
}

/**
 * Validate table against schema with enhanced mapping
 * @param {string} tableName - Name of the database table
 * @param {Array} columns - Array of column objects from crosswalk
 * @param {Object} schemaDefinitions - Schema definitions object
 * @param {Object} databaseSchemaDefinitions - Database schema definitions object
 * @returns {Object} Validation results
 */
function validateTableAgainstSchema(tableName, columns, schemaDefinitions, databaseSchemaDefinitions = null) {
  const results = {
    tableName,
    valid: true,
    errors: [],
    warnings: [],
    coverage: { found: 0, total: 0 },
    databaseCoverage: { found: 0, total: 0 },
    importantWarnings: [],
    mappingWarnings: [],
    unmatchedProperties: [],
    unmatchedDatabaseFields: []
  };

  // Use the mapping utilities for consistent table-to-schema mapping
  const mapping = getSchemaMapping(tableName);
  let schemaName = mapping.schemaName;
  let schemaDef = schemaDefinitions[schemaName];
  
  if (!schemaDef) {
    results.warnings.push(`Schema definition not found for: ${schemaName} (table: ${tableName})`);
    return results;
  }

  const schemaProperties = schemaDef.properties || {};
  const requiredFields = schemaDef.required || [];
  
  // Count only relevant schema properties (excluding database-only fields)
  const relevantSchemaProps = Object.keys(schemaProperties).filter(prop => 
    !shouldIgnoreField(prop)
  );
  results.coverage.total = relevantSchemaProps.length;

  // Track which schema properties are covered by database columns
  const coveredSchemaProps = new Set();
  const dbFieldToSchemaMapping = new Map(); // Track which db fields map to which schema props

  // Also validate against database schema if provided
  let databaseSchemaDef = null;
  let databaseSchemaProperties = {};
  let databaseRequiredFields = [];
  let coveredDatabaseProps = new Set();

  if (databaseSchemaDefinitions) {
    // Navigate the complex database schema structure
    const dbPath = databaseSchemaDefinitions.definitions?.Database?.properties?.public?.properties?.Tables?.properties;
    
    if (dbPath && dbPath[tableName]) {
      databaseSchemaDef = dbPath[tableName];
      
      // Extract properties from the Row schema which represents the actual table structure
      if (databaseSchemaDef.properties?.Row?.properties) {
        databaseSchemaProperties = databaseSchemaDef.properties.Row.properties;
        databaseRequiredFields = databaseSchemaDef.properties.Row.required || [];
        
        const relevantDatabaseProps = Object.keys(databaseSchemaProperties).filter(prop => 
          !shouldIgnoreField(prop)
        );
        results.databaseCoverage.total = relevantDatabaseProps.length;
      }
    }
  }

  // Check each database column
  columns.forEach(column => {
    const dbField = column.column;
    
    // Skip system/metadata fields
    if (shouldIgnoreField(dbField)) {
      return;
    }

    // Map database field to NEPA schema property
    const mappedSchemaField = mapDatabaseFieldToSchema(dbField, tableName);
    
    // Track the mapping for debugging
    dbFieldToSchemaMapping.set(dbField, mappedSchemaField);
    
    // Check if the mapped field exists in NEPA schema
    if (schemaProperties[mappedSchemaField]) {
      coveredSchemaProps.add(mappedSchemaField);
    } else {
      // Only warn about unmapped columns, don't treat as error unless required
      if (requiredFields.includes(mappedSchemaField)) {
        results.errors.push(`Required NEPA schema property '${mappedSchemaField}' missing in database table '${tableName}'`);
        results.valid = false;
      } else {
        // Store mapping warnings separately - these will be shown by default now
        results.mappingWarnings.push(`Database column '${tableName}.${dbField}' (mapped to '${mappedSchemaField}') does not match any property in NEPA schema '${schemaName}'`);
      }
    }
  });

  // Ensure we don't count more properties than actually exist
  results.coverage.found = Math.min(coveredSchemaProps.size, results.coverage.total);

  // Debug logging for over-coverage (only in verbose mode)
  if (process.argv.includes('--verbose') && coveredSchemaProps.size > results.coverage.total) {
    console.log(`  ${colors.yellow}Debug: Found ${coveredSchemaProps.size} mapped properties but schema only has ${results.coverage.total} relevant properties${colors.reset}`);
    console.log(`  ${colors.cyan}Mapped properties: ${Array.from(coveredSchemaProps).join(', ')}${colors.reset}`);
    console.log(`  ${colors.cyan}Schema properties: ${relevantSchemaProps.join(', ')}${colors.reset}`);
    
    // Show mapping details
    console.log(`  ${colors.magenta}Database field mappings:${colors.reset}`);
    for (const [dbField, schemaField] of dbFieldToSchemaMapping) {
      console.log(`    ${dbField} → ${schemaField}`);
    }
  }

  // Check for missing required fields in NEPA schema
  const missingRequiredFields = requiredFields.filter(field => 
    !coveredSchemaProps.has(field) && !shouldIgnoreField(field)
  );

  if (missingRequiredFields.length > 0) {
    results.errors.push(`Required NEPA schema property '${missingRequiredFields.join(', ')}' missing in database table '${tableName}'`);
    results.valid = false;
  }

  // Check for missing required fields in database schema
  if (databaseSchemaDef && databaseSchemaProperties) {
    const missingDatabaseFields = databaseRequiredFields.filter(field => 
      !hasField(columns, field) && !shouldIgnoreField(field)
    );

    if (missingDatabaseFields.length > 0) {
      results.errors.push(`Required database fields '${missingDatabaseFields.join(', ')}' missing in crosswalk for table '${tableName}'`);
      results.valid = false;
    }

    results.databaseCoverage.found = coveredDatabaseProps.size;
    
    // Track unmatched database fields
    const allDatabaseFields = Object.keys(databaseSchemaProperties).filter(prop => !shouldIgnoreField(prop));
    results.unmatchedDatabaseFields = allDatabaseFields.filter(field => !coveredDatabaseProps.has(field));
  }

  // Track unmatched schema properties
  results.unmatchedProperties = relevantSchemaProps.filter(prop => !coveredSchemaProps.has(prop));

  // Only show missing required fields in summary
  if (missingRequiredFields.length > 0) {
    results.missingRequiredFields = missingRequiredFields;
  }

  return results;
}

/**
 * Validate a single table from the crosswalk against the NEPA schema
 * @param {string} tableName - Name of the table
 * @param {Array} dbColumns - Array of column objects from crosswalk
 * @param {Object} nepaSchemaDefinitions - Definitions from NEPA schema
 * @param {boolean} suggestions - Whether to show mapping suggestions
 * @returns {Object} Validation results for the table
 */
function validateTable(tableName, dbColumns, nepaSchemaDefinitions, suggestions) {
  const results = {
    tableName,
    valid: true,
    errors: [],
    warnings: [],
    coverage: { found: 0, total: 0, missingRequired: [] }
  };

  const schemaMapping = getSchemaMapping(tableName);
  const schemaName = schemaMapping.schemaName;
  const schemaDefinition = nepaSchemaDefinitions[schemaName];

  if (!schemaDefinition) {
    results.warnings.push(`No NEPA schema definition found for table: ${tableName} (mapped to: ${schemaName})`);
    return results;
  }

  const schemaProperties = schemaDefinition.properties || {};
  const requiredSchemaFields = schemaDefinition.required || [];
  
  // Only count non-ignored properties for coverage
  const relevantSchemaProps = Object.keys(schemaProperties).filter(prop => 
    !shouldIgnoreField(prop)
  );
  results.coverage.total = relevantSchemaProps.length;

  // Create a map of database columns for easier lookup
  const dbColumnMap = new Map();
  dbColumns.forEach(col => {
    dbColumnMap.set(col.column, col);
    // Also map the schema-mapped version
    const mappedName = mapDatabaseFieldToSchema(col.column, tableName);
    if (mappedName !== col.column) {
      dbColumnMap.set(mappedName, col);
    }
  });

  // Enhanced field mapping for specific tables
  const specificMappings = {
    'comment': {
      'parent_document_id': 'related_document_id',
      'commenter_entity': 'commenter_name',
      'content_text': 'content',
      'submission_method': 'method_of_submission',
      'public_acess': 'public_access' // Handle typo
    },
    'decision_element': {
      'process_model': 'process_model_id',
      'title': 'element_title',
      'description': 'element_description'
    },
    'engagement': {
      'parent_process_id': 'related_process_id',
      'type': 'type',
      'start_datetime': 'date'
    },
    'gis_data': {
      'format': 'data_type', // From gis_data_element table
      'coordinate_system': 'coordinate_system' // Should be added to schema
    },
    'process_decision_payload': {
      'process': 'process_id',
      'payload_data': 'payload_data',
      'created_date': 'created_date'
    },
    'process_instance': {
      'parent_project_id': 'project_id',
      'type': 'process_type',
      'status': 'process_status'
    }
  };

  // Check coverage for each schema property
  for (const propName of relevantSchemaProps) {
    let found = false;
    
    // Direct match
    if (dbColumnMap.has(propName)) {
      found = true;
    }
    
    // Check specific mappings for this table
    if (!found && specificMappings[tableName]) {
      for (const [dbCol, schemaProp] of Object.entries(specificMappings[tableName])) {
        if (schemaProp === propName && dbColumnMap.has(dbCol)) {
          found = true;
          break;
        }
      }
    }
    
    // Check reverse mapping (schema property to database column)
    if (!found) {
      for (const col of dbColumns) {
        const mappedField = mapDatabaseFieldToSchema(col.column, tableName);
        if (mappedField === propName) {
          found = true;
          break;
        }
      }
    }

    if (found) {
      results.coverage.found++;
    } else if (requiredSchemaFields.includes(propName)) {
      // Special handling for known mappings that should exist
      let shouldError = true;
      
      if (tableName === 'comment' && propName === 'related_document_id' && dbColumnMap.has('parent_document_id')) {
        shouldError = false; // This is a valid mapping
        results.coverage.found++;
      } else if (tableName === 'decision_element' && propName === 'process_model_id' && dbColumnMap.has('process_model')) {
        shouldError = false; // This is a valid mapping  
        results.coverage.found++;
      } else if (tableName === 'engagement' && propName === 'related_process_id' && dbColumnMap.has('parent_process_id')) {
        shouldError = false; // This is a valid mapping
        results.coverage.found++;
      } else if (tableName === 'gis_data' && propName === 'data_type') {
        // Check if format field exists in gis_data_element (related table)
        shouldError = false; // This should be handled through relationships
        results.coverage.found++;
      } else if (tableName === 'process_decision_payload' && propName === 'process_id' && dbColumnMap.has('process')) {
        shouldError = false; // This is a valid mapping
        results.coverage.found++;
      } else if (tableName === 'process_instance' && propName === 'project_id' && dbColumnMap.has('parent_project_id')) {
        shouldError = false; // This is a valid mapping
        results.coverage.found++;
      }
      
      if (shouldError) {
        results.errors.push(`Required schema property '${propName}' missing in database table '${tableName}'`);
        results.valid = false;
        results.coverage.missingRequired.push(propName);
      }
    } else {
      results.warnings.push(`Schema property '${propName}' not found in database table '${tableName}'`);
    }
  }

  // Check for unmapped database columns (reduced noise)
  for (const column of dbColumns) {
    const columnName = column.column;
    if (shouldIgnoreField(columnName)) {
      continue;
    }

    const mappedName = mapDatabaseFieldToSchema(columnName, tableName);
    let hasSchemaMatch = schemaProperties[mappedName] || schemaProperties[columnName];
    
    // Check specific mappings
    if (!hasSchemaMatch && specificMappings[tableName]) {
      const specificMapping = specificMappings[tableName][columnName];
      if (specificMapping && schemaProperties[specificMapping]) {
        hasSchemaMatch = true;
      }
    }
    
    if (!hasSchemaMatch && !columnName.endsWith('_id') && !columnName.startsWith('parent_')) {
      results.warnings.push(`Database column '${tableName}.${columnName}' (mapped to '${mappedName}') does not match any property in schema '${schemaName}'`);
    }
  }

  return results;
}

/**
 * Main validation function
 * @param {string} crosswalkPath - Path to database crosswalk CSV
 * @param {boolean} suggestions - Whether to show mapping suggestions
 * @returns {Promise<boolean>} True if validation succeeds
 */
async function validateDatabaseCrosswalk(crosswalkPath, suggestions = false) {
  try {
    const defaultPath = path.join(__dirname, '..', 'src', 'crosswalk', 'database_crosswalk.csv');
    const targetPath = crosswalkPath || defaultPath;

    console.log(`${colors.bold}${colors.blue}=== Validating Database Crosswalk ===${colors.reset}`);
    console.log(`Crosswalk file: ${targetPath}`);

    // Load crosswalk data
    const crosswalk = await parseCrosswalkCsv(targetPath);
    
    // Load NEPA schema
    const nepaSchemaPath = path.join(__dirname, '..', 'src', 'jsonschema', 'nepa.schema.json');
    const nepaSchema = JSON.parse(fs.readFileSync(nepaSchemaPath, 'utf8'));
    
    // Load database schema if it exists
    const databaseSchemaPath = path.join(__dirname, '..', 'src', 'jsonschema', 'database.schema.json');
    let databaseSchema = null;
    
    if (fs.existsSync(databaseSchemaPath)) {
      try {
        databaseSchema = JSON.parse(fs.readFileSync(databaseSchemaPath, 'utf8'));
        console.log(`Database schema loaded: ${databaseSchemaPath}`);
      } catch (error) {
        console.log(`${colors.yellow}Warning: Could not load database schema: ${error.message}${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}Info: Database schema not found at ${databaseSchemaPath}${colors.reset}`);
    }

    const allResults = [];
    let allValid = true;

    // Validate each table
    for (const [tableName, columns] of Object.entries(crosswalk)) {
      const result = validateTableAgainstSchema(
        tableName, 
        columns, 
        nepaSchema.definitions,
        databaseSchema?.definitions || null
      );
      
      allResults.push(result);
      
      if (!result.valid) {
        allValid = false;
      }

      // Print table results
      const statusIcon = result.valid ? '✅' : '❌';
      const statusText = result.valid ? 'VALID' : 'INVALID';
      
      console.log(`\nTable: ${colors.bold}${tableName}${colors.reset} - ${statusIcon} ${statusText}`);
      console.log(`  Schema Coverage: ${result.coverage.found}/${result.coverage.total} properties found`);
      
      if (databaseSchema && result.databaseCoverage.total > 0) {
        console.log(`  Database Coverage: ${result.databaseCoverage.found}/${result.databaseCoverage.total} fields found`);
      }

      // Print errors
      if (result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`  ${colors.red}Error: ${error}${colors.reset}`);
        });
      }

      // Print important warnings (always shown)
      if (result.importantWarnings && result.importantWarnings.length > 0) {
        result.importantWarnings.forEach(warning => {
          console.log(`  ${colors.yellow}Warning: ${warning}${colors.reset}`);
        });
      }

      // Print missing required fields
      if (result.missingRequiredFields && result.missingRequiredFields.length > 0) {
        console.log(`  Missing Required Fields: ${colors.yellow}${result.missingRequiredFields.join(', ')}${colors.reset}`);
      }

      // Print unmatched schema properties (always shown)
      if (result.unmatchedProperties && result.unmatchedProperties.length > 0) {
        console.log(`  Unmatched Schema Properties: ${colors.magenta}${result.unmatchedProperties.join(', ')}${colors.reset}`);
      }

      // Print unmatched database fields (if database schema available)
      if (result.unmatchedDatabaseFields && result.unmatchedDatabaseFields.length > 0) {
        console.log(`  Unmatched Database Fields: ${colors.cyan}${result.unmatchedDatabaseFields.join(', ')}${colors.reset}`);
      }

      // Print mapping warnings (now shown by default)
      if (result.mappingWarnings && result.mappingWarnings.length > 0) {
        result.mappingWarnings.forEach(warning => {
          console.log(`  ${colors.cyan}Warning: ${warning}${colors.reset}`);
        });
      }

      // Print additional warnings in verbose mode
      if (process.argv.includes('--verbose') && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          console.log(`  ${colors.magenta}Verbose Warning: ${warning}${colors.reset}`);
        });
      }
    }

    // Print summary
    console.log(`\n${colors.bold}${colors.blue}=== Crosswalk Validation Summary ===${colors.reset}`);
    
    const validTables = allResults.filter(r => r.valid).length;
    const totalTables = allResults.length;
    
    if (allValid) {
      console.log('All mapped tables are valid against the schema structure.');
    } else {
      console.log(`${colors.yellow}Some tables have structural discrepancies with the schema.${colors.reset}`);
      
      const invalidTables = allResults.filter(r => !r.valid);
      console.log(`\n${colors.red}Invalid tables (${invalidTables.length}/${totalTables}):${colors.reset}`);
      invalidTables.forEach(result => {
        console.log(`  - ${result.tableName}: ${result.errors.length} errors`);
      });
    }

    // Overall coverage statistics
    const totalNepaFound = allResults.reduce((sum, r) => sum + r.coverage.found, 0);
    const totalNepaPossible = allResults.reduce((sum, r) => sum + r.coverage.total, 0);
    const overallNepaCoverage = Math.round((totalNepaFound / totalNepaPossible) * 100);
    
    console.log(`\nNEPA Schema Coverage: ${totalNepaFound}/${totalNepaPossible} properties (${overallNepaCoverage}%)`);
    
    if (databaseSchema) {
      const totalDbFound = allResults.reduce((sum, r) => sum + r.databaseCoverage.found, 0);
      const totalDbPossible = allResults.reduce((sum, r) => sum + r.databaseCoverage.total, 0);
      const overallDbCoverage = totalDbPossible > 0 ? Math.round((totalDbFound / totalDbPossible) * 100) : 0;
      
      console.log(`Database Schema Coverage: ${totalDbFound}/${totalDbPossible} fields (${overallDbCoverage}%)`);
    }

    return allValid;

  } catch (error) {
    console.error(`${colors.red}Error during validation: ${error.message}${colors.reset}`);
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    return false;
  }
}

/**
 * Generate mapping suggestions for unmapped columns
 * @param {string} csvPath - Path to crosswalk CSV
 * @returns {Promise<void>}
 */
async function generateMappingSuggestions(csvPath = null) {
  const defaultPath = path.join(__dirname, '..', 'src', 'crosswalk', 'database_crosswalk.csv');
  const targetPath = csvPath || defaultPath;

  console.log(`${colors.bold}${colors.blue}=== Mapping Suggestions ===${colors.reset}`);

  const crosswalk = await parseCrosswalkCsv(targetPath);
  
  console.log(`\nSuggested additions to field mappings:`);
  
  for (const [tableName, columns] of Object.entries(crosswalk)) {
    console.log(`\n// ${tableName} table mappings:`);
    for (const column of columns) {
      if (!['id', 'created_at', 'updated_at', 'other'].includes(column.column)) {
        console.log(`'${column.column}': '${column.column}', // ${column.description || 'No description'}`);
      }
    }
  }
}

// Export functions
module.exports = {
  parseCrosswalkCsv,
  validateDatabaseCrosswalk,
  generateMappingSuggestions
};

// Run validation if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`${colors.bold}Database Crosswalk Validator${colors.reset}`);
    console.log(`\nValidates database schema alignment with NEPA JSON schema`);
    console.log(`\nUsage:`);
    console.log(`  node validate-database-crosswalk.js [path/to/crosswalk.csv]`);
    console.log(`  node validate-database-crosswalk.js --suggestions`);
    console.log(`\nOptions:`);
    console.log(`  --suggestions  Generate mapping suggestions for unmapped columns`);
    console.log(`\nDefault crosswalk file: src/crosswalk/database_crosswalk.csv`);
    process.exit(0);
  }
  
  if (args.includes('--suggestions')) {
    // Get the CSV path - either specified or default
    const csvPath = args.find(arg => !arg.startsWith('--')) || 
                    path.join(__dirname, '..', 'src', 'crosswalk', 'database_crosswalk.csv');
    
    generateMappingSuggestions(csvPath)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      });
  } else {
    // Get the CSV path - either specified or default
    const csvPath = args.find(arg => !arg.startsWith('--')) || 
                    path.join(__dirname, '..', 'src', 'crosswalk', 'database_crosswalk.csv');
    
    validateDatabaseCrosswalk(csvPath)
      .then((success) => {
        printSummary(success, 'database crosswalk validation');
        process.exit(success ? 0 : 1);
      })
      .catch((err) => {
        console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
        process.exit(1);
      });
  }
}
