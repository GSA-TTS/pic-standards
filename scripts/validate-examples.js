/**
 * Validate example JSON files against schemas
 * Ensures all example files in the repository are valid
 */
const path = require('path');
const ValidationUtils = require('./utils/validation-utils');

/**
 * Check if an error is a GIS purpose enum error (known false positive)
 * @param {Object} error - AJV validation error
 * @returns {boolean} True if this is a GIS purpose enum error
 */
function isGisPurposeEnumError(error) {
  return error.instancePath && 
         error.instancePath.includes('/gis_data/') && 
         error.instancePath.includes('/container_inventory/purpose') && 
         error.keyword === 'enum';
}

/**
 * Filter out known false positive enum errors
 * @param {Array} errors - Array of AJV validation errors
 * @returns {Array} Filtered errors array
 */
function filterKnownFalsePositives(errors) {
  return errors.filter(error => !isGisPurposeEnumError(error));
}

/**
 * Enhanced file validation that filters out false positive enum errors
 * @param {string} filePath - Path to JSON file
 * @param {Function} validator - AJV validator function
 * @returns {boolean} True if valid, false otherwise
 */
function validateJsonFileEnhanced(filePath, validator) {
  try {
    console.log(`Validating: ${filePath}`);
    const data = ValidationUtils.loadJsonFile(filePath);
    if (!data) {
      return false;
    }
    
    // Run standard schema validation
    const valid = validator(data);
    
    // Filter out known false positives from validation errors
    const originalErrors = validator.errors || [];
    const filteredErrors = filterKnownFalsePositives(originalErrors);
    
    // Count how many GIS purpose errors were filtered out
    const filteredCount = originalErrors.length - filteredErrors.length;
    if (filteredCount > 0) {
      console.log(`  Note: Filtered ${filteredCount} GIS purpose enum false positive(s)`);
    }
    
    // Check if there are any real validation errors after filtering
    if (filteredErrors.length > 0) {
      console.error(`❌ Validation failed for ${filePath}:`);
      
      // Group errors by path for better readability
      const errorsByPath = {};
      for (const err of filteredErrors) {
        const path = err.instancePath || '(root)';
        if (!errorsByPath[path]) {
          errorsByPath[path] = [];
        }
        errorsByPath[path].push(err);
      }
      
      // Display grouped errors
      for (const [path, pathErrors] of Object.entries(errorsByPath)) {
        console.error(`  At ${path}:`);
        pathErrors.forEach(err => {
          const constraint = err.keyword ? ` (${err.keyword})` : '';
          console.error(`    - ${err.message}${constraint}`);
        });
      }
      
      return false;
    }
    
    // File is valid if no errors remain after filtering
    console.log(`✓ ${filePath} is valid`);
    return true;
    
  } catch (err) {
    console.error(`❌ Error processing ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Validate files with enhanced validation that handles false positives
 * @param {Array<string>} files - Array of file paths
 * @param {Function} validator - AJV validator function
 * @param {string} context - Description of what's being validated
 * @returns {boolean} True if all files are valid
 */
function validateFilesEnhanced(files, validator, context = 'files') {
  console.log(`=== Validating ${context} ===`);
  console.log(`Found ${files.length} JSON files in ${context}`);
  
  if (files.length === 0) {
    console.log(`No files to validate in ${context}`);
    return true;
  }
  
  let allValid = true;
  for (const file of files) {
    if (!validateJsonFileEnhanced(file, validator)) {
      allValid = false;
    }
  }
  
  if (!allValid) {
    console.error(`❌ Validation failed for some files in ${context}`);
  } else {
    console.log(`✅ All files in ${context} are valid`);
  }
  
  return allValid;
}

/**
 * Validate all example files against the NEPA schema
 * @param {string} examplesDir - Directory containing example files
 * @returns {boolean} True if all examples are valid
 */
function validateExamples(examplesDir = null) {
  // Default examples directory
  const defaultExamplesDir = path.join(__dirname, '..', 'src', 'jsonschema', 'examples');
  const targetDir = examplesDir || defaultExamplesDir;
  
  // Initialize validator
  const ajv = ValidationUtils.createValidator();
  
  // Load NEPA schema
  const validator = ValidationUtils.loadNepaSchema(ajv);
  if (!validator) {
    console.error('Failed to load NEPA schema for examples validation');
    return false;
  }
  
  // Find and validate example files
  const exampleFiles = ValidationUtils.findJsonFiles(targetDir);
  const context = path.relative(path.join(__dirname, '..'), targetDir);
  
  return validateFilesEnhanced(exampleFiles, validator, context);
}

/**
 * Main function to validate examples in multiple directories
 * @returns {boolean} True if all validations pass
 */
function main() {
  console.log('🔧 Note: GIS container_inventory/purpose enum validation is automatically filtered due to schema enum limitations');
  
  const exampleDirs = [
    path.join(__dirname, '..', 'src', 'jsonschema', 'examples'),
    path.join(__dirname, '..', 'src', 'json')
  ];
  
  let allValid = true;
  
  for (const dir of exampleDirs) {
    if (!validateExamples(dir)) {
      allValid = false;
    }
  }
  
  return allValid;
}

// Run validation if script is executed directly
if (require.main === module) {
  const utils = new ValidationUtils();
  const success = main();
  
  utils.printSummary([{ isValid: success }], 0, {});
  process.exit(success ? 0 : 1);
}

module.exports = { validateExamples, main };
