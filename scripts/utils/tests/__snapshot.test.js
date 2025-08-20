  it('validate-data.js produces stable machine-readable output for sample JSON', () => {
    const sampleFile = 'src/sample-data/sample.json';
    if (!fs.existsSync(sampleFile)) return;
    const output = execSync(`node scripts/validate-data.js --dir src/sample-data --schema src/jsonschema/nepa.schema.json --jsonOutput true`, { encoding: 'utf8' });
    expect(output).toMatchSnapshot();
  });
// Jest snapshot test for CLI output regression protection
const { execSync } = require('child_process');
const fs = require('fs');

describe('CLI output regression tests', () => {
  it('validate-data.js produces stable output for sample JSON', () => {
    const sampleFile = 'src/sample-data/sample.json';
    if (!fs.existsSync(sampleFile)) return;
    const output = execSync(`node scripts/validate-data.js --dir src/sample-data --schema src/jsonschema/nepa.schema.json`, { encoding: 'utf8' });
    expect(output).toMatchSnapshot();
  });

  it('validate-data.js produces stable output for sample YAML', () => {
    const sampleFile = 'src/sample-data/sample.yaml';
    if (!fs.existsSync(sampleFile)) return;
    const output = execSync(`node scripts/validate-data.js --dir src/sample-data --schema src/jsonschema/nepa.schema.json`, { encoding: 'utf8' });
    expect(output).toMatchSnapshot();
  });
});
