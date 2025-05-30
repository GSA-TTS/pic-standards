# NEPA and Permitting Data and Technology Standard

[![Validation Status](https://github.com/GSA-TTS/pic-standards/actions/workflows/validation.yml/badge.svg)](https://github.com/GSA-TTS/pic-standards/actions/workflows/validation.yml)

## Why this project

This repository includes a toolkit for implementation of the data standards, technical documentation, and scripts that can aid in validating implementations.  For more information, see the Permitting Innovation Center's [website](https://permitting.innovation.gov)

## Toolkit

The toolkit (found in - [/src](./src)) contains working files for the NEPA and Permitting Data and Technology Standard, versioned by tag.  The current version is v1.0.0

- [JSONschema](./src/jsonschema) - The core of the **NEPA Data Standard** is the [nepa.schema.json](./src/jsonschema/nepa.schema.json) file, which defines the structure and validation rules for NEPA-related data.
- [Data Standard Crosswalk](./src/crosswalk) - csv file containing a list of all entities, properties, types (postgres), and descriptions.
- [JSON](./src/json) - json file(s) including sample data organized in the data standard structure
- [YAML](./src/yaml) - yaml file(s) including sample data organized in the data standard structure
- [OpenAPI](./src/openapi) specs - sample yaml and json files that can be used to generate swagger or other documentation (note - there is no API implementation, just documentation)


Sample data is entirely notional to illustrate data structure and does not reflect any actual projects, environmental review or permitting, or other formal position of the US government related to permitting or environmental review. In some cases sample data is synthetically generated. No endorsement is implied in this sample data.

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
