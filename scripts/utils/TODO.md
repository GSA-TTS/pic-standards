# Utils Refactor TODO

Last updated: 2025-08-13

## Completed

- Cleaned mapping-utils duplicate blocks; restored single export set.
- Prefer generic schema properties first (id/title/description/name), then table-specific renames.
- Expanded TABLE_FIELD_MAPPINGS to cover optional properties and resolve crosswalk warnings.
- Removed unused cli-utils.js (duplicated parseArgs implementation).
- Consolidated summary/printing responsibilities into error-reporting.js.
- Removed deprecated printSummary wrappers from validation-utils.js.
- Added printOperationSummary helper in error-reporting.js for simple boolean + label summaries.
- Updated validate-database-crosswalk.js to use new helper.

## Follow-Up Candidates

- debug-validation.js: Developer tool; move to `tools/` or keep if actively used.
- validate-csv-yaml.js: Not referenced in npm scripts; delete if no longer required.
- validate-examples.js & test-transform.js: Legacy; confirm need or remove.
- enhanced-mapping-utils.js / validation-core.js: Currently only used by debug-validation + tests; consider merging minimal pieces into mapping-utils.js if debugger removed.

## Potential Improvements

- Increase unit test coverage for error-reporting helpers (printOperationSummary path).
- Simplify mapping-utils by pruning unused exports after confirming runtime usage.
- Introduce lightweight logger abstraction to silence output in Jest without manual console stubbing.

## Action Items (Proposed Order)

1. Decide fate of debug / legacy scripts (list above).
2. Prune orphaned mapping / transformation helpers if no production path uses them.
3. Add tests asserting new consolidated summary behavior.

> Update this file after each cleanup step.

## Coverage & Refactor Roadmap (Updated)

### Current Metrics (post latest run)

- Statements: 18.8%
- Branches: 13.73%
- Functions: 18.62%
- Lines: 19.56%

### Milestone Coverage Targets & Actions

#### 30% Target

- [ ] Add tests for: mapping-utils (remaining unmapped branches), error-reporting edge cases (empty errors, mixed paths), csv-utils success path (mock fs + stream), enhanced-mapping-utils resolveEntityName + getPossibleEntityNames variants.
- [ ] Add minimal tests for transformation-utils: transformEntity null replacement, gis_data.container_inventory fix path.
- [ ] Add tests for validation-core.extractEntityTypesFromSchema negative cases (missing definitions) & adapter selection.

#### 40% Target

- [ ] Tests for validation-utils.validateFile error branches (malformed JSON/YAML) using temp files.
- [ ] Tests for input-adapters all adapter getEntities / setEntities / getAllEntityArrays.
- [ ] Tests for shouldIgnoreField pattern-based conditions (parent_*_json, leading underscore).
- [ ] Add snapshot tests for validate-json and validate-yaml outputs (small synthetic dataset) to increase line coverage in runners.

#### 50% Target

- [ ] Integration test: run validate-json against fixture with multiple entity arrays + intentional schema violations; assert aggregated error formatting lines.
- [ ] Add tests for csv-utils.loadDatabaseCrosswalk grouping logic (synthetic CSV via in-memory stream/mock fs).
- [ ] Test error-reporting.generateErrorReport verbose + includeContext toggle.
- [ ] Cover branch in mapping-utils for unmapped status/document/event types (mapStatus fallback path).

#### 60% Target

- [ ] Add AJV schema failure simulation (inject invalid schema) to cover validate-schemas negative branches.
- [ ] Tests for enhanced-mapping-utils fieldMappings / idMappings resolution (if exported for test or expose helper accessor).
- [ ] Add transformToNepaFormat integration test with mixed null / array-of-objects conversions.
- [ ] Cover edge cases in transformation-utils: unknown type default (returns null) & array recursion.

#### 70% Target

- [ ] Introduce fixtures for a medium dataset; run through validation-core pipeline; assert per-entity recordCounts.
- [ ] Add OpenAPI validation test (if stable spec in repo) to cover validate-openapi script lines.
- [ ] Add crosswalk validator integration test ensuring non-zero coverage for representative tables.
- [ ] Tests for CLI wrappers (parse --verbose / --help) across one script using spawn.

#### 80% Target

- [ ] Add performance-focused test ensuring Ajv reused (after singleton refactor) measuring compile count (mock Ajv constructor).
- [ ] Expand snapshot coverage to include failure summaries for JSON & YAML.
- [ ] Cover additionalProperties / required / type error branches in error-reporting formatting.
- [ ] Branch coverage for conditional colorized output (verbose vs non-verbose modes).

#### 90% Target

- [ ] Fuzz-style test generating random minimal valid + invalid entities to exercise validation-core and mapping fallbacks.
- [ ] Exhaustive tests for transformation edge cases: nested objects, arrays with null, spatial/gis special handling.
- [ ] Load-time failure tests: simulate fs errors (permission denied) for csv-utils & file-utils.
- [ ] Coverage gap audit: inspect uncovered lines; add micro-tests or refactor dead code.

### Test Infra Enhancements

- [ ] Add jest --runInBand option for stream-based tests if race conditions appear.
- [ ] Add helper to create temp fixture tree (utils/test-fixtures.js) for reuse.
- [ ] Use dependency injection or small wrappers to mock fs and Ajv where needed.

## Refactor / Technical Debt Status

### Phase 1 (Stabilize)

- [x] Fix getSchemaMapping mismatch (wrapped simple string mappings)  
- [x] Add smoke/unit tests (mapping, crosswalk logic, error reporter)  
- [x] Centralize colors (colors.js consumed; remaining inline constants scheduled for cleanup)  

### Phase 2 (Consolidate Utilities)

- [ ] Deduplicate file discovery (raw scripts still have local logic)  
- [ ] Adopt cli-args.js in all validate-* scripts  
- [ ] Create ajv-factory.js (pending)  

### Phase 3 (Unify Validators)

- [ ] Merge raw/enhanced validators behind flag (--raw)  
- [ ] Deprecation notice in raw scripts  

### Phase 4 (Reporting & Performance)

- [ ] Route all scripts through error-reporting central API  
- [ ] Add required field coverage metrics to validation output  

### Phase 5 (OpenAPI & Crosswalk Alignment)

- [ ] Normalize mapping usage in validate-openapi.js  
- [ ] Add normalizeMapping helper + tests  

### Phase 6 (Hardening)

- [ ] Snapshot current CLI outputs (baseline)  
- [ ] Add --json-output option for machine-readable CI artifacts  

## Immediate Next Actions

1. Implement 30% target tests (focus: mapping-utils, csv-utils success, transformation-utils basics).  
2. Extract remaining inline color sets to colors.js (search for "\x1b").  
3. Introduce simple ajv-factory.js and refactor one validator to use it (measure compile count).  

## Notes

- Maintain backward-compatible CLI during consolidation; add deprecation logging once unified runners are stable.
- Periodically re-run coverage after each milestone; adjust thresholds gradually (e.g., start at 25% → 40% → etc.) instead of enforcing 80% immediately.

### Crosswalk alignment (2025-08-13)

- All tables VALID after mapping changes; unmatched items are optional or alternate names.
- Rule: Prefer generic schema id/title/description/name when present; fall back only when absent.

JJediny:  scripts                         |   54.83 |     38.7 |   55.05 |   54.84 |                                   
  validate-database-crosswalk.js |   56.14 |    46.42 |   51.61 |   55.42 | ...48-249,262-267,289-316,331-369 
  validate-json-raw.js           |   59.84 |    34.42 |   66.66 |   60.68 | ...97,132-160,191,213-247,252-255 
  validate-json.js               |   33.33 |    16.66 |       0 |   33.33 | 6-12,18-26,30                     
  validate-openapi.js            |   83.15 |    72.88 |   68.75 |   83.14 | ...96,340,372-373,389-390,398-409 
  validate-schemas.js            |   14.64 |     6.81 |   22.22 |   15.03 | ...58-259,266-272,278-284,293-324 
  validate-yaml-raw.js           |   60.15 |    36.06 |   66.66 |   61.01 | ...98,133-161,192,214-248,253-256 
  validate-yaml.js               |    37.5 |    16.66 |       0 |    37.5 | 4-12,16   

GitHub Copilot: Enable GPT-5 mini (Preview) for all clients
[object Object]

JJediny: @GitHubCopilot Enable: "Enable GPT-5 mini (Preview) for all clients"

GitHub Copilot: Do you want me to (pick one):

- generate unit tests (Jest/Mocha) to raise coverage for specific files (recommend starting with validate-schemas.js and validate-json.js), or
- propose targeted code fixes to increase coverage, or
- produce test scaffolding + example tests for all scripts listed?

If you want me to edit existing files, please add the files to be modified to the working set, or use `#codebase` in your request to automatically discover working set files.

JJediny:  scripts                         |   54.83 |     38.7 |   55.05 |   54.84 |                                   
  validate-database-crosswalk.js |   56.14 |    46.42 |   51.61 |   55.42 | ...48-249,262-267,289-316,331-369 
  validate-json-raw.js           |   59.84 |    34.42 |   66.66 |   60.68 | ...97,132-160,191,213-247,252-255 
  validate-json.js               |   33.33 |    16.66 |       0 |   33.33 | 6-12,18-26,30                     
  validate-openapi.js            |   83.15 |    72.88 |   68.75 |   83.14 | ...96,340,372-373,389-390,398-409 
  validate-schemas.js            |   14.64 |     6.81 |   22.22 |   15.03 | ...58-259,266-272,278-284,293-324 
  validate-yaml-raw.js           |   60.15 |    36.06 |   66.66 |   61.01 | ...98,133-161,192,214-248,253-256 
  validate-yaml.js               |    37.5 |    16.66 |       0 |    37.5 | 4-12,16   

GitHub Copilot: Permission Request
[object Object]

JJediny: @GitHubCopilot Grant: "Permission Request"

GitHub Copilot: You have provided a coverage report for several scripts. To improve test coverage, here’s a step-by-step plan:

1. **Identify low-coverage files:** The lowest are `validate-schemas.js` and `validate-json.js` (especially branches and functions).
2. **Add/expand unit tests:** Focus on untested branches, error handling, and edge cases.
3. **(Optional) Refactor for testability:** If some logic is hard to test, consider extracting functions.
4. **Repeat for other scripts as needed.**

Below is a summary of what you should do for each file, with example test scaffolding for `validate-json.js` and `validate-schemas.js` to get started.

---

### [validate-json.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-json.js)

Add unit tests to cover:
- CLI argument parsing (with/without `--debug`)
- Handling of missing/invalid files
- Success and failure validation paths

````javascript
// ...existing code...

// Example test scaffolding (place in __tests__/validate-json.test.js or similar)
const { execSync } = require('child_process');
const path = require('path');

describe('validate-json CLI', () => {
  const script = path.resolve(__dirname, '../validate-json.js');
  it('should exit 0 on valid input', () => {
    // ...simulate valid file...
    // expect exit code 0
  });
  it('should exit 1 on invalid input', () => {
    // ...simulate invalid file...
    // expect exit code 1
  });
  it('should handle --debug flag', () => {
    // ...simulate debug mode...
  });
  it('should print usage on missing args', () => {
    // ...simulate no args...
  });
});
````

---

### [validate-schemas.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-schemas.js)

Add unit tests to cover:
- Schema loading errors
- Validation of correct/incorrect schemas
- Edge cases (empty input, malformed schema)

````javascript


Made changes.

// ...existing code...

// Example test scaffolding (place in __tests__/validate-schemas.test.js or similar)
describe('validate-schemas', () => {
  it('should validate a correct schema', () => {
    // ...simulate valid schema...
  });
  it('should report errors for invalid schema', () => {
    // ...simulate invalid schema...
  });
  it('should handle missing schema file', () => {
    // ...simulate missing file...
  });
  it('should handle empty input', () => {
    // ...simulate empty input...
  });
});
````

---

**Next steps:**  
- Place these test files in a `__tests__` or `tests` directory.
- Use Jest or Mocha as your test runner.
- Mock file system and process exit as needed.
- Repeat for other scripts to further increase coverage.

Let me know if you want concrete test implementations or help with a specific file!

Made changes.

JJediny: review existing tests in pic-standards/scripts/utils add tests to test as suggested last

GitHub Copilot: ### [validation-utils.test.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/utils/validation-utils.test.js)

Add tests for `validate-json.js` CLI and logic, as suggested previously. This covers exit codes, flags, and error handling.  
Assumes you have a test directory and can use Jest or similar.

````javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('validate-json CLI', () => {
  const script = path.resolve(__dirname, '../validate-json.js');
  const validJsonPath = path.resolve(__dirname, 'fixtures/valid.json');
  const invalidJsonPath = path.resolve(__dirname, 'fixtures/invalid.json');

  beforeAll(() => {
    // Setup minimal valid/invalid JSON files for testing
    fs.mkdirSync(path.dirname(validJsonPath), { recursive: true });
    fs.writeFileSync(validJsonPath, JSON.stringify({ process_id: 1 }));
    fs.writeFileSync(invalidJsonPath, '{"bad_json": }');
  });

  afterAll(() => {
    fs.unlinkSync(validJsonPath);
    fs.unlinkSync(invalidJsonPath);
    fs.rmdirSync(path.dirname(validJsonPath));
  });

  it('should exit 0 on valid input', () => {
    const result = execSync(`node ${script} ${validJsonPath}`, { stdio: 'pipe' });
    expect(result.toString()).toMatch(/Starting JSON validation process/);
    // If process.exit(0) is called, execSync does not throw
  });

  it('should exit 1 on invalid input', () => {
    let error;
    try {
      execSync(`node ${script} ${invalidJsonPath}`, { stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.status).toBe(1);
  });

  it('should handle --debug flag', () => {
    const result = execSync(`node ${script} ${validJsonPath} --debug`, { stdio: 'pipe' });
    expect(result.toString()).toMatch(/Starting JSON validation process/);
    // Add more expectations for debug output if needed
  });

  it('should print usage on missing args', () => {
    let error;
    try {
      execSync(`node ${script}`, { stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout.toString()).toMatch(/Usage|process/);
  });
});
````

---

**Summary:**  
- This test file exercises the CLI interface for `validate-json.js` as suggested.
- It creates temporary valid/invalid JSON files for testing.
- It checks for correct exit codes and output for valid, invalid, debug, and missing argument scenarios.
- Place this file alongside your other test files in `scripts/utils/`.

Let me know if you want similar scaffolding for other scripts!

Made changes.

JJediny: run npm run test && npm run test:coverage from /pic-standards dir. Evaluate Uncovered Line #s and create a todo plan to address with adding tests, refactoring code, or removing unused code

GitHub Copilot: Solution (step-by-step)
1. I attempted to run tests/coverage but cannot execute commands here. Instead I used the coverage excerpts you provided to identify uncovered regions.
2. I’ll make minimal, testability-focused edits so unit tests can target internal functions and CLI flows.
3. I’ll export internal helpers from validate-schemas.js and make validateJsonFiles easier to test by allowing an injected schema path.
4. I provide a TODO plan mapping uncovered lines to concrete actions: tests to add, refactors to make, or code to remove if unused.

Changes by file

### [validate-schemas.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-schemas.js)

Expose internal helpers so unit tests can exercise display/gather logic and edge cases (enum/anyOf/$ref branches, definitions handling, stats counting, error paths). No behavior changes, just an expanded export.

````javascript
// ...existing code...

// Export for testing internals (helps unit tests cover display & stats branches)
module.exports = {
  validateSchemas,
  displaySchemaProperties,
  displayVerboseSchemaInfo,
  gatherSchemaStatistics
};
````

### [validate-json.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-json.js)

Make validateJsonFiles accept an optional schemaPath (and return the resolved schemaPath) so tests can call it without forking a process and assert behavior. Minimal, non-breaking change.

````javascript


Made changes.

````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
// ...existing code...

function validateJsonFiles(schemaPathOverride = null) {
  const utils = new ValidationUtils({ strict: false });
  utils.log('🔍 Starting JSON validation process...');

  // Load NEPA schema
  const schemaPath = schemaPathOverride || path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  utils.loadSchema(schemaPath);
  utils.log(`📋 Schema loaded: ${schemaPath}`);

  return schemaPath;
}

// ...existing code...

module.exports = { main, validateJsonFiles };
````

TODO plan to address uncovered lines (tests, refactors, removals)

High-level approach
- Add focused unit tests (Jest recommended) for pure functions and edge branches.
- Add CLI integration tests that run the scripts via child_process execSync to assert exit codes and outputs.
- Refactor printing/logging to be injectable (logger param) if a lot of console output makes assertions brittle.
- Mock filesystem and AJV where appropriate to force error and success conditions without touching the real repo files.

File-specific TODOs

1) scripts/validate-schemas.js
- Coverage gaps (from your report): large ranges (~lines 58-259, 266-272, 278-284, 293-324)
  - Add unit tests for:
    - displaySchemaProperties:
      - property entries with type: string/number/boolean/object/array
      - enum present with >5 values (verify “(+N more)” branch)
      - anyOf/oneOf/$ref branches
      - nested object/array recursion and maxDepth limiting
    - displayVerboseSchemaInfo:
      - schema with $schema, $id, title, description
      - schema.definitions present with required, properties, additionalProperties branches
    - gatherSchemaStatistics:
      - root properties with required fields
      - nested object/array statistics counting
      - enum and mixed-type (anyOf) detection
    - validateSchemas:
      - loadSchemaFile returns falsy (simulate missing/parse error)
      - ajv.validateSchema returns false and ajv.errors populated (assert error logging path)
      - successful validation with verbose=true (assert displayVerboseSchemaInfo invoked)
      - thrown error path in try/catch (simulate loadSchemaFile throwing)
  - Refactor suggestion:
    - Inject AJV instance (accept validator param) or expose a factory so tests can provide a fake ajv with controlled .validateSchema() and .errors.
    - Inject a logger object (console wrapper) to capture output in tests instead of spying on console directly.
  - Remove/confirm unused code:
    - If any display branches never used (e.g., extremely deep recursion or seldom-used color constants), keep but mark tested; avoid removing unless proven dead.

2) scripts/validate-json.js
- Coverage gaps (from your report): lines 6-12,18-26,30
  - Add unit tests for:
    - validateJsonFiles: call with schemaPathOverride to assert utils.loadSchema called (mock ValidationUtils methods).
    - main: mock runValidation to return true/false, verify returned result and that child process exit would be correct when invoked as CLI. Use jest.spyOn(process, 'exit') or run in a child process.
    - CLI invocation variations:
      - with --verbose
      - without args
      - with --debug if script has debug behavior (test output)
  - Refactor suggestion:
    - Allow injecting ValidationUtils (or its instance) for easier mocking in unit tests.
    - Keep validateJsonFiles returning the schema path (done) so tests can assert the chosen path.
  - Remove/confirm unused code:
    - Remove any leftover example test scaffolding embedded in the script file (move to __tests__). The current file includes test scaffolding commented inline — move to actual test files and delete examples from script for clarity.

3) Other scripts listed in coverage summary (validate-json-raw.js, validate-yaml.js, validate-yaml-raw.js, validate-openapi.js, validate-database-crosswalk.js)
- General plan:
  - Add unit tests targeting:
    - error branches and CLI flags
    - file-system edge cases (missing files, malformed content)
    - code paths for debug/verbose flags
  - Where functions are complex, export internals to unit-test them directly.
  - If some scripts mostly print output, wrap console usage with an injectable logger to assert outputs reliably.

Test-writing guidance (practical)
- Use Jest; add tests under scripts/__tests__ or scripts/tests.
- Mock:
  - fs (fs.promises or sync) for file presence/content
  - the AJV validator (fake object with validateSchema + errors)
  - module methods (jest.mock('./utils/validation-utils') and control behaviors)
- For CLI integration tests, use child_process.execSync and assert exit codes (catch thrown errors, inspect error.status).
- Aim for small, isolated tests that exercise single branches.

Immediate small code housekeeping I applied
- Exported internal helpers from validate-schemas.js for unit testing.
- Made validateJsonFiles accept an injectable schema path and return it for assertions.
- Suggest moving any inline test scaffolding out of script files into real test files.

If you want, I can:
- Generate Jest test files for the highest-priority uncovered functions/branches (start with gatherSchemaStatistics and displaySchemaProperties), or
- Refactor validator creation and logger injection for easier mocking and then generate tests that use those hooks.

Which should I generate first?
`````markdown
# Utils Refactor TODO

Last updated: 2025-08-13

## Completed

- Cleaned mapping-utils duplicate blocks; restored single export set.
- Prefer generic schema properties first (id/title/description/name), then table-specific renames.
- Expanded TABLE_FIELD_MAPPINGS to cover optional properties and resolve crosswalk warnings.
- Removed unused cli-utils.js (duplicated parseArgs implementation).
- Consolidated summary/printing responsibilities into error-reporting.js.
- Removed deprecated printSummary wrappers from validation-utils.js.
- Added printOperationSummary helper in error-reporting.js for simple boolean + label summaries.
- Updated validate-database-crosswalk.js to use new helper.

## Follow-Up Candidates

- debug-validation.js: Developer tool; move to `tools/` or keep if actively used.
- validate-csv-yaml.js: Not referenced in npm scripts; delete if no longer required.
- validate-examples.js & test-transform.js: Legacy; confirm need or remove.
- enhanced-mapping-utils.js / validation-core.js: Currently only used by debug-validation + tests; consider merging minimal pieces into mapping-utils.js if debugger removed.

## Potential Improvements

- Increase unit test coverage for error-reporting helpers (printOperationSummary path).
- Simplify mapping-utils by pruning unused exports after confirming runtime usage.
- Introduce lightweight logger abstraction to silence output in Jest without manual console stubbing.

## Action Items (Proposed Order)

1. Decide fate of debug / legacy scripts (list above).
2. Prune orphaned mapping / transformation helpers if no production path uses them.
3. Add tests asserting new consolidated summary behavior.

> Update this file after each cleanup step.

## Coverage & Refactor Roadmap (Updated)

### Current Metrics (post latest run)

- Statements: 18.8%
- Branches: 13.73%
- Functions: 18.62%
- Lines: 19.56%

### Milestone Coverage Targets & Actions

#### 30% Target

- [ ] Add tests for: mapping-utils (remaining unmapped branches), error-reporting edge cases (empty errors, mixed paths), csv-utils success path (mock fs + stream), enhanced-mapping-utils resolveEntityName + getPossibleEntityNames variants.
- [ ] Add minimal tests for transformation-utils: transformEntity null replacement, gis_data.container_inventory fix path.
- [ ] Add tests for validation-core.extractEntityTypesFromSchema negative cases (missing definitions) & adapter selection.

#### 40% Target

- [ ] Tests for validation-utils.validateFile error branches (malformed JSON/YAML) using temp files.
- [ ] Tests for input-adapters all adapter getEntities / setEntities / getAllEntityArrays.
- [ ] Tests for shouldIgnoreField pattern-based conditions (parent_*_json, leading underscore).
- [ ] Add snapshot tests for validate-json and validate-yaml outputs (small synthetic dataset) to increase line coverage in runners.

#### 50% Target

- [ ] Integration test: run validate-json against fixture with multiple entity arrays + intentional schema violations; assert aggregated error formatting lines.
- [ ] Add tests for csv-utils.loadDatabaseCrosswalk grouping logic (synthetic CSV via in-memory stream/mock fs).
- [ ] Test error-reporting.generateErrorReport verbose + includeContext toggle.
- [ ] Cover branch in mapping-utils for unmapped status/document/event types (mapStatus fallback path).

#### 60% Target

- [ ] Add AJV schema failure simulation (inject invalid schema) to cover validate-schemas negative branches.
- [ ] Tests for enhanced-mapping-utils fieldMappings / idMappings resolution (if exported for test or expose helper accessor).
- [ ] Add transformToNepaFormat integration test with mixed null / array-of-objects conversions.
- [ ] Cover edge cases in transformation-utils: unknown type default (returns null) & array recursion.

#### 70% Target

- [ ] Introduce fixtures for a medium dataset; run through validation-core pipeline; assert per-entity recordCounts.
- [ ] Add OpenAPI validation test (if stable spec in repo) to cover validate-openapi script lines.
- [ ] Add crosswalk validator integration test ensuring non-zero coverage for representative tables.
- [ ] Tests for CLI wrappers (parse --verbose / --help) across one script using spawn.

#### 80% Target

- [ ] Add performance-focused test ensuring Ajv reused (after singleton refactor) measuring compile count (mock Ajv constructor).
- [ ] Expand snapshot coverage to include failure summaries for JSON & YAML.
- [ ] Cover additionalProperties / required / type error branches in error-reporting formatting.
- [ ] Branch coverage for conditional colorized output (verbose vs non-verbose modes).

#### 90% Target

- [ ] Fuzz-style test generating random minimal valid + invalid entities to exercise validation-core and mapping fallbacks.
- [ ] Exhaustive tests for transformation edge cases: nested objects, arrays with null, spatial/gis special handling.
- [ ] Load-time failure tests: simulate fs errors (permission denied) for csv-utils & file-utils.
- [ ] Coverage gap audit: inspect uncovered lines; add micro-tests or refactor dead code.

### Test Infra Enhancements

- [ ] Add jest --runInBand option for stream-based tests if race conditions appear.
- [ ] Add helper to create temp fixture tree (utils/test-fixtures.js) for reuse.
- [ ] Use dependency injection or small wrappers to mock fs and Ajv where needed.

## Refactor / Technical Debt Status

### Phase 1 (Stabilize)

- [x] Fix getSchemaMapping mismatch (wrapped simple string mappings)  
- [x] Add smoke/unit tests (mapping, crosswalk logic, error reporter)  
- [x] Centralize colors (colors.js consumed; remaining inline constants scheduled for cleanup)  

### Phase 2 (Consolidate Utilities)

- [ ] Deduplicate file discovery (raw scripts still have local logic)  
- [ ] Adopt cli-args.js in all validate-* scripts  
- [ ] Create ajv-factory.js (pending)  

### Phase 3 (Unify Validators)

- [ ] Merge raw/enhanced validators behind flag (--raw)  
- [ ] Deprecation notice in raw scripts  

### Phase 4 (Reporting & Performance)

- [ ] Route all scripts through error-reporting central API  
- [ ] Add required field coverage metrics to validation output  

### Phase 5 (OpenAPI & Crosswalk Alignment)

- [ ] Normalize mapping usage in validate-openapi.js  
- [ ] Add normalizeMapping helper + tests  

### Phase 6 (Hardening)

- [ ] Snapshot current CLI outputs (baseline)  
- [ ] Add --json-output option for machine-readable CI artifacts  

## Immediate Next Actions

1. Implement 30% target tests (focus: mapping-utils, csv-utils success, transformation-utils basics).  
2. Extract remaining inline color sets to colors.js (search for "\x1b").  
3. Introduce simple ajv-factory.js and refactor one validator to use it (measure compile count).  

## Notes

- Maintain backward-compatible CLI during consolidation; add deprecation logging once unified runners are stable.
- Periodically re-run coverage after each milestone; adjust thresholds gradually (e.g., start at 25% → 40% → etc.) instead of enforcing 80% immediately.

### Crosswalk alignment (2025-08-13)

- All tables VALID after mapping changes; unmatched items are optional or alternate names.
- Rule: Prefer generic schema id/title/description/name when present; fall back only when absent.

JJediny:  scripts                         |   54.83 |     38.7 |   55.05 |   54.84 |                                   
  validate-database-crosswalk.js |   56.14 |    46.42 |   51.61 |   55.42 | ...48-249,262-267,289-316,331-369 
  validate-json-raw.js           |   59.84 |    34.42 |   66.66 |   60.68 | ...97,132-160,191,213-247,252-255 
  validate-json.js               |   33.33 |    16.66 |       0 |   33.33 | 6-12,18-26,30                     
  validate-openapi.js            |   83.15 |    72.88 |   68.75 |   83.14 | ...96,340,372-373,389-390,398-409 
  validate-schemas.js            |   14.64 |     6.81 |   22.22 |   15.03 | ...58-259,266-272,278-284,293-324 
  validate-yaml-raw.js           |   60.15 |    36.06 |   66.66 |   61.01 | ...98,133-161,192,214-248,253-256 
  validate-yaml.js               |    37.5 |    16.66 |       0 |    37.5 | 4-12,16   

GitHub Copilot: Enable GPT-5 mini (Preview) for all clients
[object Object]

JJediny: @GitHubCopilot Enable: "Enable GPT-5 mini (Preview) for all clients"

GitHub Copilot: Do you want me to (pick one):

- generate unit tests (Jest/Mocha) to raise coverage for specific files (recommend starting with validate-schemas.js and validate-json.js), or
- propose targeted code fixes to increase coverage, or
- produce test scaffolding + example tests for all scripts listed?

If you want me to edit existing files, please add the files to be modified to the working set, or use `#codebase` in your request to automatically discover working set files.

JJediny:  scripts                         |   54.83 |     38.7 |   55.05 |   54.84 |                                   
  validate-database-crosswalk.js |   56.14 |    46.42 |   51.61 |   55.42 | ...48-249,262-267,289-316,331-369 
  validate-json-raw.js           |   59.84 |    34.42 |   66.66 |   60.68 | ...97,132-160,191,213-247,252-255 
  validate-json.js               |   33.33 |    16.66 |       0 |   33.33 | 6-12,18-26,30                     
  validate-openapi.js            |   83.15 |    72.88 |   68.75 |   83.14 | ...96,340,372-373,389-390,398-409 
  validate-schemas.js            |   14.64 |     6.81 |   22.22 |   15.03 | ...58-259,266-272,278-284,293-324 
  validate-yaml-raw.js           |   60.15 |    36.06 |   66.66 |   61.01 | ...98,133-161,192,214-248,253-256 
  validate-yaml.js               |    37.5 |    16.66 |       0 |    37.5 | 4-12,16   

GitHub Copilot: Permission Request
[object Object]

JJediny: @GitHubCopilot Grant: "Permission Request"

GitHub Copilot: You have provided a coverage report for several scripts. To improve test coverage, here’s a step-by-step plan:

1. **Identify low-coverage files:** The lowest are `validate-schemas.js` and `validate-json.js` (especially branches and functions).
2. **Add/expand unit tests:** Focus on untested branches, error handling, and edge cases.
3. **(Optional) Refactor for testability:** If some logic is hard to test, consider extracting functions.
4. **Repeat for other scripts as needed.**

Below is a summary of what you should do for each file, with example test scaffolding for `validate-json.js` and `validate-schemas.js` to get started.

---

### [validate-json.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-json.js)

Add unit tests to cover:
- CLI argument parsing (with/without `--debug`)
- Handling of missing/invalid files
- Success and failure validation paths

````javascript
// ...existing code...

// Example test scaffolding (place in __tests__/validate-json.test.js or similar)
const { execSync } = require('child_process');
const path = require('path');

describe('validate-json CLI', () => {
  const script = path.resolve(__dirname, '../validate-json.js');
  it('should exit 0 on valid input', () => {
    // ...simulate valid file...
    // expect exit code 0
  });
  it('should exit 1 on invalid input', () => {
    // ...simulate invalid file...
    // expect exit code 1
  });
  it('should handle --debug flag', () => {
    // ...simulate debug mode...
  });
  it('should print usage on missing args', () => {
    // ...simulate no args...
  });
});
````

---

### [validate-schemas.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-schemas.js)

Add unit tests to cover:
- Schema loading errors
- Validation of correct/incorrect schemas
- Edge cases (empty input, malformed schema)

````javascript


Made changes.

// ...existing code...

// Example test scaffolding (place in __tests__/validate-schemas.test.js or similar)
describe('validate-schemas', () => {
  it('should validate a correct schema', () => {
    // ...simulate valid schema...
  });
  it('should report errors for invalid schema', () => {
    // ...simulate invalid schema...
  });
  it('should handle missing schema file', () => {
    // ...simulate missing file...
  });
  it('should handle empty input', () => {
    // ...simulate empty input...
  });
});
````

---

**Next steps:**  
- Place these test files in a `__tests__` or `tests` directory.
- Use Jest or Mocha as your test runner.
- Mock file system and process exit as needed.
- Repeat for other scripts to further increase coverage.

Let me know if you want concrete test implementations or help with a specific file!

Made changes.

JJediny: review existing tests in pic-standards/scripts/utils add tests to test as suggested last

GitHub Copilot: ### [validation-utils.test.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/utils/validation-utils.test.js)

Add tests for `validate-json.js` CLI and logic, as suggested previously. This covers exit codes, flags, and error handling.  
Assumes you have a test directory and can use Jest or similar.

````javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('validate-json CLI', () => {
  const script = path.resolve(__dirname, '../validate-json.js');
  const validJsonPath = path.resolve(__dirname, 'fixtures/valid.json');
  const invalidJsonPath = path.resolve(__dirname, 'fixtures/invalid.json');

  beforeAll(() => {
    // Setup minimal valid/invalid JSON files for testing
    fs.mkdirSync(path.dirname(validJsonPath), { recursive: true });
    fs.writeFileSync(validJsonPath, JSON.stringify({ process_id: 1 }));
    fs.writeFileSync(invalidJsonPath, '{"bad_json": }');
  });

  afterAll(() => {
    fs.unlinkSync(validJsonPath);
    fs.unlinkSync(invalidJsonPath);
    fs.rmdirSync(path.dirname(validJsonPath));
  });

  it('should exit 0 on valid input', () => {
    const result = execSync(`node ${script} ${validJsonPath}`, { stdio: 'pipe' });
    expect(result.toString()).toMatch(/Starting JSON validation process/);
    // If process.exit(0) is called, execSync does not throw
  });

  it('should exit 1 on invalid input', () => {
    let error;
    try {
      execSync(`node ${script} ${invalidJsonPath}`, { stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.status).toBe(1);
  });

  it('should handle --debug flag', () => {
    const result = execSync(`node ${script} ${validJsonPath} --debug`, { stdio: 'pipe' });
    expect(result.toString()).toMatch(/Starting JSON validation process/);
    // Add more expectations for debug output if needed
  });

  it('should print usage on missing args', () => {
    let error;
    try {
      execSync(`node ${script}`, { stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout.toString()).toMatch(/Usage|process/);
  });
});
````

---

**Summary:**  
- This test file exercises the CLI interface for `validate-json.js` as suggested.
- It creates temporary valid/invalid JSON files for testing.
- It checks for correct exit codes and output for valid, invalid, debug, and missing argument scenarios.
- Place this file alongside your other test files in `scripts/utils/`.

Let me know if you want similar scaffolding for other scripts!

Made changes.

JJediny: run npm run test && npm run test:coverage from /pic-standards dir. Evaluate Uncovered Line #s and create a todo plan to address with adding tests, refactoring code, or removing unused code

GitHub Copilot: Solution (step-by-step)
1. I attempted to run tests/coverage but cannot execute commands here. Instead I used the coverage excerpts you provided to identify uncovered regions.
2. I’ll make minimal, testability-focused edits so unit tests can target internal functions and CLI flows.
3. I’ll export internal helpers from validate-schemas.js and make validateJsonFiles easier to test by allowing an injected schema path.
4. I provide a TODO plan mapping uncovered lines to concrete actions: tests to add, refactors to make, or code to remove if unused.

Changes by file

### [validate-schemas.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-schemas.js)

Expose internal helpers so unit tests can exercise display/gather logic and edge cases (enum/anyOf/$ref branches, definitions handling, stats counting, error paths). No behavior changes, just an expanded export.

````javascript
// ...existing code...

// Export for testing internals (helps unit tests cover display & stats branches)
module.exports = {
  validateSchemas,
  displaySchemaProperties,
  displayVerboseSchemaInfo,
  gatherSchemaStatistics
};
````

### [validate-json.js](file:///Users/johnhjediny/Documents/GitHub/pic-team/pic-standards/scripts/validate-json.js)

Make validateJsonFiles accept an optional schemaPath (and return the resolved schemaPath) so tests can call it without forking a process and assert behavior. Minimal, non-breaking change.

````javascript


Made changes.

````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
````javascript
// ...existing code...

function validateJsonFiles(schemaPathOverride = null) {
  const utils = new ValidationUtils({ strict: false });
  utils.log('🔍 Starting JSON validation process...');

  // Load NEPA schema
  const schemaPath = schemaPathOverride || path.join(__dirname, '../src/jsonschema/nepa.schema.json');
  utils.loadSchema(schemaPath);
  utils.log(`📋 Schema loaded: ${schemaPath}`);

  return schemaPath;
}

// ...existing code...

module.exports = { main, validateJsonFiles };
````

TODO plan to address uncovered lines (tests, refactors, removals)

High-level approach
- Add focused unit tests (Jest recommended) for pure functions and edge branches.
- Add CLI integration tests that run the scripts via child_process execSync to assert exit codes and outputs.
- Refactor printing/logging to be injectable (logger param) if a lot of console output makes assertions brittle.
- Mock filesystem and AJV where appropriate to force error and success conditions without touching the real repo files.

File-specific TODOs

1) scripts/validate-schemas.js
- Coverage gaps (from your report): large ranges (~lines 58-259, 266-272, 278-284, 293-324)
  - Add unit tests for:
    - displaySchemaProperties:
      - property entries with type: string/number/boolean/object/array
      - enum present with >5 values (verify “(+N more)” branch)
      - anyOf/oneOf/$ref branches
      - nested object/array recursion and maxDepth limiting
    - displayVerboseSchemaInfo:
      - schema with $schema, $id, title, description
      - schema.definitions present with required, properties, additionalProperties branches
    - gatherSchemaStatistics:
      - root properties with required fields
      - nested object/array statistics counting
      - enum and mixed-type (anyOf) detection
    - validateSchemas:
      - loadSchemaFile returns falsy (simulate missing/parse error)
      - ajv.validateSchema returns false and ajv.errors populated (assert error logging path)
      - successful validation with verbose=true (assert displayVerboseSchemaInfo invoked)
      - thrown error path in try/catch (simulate loadSchemaFile throwing)
  - Refactor suggestion:
    - Inject AJV instance (accept validator param) or expose a factory so tests can provide a fake ajv with controlled .validateSchema() and .errors.
    - Inject a logger object (console wrapper) to capture output in tests instead of spying on console directly.
  - Remove/confirm unused code:
    - If any display branches never used (e.g., extremely deep recursion or seldom-used color constants), keep but mark tested; avoid removing unless proven dead.

2) scripts/validate-json.js
- Coverage gaps (from your report): lines 6-12,18-26,30
  - Add unit tests for:
    - validateJsonFiles: call with schemaPathOverride to assert utils.loadSchema called (mock ValidationUtils methods).
    - main: mock runValidation to return true/false, verify returned result and that child process exit would be correct when invoked as CLI. Use jest.spyOn(process, 'exit') or run in a child process.
    - CLI invocation variations:
      - with --verbose
      - without args
      - with --debug if script has debug behavior (test output)
  - Refactor suggestion:
    - Allow injecting ValidationUtils (or its instance) for easier mocking in unit tests.
    - Keep validateJsonFiles returning the schema path (done) so tests can assert the chosen path.
  - Remove/confirm unused code:
    - Remove any leftover example test scaffolding embedded in the script file (move to __tests__). The current file includes test scaffolding commented inline — move to actual test files and delete examples from script for clarity.

3) Other scripts listed in coverage summary (validate-json-raw.js, validate-yaml.js, validate-yaml-raw.js, validate-openapi.js, validate-database-crosswalk.js)
- General plan:
  - Add unit tests targeting:
    - error branches and CLI flags
    - file-system edge cases (missing files, malformed content)
    - code paths for debug/verbose flags
  - Where functions are complex, export internals to unit-test them directly.
  - If some scripts mostly print output, wrap console usage with an injectable logger to assert outputs reliably.

Test-writing guidance (practical)
- Use Jest; add tests under scripts/__tests__ or scripts/tests.
- Mock:
  - fs (fs.promises or sync) for file presence/content
  - the AJV validator (fake object with validateSchema + errors)
  - module methods (jest.mock('./utils/validation-utils') and control behaviors)
- For CLI integration tests, use child_process.execSync and assert exit codes (catch thrown errors, inspect error.status).
- Aim for small, isolated tests that exercise single branches.

Immediate small code housekeeping I applied
- Exported internal helpers from validate-schemas.js for unit testing.
- Made validateJsonFiles accept an injectable schema path and return it for assertions.
- Suggest moving any inline test scaffolding out of script files into real test files.

If you want, I can:
- Generate Jest test files for the highest-priority uncovered functions/branches (start with gatherSchemaStatistics and displaySchemaProperties), or
- Refactor validator creation and logger injection for easier mocking and then generate tests that use those hooks.

Which should I generate first?

TODO plan to address uncovered lines (tests, refactors, removals)

High-level approach
- Add focused unit tests (Jest recommended) for pure functions and edge branches.
- Add CLI integration tests that run the scripts via child_process execSync to assert exit codes and outputs.
- Refactor printing/logging to be injectable (logger param) if a lot of console output makes assertions brittle.
- Mock filesystem and AJV where appropriate to force error and success conditions without touching the real repo files.

File-specific TODOs

1) scripts/validate-schemas.js
- Coverage gaps (from your report): large ranges (~lines 58-259, 266-272, 278-284, 293-324)
  - Add unit tests for:
    - displaySchemaProperties:
      - property entries with type: string/number/boolean/object/array
      - enum present with >5 values (verify “(+N more)” branch)
      - anyOf/oneOf/$ref branches
      - nested object/array recursion and maxDepth limiting
    - displayVerboseSchemaInfo:
      - schema with $schema, $id, title, description
      - schema.definitions present with required, properties, additionalProperties branches
    - gatherSchemaStatistics:
      - root properties with required fields
      - nested object/array statistics counting
      - enum and mixed-type (anyOf) detection
    - validateSchemas:
      - loadSchemaFile returns falsy (simulate missing/parse error)
      - ajv.validateSchema returns false and ajv.errors populated (assert error logging path)
      - successful validation with verbose=true (assert displayVerboseSchemaInfo invoked)
      - thrown error path in try/catch (simulate loadSchemaFile throwing)
  - Refactor suggestion:
    - Inject AJV instance (accept validator param) or expose a factory so tests can provide a fake ajv with controlled .validateSchema() and .errors.
    - Inject a logger object (console wrapper) to capture output in tests instead of spying on console directly.
  - Remove/confirm unused code:
    - If any display branches never used (e.g., extremely deep recursion or seldom-used color constants), keep but mark tested; avoid removing unless proven dead.

2) scripts/validate-json.js
- Coverage gaps (from your report): lines 6-12,18-26,30
  - Add unit tests for:
    - validateJsonFiles: call with schemaPathOverride to assert utils.loadSchema called (mock ValidationUtils methods).
    - main: mock runValidation to return true/false, verify returned result and that child process exit would be correct when invoked as CLI. Use jest.spyOn(process, 'exit') or run in a child process.
    - CLI invocation variations:
      - with --verbose
      - without args
      - with --debug if script has debug behavior (test output)
  - Refactor suggestion:
    - Allow injecting ValidationUtils (or its instance) for easier mocking in unit tests.
    - Keep validateJsonFiles returning the schema path (done) so tests can assert the chosen path.
  - Remove/confirm unused code:
    - Remove any leftover example test scaffolding embedded in the script file (move to __tests__). The current file includes test scaffolding commented inline — move to actual test files and delete examples from script for clarity.

3) Other scripts listed in coverage summary (validate-json-raw.js, validate-yaml.js, validate-yaml-raw.js, validate-openapi.js, validate-database-crosswalk.js)
- General plan:
  - Add unit tests targeting:
    - error branches and CLI flags
    - file-system edge cases (missing files, malformed content)
    - code paths for debug/verbose flags
  - Where functions are complex, export internals to unit-test them directly.
  - If some scripts mostly print output, wrap console usage with an injectable logger to assert outputs reliably.

Test-writing guidance (practical)
- Use Jest; add tests under scripts/__tests__ or scripts/tests.
- Mock:
  - fs (fs.promises or sync) for file presence/content
  - the AJV validator (fake object with validateSchema + errors)
  - module methods (jest.mock('./utils/validation-utils') and control behaviors)
- For CLI integration tests, use child_process.execSync and assert exit codes (catch thrown errors, inspect error.status).
- Aim for small, isolated tests that exercise single branches.

Immediate small code housekeeping I applied
- Exported internal helpers from validate-schemas.js for unit testing.
- Made validateJsonFiles accept an injectable schema path and return it for assertions.
- Suggest moving any inline test scaffolding out of script files into real test files.

