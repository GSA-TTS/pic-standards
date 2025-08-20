const fs = require('fs');
const path = require('path');
const { colors } = require('./utils/validation-utils'); // reuse shared colors
const { shouldIgnoreField, normalizeMapping, TABLE_TO_SCHEMA_MAP } = require('./utils/mapping-utils');

// Parse CREATE TABLE ... (...) blocks and return [{ table, columns: [{name, type}], ... }]
function parseCreateTables(sqlText, targetTable = null) {
  const creates = [];
  const normalized = sqlText.replace(/\r\n/g, '\n');
  // capture everything between "CREATE TABLE ... (" and the matching closing `);`
  const createRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^(]+)\s*\(([\s\S]*?)\)\s*;/gims;
  let m;
  while ((m = createRegex.exec(normalized)) !== null) {
    // full identifier may be quoted and dotted like: "public"."project" or public.project
    let fullName = m[1].trim();
    const body = m[2];
    // split dotted parts and strip surrounding quotes/backticks
    const parts = fullName.split('.').map(p => p.trim().replace(/^["'`]+|["'`]+$/g, ''));
    const table = parts[parts.length - 1];
    if (targetTable && table.toLowerCase() !== targetTable.toLowerCase()) continue;

    const lines = body.split(/\n/);
    const cols = [];
    for (const line of lines) {
      const trimmed = line.trim().replace(/,$/, '');
      // skip constraints/indexes/comments
      if (!trimmed || /^CONSTRAINT\b|^PRIMARY\s+KEY\b|^UNIQUE\b|^CHECK\b|^FOREIGN\s+KEY\b|^COMMENT\b/i.test(trimmed)) continue;
      // match: "colname" type ...  (capture first type token)
      const colMatch = trimmed.match(/^["'`]?([\w]+)["'`]?\s+([^\s,]+)/);
      if (colMatch) {
        cols.push({ name: colMatch[1], type: colMatch[2].toLowerCase() });
      }
    }
    creates.push({ table, columns: cols });
  }
  return creates;
}

// ...existing code...

// map simple SQL type token to JSON type string(s)
function mapSqlTypeToJsonTypes(sqlType) {
  if (!sqlType) return ['string'];
  const t = sqlType.toLowerCase();
  if (/\b(bigint|int|integer|smallint|serial|numeric|decimal|number)\b/.test(t)) return ['integer', 'number'];
  if (/\b(double|real|float|numeric|decimal)\b/.test(t)) return ['number'];
  if (/\b(boolean|bool)\b/.test(t)) return ['boolean'];
  if (/\b(json|jsonb)\b/.test(t)) return ['object', 'array'];
  if (/\b(timestamp|date|time)\b/.test(t)) return ['string'];
  // fallback
  return ['string'];
}

/**
 * CLI
 * --sql PATH   defaults to src/database/schema-v1.2.0.sql
 * --schema PATH defaults to src/jsonschema/nepa.schema.json
 * --table NAME optional to restrict
 */
async function main(argv = process.argv) {
  const args = argv.slice(2);
  const getOpt = flag => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    return args[i + 1] || null;
  };

  const sqlPath = path.resolve(getOpt('--sql') || path.join(__dirname, '..', 'src', 'database', 'schema-v1.2.0.sql'));
  const schemaPath = getOpt('--schema') || path.join(__dirname, '..', 'src', 'jsonschema', 'nepa.schema.json');
  const targetTable = getOpt('--table');

  if (!fs.existsSync(sqlPath)) {
    console.error(`${colors.red}SQL file not found: ${sqlPath}${colors.reset}`);
    return 2;
  }
  if (!fs.existsSync(schemaPath)) {
    console.error(`${colors.red}Schema file not found: ${schemaPath}${colors.reset}`);
    return 2;
  }

  let sqlText;
  try { sqlText = fs.readFileSync(sqlPath, 'utf8'); } catch (e) { console.error(`${colors.red}Failed to read SQL: ${e.message}${colors.reset}`); return 2; }

  const creates = parseCreateTables(sqlText, targetTable);
  if (!creates || creates.length === 0) {
    console.error(`${colors.red}No CREATE TABLE blocks parsed from SQL.${colors.reset}`);
    return 2;
  }

  let schemaObj;
  try { schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8')); } catch (e) { console.error(`${colors.red}Failed to parse schema JSON: ${e.message}${colors.reset}`); return 2; }

  const defs = schemaObj.definitions || (schemaObj.components && schemaObj.components.schemas) || null;
  if (!defs) {
    console.warn(`${colors.yellow}Schema has no definitions/components.schemas — cannot compare table definitions.${colors.reset}`);
    return 0;
  }

  console.log(`${colors.bold}${colors.blue}SQL file:${colors.reset} ${sqlPath}`);
  console.log(`${colors.bold}${colors.blue}Schema:${colors.reset} ${schemaPath}`);

  const results = [];

  for (const tbl of creates) {
    const tableName = tbl.table;
    // Use mapping-utils for normalization
    const mapping = normalizeMapping(tableName, TABLE_TO_SCHEMA_MAP);
    const schemaName = mapping.schemaName;
    const def = defs[schemaName];
    const defKey = schemaName;
    const cols = tbl.columns.map(c => c.name).filter(c => !shouldIgnoreField(c));
    const colsMap = Object.fromEntries(tbl.columns.filter(c => !shouldIgnoreField(c.name)).map(c => [c.name, c.type]));

    if (!def) {
      results.push({ entity: tableName, ok: true, skipped: true, reason: 'no schema definition found' });
      console.warn(`${colors.yellow}⚠️ No schema definition for table '${tableName}' — skipping detailed checks.${colors.reset}`);
      continue;
    }

    const required = (def.required || []).filter(r => !shouldIgnoreField(r));
    // check coverage over properties, ignoring fields as in mapping-utils
    const schemaProps = Object.keys(def.properties || {}).filter(p => !shouldIgnoreField(p));
    const totalProps = schemaProps.length;
    const covered = schemaProps.filter(p => cols.includes(p)).length;
    const coveragePct = totalProps > 0 ? ((covered / totalProps) * 100).toFixed(1) : '0.0';

    // simple type mismatch detection
    const typeMismatches = [];
    for (const prop of schemaProps) {
      if (!colsMap[prop]) continue;
      const sqlType = colsMap[prop];
      const jsonTypes = (def.properties && def.properties[prop] && def.properties[prop].type) ? ([]).concat(def.properties[prop].type) : null;
      if (jsonTypes && jsonTypes.length > 0) {
        const sqlMapped = mapSqlTypeToJsonTypes(sqlType);
        const okType = sqlMapped.some(t => jsonTypes.includes(t));
        if (!okType) {
          typeMismatches.push({ column: prop, sqlType, expected: jsonTypes });
        }
      }
    }

    // detect optional (non-required) properties missing from SQL that reduce coverage
    const optionalMissing = schemaProps.filter(p => !cols.includes(p) && !required.includes(p));

    const missingRequired = required.filter(r => !cols.includes(r));
    const ok = missingRequired.length === 0 && typeMismatches.length === 0;
    const entry = { entity: tableName, def: defKey, ok, coveragePct, missingRequired, typeMismatches, optionalMissing, schemaProps, cols };
    results.push(entry);

    // print details per table immediately for visibility
    const coverageNumeric = Number.parseFloat(coveragePct) || 0;
    let symbol;
    if (entry.skipped) {
      symbol = 'ℹ️';
    } else if (
      coverageNumeric === 100 &&
      missingRequired.length === 0 &&
      typeMismatches.length === 0 &&
      optionalMissing.length === 0
    ) {
      symbol = '✅';
    } else {
      symbol = '⚠️';
    }
    console.log(`${symbol} ${tableName} — ${coveragePct}% coverage (${covered}/${totalProps})`);

    // Always print details when coverage < 100% or there are any issues
    const needsDetails =
      coverageNumeric < 100 ||
      missingRequired.length > 0 ||
      typeMismatches.length > 0 ||
      optionalMissing.length > 0;
    if (needsDetails) {
      console.log(`  ${colors.bold}Details:${colors.reset}`);

      // Missing required fields
      if (missingRequired.length) {
        console.log(`   ${colors.red}Missing required fields:${colors.reset}`);
        missingRequired.forEach(m => console.log(`    - ${m}`));
      }

      // Type mismatches
      if (typeMismatches.length) {
        console.log(`   ${colors.red}Type mismatches:${colors.reset}`);
        typeMismatches.forEach(tm =>
          console.log(
            `    - column ${tm.column}: sql='${tm.sqlType}' expected=${JSON.stringify(tm.expected)}`
          )
        );
      }

      // Optional (non-required) properties missing that reduce coverage
      if (optionalMissing.length) {
        console.log(`   ${colors.yellow}Optional properties missing (affects coverage):${colors.reset}`);
        optionalMissing.forEach(m => console.log(`    - ${m}`));
      }

      // If no specific lists exist, list which schema properties are absent (useful to surface why coverage < 100%)
      if (
        !missingRequired.length &&
        !typeMismatches.length &&
        !optionalMissing.length &&
        coverageNumeric < 100
      ) {
        const absent = schemaProps.filter(p => !cols.includes(p));
        if (absent.length) {
          console.log(`   ${colors.yellow}Schema properties not present in SQL (affects coverage):${colors.reset}`);
          absent.forEach(a => console.log(`    - ${a}`));
        }
      }
    }
  }

  // Summary
  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  results.forEach(r => {
    const coverageNumeric = Number.parseFloat(r.coveragePct) || 0;
    let sym;
    if (r.skipped) sym = 'ℹ️';
    else if (
      coverageNumeric === 100 &&
      (!r.missingRequired || r.missingRequired.length === 0) &&
      (!r.typeMismatches || r.typeMismatches.length === 0) &&
      (!r.optionalMissing || r.optionalMissing.length === 0)
    )
      sym = '✅';
    else sym = '⚠️';
    const note = r.skipped ? ` (skipped: ${r.reason})` : ` (${r.coveragePct}% coverage)`;
    console.log(` ${sym} ${r.entity}${note}`);
  });

  // Additionally, print details for any entity with coverage < 100 to ensure visibility of missing details
  const notPerfect = results.filter(
    r =>
      !r.skipped &&
      (Number.parseFloat(r.coveragePct) < 100 ||
        (r.missingRequired && r.missingRequired.length) ||
        (r.typeMismatches && r.typeMismatches.length) ||
        (r.optionalMissing && r.optionalMissing.length))
  );
  if (notPerfect.length > 0) {
    console.log(`\n${colors.bold}Details for entities with issues/coverage < 100%:${colors.reset}`);
    for (const r of notPerfect) {
      const coverageNumeric = Number.parseFloat(r.coveragePct) || 0;
      const sym =
        coverageNumeric === 100 &&
        (!r.missingRequired || r.missingRequired.length === 0) &&
        (!r.typeMismatches || r.typeMismatches.length === 0) &&
        (!r.optionalMissing || r.optionalMissing.length === 0)
          ? '✅'
          : '⚠️';
      console.log(`\n ${sym} ${r.entity} — ${r.coveragePct}% coverage`);
      if (r.missingRequired && r.missingRequired.length) {
        console.log('  Missing required fields:');
        r.missingRequired.forEach(m => console.log(`   - ${m}`));
      }
      if (r.typeMismatches && r.typeMismatches.length) {
        console.log('  Type mismatches:');
        r.typeMismatches.forEach(tm =>
          console.log(`   - column ${tm.column}: sql='${tm.sqlType}' expected=${JSON.stringify(tm.expected)}`)
        );
      }
      if (r.optionalMissing && r.optionalMissing.length) {
        console.log('  Optional properties missing (coverage warning):');
        r.optionalMissing.forEach(m => console.log(`   - ${m}`));
      }
      if (
        (!r.missingRequired || r.missingRequired.length === 0) &&
        (!r.typeMismatches || r.typeMismatches.length === 0) &&
        (!r.optionalMissing || r.optionalMissing.length === 0) &&
        Number.parseFloat(r.coveragePct) < 100
      ) {
        const absent = r.schemaProps.filter(p => !(r.cols || []).includes(p));
        if (absent && absent.length) {
          console.log('  Schema properties not present in SQL (affects coverage):');
          absent.forEach(a => console.log(`   - ${a}`));
        }
      }
    }
  }

  const anyFail =
    notPerfect.some(rr => rr.missingRequired && rr.missingRequired.length > 0) ||
    notPerfect.some(rr => rr.typeMismatches && rr.typeMismatches.length > 0);
  return anyFail ? 1 : 0;
}

// export and CLI
module.exports = { main };
if (require.main === module) {
  (async () => {
    const code = await main(process.argv);
    process.exit(code);
  })();
}

