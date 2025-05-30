/**
 * Command-line utilities for validation scripts
 */
const path = require('path');
const { colors } = require('./validation-utils');

/**
 * Parse command line arguments
 * @param {Array} args - Command line arguments
 * @param {Object} options - Parsing options
 * @returns {Object} Parsed arguments
 */
function parseArgs(args, options = {}) {
  const result = {
    flags: {},
    positional: [],
    command: ''
  };
  
  if (args.length > 0) {
    result.command = args[0];
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // Handle --flag or --flag=value
      const parts = arg.slice(2).split('=');
      const flag = parts[0];
      const value = parts.length > 1 ? parts[1] : true;
      result.flags[flag] = value;
    } else if (arg.startsWith('-')) {
      // Handle -f or combined flags like -abc
      const flags = arg.slice(1).split('');
      flags.forEach(flag => {
        result.flags[flag] = true;
      });
    } else {
      result.positional.push(arg);
    }
  }
  
  return result;
}

/**
 * Format validation summary for display
 * @param {boolean} success - Whether validation was successful
 * @param {string} operation - Description of validation operation
 * @returns {string} Formatted summary
 */
function formatSummary(success, operation = 'validation') {
  if (success) {
    return `\n${colors.green}✅ ${operation} completed successfully${colors.reset}`;
  } else {
    return `\n${colors.red}❌ ${operation} completed with errors${colors.reset}`;
  }
}

/**
 * Display help text for a script
 * @param {string} scriptName - Name of the script
 * @param {Object} options - Help options (usage, description, examples)
 */
function showHelp(scriptName, options = {}) {
  const { usage, description, examples } = options;
  
  console.log(`${colors.bold}${scriptName}${colors.reset}`);
  
  if (description) {
    console.log(`\n${description}`);
  }
  
  if (usage) {
    console.log(`\n${colors.bold}Usage:${colors.reset}`);
    console.log(`  ${usage}`);
  }
  
  if (examples && examples.length > 0) {
    console.log(`\n${colors.bold}Examples:${colors.reset}`);
    examples.forEach(example => {
      console.log(`  ${example}`);
    });
  }
}

module.exports = {
  parseArgs,
  formatSummary,
  showHelp
};
