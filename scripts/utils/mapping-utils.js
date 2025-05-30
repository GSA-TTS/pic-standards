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
  'notes',
  // Only ignore parent fields that don't map to required schema properties
  'parent_comment_id',
  'parent_event_id', 
  'parent_engagement_id',
  'parent_case_event_id'
  // Removed parent_project_id, parent_process_id, parent_document_id
];

// Mapping from database tables to NEPA schema entities
const TABLE_TO_SCHEMA_MAP = {
  'project': { schemaName: 'project', idField: 'project_id' },
  'process_instance': { schemaName: 'process', idField: 'process_id' },
  'document': { schemaName: 'document', idField: 'document_id' },
  'comment': { schemaName: 'public_comment', idField: 'comment_id' },
  'engagement': { schemaName: 'public_engagement_event', idField: 'event_id' },
  'case_event': { schemaName: 'case_event', idField: 'case_event_id' },
  'gis_data': { schemaName: 'gis_data', idField: 'gis_id' },
  'gis_data_element': { schemaName: 'gis_data_element', idField: 'gis_element_id' },
  'user_role': { schemaName: 'user_role', idField: 'role_id' },
  'legal_structure': { schemaName: 'legal_structure', idField: 'legal_structure_id' },
  'decision_element': { schemaName: 'decision_element', idField: 'decision_element_id' },
  'process_model': { schemaName: 'process_model', idField: 'process_model_id' },
  'process_decision_payload': { schemaName: 'decision_payload', idField: 'decision_payload_id' }
};

// Mapping from OpenAPI definitions to NEPA schema definitions
const OPENAPI_TO_SCHEMA_MAP = {
  'legal_structure': { schema: 'legal_structure', idField: 'legal_structure_id' },
  'gis_data_element': { schema: 'gis_data', idField: 'gis_id' },
  'comment': { schema: 'public_comment', idField: 'comment_id' },
  'engagement': { schema: 'public_engagement_event', idField: 'event_id' },
  'process_model': { schema: 'process_model', idField: 'process_model_id' },
  'gis_data': { schema: 'gis_data', idField: 'gis_id' },
  'process_instance': { schema: 'process', idField: 'process_id' },
  'document': { schema: 'document', idField: 'document_id' },
  'process_decision_payload': { schema: 'decision_payload', idField: 'decision_payload_id' },
  'user_role': { schema: 'user_role', idField: 'role_id' },
  'case_event': { schema: 'case_event', idField: 'case_event_id' },
  'decision_element': { schema: 'decision_element', idField: 'decision_element_id' },
  'project': { schema: 'project', idField: 'project_id' }
};

/**
 * Check if a field should be ignored during validation
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if field should be ignored
 */
function shouldIgnoreField(fieldName) {
  // System fields that should always be ignored
  const systemFields = [
    'created_at', 'updated_at', '_id', 'other', 'notes'
  ];
  
  // Parent relationship fields that are truly implementation details (not mapped to required fields)
  const ignoredParentFields = [
    'parent_comment_id', 'parent_event_id', 'parent_engagement_id', 
    'parent_case_event_id'
  ];
  
  // Check explicit lists first
  if (systemFields.includes(fieldName) || ignoredParentFields.includes(fieldName)) {
    return true;
  }
  
  // Pattern-based ignoring (but allow important parent relationships)
  if (fieldName.startsWith('_') || fieldName.includes('_json')) {
    return true;
  }
  
  // Only ignore parent_*_id fields that don't map to required schema properties
  if (fieldName.endsWith('_id') && fieldName.startsWith('parent_')) {
    const importantParentFields = [
      'parent_project_id',    // Maps to project_id in process_instance
      'parent_process_id',    // Maps to process_id in document, case_event, related_process_id in engagement
      'parent_document_id'    // Maps to related_document_id in comment
    ];
    return !importantParentFields.includes(fieldName);
  }
  
  return false;
}

/**
 * Check if a required field can be ignored for specific table contexts
 * @param {string} fieldName - Schema field name that's required but missing
 * @param {string} tableName - Database table name
 * @returns {boolean} True if this missing required field can be ignored
 */
function canIgnoreRequiredField(fieldName, tableName) {
  // GIS data_type is only required for gis_data_element, not base gis_data
  if (fieldName === 'data_type' && tableName === 'gis_data') {
    return true;
  }
  
  // Other specific cases where required fields don't apply to certain tables
  const ignorableRequiredFields = {
    'gis_data': ['data_type'],          // data_type is for elements, not containers
    'case_event': ['document_id'],      // Not all case events relate to documents
    'document': ['related_document_ids'], // Not all documents have related documents
    'engagement': ['related_document_ids'] // Not all engagements have related documents
  };
  
  if (ignorableRequiredFields[tableName] && ignorableRequiredFields[tableName].includes(fieldName)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a schema property should be counted in coverage calculations
 * @param {string} propName - Schema property name
 * @param {string} tableName - Table name for context
 * @returns {boolean} True if property should be counted
 */
function shouldCountProperty(propName, tableName) {
  // Always count required business fields
  if (!shouldIgnoreField(propName)) {
    return true;
  }
  
  // Don't count system/metadata fields in coverage
  return false;
}

/**
 * Get schema mapping for a database table
 * @param {string} tableName - Database table name
 * @returns {Object} Schema mapping with schemaName and idField
 */
function getSchemaMapping(tableName) {
  return TABLE_TO_SCHEMA_MAP[tableName] || { 
    schemaName: tableName, 
    idField: `${tableName}_id` 
  };
}

/**
 * Map database field to schema property with enhanced logic
 * @param {string} fieldName - Database field name
 * @param {string} tableName - Database table name
 * @returns {string} Schema property name
 */
function mapDatabaseFieldToSchema(fieldName, tableName) {
  // Handle special cases first - map database 'id' to the appropriate schema ID field
  if (fieldName === 'id') {
    return mapEntityId(tableName);
  }
  
  // Enhanced field mappings by table
  const fieldMappingsByTable = {
    'project': {
      'id': 'project_id',
      'title': 'project_title',
      'description': 'project_description',
      'sector': 'project_sector', 
      'sponsor': 'project_sponsor',
      'type': 'project_type',
      'funding': 'funding_source'
    },
    'document': {
      'id': 'document_id',
      'revision_no': 'revision_number',
      'supplement_no': 'supplement_number',
      'public_access': 'public_access',
      'parent_process_id': 'process_id'
    },
    'process_instance': {
      'id': 'process_id',
      'parent_project_id': 'project_id',
      'comment_start': 'comment_period_start',
      'comment_end': 'comment_period_end',
      'process_model': 'process_model_id',
      'federal_id': 'federal_unique_id',
      'description': 'description',
      'type': 'process_type',
      'status': 'process_status',
      'stage': 'process_stage',
      'complete_date': 'completion_date',
      'outcome': 'process_outcome'
    },
    'gis_data': {
      'id': 'gis_id',
      'centroid_lat': 'centroid_latitude',
      'centroid_lon': 'centroid_longitude',
      'creator_contact': 'creator_contact_info',
      'map_image': 'map_image_url',
      'data_container': 'container_inventory',
      'address': 'location_address',
      'updated_last': 'last_updated',
      'creator': 'creator',
      'description': 'description',
      'extent': 'extent',
      'notes': 'notes'
    },
    'comment': {
      'id': 'comment_id',
      'parent_document_id': 'related_document_id',
      'commenter_entity': 'commenter_name',
      'content_text': 'content',
      'submission_method': 'method_of_submission',
      'public_acess': 'public_access',
      'response_text': 'agency_response'
    },
    'case_event': {
      'id': 'case_event_id',
      'name': 'event_name',
      'type': 'event_type',
      'datetime': 'event_date',
      'parent_process_id': 'process_id'
    },
    'engagement': {
      'id': 'event_id',
      'parent_process_id': 'related_process_id',
      'participation': 'participation_method',
      'start_datetime': 'date',
      'related_document_id': 'related_document_id'
    },
    'decision_element': {
      'id': 'decision_element_id',
      'process_model': 'process_model_id',
      'title': 'element_title',
      'description': 'element_description',
      'threshold': 'threshold',
      'spatial': 'spatial',
      'category': 'category'
    },
    'process_decision_payload': {
      'id': 'decision_payload_id',
      'process': 'process_id',
      'project': 'project_id',
      'process_decision_element': 'decision_element_id',
      'evaluation_data': 'payload_data',
      'created_at': 'created_date'
    },
    'process_model': {
      'id': 'process_model_id',
      'title': 'name'
    },
    'gis_data_element': {
      'id': 'gis_element_id',
      'parent_gis': 'gis_id',
      'format': 'data_type',
      'container_reference': 'container_reference',
      'access_method': 'access_method',
      'coordinate_system': 'coordinate_system',
      'top_left_lat': 'top_left_lat',
      'top_left_lon': 'top_left_lon',
      'bot_right_lat': 'bot_right_lat',
      'bot_right_lon': 'bot_right_lon',
      'purpose': 'purpose',
      'data_match': 'data_match',
      'access_info': 'access_info'
    },
    'legal_structure': {
      'id': 'legal_structure_id'
    },
    'user_role': {
      'id': 'role_id'
    }
  };
  
  // Check table-specific mappings first
  if (fieldMappingsByTable[tableName] && fieldMappingsByTable[tableName][fieldName]) {
    return fieldMappingsByTable[tableName][fieldName];
  }
  
  // Special mappings for specific fields (global)
  const specialMappings = {
    'sponsor': 'project_sponsor',
    'location_text': 'location',
    'location_object': 'location',
    'content_text': 'content',
    'response_text': 'agency_response',
    'commenter_entity': 'commenter_name',
    'submission_method': 'method_of_submission',
    'public_acess': 'public_access',
    'related_process_id': 'process_id'
  };
  
  return specialMappings[fieldName] || fieldName;
}

/**
 * Map entity ID field for database tables
 * @param {string} tableName - Database table name
 * @returns {string} Entity ID field name
 */
function mapEntityId(tableName) {
  const mapping = getSchemaMapping(tableName);
  return mapping.idField;
}

/**
 * Map status values from database format to NEPA schema format
 */
function mapStatus(status) {
  const statusMap = {
    'Pre-application': 'pre-application',
    'Complete': 'completed',
    'Completed': 'completed',
    'In Progress': 'in-progress',
    'Pending': 'pending',
    'Active': 'underway',
    'Cancelled': 'cancelled'
  };
  return statusMap[status] || status?.toLowerCase() || 'underway';
}

/**
 * Map document types from database format to NEPA schema format
 */
function mapDocumentType(type) {
  const typeMap = {
    'FEIS': 'Final EIS',
    'DEIS': 'Draft EIS',
    'EA': 'Environmental Assessment',
    'FONSI': 'Finding of No Significant Impact',
    'NOI': 'Notice of Intent',
    'ROD': 'Record of Decision'
  };
  return typeMap[type] || type;
}

/**
 * Map engagement types from database format to NEPA schema format
 */
function mapEngagementType(type) {
  const typeMap = {
    'public meeting': 'public meeting',
    'notice': 'notice', 
    'solicitation': 'solicitation',
    'hearing': 'public hearing',
    'workshop': 'workshop',
    'scoping': 'scoping meeting'
  };
  return typeMap[type] || 'public meeting';
}

/**
 * Map event status values from database format to NEPA schema format
 */
function mapEventStatus(status) {
  const statusMap = {
    'Completed': 'completed',
    'Complete': 'completed',
    'In Progress': 'in-progress',
    'Pending': 'pending',
    'Cancelled': 'cancelled',
    'Scheduled': 'scheduled'
  };
  return statusMap[status] || status?.toLowerCase() || 'pending';
}

/**
 * Check if a column exists in the provided columns array.
 * Assumes columns is an array of objects, each with a 'column' property.
 * @param {Array<Object>} columns - Array of column objects (e.g., from crosswalk).
 * @param {string} columnName - The name of the column to check for.
 * @returns {boolean} True if the column exists, false otherwise.
 */
function hasField(columns, columnName) {
  if (!Array.isArray(columns)) {
    return false;
  }
  return columns.some(col => col && col.column === columnName);
}

module.exports = {
  mapStatus,
  mapDocumentType,
  mapEngagementType,
  mapEventStatus,
  shouldIgnoreField,
  canIgnoreRequiredField,
  mapEntityId,
  mapDatabaseFieldToSchema,
  getSchemaMapping,
  hasField,
  IGNORED_FIELDS,
  TABLE_TO_SCHEMA_MAP,
  OPENAPI_TO_SCHEMA_MAP,
  shouldCountProperty
};
