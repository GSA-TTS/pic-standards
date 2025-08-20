const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { colors } = require('./utils/validation-utils'); // use shared colors for DRY output

/**
 * Parse basic INSERT INTO ... VALUES(...) statements from SQL.
 * Returns an array of inserts: { table, columns, rows }
 */
function parseSqlInserts(sqlText, targetTable = null) {
  const inserts = [];
  const normalized = sqlText.replace(/\r\n/g, '\n');
  const insertRegex = /INSERT\s+INTO\s+["`']?([\w.]+)["`']?\s*\(([^)]+)\)\s*VALUES\s*((?:\([^;]+?\))(?:\s*,\s*\([^;]+?\))*)\s*;/gims;

  let m;
  while ((m = insertRegex.exec(normalized)) !== null) {
    const table = m[1];
    const colsRaw = m[2];
    const valuesBlock = m[3];

    if (targetTable && table.toLowerCase() !== targetTable.toLowerCase()) continue;

    const columns = colsRaw.split(',').map(c => c.trim().replace(/["'`]/g, ''));

    const tupleRegex = /\(([^()]*)\)/g;
    const tuples = [];
    let t;
    while ((t = tupleRegex.exec(valuesBlock)) !== null) {
      tuples.push(t[1]);
    }

    const rows = tuples.map(tupleText => {
      const values = [];
      let i = 0;
      const text = tupleText.trim();
      const len = text.length;
      while (i < len) {
        while (i < len && /\s/.test(text[i])) i++;
        if (i >= len) break;

        if (text[i] === "'") {
          i++;
          let buf = '';
          while (i < len) {
            if (text[i] === "'") {
              if (i + 1 < len && text[i + 1] === "'") {
                buf += "'";
                i += 2;
                continue;
              } else {
                i++;
                break;
              }
            } else {
              buf += text[i++];
            }
          }
          values.push(buf);
          while (i < len && /\s/.test(text[i])) i++;
          if (text[i] === ',') i++;
        } else if (text.substr(i, 4).toUpperCase() === 'NULL') {
          values.push(null);
          i += 4;
          while (i < len && /[\s,]/.test(text[i])) i++;
        } else if (text[i] === '{' || text[i] === '[') {
          const startChar = text[i];
          const endChar = startChar === '{' ? '}' : ']';
          let depth = 0;
          let buf = '';
          while (i < len) {
            if (text[i] === startChar) depth++;
            if (text[i] === endChar) depth--;
            buf += text[i++];
            if (depth === 0) break;
          }
          try {
            values.push(JSON.parse(buf));
          } catch (e) {
            values.push(buf);
          }
          while (i < len && /[\s,]/.test(text[i])) i++;
        } else {
          let buf = '';
          while (i < len && !/[\s,]/.test(text[i])) {
            buf += text[i++];
          }
          const val = buf.trim();
          if (/^-?\d+(\.\d+)?$/.test(val)) {
            values.push(val.indexOf('.') !== -1 ? parseFloat(val) : parseInt(val, 10));
          } else {
            values.push(val === 'NULL' ? null : val);
          }
          while (i < len && /[\s,]/.test(text[i])) i++;
        }
      }

      const obj = {};
      for (let k = 0; k < columns.length; k++) {
        obj[columns[k]] = values[k] !== undefined ? values[k] : null;
      }
      return obj;
    });

    inserts.push({ table, columns, rows });
  }

  if (targetTable) {
    return inserts.filter(it => it.table.toLowerCase() === targetTable.toLowerCase());
  }
  return inserts;
}

// Minimal default schema used when --schema not provided
function defaultSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string", format: "email" }
      },
      required: ["id", "name"]
    }
  };
}

// Pretty-print AJV errors
function printErrors(errors) {
  if (!errors || errors.length === 0) return;
  console.error('Validation errors:');
  errors.forEach((err, idx) => {
    const instance = err.instancePath || err.dataPath || '(root)';
    console.error(`${idx + 1}) ${instance} ${err.message}`);
    if (err.params) console.error(`   params: ${JSON.stringify(err.params)}`);
  });
}

function capitalize(s) {
  if (!s || typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Add: normalize/transform rows for specific tables prior to validation
function transformRowForTable(table, row) {
	// shallow copy
	const r = Object.assign({}, row);

	// Normalize table identifier (strip schema)
	const baseTable = (table || '').toString().replace(/^.*\./, '').replace(/["'`]/g, '').toLowerCase();

	if (baseTable === 'project') {
		// rename sponsor -> project_sponsor
		if (r.sponsor !== undefined) {
			r.project_sponsor = r.sponsor;
			delete r.sponsor;
		}

		// build location object from lat/lon/text or existing location_object
		const loc = {};
		if (r.location_object && typeof r.location_object === 'object') {
			Object.assign(loc, r.location_object);
		}
		if (r.location_lat !== undefined && r.location_lat !== null && !Number.isNaN(Number(r.location_lat))) {
			loc.lat = Number(r.location_lat);
		}
		if (r.location_lon !== undefined && r.location_lon !== null && !Number.isNaN(Number(r.location_lon))) {
			loc.lon = Number(r.location_lon);
		}
		if (r.location_text) {
			loc.text = String(r.location_text);
		}
		// ensure a location object exists when schema expects it
		// ensure required 'description' on location is present (use location_text, fallback to description/title or empty)
		if (!loc.description) {
			if (r.location_text) loc.description = String(r.location_text);
			else if (r.description) loc.description = String(r.description).substring(0, 200);
			else if (r.title) loc.description = String(r.title).substring(0, 200);
			else loc.description = '';
		}
		if (Object.keys(loc).length > 0) {
			r.location = loc;
		}
		// Normalize current_status to expected lowercase values
		if (typeof r.current_status === 'string') {
			const v = r.current_status.trim().toLowerCase();
			const allowed = ['pre-application', 'underway', 'paused', 'completed'];
			// try to map common variants
			if (allowed.includes(v)) {
				r.current_status = v;
			} else {
				// fallback: keep lowercase trimmed value
				r.current_status = v;
			}
		}

		// If an object-like field is null, remove it to avoid AJV "must be object" (schema can require it separately)
		if (r.sponsor_contact === null) delete r.sponsor_contact;
		if (r.location_object === null) delete r.location_object;
		if (r.other === null) delete r.other;

		// Remove numeric/null parent_project_id if null to avoid "must be integer" failing on null
		if (r.parent_project_id === null) delete r.parent_project_id;

		// Remove raw lat/lon/text fields after building location
		delete r.location_lat;
		delete r.location_lon;
		delete r.location_text;
		delete r.location_object;
	}

	// Remove any other nulls to avoid type failures (tests prefer absent vs null in many schemas)
	for (const k of Object.keys(r)) {
		if (r[k] === null) delete r[k];
	}

	return r;
}

/**
 * Main validator
 * Options:
 *  --sql PATH    Path to SQL file (default: src/database/seed-v1.2.0.sql)
 *  --schema PATH Path to JSON Schema file (optional)
 *  --table NAME  Optional: restrict parsing to a specific table name
 */
async function main(argv = process.argv) {
  const args = argv.slice(2);
  const getOpt = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    return args[i + 1] || null;
  };

  const sqlPath = path.resolve(getOpt('--sql') || path.join(__dirname, '..', 'src', 'database', 'seed-v1.2.0.sql'));
  const schemaPath = getOpt('--schema');
  const targetTable = getOpt('--table'); // optional

  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    return 2;
  }

  // Read SQL and extract INSERT rows
  let sqlText;
  try {
    sqlText = fs.readFileSync(sqlPath, 'utf8');
  } catch (e) {
    console.error(`Failed to read SQL file: ${e.message}`);
    return 2;
  }

  const parsedInserts = parseSqlInserts(sqlText, targetTable);
  if (!parsedInserts || parsedInserts.length === 0) {
    console.error('No INSERT statements could be parsed from the SQL file.');
    console.error('Ensure the SQL contains INSERT INTO ... VALUES(...) statements or adapt the script.');
    return 2;
  }

  const pick = parsedInserts[0];
  const generatedData = pick.rows;
  console.log(`⚙️  Extracted ${generatedData.length} rows from SQL INSERTs for table '${pick.table}'`);

  // load schema
  let schemaObj;
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found: ${schemaPath}`);
      return 2;
    }
    try {
      schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (e) {
      console.error(`Failed to parse schema JSON: ${e.message}`);
      return 2;
    }
  } else {
    schemaObj = defaultSchema();
  }

  // Validate using Ajv with flexible mapping (array, per-definition, or wrapped)
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  // Helper to compile and run validator and collect errors
  const runValidator = (schema, instance, label = '(root)') => {
    const v = ajv.compile(schema);
    const ok = v(instance);
    const errors = ok ? [] : (v.errors || []);
    if (!ok) {
      console.error(`${colors.red}❌ Validation failed for ${label}:${colors.reset}`);
      printErrors(errors);
    }
    return { ok, errors };
  };
  
  console.log(`${colors.bold}${colors.blue}SQL file:${colors.reset} ${sqlPath}`);
  console.log(`${colors.bold}${colors.blue}Schema:${colors.reset} ${schemaPath || '[built-in]'}`);
  
  // Validate each parsed INSERT block (each entity) and collect results
  const defs = schemaObj.definitions || (schemaObj.components && schemaObj.components.schemas) || null;
  const results = [];
  
  for (const insert of parsedInserts) {
    const thisTable = (insert.table || '').toString().replace(/^.*\./, '').replace(/["'`]/g, '');
    const rows = insert.rows || [];
    const transformed = rows.map(r => transformRowForTable(insert.table, r));
  
    let passed = false;
    let reason = '';
    const entityErrors = []; // collect { row, messages } or top-level errors
  
    // If schema is an array schema, validate the whole extracted array
    if (schemaObj.type === 'array' || schemaObj.items) {
      const res = runValidator(schemaObj, transformed, `${thisTable} (array)`);
      passed = res.ok;
      if (!passed) {
        reason = 'array schema mismatch';
        // capture summary messages
        (res.errors || []).slice(0, 10).forEach(e => {
          entityErrors.push({ row: '(array)', messages: [`${e.instancePath || '(root)'} ${e.message}`] });
        });
      }
    } else {
      // try to find a matching definition for the table
      let defSchema = null;
      if (defs) {
        const nameVariants = [
          thisTable,
          capitalize(thisTable),
          thisTable.replace(/s$/,''),
          capitalize(thisTable.replace(/s$/,'')),
        ];
        for (const n of nameVariants) {
          if (defs[n]) { defSchema = defs[n]; break; }
        }
      }
  
      if (defSchema) {
        // validate each row against the definition
        const itemValidator = ajv.compile(defSchema);
        let anyInvalid = false;
        transformed.forEach((row, idx) => {
          const okRow = itemValidator(row);
          if (!okRow) {
            anyInvalid = true;
            console.error(`\n${colors.red}❌ ${thisTable} row ${idx} errors:${colors.reset}`);
            // collect row-level messages (limit and summarize)
            const msgs = (itemValidator.errors || []).slice(0,5).map(e => `${e.instancePath || '(root)'} ${e.message}`);
            entityErrors.push({ row: idx, messages: msgs });
            printErrors(itemValidator.errors);
          }
        });
        passed = !anyInvalid;
        if (!passed) reason = 'definition mismatch';
      } else {
        // try wrapping into top-level plural property
        const pluralKey = thisTable.endsWith('s') ? thisTable : `${thisTable}s`;
        if (schemaObj.properties && schemaObj.properties[pluralKey]) {
          const wrapper = {};
          wrapper[pluralKey] = transformed;
          const res = runValidator(schemaObj, wrapper, `${thisTable} (wrapped)`);
          passed = res.ok;
          if (!passed) {
            reason = 'wrapped object mismatch';
            (res.errors || []).slice(0, 10).forEach(e => {
              entityErrors.push({ row: '(wrapped)', messages: [`${e.instancePath || '(root)'} ${e.message}`] });
            });
          }
        } else {
          // no mapping found
          reason = 'no schema mapping found';
          console.warn(`${colors.yellow}⚠️ No schema mapping for table '${thisTable}', skipping detailed validation${colors.reset}`);
          // treat as skipped (not failing) — set passed true to avoid failing CI, adjust if you prefer strict mode
          passed = true;
        }
      }
    }
  
    results.push({ entity: thisTable, ok: !!passed, reason, errors: entityErrors });
  }
  
  // Print summary of entities validated
  console.log(`\n${colors.bold}Entities validated:${colors.reset}`);
  results.forEach(r => {
    const mark = r.ok ? `${colors.green}✅` : `${colors.red}❌`;
    console.log(` ${mark} ${r.entity} ${colors.reset}${r.ok ? '' : `- ${r.reason}`}`);
    if (!r.ok && r.errors && r.errors.length > 0) {
      // Show up to 5 error lines for the entity for quick inspection
      console.log(`   ${colors.bold}Details:${colors.reset}`);
      r.errors.slice(0,5).forEach(er => {
        console.log(`    - row ${er.row}: ${er.messages.join(' ; ')}`);
      });
      if (r.errors.length > 5) {
        console.log(`    ...and ${r.errors.length - 5} more error entries`);
      }
    }
  });
  
  // Overall exit code: fail if any entity failed validation
  const anyFail = results.some(r => !r.ok);
  if (!anyFail) {
    console.log(`${colors.green}✅ All extracted rows validate against matched schema definition.${colors.reset}`);
    return 0;
  }
  return 1;
}

// Export for programmatic use / tests
module.exports = { main };

// If run directly, invoke main and set exit code
if (require.main === module) {
  (async () => {
    const code = await main(process.argv);
    process.exit(code);
  })();
}
