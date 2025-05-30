# OpenAPI Validation Technical Reference

## Overview

OpenAPI validation ensures REST API specifications align with the NEPA JSON Schema data model. This maintains consistency between API contracts, data validation, and client code generation.

## Architecture

### Validation Pipeline
```
OpenAPI Specs → Schema Loader → Definition Mapper → Validation Engine → Results
     ↓              ↓               ↓                  ↓              ↓
   YAML/JSON → Schema Objects → Entity Alignment → Type Checking → Error Reports
```

### Key Components

1. **OpenAPI Specifications** (`src/openapi/*.yaml`)
   - REST API endpoint definitions
   - Request/response schemas
   - Parameter specifications
   - Authentication requirements

2. **Schema Mapper** (`scripts/utils/openapi-utils.js`)
   - Maps OpenAPI components to NEPA schema entities
   - Handles type conversions between OpenAPI and JSON Schema
   - Validates schema references and $ref resolution

3. **Validation Engine** (`scripts/validate-openapi.js`)
   - Structural validation of OpenAPI documents
   - Schema compatibility checking
   - Security definition validation

## OpenAPI to NEPA Schema Mapping

### Entity Mapping Strategy

#### 1. Component Schema Mapping
```yaml
# OpenAPI Component
components:
  schemas:
    Project:
      type: object
      required: [project_id, project_title]
      properties:
        project_id: {type: string}
        project_title: {type: string}
```

Maps to NEPA Schema:
```json
{
  "definitions": {
    "project": {
      "type": "object",
      "required": ["project_id", "project_title"],
      "properties": {
        "project_id": {"type": "string"},
        "project_title": {"type": "string"}
      }
    }
  }
}
```

#### 2. API Path to Entity Mapping
| OpenAPI Path | HTTP Method | NEPA Entity | Operation |
|---|---|---|---|
| `/projects` | GET | `project` | List projects |
| `/projects/{id}` | GET | `project` | Get project |
| `/projects` | POST | `project` | Create project |
| `/processes` | GET | `process` | List processes |
| `/documents/{id}/comments` | GET | `public_comment` | Get document comments |

### Schema Compatibility Rules

#### 1. Type Mapping
| OpenAPI Type | JSON Schema Type | Notes |
|---|---|---|
| `string` | `string` | Direct mapping |
| `integer` | `integer` | Format preservation |
| `number` | `number` | Includes float/double |
| `boolean` | `boolean` | Direct mapping |
| `array` | `array` | Items schema required |
| `object` | `object` | Properties validation |

#### 2. Format Validation
```yaml
# OpenAPI format specifications
date:
  type: string
  format: date
  pattern: '^\d{4}-\d{2}-\d{2}$'

date-time:
  type: string
  format: date-time
  pattern: '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$'

email:
  type: string
  format: email
  pattern: '^[^@]+@[^@]+\.[^@]+$'
```

#### 3. Required Field Alignment
```javascript
// Validation logic
function validateRequiredFields(openApiSchema, nepaSchema) {
  const openApiRequired = openApiSchema.required || [];
  const nepaRequired = nepaSchema.required || [];
  
  const missingInOpenApi = nepaRequired.filter(field => 
    !openApiRequired.includes(field)
  );
  
  const extraInOpenApi = openApiRequired.filter(field =>
    !nepaRequired.includes(field)
  );
  
  return { missingInOpenApi, extraInOpenApi };
}
```

## API Design Patterns

### RESTful Resource Modeling

#### 1. Resource Identification
```yaml
# Primary resources
/projects/{project_id}
/processes/{process_id}
/documents/{document_id}
/comments/{comment_id}

# Nested resources
/projects/{project_id}/processes
/processes/{process_id}/documents
/documents/{document_id}/comments
```

#### 2. HTTP Method Mapping
```yaml
paths:
  /projects:
    get:
      summary: List projects
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Project'
    post:
      summary: Create project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectCreate'
```

#### 3. Response Schema Standardization
```yaml
# Standard response wrapper
responses:
  ProjectResponse:
    description: Project data response
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              $ref: '#/components/schemas/Project'
            meta:
              $ref: '#/components/schemas/ResponseMeta'
            links:
              $ref: '#/components/schemas/ResponseLinks'
```

### Error Handling

#### 1. Error Response Schema
```yaml
components:
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          enum: [VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED]
        message:
          type: string
        details:
          type: array
          items:
            $ref: '#/components/schemas/ErrorDetail'
            
    ErrorDetail:
      type: object
      properties:
        field:
          type: string
        code:
          type: string
        message:
          type: string
```

#### 2. HTTP Status Code Mapping
```yaml
responses:
  400:
    description: Bad Request - Validation Error
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
  404:
    description: Not Found
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
  422:
    description: Unprocessable Entity - Business Logic Error
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
```

## Validation Implementation

### OpenAPI Document Validation

#### 1. Structural Validation
```javascript
const SwaggerParser = require('@apidevtools/swagger-parser');

async function validateOpenApiStructure(specPath) {
  try {
    const api = await SwaggerParser.validate(specPath);
    return { isValid: true, api };
  } catch (error) {
    return { 
      isValid: false, 
      errors: [{ message: error.message, path: specPath }]
    };
  }
}
```

#### 2. Schema Reference Validation
```javascript
function validateSchemaReferences(api) {
  const errors = [];
  const components = api.components?.schemas || {};
  
  // Check for broken $ref references
  function checkReferences(obj, path = '') {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.$ref) {
        const refPath = obj.$ref.replace('#/components/schemas/', '');
        if (!components[refPath]) {
          errors.push({
            message: `Broken schema reference: ${obj.$ref}`,
            path: path
          });
        }
      }
      
      Object.entries(obj).forEach(([key, value]) => {
        checkReferences(value, `${path}.${key}`);
      });
    }
  }
  
  checkReferences(api);
  return errors;
}
```

### Schema Compatibility Validation

#### 1. Entity Mapping Validation
```javascript
async function validateEntityMapping(openApiSpec, nepaSchema) {
  const results = {
    compatible: true,
    errors: [],
    warnings: []
  };
  
  const openApiSchemas = openApiSpec.components?.schemas || {};
  const nepaDefinitions = nepaSchema.definitions || {};
  
  // Map OpenAPI schemas to NEPA entities
  for (const [name, schema] of Object.entries(openApiSchemas)) {
    const nepaEntity = mapOpenApiToNepaEntity(name);
    
    if (!nepaDefinitions[nepaEntity]) {
      results.warnings.push({
        message: `OpenAPI schema '${name}' has no corresponding NEPA entity`,
        schema: name
      });
      continue;
    }
    
    const compatibility = validateSchemaCompatibility(
      schema, 
      nepaDefinitions[nepaEntity]
    );
    
    if (!compatibility.isCompatible) {
      results.compatible = false;
      results.errors.push(...compatibility.errors);
    }
  }
  
  return results;
}
```

#### 2. Field-Level Compatibility
```javascript
function validateSchemaCompatibility(openApiSchema, nepaSchema) {
  const errors = [];
  
  // Check required fields
  const openApiRequired = openApiSchema.required || [];
  const nepaRequired = nepaSchema.required || [];
  
  for (const field of nepaRequired) {
    if (!openApiRequired.includes(field)) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        field: field,
        message: `Required field '${field}' missing in OpenAPI schema`
      });
    }
  }
  
  // Check property types
  const openApiProps = openApiSchema.properties || {};
  const nepaProps = nepaSchema.properties || {};
  
  for (const [fieldName, nepaProperty] of Object.entries(nepaProps)) {
    const openApiProperty = openApiProps[fieldName];
    
    if (openApiProperty) {
      const typeCompatibility = validateTypeCompatibility(
        openApiProperty, 
        nepaProperty
      );
      
      if (!typeCompatibility.compatible) {
        errors.push({
          type: 'TYPE_INCOMPATIBLE',
          field: fieldName,
          openApiType: openApiProperty.type,
          nepaType: nepaProperty.type,
          message: typeCompatibility.message
        });
      }
    }
  }
  
  return {
    isCompatible: errors.length === 0,
    errors
  };
}
```

### Security Validation

#### 1. Authentication Scheme Validation
```yaml
# OpenAPI security schemes
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key

security:
  - bearerAuth: []
  - apiKey: []
```

#### 2. Authorization Scope Validation
```javascript
function validateSecurityScopes(api) {
  const errors = [];
  const securitySchemes = api.components?.securitySchemes || {};
  
  // Check for OAuth2 scope definitions
  Object.entries(securitySchemes).forEach(([name, scheme]) => {
    if (scheme.type === 'oauth2') {
      const flows = scheme.flows || {};
      
      Object.entries(flows).forEach(([flowType, flow]) => {
        const scopes = flow.scopes || {};
        
        // Validate scope naming conventions
        Object.keys(scopes).forEach(scope => {
          if (!scope.match(/^[a-z]+:[a-z]+$/)) {
            errors.push({
              message: `Invalid scope format: ${scope}`,
              scheme: name,
              flow: flowType
            });
          }
        });
      });
    }
  });
  
  return errors;
}
```

## Code Generation Support

### Client SDK Generation

#### 1. TypeScript Interface Generation
```typescript
// Generated from OpenAPI schema
export interface Project {
  project_id: string;
  project_title: string;
  project_description: string;
  project_sector: ProjectSector;
  lead_agency: string;
  participating_agencies?: string[];
  location?: ProjectLocation;
  current_status: ProjectStatus;
}

export enum ProjectSector {
  ENERGY = 'energy',
  TRANSPORTATION = 'transportation',
  LAND_MANAGEMENT = 'land management'
}
```

#### 2. API Client Generation
```typescript
// Generated API client methods
export class ProjectsApi {
  async listProjects(params?: ListProjectsParams): Promise<Project[]> {
    const response = await this.request('GET', '/projects', { params });
    return response.data;
  }
  
  async getProject(projectId: string): Promise<Project> {
    const response = await this.request('GET', `/projects/${projectId}`);
    return response.data;
  }
  
  async createProject(project: CreateProjectRequest): Promise<Project> {
    const response = await this.request('POST', '/projects', { data: project });
    return response.data;
  }
}
```

### Server Stub Generation

#### 1. Route Handler Stubs
```javascript
// Generated Express.js route handlers
router.get('/projects', async (req, res) => {
  try {
    // Validate query parameters
    const params = validateQueryParams(req.query, ListProjectsParamsSchema);
    
    // Call business logic
    const projects = await projectService.listProjects(params);
    
    // Validate response
    const validatedResponse = validateResponse(projects, ProjectArraySchema);
    
    res.json({ data: validatedResponse });
  } catch (error) {
    handleApiError(error, res);
  }
});
```

#### 2. Validation Middleware
```javascript
function createValidationMiddleware(schema) {
  return (req, res, next) => {
    const validator = ajv.compile(schema);
    const isValid = validator(req.body);
    
    if (!isValid) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validator.errors.map(formatValidationError)
      });
    }
    
    next();
  };
}
```

## Testing Strategies

### Contract Testing

#### 1. Schema-Driven Testing
```javascript
describe('OpenAPI Contract Tests', () => {
  test('should validate project creation request', async () => {
    const projectData = {
      project_title: 'Test Project',
      project_description: 'Test Description',
      project_sector: 'energy',
      lead_agency: 'DOE'
    };
    
    const response = await request(app)
      .post('/projects')
      .send(projectData)
      .expect(201);
    
    // Validate response against OpenAPI schema
    const validator = createResponseValidator('Project');
    expect(validator(response.body.data)).toBe(true);
  });
});
```

#### 2. API Mock Generation
```javascript
// Generate mock responses from OpenAPI schemas
function generateMockResponse(schemaName) {
  const schema = openApiSpec.components.schemas[schemaName];
  return generateMockFromSchema(schema);
}

// Use in tests
const mockProject = generateMockResponse('Project');
```

### Integration Testing

#### 1. End-to-End API Testing
```javascript
describe('Project API Integration', () => {
  test('should create, retrieve, and update project', async () => {
    // Create project
    const createResponse = await api.projects.create(projectData);
    expect(createResponse).toMatchSchema('Project');
    
    // Retrieve project
    const getResponse = await api.projects.get(createResponse.project_id);
    expect(getResponse).toEqual(createResponse);
    
    // Update project
    const updateResponse = await api.projects.update(
      createResponse.project_id,
      updateData
    );
    expect(updateResponse).toMatchSchema('Project');
  });
});
```

## Performance Considerations

### Schema Compilation
```javascript
// Pre-compile OpenAPI schemas for validation
const compiledSchemas = new Map();

function getCompiledSchema(schemaRef) {
  if (!compiledSchemas.has(schemaRef)) {
    const schema = resolveSchemaReference(openApiSpec, schemaRef);
    compiledSchemas.set(schemaRef, ajv.compile(schema));
  }
  return compiledSchemas.get(schemaRef);
}
```

### Response Validation Optimization
```javascript
// Conditional validation based on environment
const shouldValidateResponses = process.env.NODE_ENV !== 'production';

function validateApiResponse(data, schemaRef) {
  if (!shouldValidateResponses) return data;
  
  const validator = getCompiledSchema(schemaRef);
  const isValid = validator(data);
  
  if (!isValid) {
    logger.warn('Response validation failed', {
      errors: validator.errors,
      schema: schemaRef
    });
  }
  
  return data;
}
```

## Best Practices

### API Design
1. **Consistent Naming**: Use consistent field names across all endpoints
2. **Resource Modeling**: Model resources around business entities
3. **Versioning Strategy**: Plan for API evolution and backward compatibility
4. **Error Standards**: Standardize error response formats

### Schema Management
1. **Single Source of Truth**: Maintain one authoritative schema definition
2. **Validation Integration**: Integrate validation into CI/CD pipeline
3. **Documentation**: Keep OpenAPI docs synchronized with implementation
4. **Testing**: Implement comprehensive contract testing

### Security
1. **Authentication**: Define clear authentication requirements
2. **Authorization**: Specify resource-level access controls
3. **Input Validation**: Validate all input parameters and request bodies
4. **Rate Limiting**: Document API usage limits and quotas

## References

- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [JSON Schema Validation](https://json-schema.org/)
- [Swagger Parser](https://github.com/APIDevTools/swagger-parser)
- [AJV Validation Library](https://ajv.js.org/)
- [REST API Design Guidelines](https://restfulapi.net/)
