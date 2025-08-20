# Enhanced NEPA Schema Validation

This directory contains the enhanced validation system for NEPA schema files, implementing the improvements described in the validation debugging and refactoring guides.

#### Centralized Summary Printing
Summary output responsibilities have been consolidated:

- `printSummary(summary, { verbose })` accepts a structured summary object (success flag, counts, errors)
- `printOperationSummary(success, label)` helper builds a minimal summary for simple one-step operations

Legacy wrapper functions previously exposed by `validation-utils.js` have been removed to keep validation logic separate from reporting concerns. Import from `./utils/error-reporting` instead of `validation-utils` for any summary printing.

## Usage

### Basic Validation

```bash
# Validate JSON files
node scripts/validate-json.js

# Validate YAML files  
node scripts/validate-yaml.js
```

### Debug Mode

```bash
# Show detailed debug information
node scripts/validate-json.js --debug
node scripts/validate-yaml.js --debug
```

### Entity Exploration

```bash
# Explore entity mappings in a file
node scripts/debug-validation.js --entities src/json/all_entities.json

# Run validation with detailed debug output
node scripts/debug-validation.js --validate src/json/all_entities.json

# Show all available information
node scripts/debug-validation.js --all src/json/all_entities.json

# Show schema information
node scripts/debug-validation.js --schema
```

## Entity Mapping Examples

The system automatically handles various entity name mappings:

| Input Name | Schema Array Name | Schema Definition |
|------------|------------------|-------------------|
| `comment` | `public_comments` | `public_comment` |
| `process_instance` | `processes` | `process` |
| `engagement` | `public_engagement_events` | `public_engagement_event` |
| `case_event` | `case_events` | `case_event` |

## Field Mapping Examples

The system automatically transforms field names:

| Input Field | Output Field | Context |
|-------------|--------------|---------|
| `id` | `process_id` | In processes |
| `id` | `comment_id` | In public_comments |
| `content_text` | `content` | In public_comments |
| `commenter_entity` | `commenter_name` | In public_comments |
| `parent_project_id` | `project_id` | In processes |
| `parent_document_id` | `related_document_id` | In public_comments |

## Error Message Examples

### Before (Old System)

```text
Error: data[0] must have required property 'process_id'
```

### After (New System)

```text
Errors at (root):
  1. must have required property 'process_id'
     Missing property: process_id
     💡 Suggestion: Add "process_id" property

Errors at /cooperating_agencies:
  1. must be array
     Current value: "Agency C"
     Expected type: array
     Actual type: string
     💡 Suggestion: Change value to array type
```

## Architecture

```text
validation-core.js           # Main validation logic
├── enhanced-mapping-utils.js # Entity and field mapping
├── input-adapters.js        # Input format handling  
├── error-reporting.js       # Rich error display
└── mapping-definitions.js   # Centralized mapping config
```

## Backward Compatibility

The enhanced system maintains backward compatibility with existing:

- `validation-utils.js` - Still available for legacy code (deprecated summary wrappers removed)
- `mapping-utils.js` - Legacy mapping functions are preserved
- Command line interfaces - Same commands work as before

## Configuration

All mapping configurations are centralized in `mapping-definitions.js`:

- **Entity mappings**: Database table names to schema array names
- **Field mappings**: Field name transformations by entity type
- **ID mappings**: Primary key field names for each entity
- **Ignored fields**: System fields to exclude from validation

This makes it easy to add new mappings or modify existing ones without touching the core validation logic.
