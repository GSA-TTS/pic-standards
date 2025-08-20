const fs = require('fs');
const path = require('path');
const { getAjv } = require('./ajv-factory');
const yaml = require('js-yaml');
const { 
  mapStatus, 
  mapDocumentType, 
  mapEngagementType, 
  mapEventStatus
} = require('./mapping-utils');
const colors = require('./colors');


/**
 * Shared validation utilities
 */
class ValidationUtils {
  constructor(options = {}) {
    this.isVerbose = options.verbose || process.argv.includes('--verbose');
  this.ajv = getAjv();
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
    const { findFiles } = require('./file-utils');
    return findFiles(searchDirs, extensions, excludePatterns);
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
          data[type].forEach((record) => {
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

  // printSummary removed (migrated to error-reporting module)

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

// Deprecated standalone functions removed (use ajv-factory and file-utils instead)

// Deprecated standalone printSummary removed in favor of error-reporting.printOperationSummary

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
  // Backwards-compatible helpers for legacy scripts/tests
  createValidator: function createValidator() {
    return getAjv();
  },
  loadSchemaFile: function loadSchemaFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`${colors.red}Error loading schema from ${filePath}: ${error.message}${colors.reset}`);
      return null;
    }
  },
  findJsonFiles: function findJsonFiles(dir) {
    const { findFiles } = require('./file-utils');
    return findFiles([dir], ['.json']);
  },
  validateJsonFile: function validateJsonFile(filePath, validator) {
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
  },
  colors,
  ensureDirectory,
  shouldIgnoreField
};
