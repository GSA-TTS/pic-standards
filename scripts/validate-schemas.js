/**
 * Validate JSON schema files for syntax and structure
 * Ensures all schema files are valid JSON and follow JSON Schema standards
 */
const path = require('path');
const {
  createValidator,
  loadSchemaFile,
  findJsonFiles,
  validateJsonFile,
  printSummary,
  colors
} = require('./utils/validation-utils');

/**
 * Extract and display detailed information about schema properties
 * @param {Object} properties - Schema properties object
 * @param {string} indent - Indentation for nested properties
 * @param {number} maxDepth - Maximum depth to traverse
 * @param {number} currentDepth - Current traversal depth
 */
function displaySchemaProperties(properties, indent = '  ', maxDepth = 3, currentDepth = 0) {
  if (!properties || typeof properties !== 'object' || currentDepth >= maxDepth) {
    return;
  }

  for (const [propName, propDef] of Object.entries(properties)) {
    let typeInfo = '';
    let enumInfo = '';
    let formatInfo = '';
    let descInfo = '';

    // Extract type information
    if (propDef.type) {
      if (Array.isArray(propDef.type)) {
        typeInfo = `type: [${propDef.type.join(', ')}]`;
      } else {
        typeInfo = `type: ${propDef.type}`;
      }
    } else if (propDef.anyOf) {
      const types = propDef.anyOf.map(item => item.type || 'mixed').join(' | ');
      typeInfo = `anyOf: ${types}`;
    } else if (propDef.oneOf) {
      const types = propDef.oneOf.map(item => item.type || 'mixed').join(' | ');
      typeInfo = `oneOf: ${types}`;
    } else if (propDef.$ref) {
      typeInfo = `$ref: ${propDef.$ref}`;
    } else {
      typeInfo = 'type: unknown';
    }

    // Extract enum information
    if (propDef.enum) {
      const enumValues = propDef.enum.slice(0, 5); // Show first 5 values
      const moreCount = propDef.enum.length > 5 ? ` (+${propDef.enum.length - 5} more)` : '';
      enumInfo = ` | enum: [${enumValues.join(', ')}]${moreCount}`;
    }

    // Extract format information
    if (propDef.format) {
      formatInfo = ` | format: ${propDef.format}`;
    }

    // Extract description (truncated)
    if (propDef.description) {
      const desc = propDef.description.substring(0, 50);
      const truncated = propDef.description.length > 50 ? '...' : '';
      descInfo = ` | ${colors.cyan}"${desc}${truncated}"${colors.reset}`;
    }

    console.log(`${indent}${colors.green}${propName}${colors.reset}: ${typeInfo}${enumInfo}${formatInfo}${descInfo}`);

    // Recursively display nested object properties
    if (propDef.type === 'object' && propDef.properties && currentDepth < maxDepth - 1) {
      displaySchemaProperties(propDef.properties, indent + '  ', maxDepth, currentDepth + 1);
    }

    // Display array item properties
    if (propDef.type === 'array' && propDef.items && propDef.items.properties && currentDepth < maxDepth - 1) {
      console.log(`${indent}  ${colors.yellow}[array items]:${colors.reset}`);
      displaySchemaProperties(propDef.items.properties, indent + '    ', maxDepth, currentDepth + 1);
    }
  }
}

/**
 * Display detailed schema information in verbose mode
 * @param {Object} schema - Parsed JSON schema
 * @param {string} schemaName - Name of the schema file
 */
function displayVerboseSchemaInfo(schema, schemaName) {
  console.log(`\n${colors.bold}${colors.blue}=== Schema Details: ${schemaName} ===${colors.reset}`);
  
  // Display basic schema information
  if (schema.$schema) {
    console.log(`${colors.yellow}Schema Version:${colors.reset} ${schema.$schema}`);
  }
  if (schema.$id) {
    console.log(`${colors.yellow}Schema ID:${colors.reset} ${schema.$id}`);
  }
  if (schema.title) {
    console.log(`${colors.yellow}Title:${colors.reset} ${schema.title}`);
  }
  if (schema.description) {
    console.log(`${colors.yellow}Description:${colors.reset} ${schema.description.substring(0, 100)}...`);
  }

  // Display root-level properties
  if (schema.properties) {
    console.log(`\n${colors.bold}Root Properties:${colors.reset}`);
    displaySchemaProperties(schema.properties);
  }

  // Display definitions
  if (schema.definitions) {
    console.log(`\n${colors.bold}Definitions (${Object.keys(schema.definitions).length} total):${colors.reset}`);
    
    for (const [defName, defSchema] of Object.entries(schema.definitions)) {
      console.log(`\n${colors.bold}${colors.magenta}${defName}:${colors.reset}`);
      
      // Show required fields
      if (defSchema.required && defSchema.required.length > 0) {
        console.log(`  ${colors.yellow}Required:${colors.reset} [${defSchema.required.join(', ')}]`);
      }
      
      // Show properties
      if (defSchema.properties) {
        console.log(`  ${colors.yellow}Properties (${Object.keys(defSchema.properties).length} total):${colors.reset}`);
        displaySchemaProperties(defSchema.properties, '    ', 2);
      }
      
      // Show additional constraints
      if (defSchema.additionalProperties !== undefined) {
        console.log(`  ${colors.yellow}Additional Properties:${colors.reset} ${defSchema.additionalProperties}`);
      }
    }
  }

  // Display schema statistics
  const stats = gatherSchemaStatistics(schema);
  console.log(`\n${colors.bold}Schema Statistics:${colors.reset}`);
  console.log(`  Total Properties: ${stats.totalProperties}`);
  console.log(`  Required Properties: ${stats.requiredProperties}`);
  console.log(`  Enum Properties: ${stats.enumProperties}`);
  console.log(`  Object Properties: ${stats.objectProperties}`);
  console.log(`  Array Properties: ${stats.arrayProperties}`);
  console.log(`  String Properties: ${stats.stringProperties}`);
  console.log(`  Number Properties: ${stats.numberProperties}`);
  console.log(`  Boolean Properties: ${stats.booleanProperties}`);
}

/**
 * Gather statistics about the schema
 * @param {Object} schema - JSON schema object
 * @returns {Object} Statistics object
 */
function gatherSchemaStatistics(schema) {
  const stats = {
    totalProperties: 0,
    requiredProperties: 0,
    enumProperties: 0,
    objectProperties: 0,
    arrayProperties: 0,
    stringProperties: 0,
    numberProperties: 0,
    booleanProperties: 0
  };

  function countProperties(properties, required = []) {
    if (!properties || typeof properties !== 'object') return;

    for (const [propName, propDef] of Object.entries(properties)) {
      stats.totalProperties++;
      
      if (required.includes(propName)) {
        stats.requiredProperties++;
      }
      
      if (propDef.enum) {
        stats.enumProperties++;
      }
      
      const type = propDef.type || (propDef.anyOf && propDef.anyOf[0] && propDef.anyOf[0].type);
      switch (type) {
        case 'object':
          stats.objectProperties++;
          if (propDef.properties) {
            countProperties(propDef.properties, propDef.required || []);
          }
          break;
        case 'array':
          stats.arrayProperties++;
          if (propDef.items && propDef.items.properties) {
            countProperties(propDef.items.properties, propDef.items.required || []);
          }
          break;
        case 'string':
          stats.stringProperties++;
          break;
        case 'number':
        case 'integer':
          stats.numberProperties++;
          break;
        case 'boolean':
          stats.booleanProperties++;
          break;
      }
    }
  }

  // Count root properties
  if (schema.properties) {
    countProperties(schema.properties, schema.required || []);
  }

  // Count definition properties
  if (schema.definitions) {
    for (const [defName, defSchema] of Object.entries(schema.definitions)) {
      if (defSchema.properties) {
        countProperties(defSchema.properties, defSchema.required || []);
      }
    }
  }

  return stats;
}

/**
 * Validate that schema files are valid JSON Schema documents
 * @param {string} schemaDir - Directory containing schema files
 * @param {boolean} verbose - Whether to show detailed schema information
 * @returns {boolean} True if all schemas are valid
 */
function validateSchemas(schemaDir = null, verbose = false) {
  const defaultSchemaDir = path.join(__dirname, '..', 'src', 'jsonschema');
  const targetDir = schemaDir || defaultSchemaDir;
  
  console.log(`${colors.bold}${colors.blue}=== Validating JSON Schema files in ${targetDir} ===${colors.reset}`);
  
  // Initialize validator with meta-schema support
  const ajv = createValidator();
  
  // Find schema files
  const schemaFiles = findJsonFiles(targetDir).filter(file => 
    file.endsWith('.schema.json') || file.endsWith('.json')
  );
  
  console.log(`Found ${schemaFiles.length} schema files`);
  
  let allValid = true;
  
  for (const schemaFile of schemaFiles) {
    try {
      const fileName = path.basename(schemaFile);
      console.log(`\n${colors.bold}Validating schema: ${fileName}${colors.reset}`);
      
      // Load and parse schema
      const schema = loadSchemaFile(schemaFile);
      if (!schema) {
        allValid = false;
        continue;
      }
      
      // Validate schema structure using AJV's meta-schema validation
      const isValid = ajv.validateSchema(schema);
      
      if (!isValid) {
        console.error(`${colors.red}❌ Invalid schema structure in ${fileName}:${colors.reset}`);
        if (ajv.errors) {
          for (const error of ajv.errors) {
            console.error(`  - ${error.message} at ${error.instancePath}`);
          }
        }
        allValid = false;
      } else {
        console.log(`${colors.green}✓ ${fileName} is a valid JSON Schema${colors.reset}`);
        
        // Show verbose information if requested
        if (verbose) {
          displayVerboseSchemaInfo(schema, fileName);
        }
      }
      
    } catch (err) {
      console.error(`${colors.red}❌ Error validating schema ${schemaFile}: ${err.message}${colors.reset}`);
      allValid = false;
    }
  }
  
  return allValid;
}

// Run validation if script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const targetDir = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`${colors.bold}Schema Validator${colors.reset}`);
    console.log(`\nValidates JSON schema files for syntax and structure`);
    console.log(`\nUsage:`);
    console.log(`  node validate-schemas.js [schema-dir] [options]`);
    console.log(`\nOptions:`);
    console.log(`  --verbose, -v    Show detailed schema information including all fields, types, and enums`);
    console.log(`  --help, -h       Show this help message`);
    console.log(`\nDefault schema directory: src/jsonschema`);
    process.exit(0);
  }
  
  const success = validateSchemas(targetDir, verbose);
  
  printSummary(success, 'schema validation');
  process.exit(success ? 0 : 1);
}

module.exports = { validateSchemas };
