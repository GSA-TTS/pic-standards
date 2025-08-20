# NEPA and Permitting Data and Technology Standard

## Why this project

This repository includes a toolkit for implementation of the data standards, technical documentation, and scripts that can aid in validating implementations.  For more information, see the Permitting Innovation Center's [website](https://permitting.innovation.gov).

## Toolkit

The toolkit (found in - [/src](./src)) contains working files for the NEPA and Permitting Data and Technology Standard, versioned by tag.  The current version is 1.2; changes include additional fields to identify record origin and some minor updates to fields.  The best way to check these changes is with the SQL database migration file in the database folder. 
The previous version was 1.1 - this version included new documentation but no new changes to the data standard structure itself.  

- [JSONschema](./src/jsonschema) - The core of the **NEPA Data Standard** is the [nepa.schema.json](./src/jsonschema/nepa.schema.json) file, which defines the structure and validation rules for NEPA-related data.
- [Data Standard Crosswalk](./src/crosswalk) - csv file containing a list of all entities, properties, types (postgres), and descriptions.
- [SQL Database migration](./src/database) - Migration files and seed data to create a sql database with the data standards structure.
- [JSON](./src/json) - json file(s) including sample data organized in the data standard structure
- [YAML](./src/yaml) - yaml file(s) including sample data organized in the data standard structure
- [OpenAPI](./src/openapi) specs - sample yaml and json files that can be used to generate swagger or other documentation (note - there is no API implementation, just documentation)


Sample data is entirely notional to illustrate data structure and does not reflect any actual projects, environmental review or permitting, or other formal position of the US government related to permitting or environmental review. In some cases sample data is synthetically generated. No endorsement is implied in this sample data.

## Changelog

Version 1.0 to 1.1: 

- Added SQL database files to toolkit, but did not change any data structure.  

Version 1.1 to 1.2: 
- New Provenance Properties (added to all tables):
  - data_record_version: The version of the record, for tracking updates or changes to the data.
  - data_source_agency: The name of the agency or organization that provided the data.
  - data_source_system: The system or database where the data originally came from.
  - last_updated: The date and time when the record was last updated.
  - record_owner_agency: The agency responsible for maintaining or “owning” this record.
  - retrieved_timestamp: The date and time when this record was retrieved from its source.

- Other Table-Specific Additions:

  - decision_element table: 
    - expected_evaluation_data: Stores expected evaluation information in JSON format.
    - response_data: Stores response data in JSON format.

  - document table:
    - document_files: Stores files related to the document in JSON format.
  - process_instance table:
    - process_code: Stores a code identifying the process instance.

- Column Type Changes:

  - For the document and process_decision_payload tables, existing columns were changed from text to JSON format:
    - document_summary and document_toc are now stored as JSON.
    - result_data in process_decision_payload is now stored as JSON.



## Documentation

Documentation (found in [docs](./docs)) contains the technical documentation for the NEPA Data Standard.  
For an overview of the data standard, see the Permitting Innovation Center website's [Data Standards](https://permitting.innovation.gov/resources/data-standard/).  

## Supporting scripts

The repository contains scripts (found in [scripts](./scripts)) used primarily to validate the toolkit files, which are generated from a source database.  These scripts may be useful for others creating their own implementation.  Scripts include:

  - JSON schema correctness using AJV
  - YAML/OpenAPI/Database crosswalk validation against [NEPA schema](./src/jsonschema/nepa.schema.json)
  - Example file compliance with schemas
  - Code linting and quality checks


## Development

### Prerequisites

- Node.js 22 or higher

### Getting Started

```bash
# Install dependencies
npm install

# Review package.json for available commands
npm run validate:schemas
npm run validate:examples
npm run validate:csv
```


## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for additional information.

## Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in [CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
