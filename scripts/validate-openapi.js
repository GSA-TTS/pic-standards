/**
 * Validate OpenAPI specifications against NEPA schema and database crosswalk
 * Ensures API definitions align with data model
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ValidationUtils, colors, ensureDirectory } = require('./utils/validation-utils');
const { 
  shouldIgnoreField, 
  mapDatabaseFieldToSchema, 
  OPENAPI_TO_SCHEMA_MAP 
} = require('./utils/mapping-utils');
const { loadDatabaseCrosswalk } = require('./utils/csv-utils');

/**
 * Validate OpenAPI specification structure
 * @param {Object} openApiSpec - Parsed OpenAPI specification
 * @returns {Object} Validation results
 */
function validateOpenApiStructure(openApiSpec) {
  const results = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Check required OpenAPI fields
  const requiredFields = ['openapi', 'info', 'paths'];
  for (const field of requiredFields) {
    if (!openApiSpec[field]) {
      results.errors.push(`Missing required OpenAPI field: ${field}`);
      results.valid = false;
    }
  }
  
  // Check OpenAPI version
  if (openApiSpec.openapi && !openApiSpec.openapi.startsWith('3.')) {
    results.warnings.push(`OpenAPI version ${openApiSpec.openapi} - consider upgrading to 3.x`);
  }
  
  // Check for deprecated fields (common in Supabase-generated specs)
  const deprecatedFields = ['host', 'basePath', 'schemes', 'consumes', 'produces'];
  for (const field of deprecatedFields) {
    if (openApiSpec[field]) {
      results.warnings.push(`Deprecated OpenAPI 2.0 field found: ${field} - should be updated for OpenAPI 3.x`);
    }
  }
  
  return results;
}

/**
 * Simple command line argument parser.
 * @param {string[]} argv - The process.argv array.
 * @returns {Object} An object containing parsed arguments.
 */
function parseArgs(argv) {
  const args = {};
  // process.argv[0] is node, process.argv[1] is the script path
  args.openApiDir = argv[2] || path.join(__dirname, '..', 'src', 'openapi');
  args.crosswalkPath = argv[3] || path.join(__dirname, '..', 'src', 'crosswalk', 'database_crosswalk.csv');
  // Add more argument parsing if needed, e.g., for flags like --suggestions
  args.suggestions = argv.includes('--suggestions');
  return args;
}

/**
 * Extract database table information from OpenAPI paths
 * @param {Object} openApiSpec - Parsed OpenAPI specification
 * @returns {Object} Table information extracted from paths
 */
function extractTablesFromOpenApi(openApiSpec) {
  const tables = {};
  
  if (!openApiSpec.paths) {
    return tables;
  }
  
  for (const [path, methods] of Object.entries(openApiSpec.paths)) {
    // Skip root path and RPC functions
    if (path === '/' || path.startsWith('/rpc/')) {
      continue;
    }
    
    // Extract table name from path (e.g., '/project' -> 'project')
    const tableName = path.replace('/', '');
    
    if (!tables[tableName]) {
      tables[tableName] = {
        paths: [],
        methods: [],
        parameters: new Set(), // Use Set to avoid duplicates
        responses: []
      };
    }
    
    tables[tableName].paths.push(path);
    
    // Extract HTTP methods and parameters
    for (const [method, methodSpec] of Object.entries(methods)) {
      if (['get', 'post', 'patch', 'delete'].includes(method)) {
        tables[tableName].methods.push(method);
        
        // Extract parameters from multiple sources
        if (methodSpec.parameters) {
          methodSpec.parameters.forEach(param => {
            if (param.$ref) {
              // Handle Supabase-style parameter references
              if (param.$ref.includes(`rowFilter.${tableName}.`)) {
                const fieldName = param.$ref.split('.').pop();
                tables[tableName].parameters.add(fieldName);
              }
            } else if (param.name) {
              // Direct parameter names
              tables[tableName].parameters.add(param.name);
            }
          });
        }
        
        // Also check if there are query parameters defined elsewhere
        if (methodSpec.responses && methodSpec.responses['200'] && methodSpec.responses['200'].schema) {
          const responseSchema = methodSpec.responses['200'].schema;
          if (responseSchema.items && responseSchema.items.properties) {
            // Extract field names from response schema
            Object.keys(responseSchema.items.properties).forEach(fieldName => {
              tables[tableName].parameters.add(fieldName);
            });
          }
        }
      }
    }
    
    // Convert Set back to Array for easier handling
    tables[tableName].parameters = Array.from(tables[tableName].parameters);
  }
  
  return tables;
}

/**
 * Validate OpenAPI table against database crosswalk
 * @param {string} tableName - Name of the table
 * @param {Object} tableInfo - OpenAPI table information
 * @param {Object} crosswalk - Database crosswalk data
 * @returns {Object} Validation results
 */
function validateTableAgainstCrosswalk(tableName, tableInfo, crosswalk) {
  const results = {
    tableName,
    valid: true,
    errors: [],
    warnings: [],
    coverage: { found: 0, total: 0 }
  };
  
  const dbColumns = crosswalk[tableName];
  if (!dbColumns) {
    results.warnings.push(`Table '${tableName}' found in OpenAPI but not in database crosswalk`);
    return results;
  }
  
  results.coverage.total = dbColumns.length;
  
  // Check if database columns are represented in OpenAPI parameters
  const apiParameters = tableInfo.parameters || [];
  
  for (const column of dbColumns) {
    const columnName = column.column;
    
    if (apiParameters.includes(columnName)) {
      results.coverage.found++;
    } else {
      // Skip database-specific fields that shouldn't be in API
      if (shouldIgnoreField(columnName)) {
        results.coverage.found++; // Count as covered since it's intentionally excluded
      } else {
        // Only warn about significant missing columns
        if (!columnName.includes('_json') && !columnName.startsWith('parent_')) {
          results.warnings.push(`Database column '${columnName}' not found in OpenAPI parameters`);
        } else {
          results.coverage.found++; // Count as covered
        }
      }
    }
  }
  
  // Check for OpenAPI parameters not in database (reduced noise)
  for (const param of apiParameters) {
    const hasDbColumn = dbColumns.some(col => col.column === param);
    if (!hasDbColumn && !shouldIgnoreField(param)) {
      // Only warn about unexpected parameters, not standard Supabase ones
      if (param !== 'other' && !param.startsWith('_') && param !== 'select') {
        results.warnings.push(`OpenAPI parameter '${param}' not found in database schema`);
      }
    }
  }
  
  return results;
}

/**
 * Validate OpenAPI definitions against NEPA schema
 * @param {string} definitionName - Name of the definition
 * @param {Object} definition - OpenAPI definition
 * @param {Object} nepaDefinitions - NEPA schema definitions
 * @returns {Object} Validation results
 */
function validateDefinitionAgainstSchema(definitionName, definition, nepaDefinitions) {
  const results = {
    definitionName,
    valid: true,
    errors: [],
    warnings: [],
    coverage: { found: 0, total: 0 }
  };

  // Map OpenAPI definition name to NEPA schema definition
  const schemaMapping = OPENAPI_TO_SCHEMA_MAP[definitionName];
  if (!schemaMapping) {
    results.warnings.push(`No schema mapping found for OpenAPI definition: ${definitionName}`);
    return results;
  }

  const nepaDefinition = nepaDefinitions[schemaMapping.schema];
  if (!nepaDefinition) {
    results.errors.push(`NEPA schema definition not found: ${schemaMapping.schema}`);
    results.valid = false;
    return results;
  }

  // Validate properties
  const apiProperties = definition.properties || {};
  const schemaProperties = nepaDefinition.properties || {};
  const requiredFields = nepaDefinition.required || [];

  // Check coverage of schema properties in API
  for (const [propName, propDef] of Object.entries(schemaProperties)) {
    results.coverage.total++;
    
    let fieldFound = false;
    
    if (apiProperties[propName]) {
      fieldFound = true;
    } else if (!requiredFields.includes(propName) && !shouldIgnoreField(propName)) {
      // Check if field exists with different name mapping
      for (const [apiField, apiDef] of Object.entries(apiProperties)) {
        const mappedField = mapDatabaseFieldToSchema(apiField, definitionName);
        if (mappedField === propName) {
          fieldFound = true;
          break;
        }
      }
    }
    
    if (fieldFound) {
      results.coverage.found++;
    } else if (requiredFields.includes(propName)) {
      results.errors.push(`Required schema property missing in API: ${propName}`);
      results.valid = false;
    }
  }
  
  // Check for OpenAPI properties that don't map to schema
  for (const [propName, propDef] of Object.entries(apiProperties)) {
    if (!schemaProperties[propName] && !shouldIgnoreField(propName)) {
      const mappedField = mapDatabaseFieldToSchema(propName, definitionName);
      if (!schemaProperties[mappedField]) {
        results.warnings.push(`API property not found in schema: ${propName}`);
      }
    }
  }

  return results;
}

/**
 * Main validation function for OpenAPI files
 * @param {string} openApiDir - Directory containing OpenAPI files
 * @param {string} crosswalkPath - Path to database crosswalk CSV
 * @returns {Promise<boolean>} True if validation succeeds
 */
async function validateOpenApiFiles(openApiDir, crosswalkPath) {
  const utils = new ValidationUtils();
  
  console.log(`${colors.bold}${colors.blue}=== Validating OpenAPI Files ===${colors.reset}`);
  console.log(`OpenAPI directory: ${openApiDir}`);
  console.log(`Database crosswalk: ${crosswalkPath}`);

  try {
    // Ensure directories exist
    if (!ensureDirectory(openApiDir)) {
      throw new Error(`Directory not found: ${openApiDir}`);
    }
    
    if (!ensureDirectory(path.dirname(crosswalkPath))) {
      throw new Error(`Directory not found: ${path.dirname(crosswalkPath)}`);
    }

    // Load database crosswalk for comparison
    const crosswalk = await loadDatabaseCrosswalk(crosswalkPath);
    console.log(`Loaded crosswalk data for ${Object.keys(crosswalk).length} tables`);

    // Load NEPA schema for comparison
    const schemaPath = path.join(__dirname, '..', 'src', 'jsonschema', 'nepa.schema.json');
    const nepaSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const nepaDefinitions = nepaSchema.definitions || {};

    // Find OpenAPI files
    const openApiFiles = utils.findFiles([openApiDir], ['.yaml', '.yml', '.json'], ['test']);
    
    console.log(`\nFound ${openApiFiles.length} OpenAPI files`);

    let allValid = true;
    const validationResults = [];

    for (const filePath of openApiFiles) {
      const fileName = path.basename(filePath);
      console.log(`\n${colors.bold}Validating: ${fileName}${colors.reset}`);

      try {
        const openApiSpec = utils.parseFile(filePath);
        
        // Validate basic OpenAPI structure
        const structureResult = validateOpenApiStructure(openApiSpec);
        if (!structureResult.valid) {
          allValid = false;
          console.log(`${colors.red}❌ Invalid OpenAPI structure${colors.reset}`);
          structureResult.errors.forEach(error => console.log(`    ${colors.red}Error: ${error}${colors.reset}`));
        }
        
        structureResult.warnings.forEach(warning => console.log(`    ${colors.yellow}Warning: ${warning}${colors.reset}`));

        // Extract and validate table information against crosswalk
        const tables = extractTablesFromOpenApi(openApiSpec);
        for (const [tableName, tableInfo] of Object.entries(tables)) {
          const crosswalkResult = validateTableAgainstCrosswalk(tableName, tableInfo, crosswalk);
          validationResults.push(crosswalkResult);
          
          if (!crosswalkResult.valid) {
            allValid = false;
          }
          
          const coverage = crosswalkResult.coverage.total > 0 
            ? ((crosswalkResult.coverage.found / crosswalkResult.coverage.total) * 100).toFixed(1)
            : '0';
          
          console.log(`  Table ${tableName}: ${coverage}% coverage (${crosswalkResult.coverage.found}/${crosswalkResult.coverage.total})`);
          
          crosswalkResult.warnings.forEach(warning => console.log(`    ${colors.yellow}Warning: ${warning}${colors.reset}`));
          crosswalkResult.errors.forEach(error => console.log(`    ${colors.red}Error: ${error}${colors.reset}`));
        }
        
        // Validate schema definitions if present
        if (openApiSpec.components && openApiSpec.components.schemas) {
          const schemas = openApiSpec.components.schemas;
          
          for (const [definitionName, definition] of Object.entries(schemas)) {
            const result = validateDefinitionAgainstSchema(definitionName, definition, nepaDefinitions);
            validationResults.push(result);
            
            if (!result.valid) {
              allValid = false;
              console.log(`${colors.red}❌ ${definitionName}: ${result.errors.length} errors${colors.reset}`);
              result.errors.forEach(error => console.log(`    ${colors.red}Error: ${error}${colors.reset}`));
            } else {
              const coverage = result.coverage.total > 0 ? ((result.coverage.found / result.coverage.total) * 100).toFixed(1) : '0.0';
              console.log(`  Schema ${definitionName}: ${coverage}% coverage (${result.coverage.found}/${result.coverage.total})`);
            }
          }
        }
      } catch (err) {
        allValid = false;
        console.error(`${colors.red}Error processing file ${fileName}: ${err.message}${colors.reset}`);
      }
    }
    
    // Summary of validation results
    console.log(`${colors.bold}${colors.blue}\n=== Validation Summary ===${colors.reset}`);
    for (const result of validationResults) {
      const status = result.valid ? `${colors.green}✔️ Valid${colors.reset}` : `${colors.red}❌ Invalid${colors.reset}`;
      console.log(`- ${result.tableName || result.definitionName}: ${status}`);
    }
    
    const overallStatus = allValid ? `${colors.green}✔️ All OpenAPI files are valid${colors.reset}` : `${colors.red}❌ Some errors were found in OpenAPI files${colors.reset}`;
    console.log(`\n${overallStatus}`);
    
    return allValid;
  } catch (err) {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    return false;
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const { openApiDir, crosswalkPath } = parseArgs(process.argv);
  
  validateOpenApiFiles(openApiDir, crosswalkPath)
    .then(valid => {
      if (valid) {
        console.log(`${colors.green}OpenAPI validation completed successfully.${colors.reset}`);
      } else {
        console.log(`${colors.red}OpenAPI validation completed with errors.${colors.reset}`);
      }
    })
    .catch(err => {
      console.error(`${colors.red}Error during validation: ${err.message}${colors.reset}`);
    });
}

module.exports = {
  validateOpenApiFiles,
  validateOpenApiStructure,
  extractTablesFromOpenApi,
  validateTableAgainstCrosswalk,
  validateDefinitionAgainstSchema
};
