/**
 * Centralized mapping definitions for NEPA schema validation
 * Handles all entity and field mapping variations between database, schema, and input formats
 */

module.exports = {
  // Entity mappings (database/input to schema array names)
  entityMappings: {
    // Database table names to schema array names
    'process_instance': 'processes',
    'comment': 'public_comments',
    'engagement': 'public_engagement_events',
    'case_event': 'case_events',
    'gis_data_element': 'gis_data_elements',
    'user_role': 'user_roles',
    'legal_structure': 'legal_structures',
    'decision_element': 'decision_elements',
    'process_model': 'process_models',
    'process_decision_payload': 'decision_payloads',
    
    // Common variations (singular to plural)
    'project': 'projects',
    'document': 'documents',
    'gis_data': 'gis_data',
    
    // Already plural forms (identity mappings)
    'projects': 'projects',
    'processes': 'processes',
    'documents': 'documents',
    'public_comments': 'public_comments',
    'public_engagement_events': 'public_engagement_events',
    'case_events': 'case_events',
    'gis_data_elements': 'gis_data_elements',
    'user_roles': 'user_roles',
    'legal_structures': 'legal_structures',
    'decision_elements': 'decision_elements',
    'process_models': 'process_models',
    'decision_payloads': 'decision_payloads'
  },
  
  // Reverse mapping (schema array names to schema definition names)
  schemaDefinitionMappings: {
    'projects': 'project',
    'processes': 'process',
    'documents': 'document',
    'public_comments': 'public_comment',
    'public_engagement_events': 'public_engagement_event',
    'case_events': 'case_event',
    'gis_data': 'gis_data',
    'gis_data_elements': 'gis_data_element',
    'user_roles': 'user_role',
    'legal_structures': 'legal_structure',
    'decision_elements': 'decision_element',
    'process_models': 'process_model',
    'decision_payloads': 'decision_payload'
  },
  
  // Field mappings (by entity type)
  fieldMappings: {
    // Global mappings (apply to all entities but can be overridden)
    global: {
      'created_at': '_created',
      'updated_at': '_updated',
      'last_updated': '_updated'
    },
    
    // Entity-specific mappings
    projects: {
      'id': 'project_id',
      'title': 'project_title',
      'description': 'project_description',
      'sector': 'project_sector', 
      'sponsor': 'project_sponsor'
    },
    
    processes: {
      'id': 'process_id',
      'parent_project_id': 'project_id',
      'type': 'process_type',
      'status': 'process_status'
    },
    
    documents: {
      'id': 'document_id',
      'parent_process_id': 'process_id',
      'type': 'document_type',
      'title': 'document_title'
    },
    
    public_comments: {
      'id': 'comment_id',
      'parent_document_id': 'related_document_id',
      'content_text': 'content',
      'commenter_entity': 'commenter_name',
      'public_acess': 'public_access'  // Note: there's a typo in the source data
    },
    
    public_engagement_events: {
      'id': 'event_id',
      'parent_process_id': 'related_process_id',
      'type': 'engagement_type',
      'status': 'event_status'
    },
    
    case_events: {
      'id': 'case_event_id',
      'parent_process_id': 'process_id',
      'name': 'event_name',
      'date': 'event_date',
      'type': 'event_type'
    },
    
    gis_data_elements: {
      'id': 'gis_element_id'
    },
    
    user_roles: {
      'id': 'role_id'
    },
    
    legal_structures: {
      'id': 'legal_structure_id'
    },
    
    decision_elements: {
      'id': 'decision_element_id'
    },
    
    process_models: {
      'id': 'process_model_id'
    },
    
    decision_payloads: {
      'id': 'decision_payload_id'
    }
  },
  
  // ID field mappings (entity type to its ID field name)
  idMappings: {
    'projects': 'project_id',
    'processes': 'process_id',
    'documents': 'document_id',
    'public_comments': 'comment_id',
    'public_engagement_events': 'event_id',
    'case_events': 'case_event_id',
    'gis_data': 'gis_id',
    'gis_data_elements': 'gis_element_id',
    'user_roles': 'role_id',
    'legal_structures': 'legal_structure_id',
    'decision_elements': 'decision_element_id',
    'process_models': 'process_model_id',
    'decision_payloads': 'decision_payload_id'
  },
  
  // Fields that should be ignored during validation
  ignoredFields: [
    'created_at',
    'updated_at', 
    '_id',
    'other',
    'notes',
    // Parent fields that don't map to required schema properties
    'parent_comment_id',
    'parent_event_id', 
    'parent_engagement_id',
    'parent_case_event_id'
  ]
};
