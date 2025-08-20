/**
 * Mapping utilities for schema validation
 * Handles field mappings between database, OpenAPI, and NEPA schema
 */


// Database fields that should be ignored during validation
const IGNORED_FIELDS = [
  'created_at',
  'updated_at',
  '_id',
  'other',
  // Parent relationship fields that are truly implementation details (not mapped to required fields)
  'parent_comment_id', 'parent_event_id', 'parent_engagement_id', 'parent_case_event_id'
];

// Mapping from database tables to NEPA schema entities (no compensating aliases)
const TABLE_TO_SCHEMA_MAP = {
  project: { schemaName: 'project', idField: 'project_id' },
  process_instance: { schemaName: 'process_instance', idField: 'process_id' },
  document: { schemaName: 'document', idField: 'document_id' },
  comment: { schemaName: 'comment', idField: 'comment_id' },
  engagement: { schemaName: 'engagement', idField: 'event_id' },
  case_event: { schemaName: 'case_event', idField: 'case_event_id' },
  gis_data: { schemaName: 'gis_data', idField: 'gis_id' },
  gis_data_element: { schemaName: 'gis_data_element', idField: 'gis_element_id' },
  user_role: { schemaName: 'user_role', idField: 'role_id' },
  legal_structure: { schemaName: 'legal_structure', idField: 'legal_structure_id' },
  decision_element: { schemaName: 'decision_element', idField: 'decision_element_id' },
  process_model: { schemaName: 'process_model', idField: 'process_model_id' },
  process_decision_payload: { schemaName: 'process_decision_payload', idField: 'decision_payload_id' },
};

/**
 * Normalize mapping for a table/entity name to ensure consistent shape
 * No compensating logic for renamed/removed fields; only use schema names as defined
 */
function normalizeMapping(tableName, map) {
  const mapping = map[tableName];
  if (typeof mapping === 'object' && mapping !== null) {
    // Support both 'schemaName' and legacy 'schema' keys
    return {
      schemaName: mapping.schemaName !== undefined ? mapping.schemaName : mapping.schema,
      idField: mapping.idField
    };
  }
  return { schemaName: tableName, idField: `${tableName}_id` };
}

/**
 * Check if a field should be ignored during validation
 * No compensating logic for renamed/removed fields
 */
function shouldIgnoreField(fieldName) {
  // System fields that should always be ignored
  const systemFields = ['created_at', 'updated_at', '_id', 'other'];
  const ignoredParentFields = ['parent_comment_id','parent_event_id','parent_engagement_id','parent_case_event_id'];
  if (systemFields.includes(fieldName) || ignoredParentFields.includes(fieldName)) return true;
  if (fieldName.startsWith('_') || fieldName.includes('_json')) return true;
  if (fieldName.endsWith('_id') && fieldName.startsWith('parent_')) {
    const importantParentFields = ['parent_project_id','parent_process_id','parent_document_id'];
    return !importantParentFields.includes(fieldName);
  }
  return false;
}

// Removed canIgnoreRequiredField: no compensating logic for required fields

/**
 * For coverage, count only non-ignored properties
 */
function shouldCountProperty(propName) {
  return !shouldIgnoreField(propName);
}

/**
 * Get schema mapping for a database table
 */
function getSchemaMapping(tableName) {
  const mapping = TABLE_TO_SCHEMA_MAP[tableName];
  if (typeof mapping === 'string') return { schemaName: mapping, idField: `${tableName}_id` };
  if (typeof mapping === 'object' && mapping !== null) return mapping;
  return { schemaName: tableName, idField: `${tableName}_id` };
}

/**
 * Table-specific field mappings that should be honored first
 */
const TABLE_FIELD_MAPPINGS = {
  project: {
    id: 'id',
    title: 'title',
    description: 'description',
    sector: 'sector',
    sponsor: 'sponsor',
    type: 'type',
    funding: 'funding',
    location_text: 'location_text',
    location_object: 'location_object'
  },
  document: {
    id: 'id',
    revision_number: 'revision_number',
    supplement_number: 'supplement_number',
    public_access: 'public_access',
    parent_process_id: 'parent_process_id'
  },
  process_instance: {
    id: 'id',
    parent_project_id: 'parent_project_id',
    comment_start: 'comment_start',
    comment_end: 'comment_end',
    process_model: 'process_model',
    federal_id: 'federal_id',
    description: 'description',
    type: 'type',
    status: 'status',
    stage: 'stage',
    complete_date: 'complete_date',
    outcome: 'outcome'
  },
  gis_data: {
    id: 'id',
    centroid_lat: 'centroid_lat',
    centroid_lon: 'centroid_lon',
    creator_contact: 'creator_contact',
    map_image: 'map_image',
    data_container: 'data_container',
    address: 'address',
    updated_last: 'last_updated',
    creator: 'creator',
    description: 'description',
    extent: 'extent',
    notes: 'notes'
  },
  comment: {
    id: 'id',
    commenter_entity: 'commenter_entity',
    content_text: 'content_text',
    date_submitted: 'date_submitted',
    parent_document_id: 'parent_document_id',
    submission_method: 'submission_method',
    response_text: 'response_text',
    public_source: 'public_source',
    content_json: 'content_json',
    response_json: 'response_json',
    public_access: 'public_access',
    other: 'other',
    record_owner_agency: 'record_owner_agency',
    data_source_agency: 'data_source_agency',
    data_source_system: 'data_source_system',
    data_record_version: 'data_record_version',
    last_updated: 'last_updated',
    retrieved_timestamp: 'retrieved_timestamp'
  },
  case_event: {
    id: 'id',
    name: 'name',
    type: 'type',
    datetime: 'datetime',
    parent_process_id: 'parent_process_id',
    address: 'address'
  },
  engagement: {
    id: 'id',
    type: 'type',
    date: 'date',
    parent_process_id: 'parent_process_id',
    location: 'location',
    attendance: 'attendance',
    related_document_id: 'related_document_id',
    end_datetime: 'end_datetime',
    start_datetime: 'start_datetime',
    participation: 'participation',
    other: 'other',
    notes: 'notes',
    record_owner_agency: 'record_owner_agency',
    data_source_agency: 'data_source_agency',
    data_source_system: 'data_source_system',
    data_record_version: 'data_record_version',
    last_updated: 'last_updated',
    retrieved_timestamp: 'retrieved_timestamp'
  },
  decision_element: {
    id: 'id',
    title: 'title',
    description: 'description',
    threshold: 'threshold',
    spatial: 'spatial',
    category: 'category'
  },
  process_decision_payload: {
    id: 'id',
    process: 'process',
    project: 'project',
    process_decision_element: 'process_decision_element',
    evaluation_data: 'evaluation_data',
    created_at: 'created_at'
  },
  process_model: {
    id: 'id',
    title: 'title'
  },
  gis_data_element: {
    id: 'id',
    parent_gis: 'parent_gis',
    format: 'format',
    container_reference: 'container_reference',
    access_method: 'access_method',
    coordinate_system: 'coordinate_system',
    top_left_lat: 'top_left_lat',
    top_left_lon: 'top_left_lon',
    bot_right_lat: 'bot_right_lat',
    bot_right_lon: 'bot_right_lon',
    purpose: 'purpose',
    data_match: 'data_match',
    access_info: 'access_info'
  },
  legal_structure: { id: 'id' },
  user_role: { id: 'id' }
};

/**
 * Map database field to schema property
 */
function mapDatabaseFieldToSchema(fieldName, tableName, schemaProperties = null) {
  // Support dot notation: table.field
  let baseTable = tableName;
  let baseField = fieldName;
  if (fieldName && fieldName.includes('.') && !tableName) {
    const parts = fieldName.split('.');
    baseTable = parts[0];
    baseField = parts[1];
  }

  // Prefer generic property names if present in NEPA schema (before table-specific renames)
  if (baseField === 'id') {
    if (schemaProperties && schemaProperties['id']) return 'id';
    // Fallback to entity-specific id only if schema truly lacks a generic 'id'
    return mapEntityId(baseTable);
  }
  if (['title', 'description', 'name'].includes(baseField)) {
    if (schemaProperties && schemaProperties[baseField]) return baseField;
  }

  // Then apply table-specific mappings
  if (TABLE_FIELD_MAPPINGS[baseTable] && TABLE_FIELD_MAPPINGS[baseTable][baseField]) {
    return TABLE_FIELD_MAPPINGS[baseTable][baseField];
  }

  // Synonyms and vocabulary cleanup
  if (baseTable === 'comment') {
    if (baseField === 'public_acess' || baseField === 'public_access') return 'public_access';
    if (baseField === 'public_source') return 'public_source';
  }
  if (baseTable === 'engagement') {
    if (baseField === 'start_datetime') return 'start_datetime';
    if (baseField === 'end_datetime') return 'end_datetime';
    if (baseField === 'created_at') return null; // system field
  }

  // process_instance specific
  if (baseTable === 'process_instance') {
  if (baseField === 'type') return 'type';
  if (baseField === 'status') return 'status';
  if (baseField === 'lead_agency') return 'lead_agency';
  if (baseField === 'parent_project_id') return 'parent_project_id';
  if (baseField === 'parent_process_id') return 'parent_process_id';
  // Do not prematurely null out other fields; allow identity mapping downstream
  }

  // Global special mappings
  const specialMappings = {
    sponsor: 'project_sponsor',
    location_text: 'location',
    location_object: 'location',
    content_text: 'content',
    response_text: 'agency_response',
    commenter_entity: 'commenter_name',
    submission_method: 'method_of_submission',
    public_acess: 'public_access',
    related_process_id: 'process_id'
  };
  if (specialMappings[baseField]) return specialMappings[baseField];

  return baseField;
}

/** Map entity ID field for database tables */
function mapEntityId(tableName) {
  const mapping = getSchemaMapping(tableName);
  return mapping.idField;
}

/** Map status values from database format to NEPA schema format */
function mapStatus(status) {
  const statusMap = {
    'Pre-application': 'pre-application',
    Complete: 'completed',
    Completed: 'completed',
    'In Progress': 'in-progress',
    Pending: 'pending',
    Active: 'underway',
    Cancelled: 'cancelled'
  };
  return statusMap[status] || (typeof status === 'string' ? status.toLowerCase() : status) || 'underway';
}

/** Map document types from database format to NEPA schema format */
function mapDocumentType(type) {
  const typeMap = {
    FEIS: 'Final EIS',
    DEIS: 'Draft EIS',
    EA: 'Environmental Assessment',
    FONSI: 'Finding of No Significant Impact',
    NOI: 'Notice of Intent',
    ROD: 'Record of Decision'
  };
  return typeMap[type] || type;
}

/** Map engagement types from database format to NEPA schema format */
function mapEngagementType(type) {
  const typeMap = {
    'public meeting': 'public meeting',
    notice: 'notice',
    solicitation: 'solicitation',
    hearing: 'public hearing',
    workshop: 'workshop',
    scoping: 'scoping meeting'
  };
  return typeMap[type] || 'public meeting';
}

/** Map event status values from database format to NEPA schema format */
function mapEventStatus(status) {
  const statusMap = {
    Completed: 'completed',
    Complete: 'completed',
    'In Progress': 'in-progress',
    Pending: 'pending',
    Cancelled: 'cancelled',
    Scheduled: 'scheduled'
  };
  return statusMap[status] || (typeof status === 'string' ? status.toLowerCase() : status) || 'pending';
}

/** Check if a column exists in the provided columns array. */
function hasField(columns, columnName) {
  if (!Array.isArray(columns)) return false;
  return columns.some(col => col && col.column === columnName);
}

module.exports = {
  mapStatus,
  mapDocumentType,
  mapEngagementType,
  mapEventStatus,
  shouldIgnoreField,
  mapEntityId,
  mapDatabaseFieldToSchema,
  getSchemaMapping,
  hasField,
  IGNORED_FIELDS,
  TABLE_TO_SCHEMA_MAP,
  shouldCountProperty,
  normalizeMapping
};
