/**
 * Data transformation utilities for converting database format to NEPA schema format
 */
const { 
  mapStatus, 
  mapDocumentType, 
  mapEngagementType, 
  mapEventStatus, 
  mapDatabaseFieldToSchema, 
  getSchemaMapping, 
  mapEntityId 
} = require('./mapping-utils');

/**
 * Provides a default value for a given schema type.
 * @param {string} type - The schema type (e.g., 'string', 'integer', 'boolean', 'object', 'array').
 * @returns {*} - The default value for that type.
 */
function getDefaultValueForType(type) {
  switch (type) {
    case 'string':
      return ''; // Use empty string as a placeholder for null strings
    case 'integer':
    case 'number':
      return 0; // Or null if the schema allows and it's preferred
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    default:
      return null; // For unknown types or when null is acceptable
  }
}

/**
 * Recursively transforms an entity, ensuring nulls are replaced by type-appropriate defaults.
 * @param {Object} entity - The entity to transform.
 * @param {string} entityType - The type of the entity (e.g., 'project', 'document').
 * @param {Array<string>} fixes - Array to collect descriptions of fixes.
 * @param {Object} schemaProperties - Simplified map of property names to their expected types for the entity.
 */
function transformProperties(entity, entityType, fixes, schemaProperties = {}) {
  if (typeof entity !== 'object' || entity === null) return entity;

  const transformedEntity = {};
  for (const key in entity) {
    let value = entity[key];
    const expectedType = schemaProperties[key]; // Get expected type from simplified schema map

    if (value === null && expectedType) {
      const defaultValue = getDefaultValueForType(expectedType);
      if (defaultValue !== null || key.endsWith('_id')) { // Don't replace _id fields with 0 if they are null, unless schema demands
        // Only apply default if it's not null, or if it's an ID field that might need a specific default (though typically IDs are strings or numbers already)
        // This prevents replacing intentional nulls in optional fields if the default is also null.
        // For strings, integers, booleans, this will provide a non-null default.
         if (value === null && defaultValue !== null && entity[key] !== defaultValue) {
            fixes.push(`Replaced null with default '${defaultValue}' for ${entityType}.${key} (expected ${expectedType})`);
            value = defaultValue;
        }
      }
    }

    // Specific transformations based on key or type can be added here
    // For example, ensuring 'container_inventory' in 'gis_data' is an object
    if (entityType === 'gis_data' && key === 'container_inventory' && Array.isArray(value)) {
        if (value.length > 0) {
            // Attempt to convert array of containers to a single object if it makes sense
            // This is a heuristic and might need refinement based on actual data structure
            transformedEntity[key] = value[0]; // Or some merging logic
            fixes.push(`Fixed container_inventory structure to object for ${entityType}`);
        } else {
            transformedEntity[key] = {}; // Default to empty object
            fixes.push(`Set empty container_inventory to object for ${entityType}`);
        }
        continue; // Skip further processing for this key
    }


    if (typeof value === 'object' && value !== null) {
      // Recurse for nested objects, but not for arrays at this level of property transformation
      // Array transformations are typically handled by transformEntity for top-level entity arrays
      if (!Array.isArray(value)) {
        // Pass down schema properties for the nested object if available
        const nestedSchemaProperties = schemaProperties[key] && schemaProperties[key].properties ? schemaProperties[key].properties : {};
        transformedEntity[key] = transformProperties(value, `${entityType}.${key}`, fixes, nestedSchemaProperties);
      } else {
        // For arrays, we might want to transform each item if we know their type
        // For now, keep arrays as they are unless specific logic is added
        transformedEntity[key] = value;
      }
    } else {
      transformedEntity[key] = value;
    }
  }
  // Ensure required fields have default values if missing and null was not explicitly set and transformed above
  // This part is tricky without full schema access here. For now, focusing on null replacement.
  // For example, if schemaProperties indicates a field is required and it's not in transformedEntity:
  // if (schemaProperties[requiredKey] && transformedEntity[requiredKey] === undefined) {
  //   transformedEntity[requiredKey] = getDefaultValueForType(schemaProperties[requiredKey]);
  //   fixes.push(`Added missing required field ${entityType}.${requiredKey} with default value`);
  // }


  return transformedEntity;
}


/**
 * Transforms a single entity from database format to NEPA schema format.
 * @param {Object} item - The item to transform.
 * @param {string} originalType - The original type name (e.g., 'project', 'process_instance').
 * @param {string} targetType - The target NEPA schema type name (e.g., 'projects', 'processes').
 * @param {Array<string>} fixes - Array to collect descriptions of fixes.
 * @param {Object} entitySchemaProperties - Simplified map of property names to their expected types for this entity.
 * @returns {Object} The transformed item.
 */
function transformEntity(item, originalType, targetType, fixes, entitySchemaProperties = {}) {
  const transformedItem = {};
  const idField = mapEntityId(originalType); // Get the correct ID field for the original type

  for (const key in item) {
    const schemaKey = mapDatabaseFieldToSchema(key, originalType);
    let value = item[key];

    // Apply specific value mappings (status, type, etc.)
    if (schemaKey === 'status' || schemaKey === 'process_status' || schemaKey === 'project_status') value = mapStatus(value);
    else if (schemaKey === 'document_type') value = mapDocumentType(value);
    else if (schemaKey === 'event_type' && (targetType === 'public_engagement_events' || originalType === 'engagement')) value = mapEngagementType(value);
    else if (schemaKey === 'event_status' && (targetType === 'public_engagement_events' || originalType === 'engagement')) value = mapEventStatus(value);
    // Add other specific mappings if needed

    // Handle null to default conversion based on schema properties
    const expectedType = entitySchemaProperties[schemaKey];
    if (value === null && expectedType) {
      const defaultValue = getDefaultValueForType(expectedType);
      if (defaultValue !== null || schemaKey === idField) { // Ensure ID fields get a default if null and expected
        if (item[key] !== defaultValue) { // Check if original was null and new default is different
             fixes.push(`Replaced null with default '${defaultValue}' for ${originalType}.${key} (mapped to ${schemaKey}, expected ${expectedType})`);
             value = defaultValue;
        }
      }
    }
    
    // Ensure IDs are strings if that's the schema expectation (common for _id fields)
    if (schemaKey.endsWith('_id') && typeof value !== 'string' && value !== null && value !== undefined) {
        if (typeof value === 'number' || typeof value === 'bigint') {
            const originalValue = value;
            value = String(value);
            fixes.push(`Converted numeric ID ${originalType}.${key} (mapped to ${schemaKey}) to string: ${originalValue} -> ${value}`);
        }
    }


    // For nested objects, recurse with transformProperties
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedSchemaProps = entitySchemaProperties[schemaKey] && entitySchemaProperties[schemaKey].properties 
                                ? entitySchemaProperties[schemaKey].properties 
                                : {};
      transformedItem[schemaKey] = transformProperties(value, `${originalType}.${schemaKey}`, fixes, nestedSchemaProps);
    } else if (Array.isArray(value) && entitySchemaProperties[schemaKey] && entitySchemaProperties[schemaKey].items && entitySchemaProperties[schemaKey].items.properties) {
      // If it's an array of objects and we have schema for items
      transformedItem[schemaKey] = value.map(arrItem => 
        transformProperties(arrItem, `${originalType}.${schemaKey}[]`, fixes, entitySchemaProperties[schemaKey].items.properties)
      );
    } else {
      transformedItem[schemaKey] = value;
    }
  }
  
  // Ensure the primary ID field for the entity exists and has a sensible default if it was null
  // This is important if the original data might not have an 'id' but schema requires one (e.g. 'project_id')
  const targetIdField = mapEntityId(targetType.slice(0,-1)); // e.g. projects -> project -> project_id
  if (!transformedItem[targetIdField] && entitySchemaProperties[targetIdField]) {
      const idDefaultValue = getDefaultValueForType(entitySchemaProperties[targetIdField]);
      if (idDefaultValue !== null) { // Only add if default is not null (e.g. for string IDs)
          transformedItem[targetIdField] = idDefaultValue;
          fixes.push(`Added missing ID field '${targetIdField}' with default '${idDefaultValue}' for ${targetType}`);
      }
  }
  
  // GIS specific transformations
  if (originalType === 'gis_data' || targetType === 'gis_data') {
      if (!transformedItem.gis_id && entitySchemaProperties.gis_id) {
          transformedItem.gis_id = getDefaultValueForType(entitySchemaProperties.gis_id) || `gis-${Date.now()}`; // Default gis_id
          fixes.push(`Added missing required gis_id for ${originalType}`);
      }
      if (!transformedItem.data_type && entitySchemaProperties.data_type) {
          transformedItem.data_type = getDefaultValueForType(entitySchemaProperties.data_type) || 'point'; // Default data_type
          fixes.push(`Added missing required data_type for ${originalType}`);
      }
      if (!transformedItem.coordinate_system && entitySchemaProperties.coordinate_system) {
          transformedItem.coordinate_system = getDefaultValueForType(entitySchemaProperties.coordinate_system) || 'WGS84'; // Default coordinate_system
          fixes.push(`Added missing required coordinate_system for ${originalType}`);
      }
      if (transformedItem.container_inventory && typeof transformedItem.container_inventory !== 'object' && entitySchemaProperties.container_inventory && entitySchemaProperties.container_inventory.type === 'object') {
          // If container_inventory is not an object but schema expects an object (e.g. it's an array from old format)
          // This case is partially handled in transformProperties, ensure it's an object here.
          if (Array.isArray(transformedItem.container_inventory) && transformedItem.container_inventory.length > 0) {
              transformedItem.container_inventory = transformedItem.container_inventory[0]; // Take first element as a heuristic
          } else {
              transformedItem.container_inventory = getDefaultValueForType('object');
          }
          fixes.push(`Fixed container_inventory structure to object for ${originalType}`);
      } else if (!transformedItem.container_inventory && entitySchemaProperties.container_inventory && entitySchemaProperties.container_inventory.type === 'object') {
          transformedItem.container_inventory = getDefaultValueForType('object');
           fixes.push(`Added missing container_inventory as empty object for ${originalType}`);
      }
  }


  return transformedItem;
}

/**
 * Transform database format to NEPA schema format with automatic fixes
 */
function transformToNepaFormat(data) {
  const fixes = [];
  let transformedData = JSON.parse(JSON.stringify(data)); // Deep clone

  // Attempt to load a simplified representation of schema properties and types
  // This is a placeholder for actual schema loading and parsing.
  // In a real scenario, this would come from parsing nepa.schema.json definitions.
  const simplifiedSchemas = {
    project: {
      project_id: 'string', project_title: 'string', project_status: 'string',
      project_sponsor: { type: 'object', properties: { name: 'string', contact_info: 'string' } },
      location: { type: 'object', properties: { description: 'string', gis_reference: 'string' } },
      notes: 'string',
      // ... other project fields
    },
    process: {
      process_id: 'string', parent_process_id: 'string', process_stage: 'string', notes: 'string',
      purpose_need: 'string', process_model: 'string', description: 'string',
      // ... other process fields
    },
    document: {
      document_id: 'string', document_type: 'string', volume_title: 'string', 
      revision_number: 'integer', supplement_number: 'integer', url: 'string', 
      notes: 'string', document_summary: 'string', document_toc: 'string',
      document_revision: 'string', // Added from error output
      // ... other document fields
    },
    public_comment: {
      comment_id: 'string', method_of_submission: 'string',
      // ... other comment fields
    },
    public_engagement_event: {
      event_id: 'string', 
      location: { type: 'object', properties: { description: 'string', gis_reference: 'string' } },
      // ... other engagement fields
    },
    case_event: {
      case_event_id: 'string', source: 'string', outcome: 'string', 
      parent_event_id: 'integer', related_engagement_id: 'integer',
      following_segment: 'string', // Added from error output
      // ... other case_event fields
    },
    gis_data: {
      gis_id: 'string', data_type: 'string', coordinate_system: 'string', extent: 'string', notes: 'string',
      parent_project_id: 'integer', parent_process_id: 'integer', parent_document_id: 'integer',
      parent_case_event_id: 'integer', parent_comment_id: 'integer', parent_engagement_id: 'integer',
      container_inventory: { type: 'object', properties: { /* ... container props ... */ } }
      // ... other gis_data fields
    },
    legal_structure: {
      legal_structure_id: 'string', effective_date: 'string', context: 'string',
      // ... other legal_structure fields
    },
    decision_element: {
      decision_element_id: 'string', intersect: 'string', spatial_reference: 'string',
      evaluation_dmn: 'string', spatial: 'string',
      // ... other decision_element fields
    },
    process_model: {
      process_model_id: 'string', name: 'string', bpmn_model: 'string', DMN_model: 'string', // Added name as it's often required
      // ... other process_model fields
    },
    decision_payload: {
      decision_payload_id: 'string', evaluation_data: 'object', response: 'string', result: 'string',
      result_bool: 'boolean', result_notes: 'string', result_source: 'string',
      data_annotation: 'string', evaluation_data_annotation: 'string',
      // ... other decision_payload fields
    }
    // ... add other entity types and their simplified property types
  };


  // Ensure root level has required 'projects' array if not present
  if (!transformedData.projects) {
    transformedData.projects = [];
    fixes.push('Added missing required projects array to root level');
  }

  const entityTypesMap = {
    project: { target: 'projects', schemaProps: simplifiedSchemas.project },
    process_instance: { target: 'processes', schemaProps: simplifiedSchemas.process },
    document: { target: 'documents', schemaProps: simplifiedSchemas.document },
    comment: { target: 'public_comments', schemaProps: simplifiedSchemas.public_comment },
    engagement: { target: 'public_engagement_events', schemaProps: simplifiedSchemas.public_engagement_event },
    case_event: { target: 'case_events', schemaProps: simplifiedSchemas.case_event },
    gis_data_element: { target: 'gis_data', schemaProps: simplifiedSchemas.gis_data }, // Assuming gis_data_element maps to gis_data
    gis_data: { target: 'gis_data', schemaProps: simplifiedSchemas.gis_data },
    user_role: { target: 'user_roles', schemaProps: simplifiedSchemas.user_role },
    legal_structure: { target: 'legal_structures', schemaProps: simplifiedSchemas.legal_structure },
    decision_element: { target: 'decision_elements', schemaProps: simplifiedSchemas.decision_element },
    process_model: { target: 'process_models', schemaProps: simplifiedSchemas.process_model },
    process_decision_payload: { target: 'decision_payloads', schemaProps: simplifiedSchemas.decision_payload }
  };

  // Transform entities if they exist at the root (old format)
  for (const originalType in entityTypesMap) {
    if (transformedData[originalType]) {
      const { target, schemaProps } = entityTypesMap[originalType];
      if (!transformedData[target]) transformedData[target] = [];
      
      const itemsToTransform = Array.isArray(transformedData[originalType]) ? transformedData[originalType] : [transformedData[originalType]];
      
      itemsToTransform.forEach(item => {
        transformedData[target].push(transformEntity(item, originalType, target, fixes, schemaProps));
      });
      
      delete transformedData[originalType]; // Remove old format key
      fixes.push(`Transformed ${originalType} data to NEPA ${target} format`);
    }
  }

  // Iterate over NEPA standard top-level arrays and apply property transformations
  // This ensures that even if data is already in NEPA format, nulls are handled
  for (const nepaKey in transformedData) {
    if (Array.isArray(transformedData[nepaKey])) {
        const entityType = nepaKey.slice(0, -1); // e.g. "projects" -> "project"
        const schemaProps = simplifiedSchemas[entityType] || {}; // Get schema for this entity type
        
        transformedData[nepaKey] = transformedData[nepaKey].map(entity => {
            // Pass the singular entityType for transformProperties context
            return transformProperties(entity, entityType, fixes, schemaProps);
        });
    }
  }


  return { data: transformedData, fixes };
}

module.exports = {
  transformToNepaFormat,
  transformEntity, // Export if needed by other modules, otherwise can be kept internal
  transformProperties // Export if needed
};
