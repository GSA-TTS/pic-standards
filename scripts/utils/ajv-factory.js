// Centralized Ajv singleton for validation scripts
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
let ajvInstance;
let validators = {};

function getAjv(schema) {
  if (!ajvInstance) {
    ajvInstance = new Ajv({ allErrors: true, strict: false });
    addFormats(ajvInstance);
    if (schema) ajvInstance.addSchema(schema);
  }
  return ajvInstance;
}

function getEntityValidator(name, schema) {
  if (!validators[name]) {
    validators[name] = getAjv(schema).compile(schema);
  }
  return validators[name];
}

module.exports = { getAjv, getEntityValidator };
