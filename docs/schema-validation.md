# Schema Validation Technical Reference

## Overview

The NEPA JSON Schema provides the authoritative data model for environmental review processes. This document covers schema structure, validation mechanisms, and implementation patterns for technical teams.

## Schema Architecture

### Core Design Principles

1. **Hierarchical Structure**: Entities organized by logical relationships
2. **Extensibility**: Support for custom fields via `other` properties
3. **Validation**: Strict type checking with comprehensive error reporting
4. **Interoperability**: Compatible with OpenAPI, database schemas, and API responses

### Schema Structure
```
nepa.schema.json
├── $schema: JSON Schema version
├── $id: Schema identifier
├── type: "object" (root)
├── required: [top-level required arrays]
├── properties: {entity collections}
└── definitions: {reusable entity schemas}
```

## Entity Definitions

### Primary Entities

#### 1. Project (`project`)
**Purpose**: Environmental review project container
**Key Fields**:
- `project_id` (required): Unique project identifier
- `project_title` (required): Human-readable project name
- `project_description` (required): Project scope and goals
- `project_sector` (required): Industry category (energy, transportation, etc.)
- `lead_agency` (required): Federal agency overseeing environmental review

**Relationships**:
- 1:N with `process` (projects can have multiple review processes)
- 1:N with `gis_data` (geospatial project boundaries)
- 1:N with `public_comment` (project-level comments)

#### 2. Process (`process`)
**Purpose**: NEPA environmental review process instance
**Key Fields**:
- `process_id` (required): Unique process identifier
- `project_id` (required): Parent project reference
- `process_type` (required): NEPA level (EIS, EA, CE)
- `process_status` (required): Current state (underway, completed, etc.)
- `lead_agency` (required): Federal agency conducting review

**Validation Rules**:
```json
{
  "process_type": {
    "enum": ["EIS", "EA", "CE", "Other"]
  },
  "process_status": {
    "enum": ["pre-application", "underway", "paused", "completed", "cancelled"]
  }
}
```

#### 3. Document (`document`)
**Purpose**: Environmental review documents and publications
**Key Fields**:
- `document_id` (required): Unique document identifier
- `process_id` (required): Parent process reference
- `document_type` (required): Document category
- `title` (required): Document title
- `status` (required): Publication status

**Document Types**:
- `Notice of Intent (NOI)`
- `Draft EIS`
- `Final EIS`
- `Environmental Assessment (EA)`
- `Finding of No Significant Impact (FONSI)`
- `Record of Decision (ROD)`

#### 4. Public Comment (`public_comment`)
**Purpose**: Public participation and stakeholder input
**Key Fields**:
- `comment_id` (required): Unique comment identifier
- `commenter_name` (required): Individual or organization name
- `content` (required): Comment text or structured content
- `related_document_id` (required): Associated document reference

**Content Handling**:
```json
{
  "content": {"type": "string"},           // Simple text
  "content_json": {"type": "object"},      // Structured data
  "response_text": {"type": "string"},     // Agency response
  "response_json": {"type": "object"}      // Structured response
}
```

### Supporting Entities

#### 5. Case Event (`case_event`)
**Purpose**: Process milestone and activity tracking
**Key Fields**:
- `case_event_id` (required): Unique event identifier
- `process_id` (required): Parent process reference
- `event_name` (required): Event title
- `event_date` (required): Event occurrence date
- `event_type` (required): Event category

#### 6. GIS Data (`gis_data`)
**Purpose**: Geospatial information and mapping
**Key Fields**:
- `gis_id` (required): Unique GIS data identifier
- `data_type` (required): Geometric type (Point, Polygon, LineString)
- `description`: Human-readable description
- `container_inventory`: Metadata about data format and access

#### 7. Legal Structure (`legal_structure`)
**Purpose**: Regulatory framework and compliance requirements
**Key Fields**:
- `legal_structure_id` (required): Unique legal reference identifier
- `title` (required): Official regulation or law title
- `citation` (required): Legal citation (CFR, USC, etc.)

## Validation Implementation

### AJV Configuration
```javascript
const ajv = new Ajv({
  allErrors: true,        // Collect all validation errors
  verbose: true,          // Detailed error information
  strict: false,          // Allow additional properties
  removeAdditional: false // Preserve extra fields
});

// Add format validation
addFormats(ajv);
```

### Custom Validation Rules

#### 1. Date Validation
```javascript
// ISO 8601 date format enforcement
{
  "type": "string",
  "format": "date",
  "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
}
```

#### 2. Identifier Validation
```javascript
// Entity ID format requirements
{
  "type": "string",
  "pattern": "^[a-zA-Z0-9_-]+$",
  "minLength": 1,
  "maxLength": 100
}
```

#### 3. Enum Validation
```javascript
// Controlled vocabulary enforcement
{
  "type": "string",
  "enum": ["pre-application", "underway", "completed"],
  "errorMessage": "Status must be one of the allowed values"
}
```

### Error Handling Patterns

#### 1. Error Classification
```javascript
const errorTypes = {
  MISSING_REQUIRED: 'required',
  TYPE_MISMATCH: 'type',
  FORMAT_INVALID: 'format',
  ENUM_VIOLATION: 'enum',
  ADDITIONAL_PROPS: 'additionalProperties'
};
```

#### 2. Error Context Enhancement
```javascript
function enhanceError(error, data) {
  return {
    ...error,
    actualValue: getValueByPath(data, error.instancePath),
    expectedType: error.schema.type,
    fieldName: getFieldName(error.instancePath),
    contextPath: error.instancePath
  };
}
```

## Data Transformation

### Input Normalization

#### 1. Field Name Mapping
```javascript
const fieldMappings = {
  // Database to schema mappings
  'parent_document_id': 'related_document_id',
  'commenter_entity': 'commenter_name',
  'content_text': 'content',
  
  // API to schema mappings
  'projectId': 'project_id',
  'processType': 'process_type',
  'documentType': 'document_type'
};
```

#### 2. Type Conversion
```javascript
function normalizeTypes(data) {
  // Convert string numbers to integers for IDs
  if (data.id && typeof data.id === 'string') {
    data.id = parseInt(data.id, 10);
  }
  
  // Ensure date strings are properly formatted
  if (data.date && !isValidDate(data.date)) {
    data.date = formatDate(data.date);
  }
  
  return data;
}
```

### Output Transformation

#### 1. API Response Formatting
```javascript
function formatForAPI(validatedData) {
  return {
    ...validatedData,
    // Add computed fields
    display_name: computeDisplayName(validatedData),
    status_label: getStatusLabel(validatedData.status),
    
    // Remove internal fields
    other: undefined,
    created_at: undefined
  };
}
```

## Performance Optimization

### Schema Compilation
```javascript
// Pre-compile schemas for better performance
const compiledSchemas = new Map();

function getValidator(schemaName) {
  if (!compiledSchemas.has(schemaName)) {
    const schema = loadSchema(schemaName);
    compiledSchemas.set(schemaName, ajv.compile(schema));
  }
  return compiledSchemas.get(schemaName);
}
```

### Batch Validation
```javascript
async function validateBatch(items, schemaName) {
  const validator = getValidator(schemaName);
  const results = [];
  
  for (const item of items) {
    const isValid = validator(item);
    results.push({
      isValid,
      errors: validator.errors,
      data: item
    });
  }
  
  return results;
}
```

### Memory Management
```javascript
// Clear error references after processing
function clearValidationErrors(validator) {
  validator.errors = null;
}

// Limit error collection for large datasets
const ajvOptions = {
  allErrors: false,  // Stop on first error for performance
  verbose: false     // Reduce memory usage
};
```

## Testing Strategies

### Unit Testing
```javascript
describe('Schema Validation', () => {
  test('should validate required fields', () => {
    const invalidData = { /* missing required fields */ };
    const isValid = validator(invalidData);
    
    expect(isValid).toBe(false);
    expect(validator.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'required',
        params: { missingProperty: 'project_id' }
      })
    );
  });
});
```

### Integration Testing
```javascript
describe('End-to-End Validation', () => {
  test('should validate complete NEPA dataset', async () => {
    const testData = await loadTestDataset();
    const results = await validateCompleteDataset(testData);
    
    expect(results.validFiles).toBe(results.totalFiles);
    expect(results.errors).toHaveLength(0);
  });
});
```

### Property-Based Testing
```javascript
const fc = require('fast-check');

test('should handle arbitrary valid project data', () => {
  fc.assert(fc.property(
    fc.record({
      project_id: fc.string(),
      project_title: fc.string(),
      project_description: fc.string(),
      project_sector: fc.constantFrom('energy', 'transportation'),
      lead_agency: fc.string()
    }),
    (project) => {
      const isValid = projectValidator(project);
      expect(isValid).toBe(true);
    }
  ));
});
```

## Monitoring and Observability

### Validation Metrics
```javascript
class ValidationMetrics {
  constructor() {
    this.totalValidations = 0;
    this.failedValidations = 0;
    this.errorsByType = new Map();
    this.processingTime = [];
  }
  
  recordValidation(result, duration) {
    this.totalValidations++;
    if (!result.isValid) {
      this.failedValidations++;
      this.categorizeErrors(result.errors);
    }
    this.processingTime.push(duration);
  }
  
  getSuccessRate() {
    return (this.totalValidations - this.failedValidations) / this.totalValidations;
  }
}
```

### Error Reporting
```javascript
function generateValidationReport(results) {
  return {
    summary: {
      totalFiles: results.length,
      validFiles: results.filter(r => r.isValid).length,
      errorCount: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0)
    },
    errorBreakdown: categorizeErrors(results),
    recommendations: generateRecommendations(results)
  };
}
```

## Best Practices

### Schema Design
1. **Required Field Minimization**: Only mark fields as required if absolutely necessary
2. **Descriptive Properties**: Include detailed descriptions for all fields
3. **Example Values**: Provide examples for complex field structures
4. **Version Management**: Use semantic versioning for schema changes

### Validation Implementation
1. **Error Context**: Provide meaningful error messages with field paths
2. **Performance Monitoring**: Track validation performance and error rates
3. **Graceful Degradation**: Handle validation failures without breaking application flow
4. **Documentation**: Maintain up-to-date validation rule documentation

### Data Quality
1. **Input Sanitization**: Clean and normalize data before validation
2. **Output Verification**: Verify that validated data meets business requirements
3. **Error Recovery**: Implement strategies for handling validation failures
4. **Audit Trails**: Log validation results for compliance and debugging

## References

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/schema)
- [AJV Documentation](https://ajv.js.org/)
- [NEPA Regulations (40 CFR 1500-1508)](https://www.ecfr.gov/current/title-40/chapter-V)
- [Environmental Review Database Schema](./database-crosswalk.md)
