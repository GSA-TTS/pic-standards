// Centralized, minimal error/summary reporting used by validation scripts

// Colors for console output (centralized)
const colors = require('./colors');

/**
 * Generate a readable error report from formatted errors
 * @param {Array} formattedErrors - Array of formatted error objects
 * @param {Object} options - Reporting options
 * @returns {string} Human-readable error report
 */
function generateErrorReport(formattedErrors, options = {}) {
  const { includeContext = true } = options;
  const report = [];
  
  if (formattedErrors.length === 0) {
    return 'No errors found.';
  }
  
  // Group errors by path
  const errorsByPath = {};
  formattedErrors.forEach(error => {
    const path = error.path || '(unknown)';
    if (!errorsByPath[path]) {
      errorsByPath[path] = [];
    }
    errorsByPath[path].push(error);
  });
  
  // Generate report sections
  Object.entries(errorsByPath).forEach(([path, errors]) => {
    report.push(`${colors.red}Errors at ${path}:${colors.reset}`);
    
    errors.forEach((error, index) => {
      report.push(`  ${index + 1}. ${colors.yellow}${error.message}${colors.reset}`);
      
      if (includeContext) {
        if (error.value !== undefined) {
          report.push(`     ${colors.cyan}Current value:${colors.reset} ${error.value}`);
        }
        
        if (error.expectedType && error.actualType) {
          report.push(`     ${colors.cyan}Expected type:${colors.reset} ${error.expectedType}`);
          report.push(`     ${colors.cyan}Actual type:${colors.reset} ${error.actualType}`);
        }
        
        if (error.allowedValues) {
          report.push(`     ${colors.cyan}Allowed values:${colors.reset} ${error.allowedValues.join(', ')}`);
        }
        
        if (error.missingProperty) {
          report.push(`     ${colors.cyan}Missing property:${colors.reset} ${error.missingProperty}`);
        }
        
        if (error.unexpectedProperty) {
          report.push(`     ${colors.cyan}Unexpected property:${colors.reset} ${error.unexpectedProperty}`);
        }
      }
      
      if (error.suggestion) {
        report.push(`     ${colors.green}💡 Suggestion:${colors.reset} ${error.suggestion}`);
      }
      
      if (index < errors.length - 1) {
        report.push(''); // Space between errors at same path
      }
    });
    
    report.push(''); // Space between different paths
  });
  
  return report.join('\n');
}

/**
 * Generate a summary report for validation results
 * @param {Object} results - Validation results from validateContent
 * @param {Object} options - Reporting options
 * @returns {Object} Summary information
 */
function generateSummaryReport(results, options = {}) {
  const { totalFiles = 1, fileName = 'file' } = options;
  
  const summary = {
    isValid: results.valid,
    totalFiles,
    fileName,
    totalRecords: 0,
    entityCounts: results.entityCounts || {},
    errorCounts: {
      root: results.rootErrors ? results.rootErrors.length : 0,
      entity: results.entityErrors ? results.entityErrors.length : 0,
      total: 0
    }
  };
  
  // Calculate total records
  Object.values(summary.entityCounts).forEach(count => {
    summary.totalRecords += count;
  });
  
  // Calculate total errors
  summary.errorCounts.total = summary.errorCounts.root + summary.errorCounts.entity;
  
  return summary;
}

/**
 * Print validation summary to console
 * @param {Object} summary - Summary from generateSummaryReport
 * @param {Object} options - Display options
 */
function printSummary(summary) {
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  
  if (summary.totalFiles > 1) {
    console.log(`📁 Files processed: ${summary.totalFiles}`);
  } else {
    console.log(`📄 File: ${summary.fileName}`);
  }
  
  if (summary.isValid) {
    console.log(`${colors.green}✅ Validation: PASSED${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Validation: FAILED${colors.reset}`);
  }
  
  if (summary.totalRecords > 0) {
    console.log(`📋 Total records: ${summary.totalRecords}`);
  }
  
  if (Object.keys(summary.entityCounts).length > 0) {
    console.log('\n📊 Records by type:');
    Object.entries(summary.entityCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
  
  if (summary.errorCounts.total > 0) {
    console.log('\n❌ Error counts:');
    if (summary.errorCounts.root > 0) {
      console.log(`  Root schema errors: ${summary.errorCounts.root}`);
    }
    if (summary.errorCounts.entity > 0) {
      console.log(`  Entity validation errors: ${summary.errorCounts.entity}`);
    }
    console.log(`  Total errors: ${summary.errorCounts.total}`);
  }
}

/**
 * Print debug information if debug mode is enabled
 * @param {Object} debugInfo - Debug information from validation results
 * @param {Object} options - Display options
 */
function printDebugInfo(debugInfo) {
  if (!debugInfo) {
    return;
  }
  
  console.log('\n🔍 DEBUG INFORMATION');
  console.log('='.repeat(50));
  
  if (debugInfo.entities) {
    const entityDebug = debugInfo.entities;
    
    if (entityDebug.detectedFormat) {
      console.log(`📋 Detected input format: ${entityDebug.detectedFormat}`);
    }
    
    if (entityDebug.entityTypesFound) {
      console.log(`🎯 Schema entity types: ${entityDebug.entityTypesFound.join(', ')}`);
    }
    
    if (entityDebug.inputEntityArrays && entityDebug.inputEntityArrays.length > 0) {
      console.log('\n📊 Found entity arrays in input:');
      entityDebug.inputEntityArrays.forEach(array => {
        console.log(`  - ${array.name}: ${array.count} items`);
      });
    }
    
    if (entityDebug.mappingResults && entityDebug.mappingResults.length > 0) {
      console.log('\n🔗 Entity mapping results:');
      entityDebug.mappingResults.forEach(result => {
        if (result.foundAs) {
          console.log(`  ✅ ${result.schemaEntity} ← ${result.foundAs} (${result.count} items)`);
        } else {
          console.log(`  ❌ ${result.schemaEntity} (not found, tried: ${result.triedNames?.join(', ') || 'default names'})`);
        }
      });
    }
  }
}

/**
 * Print detailed error information
 * @param {Array} rootErrors - Root schema errors
 * @param {Array} entityErrors - Entity validation errors
 * @param {Object} options - Display options
 */
function printDetailedErrors(rootErrors, entityErrors, options = {}) {
  const { maxErrors = 10 } = options;
  
  // Print root errors
  if (rootErrors && rootErrors.length > 0) {
    console.log('\n❌ ROOT SCHEMA ERRORS');
    console.log('-'.repeat(30));
  const report = generateErrorReport(rootErrors.slice(0, maxErrors), { includeContext: true });
    console.log(report);
    
    if (rootErrors.length > maxErrors) {
      console.log(`... and ${rootErrors.length - maxErrors} more root errors`);
    }
  }
  
  // Print entity errors
  if (entityErrors && entityErrors.length > 0) {
    console.log('\n❌ ENTITY VALIDATION ERRORS');
    console.log('-'.repeat(30));
    
    let errorCount = 0;
    for (const entityError of entityErrors) {
      if (errorCount >= maxErrors) {
        console.log(`... and ${entityErrors.length - errorCount} more entity errors`);
        break;
      }
      
      console.log(`\n${colors.cyan}Entity: ${entityError.entityType} [${entityError.entityIndex}] at ${entityError.path}${colors.reset}`);
  const report = generateErrorReport(entityError.errors, { includeContext: true });
      console.log(report);
      
      errorCount++;
    }
  }
}

/**
 * Main function to print complete validation results
 * @param {Object} results - Validation results from validateContent
 * @param {Object} options - Display and processing options
 */
function printValidationResults(results, options = {}) {
  const { debug = false, totalFiles = 1, fileName = 'file', maxErrors = 10 } = options;
  const summary = generateSummaryReport(results, { totalFiles, fileName });
  printSummary(summary);
  if (debug && results.debugInfo) {
    printDebugInfo(results.debugInfo);
  }
  if (!results.valid) {
    printDetailedErrors(results.rootErrors, results.entityErrors, { maxErrors });
  }
  return summary.isValid;
}

module.exports = {
  generateErrorReport,
  generateSummaryReport,
  printSummary,
  printDebugInfo,
  printDetailedErrors,
  printValidationResults,
  colors,
  // Lightweight operation summary printer (boolean + label)
  printOperationSummary: (success, operation = 'operation') => {
    const summary = {
      isValid: success,
      totalFiles: 1,
      fileName: operation,
      totalRecords: 0,
      entityCounts: {},
      errorCounts: { root: success ? 0 : 1, entity: 0, total: success ? 0 : 1 }
    };
    printSummary(summary);
  return summary.isValid;
  }
};
