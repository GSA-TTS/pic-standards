/**
 * Dedicated CSV validation script for NEPA schema compliance
 * Handles multiple CSV files by concatenating them to meet schema requirements
 */
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const {
  createValidator,
  loadNepaSchema,
  ensureDirectory,
  findFiles,
  colors,
  PATHS,
  printSummary
} = require('./utils/validation-utils');

/**
 * Schema section mappings - maps CSV filenames to NEPA schema sections
 */
const SCHEMA_MAPPINGS = {
  'project.csv': 'projects',
  'process_instance.csv': 'processes', 
  'document.csv': 'documents',
  'case_event.csv': 'case_events',
  'comment.csv': 'public_comments',
  'public_comment.csv': 'public_comments',
  'engagement.csv': 'public_engagement_events',
  'engagement_event.csv': 'public_engagement_events',
  'gis_data.csv': 'gis_data',
  'gis_data_element.csv': 'gis_data_elements',
  'legal_structure.csv': 'legal_structures',
  'decision_element.csv': 'decision_elements',
  'decision_payload.csv': 'decision_payloads',
  'process_decision_payload.csv': 'decision_payloads',
  'process_model.csv': 'models',
  'user_role.csv': 'user_roles'
};

/**
 * Field mappings from CSV column names to schema property names (now snake_case)
 */
const FIELD_MAPPINGS = {
  // Common mappings - all now snake_case
  'title': 'project_title', // For projects
  'description': 'project_description',
  'sector': 'project_sector',
  'lead_agency': 'lead_agency',
  'sponsor': 'project_sponsor',
  'sponsor_contact': 'contact_info',
  'location_text': 'location',
  
  // Process specific
  'parent_project_id': 'project_id',
  'type': 'process_type',
  'status': 'process_status',
  
  // Document specific
  'parent_process_id': 'process_id',
  'document_type': 'document_type',
  'prepared_by': 'prepared_by',
  'publish_date': 'publish_date',
  'public_access': 'accessibility',
  'document_summary': 'document_summary',
  'document_toc': 'document_toc',
  'title': 'title', // For documents - keep as title
  
  // Comment specific
  'commenter_entity': 'commenter_name',
  'content_text': 'content',
  'date_submitted': 'date_submitted',
  'submission_method': 'method_of_submission',
  'response_text': 'agency_response',
  'public_source': 'privacy_level',
  'public_acess': 'privacy_level',
  'parent_document_id': 'related_document_id',
  
  // Engagement specific
  'parent_process_id': 'related_process_id',
  'start_datetime': 'date',
  
  // Case Event specific
  'name': 'event_name',
  'datetime': 'event_date',
  'type': 'event_type', // For case events
  
  // GIS Data specific
  'parent_project_id': 'project_id',
  'centroid_lat': 'centroid_lat',
  'centroid_lon': 'centroid_lon',
  'creator_contact': 'contact_information',
  'updated_last': 'last_updated',
  
  // Legal Structure specific
  'issuing_authority': 'issuing_authority',
  'effective_date': 'effective_date',
  'compliance_data': 'compliance_requirements'
};

/**
 * Get appropriate ID field mapping based on schema section (now snake_case)
 */
function getIdFieldMapping(schemaSection) {
  const idMappings = {
    'projects': 'project_id',
    'processes': 'process_id',
    'documents': 'document_id',
    'public_comments': 'comment_id',
    'public_engagement_events': 'event_id',
    'case_events': 'case_event_id',
    'gis_data': 'gis_id',
    'gis_data_elements': 'gis_element_id',
    'legal_structures': 'legal_structure_id',
    'decision_elements': 'decision_element_id',
    'decision_payloads': 'decision_payload_id',
    'models': 'process_model_id',
    'user_roles': 'role_id'
  };
  
  return idMappings[schemaSection] || 'id';
}

/**
 * Transform CSV field names to match schema expectations
 */
function transformFieldNames(data, schemaSection) {
  const transformed = {};
  const idField = getIdFieldMapping(schemaSection);

  Object.keys(data).forEach(key => {
    let newKey = key;
    let value = data[key];

    // Handle CSV id → schema section ID
    if (key === 'id') {
      newKey = idField;
    }
    // parent_process_id → related_process_id (engagement) or process_id (others), but not in 'processes' section
    else if (key === 'parent_process_id' && schemaSection !== 'processes') {
      if (schemaSection === 'public_engagement_events') {
        newKey = 'related_process_id';
      } else {
        newKey = 'process_id';
      }
    }
    // parent_project_id → project_id, but skip in 'projects' section
    else if (key === 'parent_project_id' && schemaSection !== 'projects') {
      newKey = 'project_id';
    }
    else if (FIELD_MAPPINGS[key]) {
      newKey = FIELD_MAPPINGS[key];
    }
    
    // Special handling for context-sensitive fields
    if (key === 'type') {
      if (schemaSection === 'case_events') {
        newKey = 'event_type';
      } else if (schemaSection === 'processes') {
        newKey = 'process_type';
      } else if (schemaSection === 'public_engagement_events') {
        newKey = 'type';
      }
    }
    
    if (key === 'title') {
      if (schemaSection === 'projects') {
        newKey = 'project_title';
      } else {
        newKey = 'title'; // For documents, legal structures, etc.
      }
    }
    
    if (key === 'description') {
      if (schemaSection === 'projects') {
        newKey = 'project_description';
      } else {
        newKey = 'description';
      }
    }
    
    // Convert values - ALWAYS convert IDs and most fields to strings
    if (value === 'null' || value === '') {
      // For required string fields, use empty string instead of null
      const requiredStringFields = ['source', 'tier', 'outcome', 'notes', 'url', 'extent'];
      if (requiredStringFields.includes(key)) {
        value = '';
      } else {
        value = null;
      }
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (value !== null) {
      // Convert ALL values to strings first, then handle special numeric cases
      value = String(value);
      
      // Only convert specific numeric fields to numbers
      const numericFields = ['attendance', 'centroid_lat', 'centroid_lon'];
      if (numericFields.includes(key)) {
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
          value = key.includes('lat') || key.includes('lon') ? parseFloat(value) : parseInt(value);
        }
      }
      // All other fields including IDs remain as strings
    }
    
    // Handle special object transformations
    if (newKey === 'project_sponsor' && typeof value === 'string') {
      // Transform string to object format expected by schema
      transformed[newKey] = {
        name: value,
        contact_info: data['sponsor_contact'] || ''
      };
      return; // Skip adding this field again
    }
    
    if (newKey === 'location' && typeof value === 'string' && schemaSection === 'projects') {
      // Transform string to object format
      transformed[newKey] = {
        description: value
      };
      return;
    }
    
    if (newKey === 'location' && typeof value === 'string' && schemaSection === 'public_engagement_events') {
      // Transform string to object format
      transformed[newKey] = {
        name: value,
        address: value
      };
      return;
    }
    
    // Format dates properly
    if (newKey === 'date' && value) {
      // Convert datetime to date format (YYYY-MM-DD)
      if (value.includes(' ')) {
        value = value.split(' ')[0];
      }
    }
    
    transformed[newKey] = value;
  });

  return transformed;
}

/**
 * Parse a single CSV file and return the data
 * @param {string} filePath - Path to CSV file
 * @param {string} schemaSection - Schema section this data belongs to
 * @returns {Promise<Array>} Parsed CSV data
 */
function parseCsvFile(filePath, schemaSection = null) {
  return new Promise((resolve, reject) => {
    const results = [];
    let headerRow = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('headers', (headers) => {
        headerRow = headers;
      })
      .on('data', (data) => {
        const transformed = transformFieldNames(data, schemaSection);
        results.push(transformed);
      })
      .on('end', () => {
        console.log(`${colors.blue}Parsed ${path.basename(filePath)}:${colors.reset} ${results.length} rows, ${headerRow.length} columns`);
        resolve(results);
      })
      .on('error', (err) => {
        console.error(`${colors.red}Error parsing ${filePath}:${colors.reset} ${err.message}`);
        reject(err);
      });
  });
}

/**
 * Get the schema section name for a CSV file
 * @param {string} filename - CSV filename
 * @returns {string|null} Schema section name or null if not mapped
 */
function getSchemaSection(filename) {
  const baseName = path.basename(filename).toLowerCase();
  return SCHEMA_MAPPINGS[baseName] || null;
}

/**
 * Combine multiple CSV files into a single NEPA-compliant data structure
 * @param {Array<string>} csvFiles - Array of CSV file paths
 * @returns {Promise<Object>} Combined data structure
 */
async function combineCsvFiles(csvFiles) {
  const combinedData = {};
  const processedFiles = [];
  
  console.log(`${colors.bold}${colors.blue}=== Combining CSV files for validation ===${colors.reset}`);
  
  for (const filePath of csvFiles) {
    try {
      const filename = path.basename(filePath);
      const schemaSection = getSchemaSection(filename);
      
      if (!schemaSection) {
        console.log(`${colors.yellow}Warning: No schema mapping for ${filename}, skipping${colors.reset}`);
        continue;
      }
      
      const data = await parseCsvFile(filePath, schemaSection);
      
      if (data.length > 0) {
        combinedData[schemaSection] = data;
        processedFiles.push(filename);
        console.log(`${colors.green}✓ Added ${data.length} records to ${schemaSection}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Warning: ${filename} is empty${colors.reset}`);
      }
      
    } catch (err) {
      console.error(`${colors.red}Error processing ${filePath}: ${err.message}${colors.reset}`);
      return null;
    }
  }
  
  console.log(`${colors.bold}Combined data from ${processedFiles.length} files:${colors.reset} ${processedFiles.join(', ')}`);
  console.log(`${colors.bold}Schema sections populated:${colors.reset} ${Object.keys(combinedData).join(', ')}`);
  
  return combinedData;
}

/**
 * Validate combined CSV data against NEPA schema
 * @param {Object} combinedData - Combined data from CSV files
 * @returns {boolean} True if valid
 */
function validateCombinedData(combinedData) {
  try {
    console.log(`\n${colors.bold}${colors.blue}=== Validating against NEPA schema ===${colors.reset}`);
    
    const ajv = createValidator();
    const validator = loadNepaSchema(ajv);
    
    if (!validator) {
      console.error(`${colors.red}Failed to load NEPA schema${colors.reset}`);
      return false;
    }
    
    const valid = validator(combinedData);
    
    if (!valid) {
      console.error(`${colors.red}${colors.bold}✘ Combined CSV data validation failed${colors.reset}`);
      formatValidationErrors(validator.errors);
      return false;
    }
    
    console.log(`${colors.green}${colors.bold}✓ Combined CSV data is valid against NEPA schema${colors.reset}`);
    return true;
    
  } catch (err) {
    console.error(`${colors.red}Validation error: ${err.message}${colors.reset}`);
    return false;
  }
}

/**
 * Format validation errors for better readability
 * @param {Array} errors - AJV validation errors
 */
function formatValidationErrors(errors) {
  const errorsByPath = {};
  
  // Group errors by instance path
  for (const err of errors) {
    const path = err.instancePath || '(root)';
    if (!errorsByPath[path]) {
      errorsByPath[path] = [];
    }
    errorsByPath[path].push(err);
  }
  
  console.error(`\n${colors.bold}Validation Errors:${colors.reset}`);
  
  for (const [path, pathErrors] of Object.entries(errorsByPath)) {
    console.error(`\n  ${colors.yellow}At ${path}:${colors.reset}`);
    
    const displayErrors = pathErrors.slice(0, 3);
    for (const err of displayErrors) {
      if (err.keyword === 'required') {
        console.error(`    ${colors.red}✘${colors.reset} Missing required property: ${colors.cyan}${err.params.missingProperty}${colors.reset}`);
      } else if (err.keyword === 'additionalProperties') {
        console.error(`    ${colors.red}✘${colors.reset} Unexpected property: ${colors.cyan}${err.params.additionalProperty}${colors.reset}`);
      } else {
        console.error(`    ${colors.red}✘${colors.reset} ${err.message} (${err.keyword})`);
      }
    }
    
    if (pathErrors.length > 3) {
      console.error(`    ${colors.gray}... and ${pathErrors.length - 3} more errors${colors.reset}`);
    }
  }
  
  // Provide helpful suggestions
  console.error(`\n${colors.bold}${colors.blue}Suggestions:${colors.reset}`);
  
  const missingProps = errors.filter(e => e.keyword === 'required').map(e => e.params.missingProperty);
  if (missingProps.length > 0) {
    console.error(`  • Ensure CSV files contain data for: ${colors.cyan}${[...new Set(missingProps)].join(', ')}${colors.reset}`);
  }
  
  const unexpectedProps = errors.filter(e => e.keyword === 'additionalProperties').map(e => e.params.additionalProperty);
  if (unexpectedProps.length > 0) {
    console.error(`  • Check column names in CSV files - unexpected: ${colors.cyan}${[...new Set(unexpectedProps)].join(', ')}${colors.reset}`);
  }
  
  console.error(`  • Verify CSV filenames match expected patterns (e.g., ${colors.cyan}project.csv, process_instance.csv${colors.reset})`);
  console.error(`  • Ensure related data exists (e.g., processes require projects, documents require processes)`);
}

/**
 * Validate individual CSV files for basic structure
 * @param {Array<string>} csvFiles - Array of CSV file paths
 * @returns {Promise<boolean>} True if all files have valid structure
 */
async function validateIndividualFiles(csvFiles) {
  console.log(`\n${colors.bold}${colors.blue}=== Validating individual CSV files ===${colors.reset}`);
  
  let allValid = true;
  
  for (const filePath of csvFiles) {
    try {
      const filename = path.basename(filePath);
      const data = await parseCsvFile(filePath);
      
      if (data.length === 0) {
        console.log(`${colors.yellow}Warning: ${filename} is empty${colors.reset}`);
        continue;
      }
      
      // Basic structure validation
      const firstRow = data[0];
      const hasId = firstRow.hasOwnProperty('id') || 
                   Object.keys(firstRow).some(key => key.toLowerCase().includes('id'));
      
      if (!hasId) {
        console.error(`${colors.red}✘ ${filename}: No ID column found${colors.reset}`);
        allValid = false;
      } else {
        console.log(`${colors.green}✓ ${filename}: ${data.length} rows, valid structure${colors.reset}`);
      }
      
    } catch (err) {
      console.error(`${colors.red}✘ Error validating ${filePath}: ${err.message}${colors.reset}`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Main CSV validation function
 * @param {string} csvDir - Directory containing CSV files
 * @returns {Promise<boolean>} True if all validations pass
 */
async function validateCsvFiles(csvDir = null) {
  const targetDir = csvDir || path.join(__dirname, '..', 'src', 'csv');
  
  if (!ensureDirectory(targetDir)) {
    console.error(`${colors.red}CSV directory not found: ${targetDir}${colors.reset}`);
    return false;
  }
  
  const csvFiles = findFiles(targetDir, '.csv');
  
  if (csvFiles.length === 0) {
    console.log(`${colors.yellow}No CSV files found in ${targetDir}${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.bold}Found ${csvFiles.length} CSV files in ${targetDir}${colors.reset}`);
  
  // Step 1: Validate individual files
  const individualValid = await validateIndividualFiles(csvFiles);
  
  // Step 2: Combine and validate against schema
  const combinedData = await combineCsvFiles(csvFiles);
  if (!combinedData) {
    return false;
  }
  
  const schemaValid = validateCombinedData(combinedData);
  
  return individualValid && schemaValid;
}

/**
 * Display schema mapping information
 */
function displayMappingInfo() {
  console.log(`\n${colors.bold}${colors.blue}CSV File to Schema Section Mappings:${colors.reset}`);
  
  Object.entries(SCHEMA_MAPPINGS).forEach(([filename, section]) => {
    console.log(`  ${colors.cyan}${filename}${colors.reset} → ${colors.green}${section}${colors.reset}`);
  });
  
  console.log(`\n${colors.bold}${colors.blue}Usage Tips:${colors.reset}`);
  console.log(`  • Name your CSV files according to the mappings above`);
  console.log(`  • Multiple files will be combined into a single data structure for validation`);
  console.log(`  • Ensure required relationships exist (e.g., processes reference valid project IDs)`);
  console.log(`  • Use 'null' for empty values, 'true'/'false' for booleans`);
}

// Export functions for use in other modules
module.exports = {
  validateCsvFiles,
  combineCsvFiles,
  parseCsvFile,
  SCHEMA_MAPPINGS
};

// Run validation if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    displayMappingInfo();
    process.exit(0);
  }
  
  const csvDir = args[0];
  
  validateCsvFiles(csvDir)
    .then((success) => {
      printSummary(success, 'CSV validation');
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
      process.exit(1);
    });
}
