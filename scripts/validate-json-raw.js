/**
 * Raw JSON validation script using AJV directly
 * Validates JSON files against NEPA schema with minimal processing
 */
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Raw JSON validation using AJV directly
 */
async function validateJsonRaw() {
  console.log('🔍 Starting Raw JSON validation...');
  
  // Create AJV instance with formats
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  
  // Load NEPA schema
  const schemaPath = path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    console.log(`📋 Schema loaded: ${schemaPath}`);
  } catch (error) {
    console.error(`${colors.red}Error loading schema: ${error.message}${colors.reset}`);
    process.exit(1);
  }
  
  // Compile validator
  const validate = ajv.compile(schema);
  
  // Search directories for JSON files
  const searchDirs = [
    path.join(__dirname, '../src/json'),
    path.join(__dirname, '../src/sample-data'),
    path.join(__dirname, '../examples'),
    path.join(__dirname, '../test/data'),
    path.join(__dirname, '../data')
  ];
  
  // Find JSON files
  const jsonFiles = findFiles(searchDirs, ['.json'], ['schema', 'package', 'lock']);
  console.log(`📁 Found ${jsonFiles.length} JSON files to validate`);
  
  if (jsonFiles.length === 0) {
    console.log('✅ No JSON files found to validate');
    return;
  }
  
  // Track validation results
  const results = [];
  
  // Entity types to look for in data files
  const entityTypes = [
    'projects', 'processes', 'documents', 'public_comments', 
    'public_engagement_events', 'case_events', 'gis_data',
    'gis_data_elements', 'user_roles', 'legal_structures', 
    'decision_elements', 'process_models', 'decision_payloads',
    // Also look for database naming variants
    'process_instance', 'comment', 'engagement'
  ];
  
  // Validate each file
  for (const filePath of jsonFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`\n📄 Validating: ${relativePath}`);
    
    try {
      // Parse JSON file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // First show what entities are found in the file
      console.log(`\n${colors.cyan}=== Entities in File ===${colors.reset}`);
      
      // Display top-level keys in the file
      console.log(`${colors.cyan}Top-Level Keys:${colors.reset}`);
      Object.keys(data).forEach(key => {
        const value = data[key];
        const type = typeof value;
        if (Array.isArray(value)) {
          console.log(`  ${key}: array with ${value.length} items`);
        } else {
          console.log(`  ${key}: ${type}`);
        }
      });
      
      // Display detailed entity information
      console.log(`\n${colors.cyan}Entity Details:${colors.reset}`);
      entityTypes.forEach(entityType => {
        const entities = data[entityType];
        if (Array.isArray(entities) && entities.length > 0) {
          console.log(`\n  ${colors.green}${entityType}:${colors.reset} ${entities.length} records`);
          
          // Show first entity details (truncated for readability)
          const firstEntity = entities[0];
          console.log(`  First entity properties:`);
          Object.entries(firstEntity).forEach(([key, value]) => {
            const valueType = typeof value;
            const valueDisplay = valueType === 'object' ? 
              (value === null ? 'null' : Array.isArray(value) ? `Array(${value.length})` : 'Object') : 
              JSON.stringify(value).substring(0, 50);
            console.log(`    - ${key}: ${valueType} = ${valueDisplay}`);
          });
          
          if (entities.length > 1) {
            console.log(`    ... and ${entities.length - 1} more entities`);
          }
        }
      });
      
      // Validate against schema
      const isValid = validate(data);
      
      if (isValid) {
        console.log(`\n${colors.green}✅ Valid${colors.reset}`);
        results.push({ filePath: relativePath, isValid: true, errors: [] });
      } else {
        console.log(`\n${colors.red}❌ Invalid${colors.reset}`);
        const errors = validate.errors || [];
        results.push({ filePath: relativePath, isValid: false, errors });
        
        // Print errors
        console.log(`${colors.red}=== Validation Errors ===${colors.reset}`);
        errors.forEach((error, index) => {
          const pathStr = error.instancePath || '(root)';
          console.error(`  ${colors.yellow}Error ${index + 1}:${colors.reset} at ${pathStr}`);
          console.error(`    Message: ${error.message}`);
          
          if (error.keyword === 'required') {
            console.error(`    Missing property: ${colors.magenta}${error.params.missingProperty}${colors.reset}`);
          } else if (error.keyword === 'type') {
            console.error(`    Expected type: ${colors.magenta}${error.params.type}${colors.reset}`);
            
            // Try to show the problematic value
            try {
              const dataAtPath = getDataAtPath(data, pathStr);
              console.error(`    Actual value: ${truncateValue(dataAtPath)}`);
            } catch (err) {
              // Skip if we can't access the path
            }
          }
        });
      }
    } catch (error) {
      console.error(`${colors.red}Error processing ${relativePath}: ${error.message}${colors.reset}`);
      results.push({ filePath: relativePath, isValid: false, errors: [{ message: error.message }] });
    }
  }
  
  // Print summary
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  console.log(`✅ Valid files: ${validCount}`);
  console.log(`❌ Invalid files: ${invalidCount}`);
  
  // Exit with appropriate code
  process.exit(invalidCount === 0 ? 0 : 1);
}

/**
 * Find files matching extensions and not matching exclude patterns
 */
function findFiles(searchDirs, extensions, excludePatterns = []) {
  const files = [];
  
  const findInDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findInDir(fullPath);
      } else {
        const hasValidExtension = extensions.some(ext => item.endsWith(ext));
        const isExcluded = excludePatterns.some(pattern => item.includes(pattern));
        
        if (hasValidExtension && !isExcluded && !item.startsWith('.')) {
          files.push(fullPath);
        }
      }
    }
  };

  searchDirs.forEach(dir => findInDir(dir));
  return files;
}

/**
 * Get data at a specific JSON path
 * @param {object} data - The data object
 * @param {string} path - JSON path (e.g., /foo/0/bar)
 */
function getDataAtPath(data, path) {
  if (!path || path === '' || path === '/') return data;
  
  const parts = path.split('/').filter(p => p !== '');
  let current = data;
  
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Truncate a value for display
 */
function truncateValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  
  const type = typeof value;
  if (type === 'object') {
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    try {
      const json = JSON.stringify(value);
      return json.length > 100 ? json.substring(0, 97) + '...' : json;
    } catch (e) {
      return '[Complex Object]';
    }
  }
  
  const str = String(value);
  return str.length > 100 ? str.substring(0, 97) + '...' : str;
}

// Run if called directly
if (require.main === module) {
  validateJsonRaw().catch(err => {
    console.error(`${colors.red}Unhandled error: ${err.message}${colors.reset}`);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = validateJsonRaw;
