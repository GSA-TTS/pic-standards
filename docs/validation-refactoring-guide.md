# NEPA Schema Validation Refactoring Guide

This document provides a step-by-step refactoring guide for the NEPA schema validation scripts to improve reliability and maintainability.

## Current Architecture Issues

The validation scripts (`validate-json.js`, `validate-yaml.js`) and their supporting utilities (`validation-utils.js`, `mapping-utils.js`) have several architectural issues:

1. **Inconsistent Validation Approaches**: JSON and YAML validation use similar but different approaches
2. **Hardcoded Entity Types**: Entity type lists are hardcoded rather than derived from the schema
3. **Limited Error Context**: Error messages lack sufficient context for easy debugging
4. **Implicit Mapping Logic**: Entity and field mapping logic is spread across multiple files
5. **Insufficient Input Flexibility**: Input files must follow a strict structure

## Refactoring Strategy

### Phase 1: Consolidation

**Goal**: Create a unified validation core that both JSON and YAML validators use.

1. Create a new validation core module:

```javascript
// validation-core.js
const { loadSchema } = require('./utils/validation-utils');

function validateContent(data, options = {}) {
  const { schema, entityMappings, fieldMappings } = options;
  
  // 1. Validate entire document (if schema provided)
  const rootResults = schema ? validateRoot(data, schema) : { valid: true, errors: [] };
  
  // 2. Extract and validate individual entities
  const entityResults = validateEntities(data, options);
  
  return {
    valid: rootResults.valid && entityResults.valid,
    rootErrors: rootResults.errors,
    entityErrors: entityResults.errors,
    entityCounts: entityResults.counts
  };
}

module.exports = { validateContent };
```

2. Update JSON and YAML validators to use the core:

```javascript
// validate-json.js
const { validateContent } = require('./validation-core');
const { ValidationUtils } = require('./utils/validation-utils');

async function validateJsonFiles() {
  const utils = new ValidationUtils();
  const schemaPath = path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  const schema = utils.parseFile(schemaPath);
  
  // Find files
  const jsonFiles = utils.findFiles(...);
  
  // Process each file using the core
  for (const filePath of jsonFiles) {
    const data = utils.parseFile(filePath);
    const results = validateContent(data, { schema });
    // Handle results...
  }
}
```

### Phase 2: Schema-Driven Entity Detection

**Goal**: Replace hardcoded entity types with schema-derived types.

1. Extract entity types from schema:

```javascript
function extractEntityTypesFromSchema(schema) {
  const entityTypes = [];
  
  // Check each property in the root schema
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([propName, propSchema]) => {
      // If property is an array that references a definition, it's an entity type
      if (propSchema.type === 'array' && 
          propSchema.items && 
          propSchema.items.$ref) {
        entityTypes.push({
          name: propName,
          refName: propSchema.items.$ref.split('/').pop(),
          definition: schema.definitions[propSchema.items.$ref.split('/').pop()]
        });
      }
    });
  }
  
  return entityTypes;
}
```

2. Use the extracted types for validation:

```javascript
function validateEntities(data, options) {
  const { schema } = options;
  const entityTypes = extractEntityTypesFromSchema(schema);
  const errors = [];
  const counts = {};
  
  // Check each entity type
  entityTypes.forEach(entityType => {
    // Look for matching arrays in the data
    // - Direct match (e.g., "projects")
    // - Mapped match (e.g., "process_instance" -> "processes")
    const possibleNames = getPossibleEntityNames(entityType.name, options.entityMappings);
    
    possibleNames.forEach(name => {
      if (data[name] && Array.isArray(data[name])) {
        counts[entityType.name] = (counts[entityType.name] || 0) + data[name].length;
        
        // Validate each entity
        data[name].forEach((entity, index) => {
          const validator = createEntityValidator(entityType.definition);
          const isValid = validator(entity);
          
          if (!isValid) {
            errors.push({
              path: `/${name}/${index}`,
              errors: validator.errors
            });
          }
        });
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    counts
  };
}
```

### Phase 3: Enhanced Error Reporting

**Goal**: Provide clear, actionable error messages with context.

1. Create a rich error formatter:

```javascript
function formatValidationErrors(errors, data) {
  return errors.map(error => {
    const path = error.instancePath || '(root)';
    const value = getValueAtPath(data, path);
    const formattedError = {
      path,
      message: error.message,
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath,
      value: truncateValue(value)
    };
    
    // Add context-specific information
    switch (error.keyword) {
      case 'required':
        formattedError.missingProperty = error.params.missingProperty;
        formattedError.suggestion = `Add "${error.params.missingProperty}" property`;
        break;
      case 'type':
        formattedError.expectedType = error.params.type;
        formattedError.actualType = typeof value;
        formattedError.suggestion = `Change value to ${error.params.type} type`;
        break;
      // ...other keyword handlers
    }
    
    return formattedError;
  });
}
```

2. Generate readable error reports:

```javascript
function generateErrorReport(formattedErrors) {
  const report = [];
  
  // Group errors by path
  const errorsByPath = {};
  formattedErrors.forEach(error => {
    if (!errorsByPath[error.path]) {
      errorsByPath[error.path] = [];
    }
    errorsByPath[error.path].push(error);
  });
  
  // Generate report sections
  Object.entries(errorsByPath).forEach(([path, errors]) => {
    report.push(`Errors at ${path}:`);
    
    errors.forEach(error => {
      report.push(`  - ${error.message}`);
      if (error.value !== undefined) {
        report.push(`    Current value: ${JSON.stringify(error.value)}`);
      }
      if (error.suggestion) {
        report.push(`    Suggestion: ${error.suggestion}`);
      }
    });
    
    report.push(''); // Empty line between paths
  });
  
  return report.join('\n');
}
```

### Phase 4: Flexible Entity Mapping

**Goal**: Create a comprehensive mapping system that handles all entity and field variations.

1. Centralize mapping definitions:

```javascript
// mapping-definitions.js
module.exports = {
  // Entity mappings (database to schema)
  entityMappings: {
    // Database to schema
    'process_instance': 'processes',
    'comment': 'public_comments',
    'engagement': 'public_engagement_events',
    
    // Common variations
    'project': 'projects',
    'document': 'documents',
    'case_event': 'case_events'
  },
  
  // Field mappings (by entity)
  fieldMappings: {
    // Global mappings (apply to all entities)
    global: {
      'id': '_id', // Special case handled separately
      'created_at': '_created',
      'updated_at': '_updated'
    },
    
    // Entity-specific mappings
    projects: {
      'title': 'project_title',
      'description': 'project_description',
      'sector': 'project_sector',
      'sponsor': 'project_sponsor'
    },
    
    processes: {
      'parent_project_id': 'project_id',
      'type': 'process_type',
      'status': 'process_status'
    },
    // ...other entities
  },
  
  // ID field mappings
  idMappings: {
    'projects': 'project_id',
    'processes': 'process_id',
    'documents': 'document_id',
    'public_comments': 'comment_id',
    'public_engagement_events': 'event_id',
    'case_events': 'case_event_id',
    'gis_data': 'gis_id'
    // ...other entity ID mappings
  }
};
```

2. Create a flexible mapping utility:

```javascript
// mapping-utils.js (updated)
const { entityMappings, fieldMappings, idMappings } = require('./mapping-definitions');

function resolveEntityName(name) {
  // Convert to canonical schema name
  return entityMappings[name] || name;
}

function mapEntityField(fieldName, entityType) {
  // Handle ID field mapping first
  if (fieldName === 'id') {
    return idMappings[entityType] || `${entityType.replace(/s$/, '')}_id`;
  }
  
  // Check entity-specific mappings
  const entityMappings = fieldMappings[entityType] || {};
  if (entityMappings[fieldName]) {
    return entityMappings[fieldName];
  }
  
  // Check global mappings
  if (fieldMappings.global[fieldName]) {
    return fieldMappings.global[fieldName];
  }
  
  // Default to the original name
  return fieldName;
}

// Transform entity data to match schema
function transformEntity(data, entityType) {
  const result = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const mappedKey = mapEntityField(key, entityType);
    result[mappedKey] = value;
  });
  
  return result;
}

module.exports = {
  resolveEntityName,
  mapEntityField,
  transformEntity
};
```

### Phase 5: Input Adaptability

**Goal**: Handle different input formats and structures.

1. Create adapters for different input formats:

```javascript
// adapters/input-adapters.js
const adapters = {
  // Standard format - entities are direct properties of root object
  standard: {
    getEntities: (data, entityName) => data[entityName] || [],
    setEntities: (data, entityName, entities) => {
      data[entityName] = entities;
      return data;
    }
  },
  
  // Nested format - entities under "data" property
  nested: {
    getEntities: (data, entityName) => data.data?.[entityName] || [],
    setEntities: (data, entityName, entities) => {
      if (!data.data) data.data = {};
      data.data[entityName] = entities;
      return data;
    }
  },
  
  // Database format - different entity names
  database: {
    getEntities: (data, entityName) => {
      // Map schema entity name to database table name
      const dbName = reverseEntityMapping(entityName);
      return data[dbName] || [];
    },
    setEntities: (data, entityName, entities) => {
      const dbName = reverseEntityMapping(entityName);
      data[dbName] = entities;
      return data;
    }
  }
};

function detectInputFormat(data) {
  // Logic to detect which format the data uses
  if (data.data && typeof data.data === 'object') {
    return 'nested';
  }
  
  // Check for database-style entity names
  if (data.process_instance || data.comment || data.engagement) {
    return 'database';
  }
  
  // Default
  return 'standard';
}

module.exports = {
  adapters,
  detectInputFormat
};
```

2. Use adapters in the validation core:

```javascript
function validateEntities(data, options) {
  const { schema } = options;
  const entityTypes = extractEntityTypesFromSchema(schema);
  const errors = [];
  const counts = {};
  
  // Detect input format
  const format = detectInputFormat(data);
  const adapter = adapters[format];
  
  // Check each entity type
  entityTypes.forEach(entityType => {
    // Get entities using the appropriate adapter
    const entities = adapter.getEntities(data, entityType.name);
    
    if (entities.length > 0) {
      counts[entityType.name] = entities.length;
      
      // Validate each entity
      entities.forEach((entity, index) => {
        // Transform entity if needed based on format
        const transformedEntity = format === 'standard' ? 
          entity : transformEntity(entity, entityType.name);
        
        const validator = createEntityValidator(entityType.definition);
        const isValid = validator(transformedEntity);
        
        if (!isValid) {
          errors.push({
            path: `/${entityType.name}/${index}`,
            errors: validator.errors
          });
        }
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    counts
  };
}
```

## Practical Refactoring Steps

1. **Diagnostic Tools First**
   - Add debug logging to current validators to identify exactly which entity mappings are failing
   - Create a simple entity explorer script to dump all entity types found in input files

2. **Start with Validation Core**
   - Create the core validation functions that both JSON and YAML validators will use
   - Implement schema-based entity type detection

3. **Update Mapping Utilities**
   - Centralize all mapping definitions
   - Create bidirectional mapping functions

4. **Enhance Error Reporting**
   - Implement detailed error formatting
   - Add context-specific suggestions

5. **Create Input Adapters**
   - Implement adapters for different input formats
   - Add automatic format detection

6. **Update Main Validators**
   - Refactor JSON validator to use the new core
   - Refactor YAML validator to use the new core

7. **Add Comprehensive Tests**
   - Create test cases for each input format
   - Test with both valid and invalid data

## Best Practices Moving Forward

1. **Schema-Driven Development**
   - Let the schema drive the code, not vice versa
   - Extract validation rules and entity definitions from the schema

2. **Explicit Mapping**
   - Make all mappings explicit and centralized
   - Avoid hardcoding mappings in multiple places

3. **Progressive Validation**
   - Validate entire documents first
   - Then validate individual entities
   - Then validate relationships between entities

4. **Rich Error Context**
   - Include path, expected value, actual value
   - Provide clear suggestions for fixing issues

5. **Format Adaptability**
   - Support multiple input formats
   - Use adapters to normalize different structures

By following this refactoring guide, the validation scripts will become more robust, maintainable, and user-friendly.
