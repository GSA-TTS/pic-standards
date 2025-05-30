# NEPA Data Schema Guide

This document explains the structure and usage of the NEPA data schema, which is designed to standardize data related to the National Environmental Policy Act (NEPA) review process.

## Schema Overview

The NEPA schema provides a standardized format for representing:

- Projects requiring environmental review
- Review processes (EIS, EA, CE)
- Documents created during reviews
- Public comments and engagement
- Case events and milestones
- GIS data related to projects
- Legal structures and requirements
- User roles and permissions

## Schema Structure

The schema uses **snake_case** naming convention for all field names to ensure consistency across different systems and databases.

### Root Structure

All valid NEPA data must include at minimum a `projects` array:

```json
{
  "projects": [/* required */],
  "processes": [/* optional */],
  "documents": [/* optional */],
  "public_comments": [/* optional */],
  "public_engagement_events": [/* optional */],
  "case_events": [/* optional */],
  "gis_data": [/* optional */],
  "legal_structures": [/* optional */],
  "user_roles": [/* optional */]
}
```

## Core Entities

### Project

The central entity in the schema. A project represents an activity or decision requiring NEPA review.

**Required fields**: `project_id`, `project_title`, `project_description`, `project_sector`, `project_sponsor`, `lead_agency`, `location`

```json
{
  "projects": [{
    "project_id": "unique-id",
    "project_title": "Highway Infrastructure Project",
    "project_description": "Construction of new highway corridor",
    "project_sector": "transportation",
    "lead_agency": "Department of Transportation",
    "project_sponsor": {
      "name": "State Highway Department",
      "contact_info": "contact@highway.state.gov"
    },
    "location": {
      "description": "Interstate corridor through rural area"
    },
    "participating_agencies": ["EPA", "USACE"],
    "current_status": "underway"
  }]
}
```

### Process

Represents a specific type of environmental review, permit, or authorization.

**Required fields**: `process_id`, `project_id`, `process_type`, `process_status`, `lead_agency`

```json
{
  "processes": [{
    "process_id": "unique-id",
    "project_id": "reference-to-project",
    "process_type": "EIS",
    "process_status": "underway",
    "lead_agency": "Department of Transportation",
    "start_date": "2024-01-15",
    "cooperating_agencies": ["EPA"],
    "participating_agencies": ["USACE"]
  }]
}
```

### Document

Official records created during the NEPA review process.

**Required fields**: `document_id`, `process_id`, `document_type`, `title`, `prepared_by`

```json
{
  "documents": [{
    "document_id": "unique-id",
    "process_id": "reference-to-process",
    "document_type": "Draft EIS",
    "title": "Draft Environmental Impact Statement",
    "prepared_by": "Department of Transportation",
    "publish_date": "2024-06-01",
    "accessibility": "public"
  }]
}
```

### Public Comment

Feedback submitted during the NEPA process.

**Required fields**: `comment_id`, `commenter_name`, `content`, `date_submitted`, `related_document_id`

```json
{
  "public_comments": [{
    "comment_id": "unique-id",
    "commenter_name": "Environmental Coalition",
    "content": "We request additional wildlife impact studies",
    "date_submitted": "2024-07-15",
    "related_document_id": "reference-to-document",
    "method_of_submission": "online",
    "privacy_level": "public"
  }]
}
```

### Case Event

Milestones and steps within the NEPA review process.

**Required fields**: `case_event_id`, `process_id`, `event_name`, `event_date`, `event_type`

```json
{
  "case_events": [{
    "case_event_id": "unique-id",
    "process_id": "reference-to-process",
    "event_name": "Notice of Intent Published",
    "event_date": "2024-03-01",
    "event_type": "NOI",
    "status": "completed",
    "for_public_display": true
  }]
}
```

### GIS Data

Location-based information and spatial data.

**Required fields**: `gis_id`, `source`, `creator`

```json
{
  "gis_data": [{
    "gis_id": "unique-id",
    "description": "Project boundary and impact zones",
    "source": "Field surveys and satellite imagery",
    "creator": "GIS Department",
    "container_inventory": {
      "format": "GeoJSON",
      "coordinate_system": "WGS84",
      "purpose": "bespoke"
    }
  }]
}
```

## Field Naming Convention

The schema uses **snake_case** for all field names:

- `project_id` (not `projectId`)
- `lead_agency` (not `leadAgency`)
- `public_engagement_events` (not `publicEngagementEvents`)
- `related_document_id` (not `relatedDocumentId`)

## Enum Values

Several fields have restricted values:

### Project Status
- `"pre-application"`
- `"underway"`
- `"paused"`
- `"completed"`

### Process Type
- `"CE"` (Categorical Exclusion)
- `"EA"` (Environmental Assessment)
- `"EIS"` (Environmental Impact Statement)

### Process Status
- `"planned"`
- `"underway"`
- `"paused"`
- `"completed"`

### Document Types
- `"NOI"` (Notice of Intent)
- `"Draft EIS"`
- `"Final EIS"`
- `"ROD"` (Record of Decision)

## Data Formats

The schema supports multiple data formats:

### JSON
Primary format for complete data representation with full validation.

### CSV
Tabular data exports with field mapping:
- CSV column names are mapped to schema properties
- Files are validated by combining into schema structure
- Common mappings: `id` → `project_title`, `title` → `project_title`
- Dot notation for nested objects could also be used (e.g., `project_sponsor.name`)

```csv
project_id,project_title
highway-001,Interstate 95 Corridor Improvement
```
### YAML
Human-readable alternative to JSON, validated against the same schema.

## Validation

### Required Relationships
- All `project_id` references must exist in the projects array
- All `process_id` references must exist in the processes array
- All `document_id` references must exist in the documents array

### Data Types
- Arrays: `participating_agencies`, `cooperating_agencies`
- Objects: `project_sponsor`, `location`, `container_inventory`
- Strings: All ID fields, names, descriptions
- Dates: ISO 8601 format (`YYYY-MM-DD`)

### Validation Tools

Use the provided scripts for validation:

```bash
# Validate JSON files
npm run validate:json

# Validate YAML files  
npm run validate:yaml

# Validate CSV files
npm run validate:csv

# Validate database crosswalk
npm run validate:crosswalk
```

## Example Complete Document

```json
{
  "projects": [{
    "project_id": "highway-001",
    "project_title": "Interstate 95 Corridor Improvement",
    "project_description": "Widening and improvement of 50-mile corridor",
    "project_sector": "transportation",
    "lead_agency": "Federal Highway Administration",
    "project_sponsor": {
      "name": "State Department of Transportation",
      "contact_info": "projects@state-dot.gov"
    },
    "location": {
      "description": "Interstate 95 from Mile 150 to Mile 200"
    },
    "participating_agencies": ["EPA", "USACE", "USFWS"],
    "current_status": "underway",
    "start_date": "2024-01-15"
  }],
  "processes": [{
    "process_id": "eis-highway-001",
    "project_id": "highway-001",
    "process_type": "EIS",
    "process_status": "underway",
    "lead_agency": "Federal Highway Administration",
    "start_date": "2024-02-01",
    "cooperating_agencies": ["EPA"],
    "participating_agencies": ["USACE", "USFWS"]
  }],
  "documents": [{
    "document_id": "noi-highway-001",
    "process_id": "eis-highway-001",
    "document_type": "NOI",
    "title": "Notice of Intent for Interstate 95 Corridor EIS",
    "prepared_by": "Federal Highway Administration",
    "publish_date": "2024-03-01",
    "accessibility": "public"
  }],
  "case_events": [{
    "case_event_id": "noi-pub-001",
    "process_id": "eis-highway-001",
    "event_name": "NOI Published",
    "event_date": "2024-03-01",
    "event_type": "NOI",
    "status": "completed",
    "for_public_display": true,
    "document_id": "noi-highway-001"
  }]
}
```

## Best Practices

1. **Always include projects**: Every valid document must have at least one project
2. **Use proper relationships**: Ensure all ID references point to existing entities
3. **Follow naming conventions**: Use snake_case for all field names
4. **Validate regularly**: Use the provided validation scripts during development
5. **Maintain data integrity**: Keep related data synchronized across entities
6. **Use enum values**: Stick to predefined values for status and type fields

## Database Integration

The schema is designed to work with relational databases. See `src/crosswalk/database_crosswalk.csv` for field mappings between the JSON schema and database table structures.

Use `npm run validate:crosswalk` to ensure database schema alignment.
