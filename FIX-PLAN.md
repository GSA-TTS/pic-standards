# Crosswalk Alignment Fix Plan (v1.2.x)

Last updated: 2025-08-13

## Summary

- Centralized mapping logic prefers generic schema properties when present: id, title, description, name.
- Cleaned scripts/utils/mapping-utils.js and removed duplicate exports.
- Added/adjusted per-table mappings to align database crosswalk with nepa.schema.json.
- Crosswalk now passes for all tables (with some optional properties unmatched by design).

## Mapping Rules

- Prefer generic property names when schema defines them:
  - id → id (fallback to entity-specific id only if schema lacks id)
  - title → title; description → description; name → name
- Only then apply table-specific renames from TABLE_FIELD_MAPPINGS.
- Avoid nulling process_instance fields; allow identity mapping unless explicitly remapped.

## Key Table Mappings (additions/changes)

- project:
  - id → id; title → title; description → description
  - sector → project_sector; sponsor → project_sponsor; type → project_type; funding → funding_source
  - location_text → location; location_object → location
- document:
  - id → id; revision_number → revision_number; supplement_number → supplement_number
- process_instance:
  - id, parent_project_id, type, status, lead_agency, parent_process_id → same name
  - comment_start, comment_end, federal_id, stage, start_date, complete_date, outcome, purpose_need → same name
  - process_model → process_model
- case_event:
  - id → id; name → name; event_type → event_type
- gis_data:
  - id → id; data_container → data_container
- gis_data_element:
  - id → id; parent_gis → parent_gis; format → format
- process_model:
  - id → id; title → title
- legal_structure, user_role:
  - id → id
- comment and engagement:
  - comment: date_submitted, public_access/public_source preserved; metadata mapped
  - engagement: type, start_datetime, end_datetime preserved
- process_decision_payload:
  - process, project, process_decision_element, evaluation_data, created_at → same name

## Crosswalk Status (after changes)

- PASS overall; all mapped tables VALID.
- Remaining unmatched (non-blocking):
  - case_event: event_type (schema keeps type and event_type)
  - gis_data_element: gis_id, data_type (accepted alternates exist in NEPA schema)
  - project: location_object, location_text (flattened fields retained for provenance; "location" satisfies required)

## Verification

- npm run coverage-test → PASS (7/7)
- npm run validate:crosswalk → PASS overall (all tables VALID)

## Notes

- Keep schema and crosswalk vocabulary aligned; prefer schema terms on conflicts.
- If future DB adds columns, extend TABLE_FIELD_MAPPINGS or allow identity mapping where safe.
