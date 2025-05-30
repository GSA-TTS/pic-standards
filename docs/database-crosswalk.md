# Database Crosswalk Technical Reference

## Overview

The database crosswalk validates alignment between the PostgreSQL database schema and the NEPA JSON Schema logical model. This ensures data consistency across persistence, API, and validation layers.

## Architecture

### Validation Pipeline
```
Database CSV → Crosswalk Parser → Schema Validator → Results Analysis
     ↓              ↓                ↓                    ↓
 Field Mapping → Type Checking → Coverage Analysis → Error Reporting
```

### Key Components

1. **Database Crosswalk CSV** (`src/crosswalk/database_crosswalk.csv`)
   - Authoritative source of database schema structure
   - Maps database tables/columns to logical entities
   - Includes field descriptions and constraints

2. **Validation Script** (`scripts/validate-database-crosswalk.js`)
   - Automated schema alignment verification
   - Field mapping and type validation
   - Coverage analysis and gap identification

3. **Mapping Utilities** (`scripts/utils/mapping-utils.js`)
   - Database-to-schema field transformation logic
   - Entity relationship mapping
   - Type conversion and normalization

## Database-to-Schema Mapping Strategy

### Entity Mapping Table (Subject to Change)
| Database Table | Schema Entity | Primary ID Mapping |
|---|---|---|
| `project` | `project` | `id` → `project_id` |
| `process_instance` | `process` | `id` → `process_id` |
| `document` | `document` | `id` → `document_id` |
| `comment` | `public_comment` | `id` → `comment_id` |
| `engagement` | `public_engagement_event` | `id` → `event_id` |
| `case_event` | `case_event` | `id` → `case_event_id` |
| `gis_data` | `gis_data` | `id` → `gis_id` |
| `legal_structure` | `legal_structure` | `id` → `legal_structure_id` |
| `decision_element` | `decision_element` | `id` → `decision_element_id` |
| `process_model` | `process_model` | `id` → `process_model_id` |
| `process_decision_payload` | `decision_payload` | `id` → `decision_payload_id` |
| `user_role` | `user_role` | `id` → `role_id` |

### Field Mapping Patterns

#### 1. Direct Mappings
```javascript
// 1:1 field name correspondence
'title' → 'title'
'description' → 'description'
'status' → 'status'
```

#### 2. Semantic Mappings
```javascript
// Different names, same meaning
'parent_document_id' → 'related_document_id'
'commenter_entity' → 'commenter_name'
'submission_method' → 'method_of_submission'
```

#### 3. Structural Mappings
```javascript
// Complex transformations
'location_lat', 'location_lon' → 'location.coordinates'
'content_text', 'content_json' → 'content'
```

### Data Type Reconciliation

#### PostgreSQL to JSON Schema Types
| PostgreSQL | JSON Schema | Notes |
|---|---|---|
| `bigint` | `integer` | Primary keys, foreign keys |
| `text` | `string` | Text content, identifiers |
| `boolean` | `boolean` | Direct mapping |
| `jsonb` | `object` | Structured data containers |
| `timestamp with time zone` | `string` (date-time) | ISO 8601 format |
| `date` | `string` (date) | ISO 8601 date format |
| `double precision` | `number` | Coordinates, measurements |

## Validation Rules

### Required Field Validation
```javascript
// Example: public_comment entity
const requiredFields = [
  'comment_id',      // Maps from database 'id'
  'commenter_name',  // Maps from 'commenter_entity'
  'content',         // Maps from 'content_text'
  'related_document_id' // Maps from 'parent_document_id'
];
```

### Coverage Metrics
- **Total Coverage**: Schema properties found in database / Total schema properties
- **Required Coverage**: Required schema properties found / Total required properties
- **Table Validity**: No missing required fields and proper type mappings

### Error Categories

#### 1. Missing Required Fields
```
Error: Required schema property 'related_document_id' missing in database table 'comment'
Resolution: Add field mapping or database column
```

#### 2. Type Mismatches
```
Error: Field 'related_document_id' expected integer, got string
Resolution: Update schema type or add type conversion
```

#### 3. Unmapped Database Fields
```
Warning: Database column 'comment.public_acess' does not match schema
Resolution: Fix typo or add field mapping
```

## Implementation Guide

### Adding New Entity Mappings

#### 1. Update Database Crosswalk CSV
```csv
new_table,id,bigint,database id,NO
new_table,entity_specific_id,text,business identifier,NO
new_table,name,text,entity name,NO
```

#### 2. Add Schema Definition
```json
"new_entity": {
  "type": "object",
  "required": ["entity_id", "name"],
  "properties": {
    "entity_id": {"type": "string"},
    "name": {"type": "string"}
  }
}
```

#### 3. Update Mapping Utilities
```javascript
// In mapping-utils.js
TABLE_TO_SCHEMA_MAP['new_table'] = {
  schemaName: 'new_entity',
  idField: 'entity_id'
};
```

### Field Mapping Best Practices

#### 1. Consistent Naming Conventions
- Use snake_case for database fields
- Use camelCase for JSON schema properties
- Maintain semantic consistency across entities

#### 2. Relationship Handling
```javascript
// Parent/foreign key mappings
'parent_project_id' → 'project_id'  // Direct reference
'related_document_id' → 'related_document_id'  // Cross-reference
```

#### 3. Optional vs Required Fields
```javascript
// Database-specific fields (optional in schema)
'created_at', 'updated_at', 'other' → OPTIONAL

// Business logic fields (required in schema)
'entity_id', 'name', 'status' → REQUIRED
```

## Troubleshooting

### Common Issues

#### 1. False Positive Missing Fields
**Symptom**: Required field reported missing despite database column existing
**Cause**: Incorrect field name mapping
**Solution**: Update mapping in `mapDatabaseFieldToSchema()`

#### 2. Type Validation Failures
**Symptom**: Schema expects string but gets integer
**Cause**: Database uses numeric IDs, schema expects string identifiers
**Solution**: Add type conversion or update schema type

#### 3. Low Coverage Metrics
**Symptom**: Coverage below expected threshold
**Cause**: Database-only fields counted in total
**Solution**: Add fields to ignore list or update schema

### Debugging Commands

```bash
# Run full validation with verbose output
npm run validate:crosswalk -- --verbose

# Generate mapping suggestions
node scripts/validate-database-crosswalk.js --suggestions

# Validate specific table
node scripts/validate-database-crosswalk.js --table=comment
```

### Performance Considerations

#### 1. Validation Efficiency
- CSV parsing: O(n) where n = number of database columns
- Schema validation: O(m) where m = number of schema properties
- Field mapping: O(1) lookup with hash maps

#### 2. Memory Usage
- CSV data loaded into memory during validation
- Schema definitions cached for repeated validation
- Results objects maintain full error context

## Maintenance Procedures

### Regular Validation
```bash
# Add to CI/CD pipeline
npm run validate:crosswalk || exit 1
```

### Schema Evolution
1. **Database Changes**: Update crosswalk CSV first
2. **Schema Changes**: Update NEPA schema, then validate
3. **Mapping Changes**: Update utilities, run full test suite

### Quality Assurance
- Maintain 100% validation pass rate
- Ensure >95% schema coverage
- Document any intentional gaps

## Advanced Topics

### Custom Validation Rules
```javascript
// Example: Conditional field requirements
if (tableName === 'gis_data' && hasField(columns, 'geometry_type')) {
  // Special handling for geometric data
  const spatialFields = ['coordinate_system', 'bounding_box'];
  validateSpatialRequirements(columns, spatialFields);
}
```

### Multi-Schema Support
```javascript
// Support for versioned schemas
const schemaVersion = process.env.SCHEMA_VERSION || 'v1';
const schemaPath = `src/jsonschema/nepa.${schemaVersion}.schema.json`;
```

### Integration Testing
```javascript
// Validate against live database schema
const dbSchema = await introspectDatabase();
const crosswalkData = loadCrosswalk();
validateConsistency(dbSchema, crosswalkData);
```

## References

- [JSON Schema Specification](https://json-schema.org/)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [AJV Validation Library](https://ajv.js.org/)
- [NEPA Schema Documentation](./schema-validation.md)
