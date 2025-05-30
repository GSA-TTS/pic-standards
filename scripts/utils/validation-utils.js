const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const { 
  mapStatus, 
  mapDocumentType, 
  mapEngagementType, 
  mapEventStatus,
  mapEntityId 
} = require('./mapping-utils');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Shared validation utilities
 */
class ValidationUtils {
  constructor(options = {}) {
    this.isVerbose = options.verbose || process.argv.includes('--verbose');
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: options.strict !== false
    });
    addFormats(this.ajv);
  }

  log(message, level = 'info') {
    if (level === 'error' || this.isVerbose) {
      console.log(message);
    }
  }

  loadSchema(schemaPath) {
    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      return this.ajv.compile(schema);
    } catch (error) {
      throw new Error(`Failed to load schema from ${schemaPath}: ${error.message}`);
    }
  }

  findFiles(searchDirs, extensions, excludePatterns = []) {
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

  parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return yaml.load(content);
    } else if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported file type: ${filePath}`);
    }
  }

  validateFile(filePath, validator, transformer = null) {
    const relativePath = path.relative(process.cwd(), filePath);
    this.log(`\n📄 Validating: ${relativePath}`);

    try {
      let data = this.parseFile(filePath);
      
      if (transformer) {
        data = transformer(data);
      }

      const isValid = validator(data);
      
      return {
        isValid,
        data,
        errors: validator.errors || [],
        filePath: relativePath
      };
    } catch (error) {
      return {
        isValid: false,
        data: null,
        errors: [{ message: error.message }],
        filePath: relativePath
      };
    }
  }

  countRecords(data, recordTypes) {
    const counts = {};
    let total = 0;

    recordTypes.forEach(type => {
      if (data[type] && Array.isArray(data[type])) {
        const count = data[type].length;
        counts[type] = count;
        total += count;

        if (this.isVerbose) {
          this.log(`  ${type}: ${count} records`); // Removed "📊" symbol
          data[type].forEach((record, index) => {
            // const identifier = this.getRecordIdentifier(record, index); // Removed Record Identifier line
            // this.log(`    • Record Identifier: ${identifier}`); // Removed Record Identifier line
            Object.entries(record).forEach(([key, value]) => {
              const valueType = typeof value;
              this.log(`      - Key: "${colors.cyan}${key}${colors.reset}", Type: ${colors.yellow}${valueType}${colors.reset}`); // Removed Value part
            });
          });
        }
      }
    });

    return { counts, total };
  }

  getRecordIdentifier(record, index) {
    const idFields = [
      'id', 'project_id', 'process_id', 'document_id', 'case_event_id',
      'comment_id', 'event_id', 'gis_id', 'role_id', 'legal_structure_id',
      'decision_element_id', 'process_model_id', 'decision_payload_id'
    ];

    for (const field of idFields) {
      if (record[field]) return record[field];
    }

    return `item-${index}`;
  }

  /**
   * Retrieves a value from an object using a JSON Pointer.
   * @param {Object} data - The data object to traverse.
   * @param {string} pointer - The JSON Pointer string (e.g., "/path/to/value" or "#/path/to/value").
   * @returns {*} The value at the pointer's location, or undefined if the path is invalid.
   * @private
   */
  _getValueByJsonPointer(data, pointer) {
    if (pointer === '' || pointer === '#') {
      return data;
    }

    const path = pointer.startsWith('#/') ? pointer.substring(2) : (pointer.startsWith('/') ? pointer.substring(1) : pointer);
    if (path === '') return data;

    const parts = path.split('/');
    let current = data;

    for (const part of parts) {
      const decodedPart = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, decodedPart)) {
        return undefined;
      }
      current = current[decodedPart];
    }
    return current;
  }

  printSummary(results, totalRecords = 0, recordCounts = {}) {
    const validFiles = results.filter(r => r.isValid).length;
    const invalidFiles = results.length - validFiles;

    this.log('\n📊 VALIDATION SUMMARY');
    this.log('='.repeat(50));
    this.log(`📁 Files processed: ${results.length}`);
    this.log(`✅ Valid files: ${validFiles}`);
    this.log(`❌ Invalid files: ${invalidFiles}`);
    
    if (totalRecords > 0) {
      this.log(`📋 Total records: ${totalRecords}`);
    }

    if (Object.keys(recordCounts).length > 0) {
      this.log('\n📊 Records by type:');
      Object.entries(recordCounts).forEach(([type, count]) => {
        this.log(`  ${type}: ${count}`);
      });
    }

    // Print errors for invalid files
    results.filter(r => !r.isValid).forEach(result => {
      this.log(`\n❌ ${colors.red}File: ${result.filePath}${colors.reset}`, 'error');
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          const instancePath = error.instancePath || '';
          const key = instancePath.split('/').pop() || (instancePath === '' ? 'root' : 'unknown');
          
          const actualValue = result.data !== null ? this._getValueByJsonPointer(result.data, instancePath) : error.data; // error.data can be a fallback
          const actualType = typeof actualValue;

          let expectedType = 'N/A';
          if (error.keyword === 'type' && error.params && error.params.type) {
            expectedType = Array.isArray(error.params.type) ? error.params.type.join('|') : error.params.type;
          } else if (error.parentSchema && error.parentSchema.type) {
            expectedType = Array.isArray(error.parentSchema.type) ? error.parentSchema.type.join('|') : error.parentSchema.type;
          }

          this.log(`  ${colors.yellow}Error at ${instancePath || '(root)'}:${colors.reset} ${error.message}`, 'error');
          
          if (error.keyword === 'required') {
            this.log(`    ${colors.cyan}Missing Key:${colors.reset} "${error.params.missingProperty}"`, 'error');
          } else if (error.keyword === 'additionalProperties') {
            this.log(`    ${colors.cyan}Unexpected Key:${colors.reset} "${error.params.additionalProperty}"`, 'error');
          } else {
            this.log(`    ${colors.cyan}Field Key:${colors.reset} "${key}"`, 'error');
            try {
              const valueStr = JSON.stringify(actualValue, null, 2);
              if (valueStr && valueStr.length > 100) { // Truncate long values
                this.log(`    ${colors.cyan}Actual Value:${colors.reset} ${valueStr.substring(0, 100)}... (Type: ${actualType})`, 'error');
              } else {
                this.log(`    ${colors.cyan}Actual Value:${colors.reset} ${valueStr} (Type: ${actualType})`, 'error');
              }
            } catch (e) { // Handle circular structures or other stringify errors
                 this.log(`    ${colors.cyan}Actual Value:${colors.reset} [Could not stringify] (Type: ${actualType})`, 'error');
            }
            this.log(`    ${colors.cyan}Expected Schema Type:${colors.reset} ${expectedType}`, 'error');
          }
          
          if (this.isVerbose) {
            this.log(`    ${colors.magenta}AJV Keyword:${colors.reset} ${error.keyword}`, 'error');
            this.log(`    ${colors.magenta}AJV Params:${colors.reset} ${JSON.stringify(error.params)}`, 'error');
            // this.log(`    AJV Schema Path: ${error.schemaPath}`, 'error'); // Can be very verbose
          }
          this.log('    ---', 'error'); // Separator for multiple errors
        });
      } else if (result.errors && result.errors.length === 0) {
        // This case should ideally not happen if !isValid, but as a fallback:
        this.log(`  ${colors.yellow}File is invalid, but no specific AJV errors were reported. General parsing or transformation error likely.`, 'error');
      } else {
         // If result.errors is not an array (e.g. a single error string from parseFile)
         this.log(`  ${colors.red}Error:${colors.reset} ${result.errors.message || JSON.stringify(result.errors)}`, 'error');
      }
    });

    return invalidFiles === 0;
  }

  // Mapping utility functions (delegated to mapping-utils)
  mapStatus(status) {
    return mapStatus(status);
  }

  mapDocumentType(type) {
    return mapDocumentType(type);
  }

  mapEngagementType(type) {
    return mapEngagementType(type);
  }

  mapEventStatus(status) {
    return mapEventStatus(status);
  }
}

// Standalone utility functions for backward compatibility
function createValidator() {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false
  });
  addFormats(ajv);
  return ajv;
}

function loadSchemaFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading schema from ${filePath}: ${error.message}${colors.reset}`);
    return null;
  }
}

function findJsonFiles(dir) {
  const files = [];
  
  function findInDir(directory) {
    if (!fs.existsSync(directory)) return;
    
    const items = fs.readdirSync(directory);
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findInDir(fullPath);
      } else if (item.endsWith('.json') && !item.startsWith('.')) {
        files.push(fullPath);
      }
    }
  }
  
  findInDir(dir);
  return files;
}

function validateJsonFile(filePath, validator) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const isValid = validator(data);
    
    return {
      isValid,
      data,
      errors: validator.errors || [],
      filePath
    };
  } catch (error) {
    return {
      isValid: false,
      data: null,
      errors: [{ message: error.message }],
      filePath
    };
  }
}

function printSummary(success, operation) {
  if (success) {
    console.log(`\n${colors.green}✅ ${operation} completed successfully${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ ${operation} completed with errors${colors.reset}`);
  }
}

/**
 * Ensure directory exists, creates it if not.
 * @param {string} dirPath - Path to the directory.
 * @returns {boolean} True if directory exists or was created, false otherwise.
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      // console.log(`Created directory: ${dirPath}`); // Optional: for logging
      return true;
    } catch (err) {
      console.error(`Error creating directory ${dirPath}: ${err.message}`);
      return false;
    }
  }
  return true;
}

/**
 * Check if a field should be ignored during validation
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if field should be ignored
 */
function shouldIgnoreField(fieldName) {
  // System fields that should always be ignored
  const systemFields = [
    'created_at', 'updated_at', '_id', 'other', 'notes'
    // Removed 'id' from here since it's the primary key that maps to entity IDs
  ];
  
  // Parent relationship fields (these are implementation details)
  const parentFields = [
    'parent_project_id', 'parent_process_id', 'parent_document_id',
    'parent_comment_id', 'parent_event_id', 'parent_engagement_id', 
    'parent_case_event_id'
  ];
  
  // Check explicit lists first
  if (systemFields.includes(fieldName) || parentFields.includes(fieldName)) {
    return true;
  }
  
  // Pattern-based ignoring (but don't ignore the main 'id' field)
  return fieldName.startsWith('_') || 
         fieldName.includes('_json') ||
         (fieldName.endsWith('_id') && fieldName.startsWith('parent_'));
}

module.exports = {
  ValidationUtils,
  createValidator,
  loadSchemaFile,
  findJsonFiles,
  validateJsonFile,
  printSummary,
  colors,
  ensureDirectory,
  shouldIgnoreField
};
