const { getSchemaMapping } = require('../mapping-utils');
const { ValidationUtils } = require('../validation-utils');
const { shouldIgnoreField } = require('../validation-utils');
const { generateErrorReport } = require('../error-reporting');
const fs = require('fs');
const path = require('path');

describe('getSchemaMapping', () => {
  it('returns correct object for string mapping', () => {
    const result = getSchemaMapping('project');
    expect(result).toHaveProperty('schemaName', 'project');
    expect(result).toHaveProperty('idField', 'project_id');
  });

  it('returns correct fallback for unknown table', () => {
    const result = getSchemaMapping('unknown_table');
    expect(result).toHaveProperty('schemaName', 'unknown_table');
    expect(result).toHaveProperty('idField', 'unknown_table_id');
  });

  it('returns object mapping unchanged', () => {
    const customMap = { schemaName: 'foo', idField: 'foo_id' };
    const mappingUtils = require('../mapping-utils');
    mappingUtils.TABLE_TO_SCHEMA_MAP.bar = customMap;
    const result = getSchemaMapping('bar');
    expect(result).toEqual(customMap);
  });
});

describe('validation-utils', () => {
  test('validateFile returns error for malformed JSON', () => {
    const filePath = path.join(__dirname, 'malformed.json');
    fs.writeFileSync(filePath, '{bad json}', 'utf8');
    const validator = () => true;
    const vu = new ValidationUtils({ verbose: false });
    const result = vu.validateFile(filePath, validator);
    expect(result.isValid).toBe(false);
  // Message wording can vary across Node versions (Unexpected token vs Expected property name)
  expect(result.errors[0].message).toMatch(/Expected property name|Unexpected token/);
    fs.unlinkSync(filePath);
  });
});


describe('shouldIgnoreField', () => {
  test('ignores parent_* fields', () => {
    expect(shouldIgnoreField('parent_project_id')).toBe(true);
    expect(shouldIgnoreField('parent_comment_id')).toBe(true);
  });
  test('ignores _json fields', () => {
    expect(shouldIgnoreField('foo_json')).toBe(true);
  });
  test('ignores fields starting with _', () => {
    expect(shouldIgnoreField('_private')).toBe(true);
  });
  test('does not ignore id field', () => {
    expect(shouldIgnoreField('id')).toBe(false);
  });
});

describe('error-reporting', () => {
  test('generateErrorReport handles empty errors', () => {
    expect(generateErrorReport([])).toBe('No errors found.');
  });
  test('generateErrorReport formats mixed errors', () => {
    const errors = [
      { path: 'foo', message: 'bad', value: 1 },
      { path: 'bar', message: 'worse', value: 2 }
    ];
    const report = generateErrorReport(errors);
    expect(report).toMatch(/Errors at foo:/);
    expect(report).toMatch(/Errors at bar:/);
  });
});
