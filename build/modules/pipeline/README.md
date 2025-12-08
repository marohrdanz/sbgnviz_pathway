
# Generate Pipeline Initialization Section of Pipeline Report

This directory is used to generate a javascript bundle that
creates and initializes the $PIPE variable.

The "pipeline" module also provides
- a function for creating a template dataType object, and
- a function for adding a dataType object to the pipeline's known dataTypes.

## Generating bundle.js and adding to report

Inclusion of this module into the final report occurs in two stages:

1. The Dockerfile sets `OUTPUT_DIR` for the module and runs `npm run build`.  This uses
   webpack to create a minified javascript file that is output to `$OUTPUT_DIR/bundle.js`.
   This is run when the docker image is created.

2. `$OUTPUT_DIR/bundle.js` is incorporated into the final report by `scripts/child_templates/global-variables.Rmd`
   which is invoked from `scripts/pipeline_report_template.Rmd`.
   This is run when each report is generated.
