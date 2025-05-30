/**
 * CSV utilities for parsing and validating CSV files
 * Shared functions for database crosswalk and other CSV operations
 */
const fs = require('fs');
const csv = require('csv-parser');

/**
 * Load and parse CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of parsed CSV rows
 */
function loadCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    if (!fs.existsSync(filePath)) {
      reject(new Error(`CSV file not found: ${filePath}`));
      return;
    }
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Parse database crosswalk CSV into organized structure
 * @param {string} csvPath - Path to database crosswalk CSV file
 * @returns {Promise<Object>} Organized crosswalk data by table name
 */
async function loadDatabaseCrosswalk(csvPath) {
  try {
    const rows = await loadCsvFile(csvPath);
    const crosswalk = {};
    
    for (const row of rows) {
      const tableName = row.table_name || row.Table || row.table;
      const columnName = row.column_name || row.Column || row.column;
      
      if (!tableName || !columnName) {
        continue; // Skip malformed rows
      }
      
      if (!crosswalk[tableName]) {
        crosswalk[tableName] = [];
      }
      
      crosswalk[tableName].push({
        table: tableName,
        column: columnName,
        dataType: row.data_type || row.DataType || row.type,
        nullable: row.is_nullable || row.Nullable || row.nullable,
        defaultValue: row.column_default || row.Default || row.default,
        description: row.description || row.Description || '',
        constraints: row.constraints || row.Constraints || ''
      });
    }
    
    return crosswalk;
  } catch (error) {
    throw new Error(`Failed to load database crosswalk: ${error.message}`);
  }
}

/**
 * Validate CSV structure and content
 * @param {Array} csvData - Parsed CSV data
 * @param {Array} requiredColumns - Required column names
 * @returns {Object} Validation results
 */
function validateCsvStructure(csvData, requiredColumns = []) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    rowCount: csvData.length
  };
  
  if (csvData.length === 0) {
    results.errors.push('CSV file is empty');
    results.valid = false;
    return results;
  }
  
  const headers = Object.keys(csvData[0]);
  
  // Check for required columns
  for (const required of requiredColumns) {
    if (!headers.includes(required)) {
      results.errors.push(`Missing required column: ${required}`);
      results.valid = false;
    }
  }
  
  // Check for empty rows
  let emptyRowCount = 0;
  csvData.forEach((row, index) => {
    const values = Object.values(row);
    if (values.every(val => !val || val.trim() === '')) {
      emptyRowCount++;
    }
  });
  
  if (emptyRowCount > 0) {
    results.warnings.push(`Found ${emptyRowCount} empty rows`);
  }
  
  return results;
}

/**
 * Get unique values from a CSV column
 * @param {Array} csvData - Parsed CSV data
 * @param {string} columnName - Name of column to extract values from
 * @returns {Array} Unique values from the column
 */
function getUniqueColumnValues(csvData, columnName) {
  const values = csvData
    .map(row => row[columnName])
    .filter(val => val && val.trim() !== '')
    .map(val => val.trim());
  
  return [...new Set(values)];
}

/**
 * Group CSV data by a specific column
 * @param {Array} csvData - Parsed CSV data
 * @param {string} groupByColumn - Column to group by
 * @returns {Object} Data grouped by column values
 */
function groupCsvData(csvData, groupByColumn) {
  const grouped = {};
  
  csvData.forEach(row => {
    const groupKey = row[groupByColumn];
    if (!groupKey) return;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    
    grouped[groupKey].push(row);
  });
  
  return grouped;
}

module.exports = {
  loadCsvFile,
  loadDatabaseCrosswalk,
  validateCsvStructure,
  getUniqueColumnValues,
  groupCsvData
};
