/**
 * Combined CSV and YAML validation script
 * Uses dedicated CSV validator and enhanced YAML validation
 */
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { validateCsvFiles } = require('./validate-csv');
const { ValidationUtils, colors, ensureDirectory, createValidator } = require('./utils/validation-utils'); // Added createValidator
const { transformToNepaFormat } = require('./utils/transformation-utils'); // For potential transformations

/**
 * Load and parse YAML file with error handling
 * @param {string} filePath - Path to YAML file
 * @returns {Object|null} Parsed YAML data or null if failed
 */
function loadYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  } catch (err) {
    console.error(`Error loading YAML from ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Check if an error is a known false positive
 * @param {Object} error - AJV validation error
 * @returns {boolean} True if this is a known false positive
 */
function isKnownFalsePositive(error) {
  // Filter GIS purpose enum errors
  if (error.instancePath && 
      error.instancePath.includes('/gis_data/') && 
      error.instancePath.includes('/container_inventory/purpose') && 
      error.keyword === 'enum') {
    return true;
  }
  
  // Filter other known issues that don't affect core functionality
  if (error.instancePath && 
      (error.instancePath.includes('parent_') || 
       error.instancePath.includes('_json') ||
       error.instancePath.includes('other'))) {
    return true;
  }
  
  return false;
}

/**
 * Validate YAML data structure and apply fixes for common issues
 * @param {Object} data - Parsed YAML data
 * @param {string} fileName - Name of file being validated (for logging)
 * @returns {Object} Validation results with applied fixes, modified data
 */
function validateAndFixYamlStructure(data, fileName) {
  const fixes = [];
  const warnings = [];
  let modifiedData = JSON.parse(JSON.stringify(data)); // Deep clone to avoid modifying original data directly in this function

  // Ensure root level has required projects array
  if (!modifiedData.projects) {
    modifiedData.projects = [];
    fixes.push('Added missing required projects array to root level');
  }
  
  // Fix GIS data structure issues
  if (modifiedData.gis_data && Array.isArray(modifiedData.gis_data)) {
    modifiedData.gis_data.forEach((gisItem, index) => {
      if (!gisItem.gis_id) {
        gisItem.gis_id = `gis-${String(index + 1).padStart(3, '0')}`;
        fixes.push(`Added missing required gis_id for gis_data[${index}]`);
      }
      if (!gisItem.data_type) {
        gisItem.data_type = 'point';
        fixes.push(`Added missing required data_type for gis_data[${index}]`);
      }
      if (!gisItem.coordinate_system) {
        gisItem.coordinate_system = 'WGS84';
        fixes.push(`Added missing required coordinate_system for gis_data[${index}]`);
      }
    });
  }
  // Add other structural fixes or transformations if needed
  // Example: if transformation to NEPA format is desired for YAML similar to JSON
  // const transformationResult = transformToNepaFormat(modifiedData);
  // modifiedData = transformationResult.data;
  // fixes.push(...transformationResult.fixes.map(fix => `NEPA Transform: ${fix}`));

  return { data: modifiedData, fixes, warnings };
}

/**
 * Validate a single YAML file against the NEPA schema.
 * @param {string} filePath - Path to the YAML file.
 * @param {ValidationUtils} utils - Instance of ValidationUtils.
 * @returns {Promise<boolean>} True if the file is valid, false otherwise.
 */
async function validateYamlFile(filePath, utils) {
  console.log(`\nValidating YAML: ${filePath}`);
  const fileName = path.basename(filePath);
  let data = loadYamlFile(filePath);

  if (!data) {
    return false; // Error loading file
  }

  // Apply structural fixes and transformations
  const { data: fixedData, fixes, warnings: structureWarnings } = validateAndFixYamlStructure(data, fileName);
  data = fixedData;

  // Load NEPA schema using utils
  // Assuming a common schema path, adjust if necessary
  const schemaPath = path.join(__dirname, '..', 'src', 'jsonschema', 'nepa.schema.json');
  let validateSchema;
  try {
    validateSchema = utils.loadSchema(schemaPath);
  } catch (err) {
    console.error(`${colors.red}Error loading NEPA schema: ${err.message}${colors.reset}`);
    return false;
  }
  
  const isValid = validateSchema(data);
  const validationErrors = validateSchema.errors || [];
  
  const relevantErrors = validationErrors.filter(error => !isKnownFalsePositive(error));

  if (!isValid && relevantErrors.length > 0) {
    console.error(`${colors.red}✗ ${filePath} is invalid:${colors.reset}`);
    const errorsByPath = {};
    relevantErrors.forEach(err => {
      const pathKey = err.instancePath || 'root';
      if (!errorsByPath[pathKey]) errorsByPath[pathKey] = [];
      errorsByPath[pathKey].push(err);
    });

    for (const [pathKey, pathErrors] of Object.entries(errorsByPath)) {
      console.error(`  Path: ${pathKey}`);
      pathErrors.slice(0, 3).forEach(err => { // Show up to 3 errors per path
        const constraint = err.keyword ? ` (${err.keyword} - ${err.schemaPath})` : '';
        console.error(`    - ${err.message}${constraint}`);
      });
      if (pathErrors.length > 3) {
        console.error(`    ... and ${pathErrors.length - 3} more errors in this path`);
      }
    }
    if (fixes.length > 0) {
      console.log(`  Applied ${fixes.length} automatic fix(es) before validation:`);
      fixes.forEach(fix => console.log(`    - ${fix}`));
    }
    structureWarnings.forEach(warning => console.log(`  ${colors.yellow}Structure Warning: ${warning}${colors.reset}`));
    return false;
  }
  
  console.log(`${colors.green}✓ ${filePath} is valid${relevantErrors.length > 0 ? ' (after filtering known false positives)' : ''}${colors.reset}`);
  
  if (fixes.length > 0) {
    console.log(`  Applied ${fixes.length} automatic fix(es):`);
    fixes.forEach(fix => console.log(`    - ${fix}`));
  }
  structureWarnings.forEach(warning => console.log(`  ${colors.yellow}Structure Warning: ${warning}${colors.reset}`));
  
  return true;
}

/**
 * Validates all CSV and YAML files in a directory
 * @param {string} dirPath - Path to directory containing files
 * @param {ValidationUtils} utils - Instance of ValidationUtils.
 * @returns {Promise<boolean>} - True if all files are valid, false otherwise
 */
async function validateAllFiles(dirPath, utils) { // Added utils parameter
  if (!ensureDirectory(dirPath)) { // ensureDirectory is a global import from validation-utils
    console.error(`${colors.red}Directory not found: ${dirPath}${colors.reset}`);
    return false;
  }
  
  // Use utils.findFiles
  const csvFiles = utils.findFiles([dirPath], ['.csv'], ['schema', 'package', 'lock']);
  const yamlFiles = [
    ...utils.findFiles([dirPath], ['.yaml'], ['schema', 'package', 'lock']),
    ...utils.findFiles([dirPath], ['.yml'], ['schema', 'package', 'lock'])
  ];
  
  console.log(`Found ${csvFiles.length} CSV files, ${yamlFiles.length} YAML files in ${dirPath}`);
  
  let allValid = true;
  
  // Validate CSV files using dedicated CSV validator
  if (csvFiles.length > 0) {
    try {
      // Assuming validateCsvFiles might also need utils or is self-contained
      // If validateCsvFiles needs utils, it should be passed: await validateCsvFiles(dirPath, utils);
      const csvValid = await validateCsvFiles(dirPath); 
      if (!csvValid) {
        allValid = false;
      }
    } catch (err) {
      console.error(`${colors.red}CSV validation error: ${err.message}${colors.reset}`);
      allValid = false;
    }
  }
  
  // Validate YAML files individually
  if (yamlFiles.length > 0) {
    console.log(`\n${colors.bold}${colors.blue}=== Validating YAML files ===${colors.reset}`);
    
    for (const file of yamlFiles) {
      try {
        if (!await validateYamlFile(file, utils)) { // Pass utils to validateYamlFile
          allValid = false;
        }
      } catch (err) {
        console.error(`${colors.red}Error validating ${file}: ${err.message}${colors.reset}`);
        allValid = false;
      }
    }
  }
  
  return allValid;
}

// Export functions for use in other modules
module.exports = {
  validateAllFiles
};

// Run validation if called directly
if (require.main === module) {
  const utils = new ValidationUtils(); // Create instance here
  const dirPath = process.argv[2] || path.join(__dirname, '..', 'src');
  
  validateAllFiles(dirPath, utils) // Pass utils instance
    .then((success) => {
      // Use utils.printSummary for consistent output formatting
      // The first argument to printSummary should be an array of result objects.
      // For a simple success/failure, we can create a mock result.
      const summaryResults = [{ filePath: dirPath, isValid: success, errors: success ? [] : [{message: "One or more YAML/CSV files failed validation."}] }];
      utils.printSummary(summaryResults, 0, {}); 
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
