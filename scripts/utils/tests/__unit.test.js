// Unit/integration tests for mapping, crosswalk, ignore logic, error reporting
const { mapDatabaseFieldToSchema, getSchemaMapping, shouldIgnoreField, normalizeMapping } = require('../mapping-utils.js');
const { generateErrorReport, printSummary } = require('../error-reporting.js');

describe('Mapping utilities', () => {
  test('getSchemaMapping returns correct object for known table', () => {
    expect(getSchemaMapping('project')).toEqual({ schemaName: 'project', idField: 'project_id' });
  });

  test('getSchemaMapping returns fallback for unknown table', () => {
    expect(getSchemaMapping('unknown')).toEqual({ schemaName: 'unknown', idField: 'unknown_id' });
  });

  test('normalizeMapping supports both schemaName and schema keys', () => {
    const map = { foo: { schema: 'bar', idField: 'foo_id' } };
    expect(normalizeMapping('foo', map)).toEqual({ schemaName: 'bar', idField: 'foo_id' });
  });

  test('mapDatabaseFieldToSchema maps direct and edge cases', () => {
    expect(mapDatabaseFieldToSchema('project_id', 'project')).toBe('project_id');
    expect(mapDatabaseFieldToSchema('parent_project_id', 'process_instance')).toBe('parent_project_id');
  });
});

describe('shouldIgnoreField logic', () => {
  test('ignores system fields', () => {
    expect(shouldIgnoreField('created_at')).toBe(true);
    expect(shouldIgnoreField('updated_at')).toBe(true);
    expect(shouldIgnoreField('_id')).toBe(true);
  });
  test('does not ignore important parent fields', () => {
    expect(shouldIgnoreField('parent_project_id')).toBe(false);
  });
  test('ignores parent fields not mapped to required', () => {
    expect(shouldIgnoreField('parent_comment_id')).toBe(true);
  });
});

describe('Crosswalk coverage calculations', () => {
  test('calculates coverage for synthetic schema and columns', () => {
    const schema = { properties: { a: {}, b: {}, c: {} }, required: ['a', 'b'] };
    const columns = [{ column: 'a' }, { column: 'b' }, { column: 'x' }];
    // Simulate coverage logic
    const covered = columns.filter(col => Object.keys(schema.properties).includes(col.column)).length;
    expect(covered).toBe(2);
  });
});

describe('Error reporter formatting', () => {
  test('generateErrorReport formats errors as string', () => {
    const errors = [{ path: 'foo', message: 'bad', value: 42 }];
    const report = generateErrorReport(errors);
    expect(typeof report).toBe('string');
    expect(report).toMatch(/Errors at foo:/);
  });
  test('printSummary outputs summary', () => {
    const summary = { isValid: true, totalFiles: 1, fileName: 'file', totalRecords: 2, entityCounts: { a: 1, b: 1 }, errorCounts: { root: 0, entity: 0, total: 0 } };
    // Should not throw
    expect(() => printSummary(summary)).not.toThrow();
  });
});

// Silence console output for this test suite
const _origConsoleLog = console.log;
const _origConsoleWarn = console.warn;
const _origConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = _origConsoleLog;
  console.warn = _origConsoleWarn;
  console.error = _origConsoleError;
});

// Utility script coverage
const { parseArgs } = require('../cli-args.js');
const colors = require('../colors.js');
const { loadCsvFile } = require('../csv-utils.js');
const { ensureDirectory, resolveProjectPath } = require('../file-utils.js');
const mappingDefs = require('../mapping-definitions.js');
const { getDefaultValueForType } = require('../transformation-utils.js');
const { ValidationUtils } = require('../validation-utils.js');

describe('cli-args', () => {
  test('parseArgs parses flags and values', () => {
    expect(parseArgs(['--foo', 'bar', '--baz'])).toEqual({ foo: 'bar', baz: true });
  });
});

describe('colors', () => {
  test('exports ANSI color codes', () => {
    expect(colors.red).toMatch(/\x1b\[31m/);
    expect(colors.green).toMatch(/\x1b\[32m/);
  });
});

describe('csv-utils', () => {
  test('loadCsvFile throws on missing file', async () => {
    await expect(loadCsvFile('nonexistent.csv')).rejects.toThrow();
  });
});


describe('file-utils', () => {
  test('ensureDirectory returns false for missing dir', () => {
    expect(ensureDirectory('nonexistent_dir')).toBe(false);
  });
  test('resolveProjectPath returns absolute path', () => {
    expect(resolveProjectPath('foo/bar')).toMatch(/foo\/bar/);
  });
});


describe('mapping-definitions', () => {
  test('entityMappings contains project', () => {
    expect(mappingDefs.entityMappings.project).toBe('projects');
  });
});

describe('transformation-utils', () => {
  test('getDefaultValueForType returns correct defaults', () => {
    expect(getDefaultValueForType('string')).toBe('');
    expect(getDefaultValueForType('integer')).toBe(0);
    expect(getDefaultValueForType('boolean')).toBe(false);
    expect(getDefaultValueForType('object')).toEqual({});
    expect(getDefaultValueForType('array')).toEqual([]);
  });
});


describe('validation-utils', () => {
  test('ValidationUtils instantiates and logs', () => {
    const vu = new ValidationUtils();
    expect(typeof vu.log).toBe('function');
  });
});

describe('validate-schemas helpers', () => {
  beforeEach(() => {
    // ensure a fresh module load for each test
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('gatherSchemaStatistics counts properties and types correctly', () => {
    // no need to mock validation-utils for pure function
    const { gatherSchemaStatistics } = require('../../validate-schemas.js');

    const schema = {
      properties: {
        a: { type: 'string' },
        b: { type: 'integer' },
        c: {
          type: 'object',
          properties: {
            d: { type: 'boolean' }
          },
          required: ['d']
        },
        e: {
          type: 'array',
          items: {
            properties: {
              f: { type: 'number' }
            }
          }
        },
        g: { enum: [1, 2, 3] }
      },
      required: ['a'],
      definitions: {
        def1: {
          properties: {
            x: { type: 'string' }
          }
        }
      }
    };

    const stats = gatherSchemaStatistics(schema);

    expect(stats.totalProperties).toBe(8); // a,b,c,e,g + d + f + x
    expect(stats.requiredProperties).toBe(2); // a and d
    expect(stats.enumProperties).toBe(1); // g
    expect(stats.objectProperties).toBe(1); // c
    expect(stats.arrayProperties).toBe(1); // e
    expect(stats.stringProperties).toBe(2); // a and x
    expect(stats.numberProperties).toBe(2); // b(integer) and f(number)
    expect(stats.booleanProperties).toBe(1); // d
  });

  test('displaySchemaProperties prints types, enums, anyOf/oneOf/$ref and nested properties', () => {
    // Use per-test mock to avoid jest.mock hoisting issues
    jest.doMock('../validation-utils', () => {
      return {
        createValidator: jest.fn(),
        loadSchemaFile: jest.fn(),
        findJsonFiles: jest.fn(),
        colors: { cyan: '', green: '', reset: '', yellow: '', magenta: '' }
      };
    });

    const { displaySchemaProperties } = require('../../validate-schemas.js');

    const properties = {
      strProp: { type: 'string', description: 'a'.repeat(60) },
      multiType: { type: ['string', 'null'] },
      anyProp: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      oneProp: { oneOf: [{ type: 'boolean' }] },
      refProp: { $ref: '#/definitions/Some' },
      enumProp: { enum: [1, 2, 3, 4, 5, 6, 7] },
      objProp: {
        type: 'object',
        properties: {
          nested: { type: 'number' }
        }
      },
      arrProp: {
        type: 'array',
        items: {
          properties: {
            itemprop: { type: 'string' }
          }
        }
      }
    };

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    displaySchemaProperties(properties, '  ', 3, 0);
    const calls = logSpy.mock.calls.map(c => c.join(' ')).join('\n');

    expect(calls).toMatch(/strProp/);
    expect(calls).toMatch(/type: string/);
    expect(calls).toMatch(/multiType/);
    expect(calls).toMatch(/\[string, null]/);
    expect(calls).toMatch(/anyOf/);
    expect(calls).toMatch(/oneOf/);
    expect(calls).toMatch(/\$ref: #\/definitions\/Some/);
    expect(calls).toMatch(/enum: \[1, 2, 3, 4, 5\]/);
    expect(calls).toMatch(/\(\+\d+ more\)/);
    expect(calls).toMatch(/\[array items\]/);
    expect(calls).toMatch(/itemprop/);

    logSpy.mockRestore();
  });

  test('displayVerboseSchemaInfo prints summary, definitions and statistics', () => {
    // Per-test mock
    jest.doMock('../validation-utils', () => {
      return {
        createValidator: jest.fn(),
        loadSchemaFile: jest.fn(),
        findJsonFiles: jest.fn(),
        colors: { bold: '', blue: '', reset: '', yellow: '', green: '', cyan: '', magenta: '' }
      };
    });

    const { displayVerboseSchemaInfo } = require('../../validate-schemas.js');

    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://example.com/schema',
      title: 'Test Schema',
      description: 'A'.repeat(120),
      properties: {
        p1: { type: 'string' }
      },
      definitions: {
        MyDef: {
          required: ['reqField'],
          properties: {
            reqField: { type: 'number' }
          },
          additionalProperties: false
        }
      }
    };

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'log'); // same spy covers prints

    displayVerboseSchemaInfo(schema, 'test.schema.json');

    const calls = infoSpy.mock.calls.map(c => c.join(' ')).join('\n');

    expect(calls).toMatch(/Schema Version/);
    expect(calls).toMatch(/Schema ID/);
    expect(calls).toMatch(/Title/);
    expect(calls).toMatch(/Description/);
    expect(calls).toMatch(/Root Properties/);
    expect(calls).toMatch(/Definitions \(1 total\)/);
    expect(calls).toMatch(/Required/);
    expect(calls).toMatch(/Properties \(1 total\)/);
    expect(calls).toMatch(/Schema Statistics/);
    expect(calls).toMatch(/Total Properties/);

    logSpy.mockRestore();
  });

  test('validateSchemas returns false when loadSchemaFile returns falsy', () => {
    // Per-test mock needs path, require inside factory
    jest.doMock('../validation-utils', () => {
      const p = require('path');
      return {
        createValidator: jest.fn(() => ({ validateSchema: jest.fn().mockReturnValue(true) })),
        loadSchemaFile: jest.fn(() => null),
        findJsonFiles: jest.fn(() => [p.join('schemas', 'a.schema.json')]),
        colors: { bold: '', blue: '', reset: '', yellow: '', green: '', cyan: '', magenta: '', red: '' }
      };
    });

    const { validateSchemas } = require('../../validate-schemas.js');

    const result = validateSchemas('schemas', false);
    expect(result).toBe(false);
  });

  test('validateSchemas returns false and logs errors when ajv.validateSchema returns false', () => {
    const fakeErrors = [{ message: 'invalid', instancePath: '/' }];

    jest.doMock('../validation-utils', () => {
      const p = require('path');
      return {
        createValidator: jest.fn(() => ({ validateSchema: jest.fn().mockReturnValue(false), errors: fakeErrors })),
        loadSchemaFile: jest.fn(() => ({ $id: 'x' })),
        findJsonFiles: jest.fn(() => [p.join('schemas', 'bad.schema.json')]),
        colors: { bold: '', blue: '', reset: '', yellow: '', green: '', cyan: '', magenta: '', red: '' }
      };
    });

    const { validateSchemas } = require('../../validate-schemas.js');

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = validateSchemas('schemas', false);

    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  test('validateSchemas returns true for valid schema', () => {
    jest.doMock('../validation-utils', () => {
      const p = require('path');
      return {
        createValidator: jest.fn(() => ({ validateSchema: jest.fn().mockReturnValue(true), errors: null })),
        loadSchemaFile: jest.fn(() => ({ $id: 'ok' })),
        findJsonFiles: jest.fn(() => [p.join('schemas', 'ok.schema.json')]),
        colors: { bold: '', blue: '', reset: '', yellow: '', green: '', cyan: '', magenta: '', red: '' }
      };
    });

    const { validateSchemas } = require('../../validate-schemas.js');

    const outSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = validateSchemas('schemas', true);

    expect(result).toBe(true);

    outSpy.mockRestore();
  });
});
