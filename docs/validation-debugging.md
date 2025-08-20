# NEPA Schema Validation Debugging Guide

This document provides guidance on debugging and refactoring the validation scripts for NEPA schema files, with a particular focus on resolving issues with `all_entities.json` and `all_entities.yaml`.

## Current Problems

### 1. Entity Detection Issues

The validation scripts aren't detecting all entity types in the input files. Specifically:

- In `validate-json.js` and `validate-yaml.js`, the scripts process records entity-by-entity
- Instead of validating the entire document against the root schema, the scripts are extracting entities and validating each separately
- When an entity doesn't match the expected naming pattern or structure, it gets missed entirely

### 2. Schema Mapping Inconsistencies

There are inconsistencies between:

- Database field names
- Schema property names 
- Entity names in the input files

For example:
- `process_instance` in the database vs `process` in the schema
- `comment` in the database vs `public_comment` in the schema
- `engagement` in the database vs `public_engagement_event` in the schema

### 3. Error Handling Limitations

The current error handling:
- Doesn't show the exact location of validation failures
- Makes it difficult to determine which specific fields are causing issues
- Doesn't provide clear guidance on how to fix the problems

## Reductive Analysis

To better understand the issues, let's break down the validation flow:

### JSON/YAML Validation Flow

1. Find input files in specified directories
2. For each file:
   - Parse the file content (JSON/YAML)
   - For each expected entity type (from `nepaRecordTypes`):
     - Check if the entity array exists in the parsed data
     - If it exists, validate each record against its schema definition
   - Collect and report validation results

### Key Issues Found via Analysis

1. **Entity Type Recognition**: The scripts only look for predefined entity arrays using a hardcoded list of `nepaRecordTypes`. If the input file uses different entity names or nesting structures, they won't be found.

2. **Schema Definition Lookups**: The singular form is derived by removing the trailing 's' from the entity name, which fails for irregular plurals or non-standard naming patterns.

3. **Missing Root Schema Validation**: The scripts validate each entity individually against its schema definition rather than validating the entire document against the full schema.

4. **Data Structure Assumptions**: The validation assumes a flat structure where entities are arrays directly under the root object, but doesn't handle nested structures or alternate formats.

## Recommended Refactoring Approaches

### 1. Unified Schema Validation

Replace the entity-by-entity validation with a whole-document validation approach:

```javascript
function validateFile(filePath, validator) {
  const data = utils.parseFile(filePath);
  return validator(data); // Validate entire document against the root schema
}
```

### 2. Schema-driven Entity Processing

Instead of hardcoding entity types, extract them from the schema:

```javascript
function getEntityTypes(schema) {
  return Object.keys(schema.properties)
    .filter(prop => 
      schema.properties[prop].type === 'array' && 
      schema.properties[prop].items?.$ref
    );
}
```

### 3. Flexible Entity Name Resolution

Create a more robust mapping system for entity names:

```javascript
const ENTITY_MAPPINGS = {
  // DB to Schema
  'process_instance': 'processes',
  'comment': 'public_comments',
  'engagement': 'public_engagement_events',
  
  // Schema to Definition
  'processes': 'process',
  'public_comments': 'public_comment',
  'public_engagement_events': 'public_engagement_event',
  // ...etc
};
```

### 4. Enhanced Error Reporting

Improve error reporting with context and suggestions:

```javascript
function reportValidationError(error, data) {
  const path = error.instancePath || '(root)';
  const value = getValueAtPath(data, path);
  
  console.error(`Error at ${path}: ${error.message}`);
  console.error(`Current value: ${JSON.stringify(value)}`);
  
  if (error.keyword === 'required') {
    console.error(`Missing required property: ${error.params.missingProperty}`);
    console.error(`Add this field with an appropriate value`);
  }
  // ...handle other error types
}
```

### 5. Debug Mode for Detailed Entity Information

Add a debug mode that shows exactly what entities were found and processed:

```javascript
if (options.debug) {
  console.log('Found entity arrays:');
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      console.log(`- ${key}: ${value.length} items`);
    }
  });
}
```

## Implementation Checklist

1. **Add enhanced debugging** to existing scripts to identify specific issues
   - Log all entity arrays found in input files
   - Show schema lookups and matches

2. **Implement unified validation** that validates the entire document first
   - Add root-level validation before entity-by-entity validation
   - Show any root-level schema issues

3. **Create flexible entity mapping** system
   - Build a comprehensive mapping of all entity name variations
   - Use this for lookups in both directions

4. **Improve error reporting**
   - Show context for each error (file, location, current value)
   - Provide suggestions for fixing issues

5. **Add schema adapters** for different input formats
   - Support different nesting structures
   - Handle alternate naming conventions

## Specific Tests

To verify the refactored validation works correctly, create test cases for:

1. **Entity name variations** - Test with different casing and pluralization
2. **Nested structures** - Test with entities nested under different paths
3. **Empty or null values** - Test with missing, empty, and null fields
4. **Type mismatches** - Test with incorrect data types
5. **Reference validation** - Test with both valid and invalid references between entities

## Example Debug Session

```
$ node scripts/validate-json.js --debug

🔍 DEBUG: Processing /src/json/all_entities.json
📊 Entity detection:
  - Found keys: process_instance, document, comment, engagement, gis_data...
  - Expected: projects, processes, documents, public_comments...
  - Mapping: process_instance → processes, comment → public_comments...

📄 Schema lookups:
  - For 'process_instance' looking up schema: process
  - For 'comment' looking up schema: public_comment
  ...

❌ Validation errors:
  Error at /process_instance/0: must have required property 'process_id'
  Current value: { "id": 1, "type": "EIS", ... }
  Mapping issue: 'id' should be mapped to 'process_id'
```

By following these recommendations, the validation scripts will be more robust, provide better error messages, and handle a wider variety of input formats.
