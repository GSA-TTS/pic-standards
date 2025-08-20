# NEPA Schema Fix Plan (v1.2.x)

This plan addresses INVALID findings from `npm run validate:crosswalk` by aligning `nepa.schema.json` with the database crosswalk and making mappings explicit.

## Summary of issues
- comment: INVALID (0/0 properties found) – mapping mismatch and minor type inconsistency
- engagement: INVALID (0/0 properties found) – mapping mismatch and required field typo
- gis_data_element: INVALID – required `format` missing; DB uses `data_type`
- process_instance, process_decision_payload: INVALID (0/0) – mapping names did not align with schema definitions
- Various false positives for unmatched DB fields like `id` due to post-processing not using schema context

## Changes implemented
1) Mapping fixes (scripts/utils/mapping-utils.js)
- Table map aligned to schema names: `comment`, `engagement`, `process_instance`, `process_decision_payload`.
- Comment fields: map `public_acess`/`public_access` -> `public_access`; allow `public_source`.
- Engagement fields: map `start_datetime` and `end_datetime` to the same-named schema fields (not to a non-existent `date`).

2) Schema fixes (src/jsonschema/nepa.schema.json)
- engagement.required: replace `date` with `start_datetime`.
- comment.parent_document_id: type `integer` (was `string`) to match DB and other references.
- gis_data_element.required: enforce `id` and `gis_id` and require at least one of `format` or `data_type` via:
  - allOf: [ { required: ["id","gis_id"] }, { anyOf: [ { required: ["format"] }, { required: ["data_type"] } ] } ]

3) Crosswalk validator improvement
- Use schemaProperties context when computing unmatched database fields to avoid false positives for `id`, etc.

## Follow-ups (deferred)
- Top-level collections: fix typo `processe_instances` -> `process_instances` and ensure dependencies reference the correct key. This is outside crosswalk scope but should be corrected for data-file validation.
- case_event: treat `type` vs `event_type` consistently; consider deprecating `event_type` (schema keeps `type`).
- Add `oneOf`/enums reconciliation where DB uses variants (e.g., status picklists).

## How to verify
- Run: `npm run validate:crosswalk`
- Expect previously INVALID tables (comment, engagement, process_instance, process_decision_payload) to resolve to VALID/with coverage.
- Expect gis_data_element to be VALID if crosswalk has either `format` or `data_type`.

## Current status (2025-08-13)

- Crosswalk: PASS overall; all tables VALID.
- Rule adopted: prefer generic id/title/description/name where schema provides them; apply table-specific renames only when needed.

## Compatibility notes
- All schema changes are backward-compatible with existing data structures:
  - comment.parent_document_id becoming integer matches other relationship IDs.
  - engagement uses existing `start_datetime`/`end_datetime` fields.
  - gis_data_element accepts either `format` or `data_type`.

## Next Steps: Crosswalk Validation and Schema Alignment

1. **Fix Reporting Error:**
   - Investigate and resolve the `Cannot convert undefined or null to object` error in the crosswalk validation summary. Likely cause: missing or undefined fileName/summary object in the final reporting step.
   - Add defensive checks and fallback values to error reporting and summary output.

2. **Investigate Table Coverage Issues:**
   - Review tables with 0/0 coverage (`comment`, `engagement`, `process_instance`, `process_decision_payload`).
   - Check for missing or incomplete schema definitions, mapping inconsistencies, or crosswalk omissions.
   - Update schema or crosswalk as needed to ensure all entities are represented and mapped.

3. **Further Improvements:**
   - Continue harmonizing vocabulary and structure between schema and crosswalk (see detailed entity breakdowns below).
   - Add more robust coverage metrics and reporting (e.g., partial matches, rationale for ignored fields).
   - Expand unit/integration tests to cover edge cases and reporting logic.
   - Document known mismatches and rationale for any intentional differences.

---
Of course. I have analyzed the database crosswalk CSV and compared it against the provided JSON schema. Here is a detailed comparison, highlighting alignments, validations, and mismatches using dot notation.

### **Executive Summary**

The database crosswalk and the JSON schema are largely aligned, indicating a strong foundational consistency between the database design and the data standard. The core entities (`project`, `document`, `case_event`, etc.) and most of their fields match well in name, purpose, and data type.

However, several key areas of discrepancy require attention to ensure full compliance and interoperability:

1.  **Vocabulary Mismatches:** There are numerous instances of minor but important differences in field names (e.g., `sector` vs. `project_sector`, `type` vs. `project_type`, `revision_number` vs. `revision_number`).
2.  **Structural & Hierarchy Mismatches:** The most significant mismatch is in how location data is handled. The schema defines a nested `project.location` object, whereas the crosswalk uses flattened, separate fields (`location_text`, `location_object`).
3.  **Inconsistent or Missing Fields:** Some fields exist in the crosswalk but not the schema (e.g., `document.document_revision`), and vice-versa. Several schema `required` fields are not explicitly marked as such or are structurally different in the crosswalk.
4.  **Schema Inconsistency:** A minor error was found within the JSON schema itself for the `gis_data_element` definition, where a required field is named differently in the properties list.

The following detailed breakdown provides specific, actionable feedback for each data entity.

---

### **Detailed Comparison by Entity**

#### **1. Project (`project`)**
*   **Status:** Good alignment, but with significant vocabulary and structural mismatches.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | ✅ Aligned | |
| `title` | `title` | ✅ Aligned | |
| `description` | `description` | ✅ Aligned | |
| `project_sponsor` | `sponsor` | ⚠️ **Vocabulary Mismatch** | Schema uses `project_sponsor`. |
| `location` | `location_text`, `location_object` | ❌ **Hierarchy Mismatch** | Schema requires a nested object `location` with a required `description` property. Crosswalk uses separate flat fields. |
| `location.description` | `location_text` | ⚠️ **Partial Match** | Likely intended to match, but the hierarchy is incorrect. |
| `location.gis_reference`| *(none)* | ❌ **Missing from Crosswalk** | This field from the nested `location` object is missing. |
| `project_sector` | `sector` | ⚠️ **Vocabulary Mismatch** | Schema uses `project_sector`. |
| `project_type` | `type` | ⚠️ **Vocabulary Mismatch** | Schema uses `project_type`. |
| `funding_source` | `funding` | ⚠️ **Vocabulary Mismatch** | Schema uses `funding_source`. |
| `lead_agency` | `lead_agency` | ✅ Aligned | |
| `participating_agencies` | `participating_agencies` | ✅ Aligned | Schema type is `string`, but description implies an array. Crosswalk type is `text`. This is consistent. |
| `start_date` | `start_date` | ✅ Aligned | |
| `current_status` | `current_status` | ✅ Aligned | |
| `location_lat` | `location_lat` | ✅ Aligned | |
| `location_lon` | `location_lon` | ✅ Aligned | |
| `sponsor_contact` | `sponsor_contact` | ✅ Aligned | |
| `parent_project_id` | `parent_project_id` | ✅ Aligned | |
| `notes` | *(none)* | ❌ **Missing from Crosswalk** | Schema includes a `notes` field. |
| *(none)* | `created_at` | ❌ **Missing from Schema** | Crosswalk has a `created_at` field not present in the schema. |

*   **Required Fields Check:**
    *   `id`, `title`, `description`: ✅ Aligned.
    *   `sponsor`: ⚠️ Aligned in concept but mismatched in name (`project_sponsor`).
    *   `location`: ❌ **Not Aligned.** The required nested `location` object is not present in the crosswalk.

---

#### **2. Process Instance (`process_instance`)**
*   **Status:** Very good alignment. Minor discrepancies.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | ✅ Aligned | |
| `parent_project_id` | `parent_project_id` | ✅ Aligned | |
| `type` | `type` | ✅ Aligned | |
| `status` | `status` | ✅ Aligned | |
| `lead_agency` | `lead_agency` | ✅ Aligned | |
| `parent_process_id` | `parent_process_id` | ✅ Aligned | |
| `cooperating_agencies`| `cooperating_agencies` | ✅ Aligned | Schema type is `array`, crosswalk is `text`. This is a common and acceptable mapping for arrays. |
| `comment_start` | `comment_start` | ✅ Aligned | Schema format is `date-time`, crosswalk is `date`. **Minor type mismatch.** |
| `comment_end` | `comment_end` | ✅ Aligned | Schema format is `date-time`, crosswalk is `date`. **Minor type mismatch.** |
| `process_model` | `process_model` | ✅ Aligned | Schema type is `string`/`null`, crosswalk is `bigint`. This reflects a foreign key relationship, which is a valid implementation. |

*   **Required Fields Check:**
    *   `id`, `parent_project_id`, `type`, `status`, `lead_agency`: ✅ All aligned and present.

---

#### **3. Document (`document`)**
*   **Status:** Good alignment, with minor vocabulary mismatches and one extra field in the crosswalk.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | ✅ Aligned | |
| `parent_process_id` | `parent_process_id` | ✅ Aligned | |
| `document_type` | `document_type` | ✅ Aligned | |
| `title` | `title` | ✅ Aligned | |
| `prepared_by` | `prepared_by` | ✅ Aligned | |
| `revision_number` | `revision_number` | ⚠️ **Vocabulary Mismatch** | Schema uses `revision_number`. |
| `supplement_number` | `supplement_number` | ⚠️ **Vocabulary Mismatch** | Schema uses `supplement_number`. |
| *(none)* | `document_revision` | ❌ **Missing from Schema** | Crosswalk has a `text` field for revision which seems redundant with `revision_number`. The schema only has the numeric version. |

*   **Required Fields Check:**
    *   `id`, `parent_process_id`, `document_type`, `title`, `prepared_by`: ✅ All aligned and present.

---

#### **4. Comment (`comment`)**
*   **Status:** Good alignment, but with a critical typo and a type mismatch.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `public_access` | `public_acess` | ⚠️ **Vocabulary Mismatch (Typo)** | Crosswalk has a typo: `public_acess`. |
| `public_access` | `public_acess` | ❌ **Type Mismatch** | Schema type is `string`. Crosswalk type is `boolean`. |
| *(none)* | `public_source` | ❌ **Missing from Schema** | Crosswalk has `public_source` (boolean) field not in the schema. |

*   **Required Fields Check:**
    *   `id`, `commenter_entity`, `content_text`, `date_submitted`, `parent_document_id`: ✅ All aligned and present.

---

#### **5. Engagement (`engagement`)**
*   **Status:** Excellent alignment. One minor discrepancy in a required field.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `date` | *(none)* | ❌ **Missing from Crosswalk** | The required `date` field is missing. The crosswalk uses `start_datetime` and `end_datetime` instead, which is a reasonable but different implementation. |
| *(none)* | `created_at` | ❌ **Missing from Schema** | Crosswalk has a `created_at` field not present in the schema. |

*   **Required Fields Check:**
    *   `id`, `type`, `parent_process_id`: ✅ Aligned.
    *   `date`: ❌ **Not Aligned.** The schema requires `date`, but the crosswalk provides `start_datetime` and `end_datetime`. The schema should likely be updated to reflect this more granular approach.

---

#### **6. Case Event (`case_event`)**
*   **Status:** Excellent alignment. One minor vocabulary mismatch.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `type` | `type` | ✅ Aligned | |
| `event_type` | *(none)* | ❌ **Missing from Crosswalk** | The schema has an `event_type` field. The crosswalk's `type` field seems to serve this purpose. The schema has both `type` and `event_type` with identical descriptions, which appears redundant. This should be clarified in the schema. |

*   **Required Fields Check:**
    *   `id`, `parent_process_id`, `name`, `datetime`, `type`: ✅ All aligned and present.

---

#### **7. GIS Data (`gis_data`)**
*   **Status:** Good alignment, but with several vocabulary mismatches.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `centroid_latitude` | `centroid_lat` | ⚠️ **Vocabulary Mismatch** | Schema uses full `latitude`. |
| `centroid_longitude` | `centroid_lon` | ⚠️ **Vocabulary Mismatch** | Schema uses full `longitude`. |
| `creator_contact_info` | `creator_contact` | ⚠️ **Vocabulary Mismatch** | Schema uses `creator_contact_info`. |
| `map_image_url` | `map_image` | ⚠️ **Vocabulary Mismatch** | Schema specifies `map_image_url`. |
| `location_address` | `address` | ⚠️ **Vocabulary Mismatch** | Schema uses `location_address`. |
| `last_updated` | `updated_last` | ⚠️ **Vocabulary Mismatch** | The primary timestamp field is named differently. The crosswalk also contains another `last_updated` field, likely for the standard metadata block, creating potential confusion. |

---

#### **8. GIS Data Element (`gis_data_element`)**
*   **Status:** Good alignment, but with a key vocabulary mismatch and a schema inconsistency.
*   **Field-by-Field Analysis:**

| Schema Field (JSON) | Crosswalk Field (CSV) | Alignment Status | Notes |
| :--- | :--- | :--- | :--- |
| `data_type` | `format` | ⚠️ **Vocabulary Mismatch** | Schema requires `data_type`. Crosswalk uses `format`. The descriptions match. |
| `parent_gis` / `gis_id`| `parent_gis` | ⚠️ **Schema Inconsistency** | The schema `required` list specifies `parent_gis`, but the `properties` define `gis_id`. The crosswalk uses `parent_gis`. The schema should be corrected to use one consistent name (`gis_id` is more conventional). |

*   **Required Fields Check:**
    *   `id`: ✅ Aligned.
    *   `parent_gis`: ✅ Aligned with crosswalk, but inconsistent within the schema itself.
    *   `data_type`: ⚠️ Aligned in concept (`format`) but mismatched in name.

---

#### **9. Other Entities**
*   **`decision_element`**: Excellent alignment. The `process_model_id` in the schema is represented as `process_model` (bigint) in the crosswalk, which is a correct implementation.
*   **`legal_structure`**: Excellent alignment.
*   **`process_model`**: Excellent alignment.
*   **`process_decision_payload`**: Good alignment. The `process_id` required by the schema is named `process` in the crosswalk, a minor vocabulary difference.
*   **`user_role`**: Excellent alignment.