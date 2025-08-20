/**
 * Validate a database table against NEPA schema
 * @param {string} tableName
 * @param {Array} columns
 * @param {Object} schemaDefinitions
 * @param {Object} databaseSchemaDefinitions
 * @returns {Object} Validation results
 */
function validateTableAgainstSchema(tableName, columns, schemaDefinitions, databaseSchemaDefinitions = null) {
  // Use centralized mapping logic from mapping-utils.js
  const { normalizeMapping, TABLE_TO_SCHEMA_MAP } = require('./utils/mapping-utils');
  const mapping = normalizeMapping(tableName, TABLE_TO_SCHEMA_MAP);
  const schemaName = mapping.schemaName;
  const schemaDef = schemaDefinitions[schemaName];
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
    unmatchedDatabaseFields: [],
    missingRequiredFields: []
  };
  if (!schemaDef) {
    results.warnings.push(`Schema definition not found for: ${schemaName} (table: ${tableName})`);
    results.valid = false;
    return results;
  }
  const schemaProperties = schemaDef.properties || {};
  const requiredFields = schemaDef.required || [];
  const relevantSchemaProps = Object.keys(schemaProperties).filter(prop => !shouldIgnoreField(prop));
  results.coverage.total = relevantSchemaProps.length;
  const coveredSchemaProps = new Set();
  const dbFieldToSchemaMapping = new Map();
  // Database schema validation
  let databaseSchemaDef = null;
  let databaseSchemaProperties = {};
  let databaseRequiredFields = [];
  if (databaseSchemaDefinitions) {
    const dbPath = databaseSchemaDefinitions.definitions?.Database?.properties?.public?.properties?.Tables?.properties;
    if (dbPath && dbPath[tableName]) {
      databaseSchemaDef = dbPath[tableName];
      if (databaseSchemaDef.properties?.Row?.properties) {
        databaseSchemaProperties = databaseSchemaDef.properties.Row.properties;
        databaseRequiredFields = databaseSchemaDef.properties.Row.required || [];
        const relevantDatabaseProps = Object.keys(databaseSchemaProperties).filter(prop => !shouldIgnoreField(prop));
        results.databaseCoverage.total = relevantDatabaseProps.length;
      }
    }
  }
  // Check each database column
  columns.forEach(column => {
    const dbField = column.column;
    if (shouldIgnoreField(dbField)) return;
    // Pass schemaProperties to mapping function for generic name preference
    const mappedSchemaField = mapDatabaseFieldToSchema(dbField, tableName, schemaProperties);
    dbFieldToSchemaMapping.set(dbField, mappedSchemaField);
    if (schemaProperties[mappedSchemaField]) {
      coveredSchemaProps.add(mappedSchemaField);
    } else {
      if (requiredFields.includes(mappedSchemaField)) {
        results.errors.push(`Required NEPA schema property '${mappedSchemaField}' missing in database table '${tableName}'`);
        results.valid = false;
        results.missingRequiredFields.push(mappedSchemaField);
      } else {
        results.mappingWarnings.push(`Database column '${tableName}.${dbField}' (mapped to '${mappedSchemaField}') does not match any property in NEPA schema '${schemaName}'`);
      }
    }
  });
  results.coverage.found = Math.min(coveredSchemaProps.size, results.coverage.total);
  // Check for missing required fields in NEPA schema
  const missingRequiredFields = requiredFields.filter(field =>
    !coveredSchemaProps.has(field) && !shouldIgnoreField(field)
  );
  if (missingRequiredFields.length > 0) {
    results.errors.push(`Required NEPA schema property '${missingRequiredFields.join(', ')}' missing in database table '${tableName}'`);
    results.valid = false;
    results.missingRequiredFields.push(...missingRequiredFields);
  }
  // Check for missing required fields in database schema
  if (databaseSchemaDef && databaseSchemaProperties) {
    const missingDatabaseFields = databaseRequiredFields.filter(field =>
      !hasField(columns, field) && !shouldIgnoreField(field)
    );
    if (missingDatabaseFields.length > 0) {
      results.importantWarnings.push(`Required database fields '${missingDatabaseFields.join(', ')}' missing in table '${tableName}'`);
    }
  }
  // Track unmatched properties and database fields for reporting
  results.unmatchedProperties = relevantSchemaProps.filter(prop => !coveredSchemaProps.has(prop));
  results.unmatchedDatabaseFields = columns.map(col => col.column).filter(dbField => {
    const mappedSchemaField = mapDatabaseFieldToSchema(dbField, tableName, schemaProperties);
    return !schemaProperties[mappedSchemaField] && !shouldIgnoreField(dbField);
  });
  return results;
}
/**
 * Validate database crosswalk against NEPA schema
 * Ensures database structure aligns with schema definitions
 */
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser'); // Added missing import
const { colors } = require('./utils/validation-utils');
const { 
  shouldIgnoreField, 
  mapDatabaseFieldToSchema, 
  hasField 
} = require('./utils/mapping-utils');
// const { loadDatabaseCrosswalk } = require('./utils/csv-utils');

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
        resolve(crosswalk);
      })
      .on('error', reject);
  });
}

/**
 * Main validation function
 * @param {string} crosswalkPath - Path to database crosswalk CSV
 * @param {boolean} suggestions - Whether to show mapping suggestions
 * @returns {Promise<boolean>} True if validation succeeds
 */
async function validateDatabaseCrosswalk(crosswalkPath) {
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

    // Validate each table and print summary line with details if needed
    for (const [tableName, columns] of Object.entries(crosswalk)) {
      const result = validateTableAgainstSchema(
        tableName,
        columns,
        nepaSchema.definitions,
        databaseSchema?.definitions || null
      );
      allResults.push(result);
      if (!result.valid) allValid = false;

      // Calculate coverage percent
      const totalProps = result.coverage.total;
      const covered = result.coverage.found;
      const coveragePct = totalProps > 0 ? ((covered / totalProps) * 100).toFixed(1) : '0.0';
      let symbol;
      if (result.valid && covered === totalProps && (!result.errors.length && !result.importantWarnings.length && !result.mappingWarnings.length)) {
        symbol = '✅';
      } else {
        symbol = '⚠️';
      }
      console.log(`${symbol} ${tableName} — ${coveragePct}% coverage (${covered}/${totalProps})`);

      // Print details if coverage < 100% or there are issues
      const needsDetails =
        Number.parseFloat(coveragePct) < 100 ||
        result.errors.length > 0 ||
        (result.importantWarnings && result.importantWarnings.length > 0) ||
        (result.mappingWarnings && result.mappingWarnings.length > 0);
      if (needsDetails) {
        console.log(`  ${colors.bold}Details:${colors.reset}`);
        if (result.errors.length) {
          console.log(`   ${colors.red}Errors:${colors.reset}`);
          result.errors.forEach(error => console.log(`    - ${error}`));
        }
        if (result.importantWarnings && result.importantWarnings.length > 0) {
          console.log(`   ${colors.yellow}Important Warnings:${colors.reset}`);
          result.importantWarnings.forEach(warning => console.log(`    - ${warning}`));
        }
        if (result.mappingWarnings && result.mappingWarnings.length > 0) {
          console.log(`   ${colors.cyan}Mapping Warnings:${colors.reset}`);
          result.mappingWarnings.forEach(warning => console.log(`    - ${warning}`));
        }
        if (result.missingRequiredFields && result.missingRequiredFields.length > 0) {
          console.log(`   ${colors.yellow}Missing Required Fields:${colors.reset}`);
          result.missingRequiredFields.forEach(f => console.log(`    - ${f}`));
        }
        if (result.unmatchedProperties && result.unmatchedProperties.length > 0) {
          console.log(`   ${colors.magenta}Unmatched Schema Properties:${colors.reset}`);
          result.unmatchedProperties.forEach(p => console.log(`    - ${p}`));
        }
        if (result.unmatchedDatabaseFields && result.unmatchedDatabaseFields.length > 0) {
          console.log(`   ${colors.cyan}Unmatched Database Fields:${colors.reset}`);
          result.unmatchedDatabaseFields.forEach(f => console.log(`    - ${f}`));
        }
        if (process.argv.includes('--verbose') && result.warnings.length > 0) {
          console.log(`   ${colors.magenta}Verbose Warnings:${colors.reset}`);
          result.warnings.forEach(warning => console.log(`    - ${warning}`));
        }
      }
    }

    // Print summary in the style of validate-sql-schema.js
    console.log(`\n${colors.bold}Summary:${colors.reset}`);
    allResults.forEach(r => {
      const totalProps = r.coverage.total;
      const covered = r.coverage.found;
      const coveragePct = totalProps > 0 ? ((covered / totalProps) * 100).toFixed(1) : '0.0';
      let sym;
      if (r.valid && covered === totalProps && (!r.errors.length && !r.importantWarnings.length && !r.mappingWarnings.length)) {
        sym = '✅';
      } else {
        sym = '⚠️';
      }
      const note = ` (${coveragePct}% coverage)`;
      console.log(` ${sym} ${r.tableName}${note}`);
    });

    // Print details for any entity with coverage < 100 or issues
    const notPerfect = allResults.filter(
      r =>
        Number.parseFloat((r.coverage.total > 0 ? ((r.coverage.found / r.coverage.total) * 100).toFixed(1) : '0.0')) < 100 ||
        (r.errors && r.errors.length) ||
        (r.importantWarnings && r.importantWarnings.length) ||
        (r.mappingWarnings && r.mappingWarnings.length)
    );
    if (notPerfect.length) {
      console.log(`\n${colors.bold}Details for entities with issues/coverage < 100%:${colors.reset}`);
      notPerfect.forEach(r => {
        const totalProps = r.coverage.total;
        const covered = r.coverage.found;
        const coveragePct = totalProps > 0 ? ((covered / totalProps) * 100).toFixed(1) : '0.0';
        console.log(`\n ⚠️ ${r.tableName} — ${coveragePct}% coverage`);
        if (r.errors && r.errors.length) {
          console.log(`   ${colors.red}Errors:${colors.reset}`);
          r.errors.forEach(e => console.log(`    - ${e}`));
        }
        if (r.importantWarnings && r.importantWarnings.length) {
          console.log(`   ${colors.yellow}Important Warnings:${colors.reset}`);
          r.importantWarnings.forEach(w => console.log(`    - ${w}`));
        }
        if (r.mappingWarnings && r.mappingWarnings.length) {
          console.log(`   ${colors.cyan}Mapping Warnings:${colors.reset}`);
          r.mappingWarnings.forEach(w => console.log(`    - ${w}`));
        }
        if (r.missingRequiredFields && r.missingRequiredFields.length) {
          console.log(`   ${colors.yellow}Missing Required Fields:${colors.reset}`);
          r.missingRequiredFields.forEach(f => console.log(`    - ${f}`));
        }
        if (r.unmatchedProperties && r.unmatchedProperties.length) {
          console.log(`   ${colors.magenta}Unmatched Schema Properties:${colors.reset}`);
          r.unmatchedProperties.forEach(p => console.log(`    - ${p}`));
        }
        if (r.unmatchedDatabaseFields && r.unmatchedDatabaseFields.length) {
          console.log(`   ${colors.cyan}Unmatched Database Fields:${colors.reset}`);
          r.unmatchedDatabaseFields.forEach(f => console.log(`    - ${f}`));
        }
        if (process.argv.includes('--verbose') && r.warnings && r.warnings.length) {
          console.log(`   ${colors.magenta}Verbose Warnings:${colors.reset}`);
          r.warnings.forEach(warning => console.log(`    - ${warning}`));
        }
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
        const { printOperationSummary } = require('./utils/error-reporting');
        printOperationSummary(success, 'database crosswalk validation');
        process.exit(success ? 0 : 1);
      })
      .catch((err) => {
        console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
        process.exit(1);
      });
  }
}
