#!/bin/bash
# MIT License
#
# Copyright (c) 2025 The University of Texas MD Anderson Cancer Center
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the 'Software'), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

##
## This script builds the pathway-data index.html file.
## It is run from scripts/pipeline_processing.R.
##
## It:
## - Updates the pathway diagrams and their summary files if needed
## - Sets environment variables based on the script's parameters
## - Runs webpack (via npm run build) to generate the index.html file
##
## The index.html file will be subsequently included in the final
## report when scripts/pipeline_report_template.Rmd (specifically,
## scripts/child_templates/pathway-data-loader.Rmd) is run from
## scripts/generate_report.R.
##

if [ $# -ne 1 ] ; then
  echo Usage: "$0" OUTPUT_DIR
  echo Command was "$*"
  exit 1
fi
export OUTPUT_DIR="$1" # full path to output directory for pathway data section
## Set OUTPUT_DIR as an environment variable since it is required by webpack.
## (see "${MODULES_DIR}/pathway-loader/webpack.config.js").

# Determine the directory containing this script.
SCRIPTS_DIR="$(dirname ${0})"
# Determine the directory containing the module sources.
MODULES_DIR="$(dirname ${SCRIPTS_DIR})/"

# We will create/use a cache of pathway diagrams under
# a subdirectory of the user's home directory.
CACHE_DIR="${HOME}/.pathways/cache"

export PATHWAYS_DIR="${HOME}/.pathways"
export DIAGRAMS_DIR="${CACHE_DIR}/diagrams/Diagrams"

# First time:
if [ ! -d "${CACHE_DIR}" ] ; then
  mkdir -p "${CACHE_DIR}"
  echo force first build > "${CACHE_DIR}"/diagrams-version
fi

# Make a per-process temporary directory and create a JSON
# file to store metadata about the pathway data.
TMPDIR="$(mktemp -d)"
trap '/usr/bin/rm -rf -- "$TMPDIR"' EXIT
export METADATA_PATH="$TMPDIR/metadata.json"
echo '{' > "$METADATA_PATH"

# Define DIAGRAMS_URL if not specified.
if [ "X${DIAGRAMS_URL}" == "X" ] ; then
  DIAGRAMS_URL=https://github.com/MD-Anderson-Bioinformatics/pathway-diagrams.git
fi

# Append to the global variables metadata version info about the pathway diagrams used.
CHECKFILE=/$CACHE_DIR/diagrams-updated # Use modify time to track last check
VERSIONFILE=/$CACHE_DIR/diagrams-version # Checksum to see if diagrams have changed
if [ -d /diagrams-dev/Diagrams ] ; then
    echo Overriding pathway diagrams
    echo '  "diagramsVersion": "manually specified",' >> "$METADATA_PATH"
    DIAGRAMS_DIR=/diagrams-dev/Diagrams node "/${SCRIPTS_DIR}/parse-pathway-diagrams.js"
    find . -type f | git hash-object --stdin-paths > "$TMPDIR"/file-hashes
    git hash-object /tmp/file-hashes > "$TMPDIR"/newversion
else
    # Create checkfile if needed.
    if ! [ -e $CHECKFILE ] ; then
      echo Pulling initial pathway diagrams from git
      git clone --depth 1 ${DIAGRAMS_URL} /$CACHE_DIR/diagrams
      touch $CHECKFILE
      OUTPUT_DIR="${PATHWAYS_DIR}" node "/${SCRIPTS_DIR}/parse-pathway-diagrams.js"
    fi
    # Check if the pathway information needs updating.
    LAST_CHECKED=$(date -r $CHECKFILE +%s)
    NOW=$(date +%s)
    RECHECK_TIME=600 # Ten minutes
    if [ ${LAST_CHECKED} -lt $(expr ${NOW} - ${RECHECK_TIME}) ] ; then
        echo Need to check diagram data is up to date
        echo Trying to pull updated diagrams from git
        (cd /$CACHE_DIR/diagrams && git pull)
        # Update time of last pathway diagram check
        touch $CHECKFILE
        # Parse pathway diagrams to generate /$CACHE_DIR/pathway-{diagrams,metabolites}.json
        OUTPUT_DIR="${PATHWAYS_DIR}" node /${SCRIPTS_DIR}/parse-pathway-diagrams.js
    fi
    # Append current git commit to global variables metadata.
    GITVER="$(cd /$CACHE_DIR/diagrams && git rev-parse HEAD)"
    echo '  "diagramsVersion": "git '"$GITVER"'",' >> "$METADATA_PATH"
    echo '  "diagramsRepository": "'"$DIAGRAMS_URL"'",' >> "$METADATA_PATH"
    echo "$GITVER" > "$TMPDIR"/newversion
fi

# Determine if the pathways loader must be regenerated.
if cmp "$TMPDIR"/newversion "$VERSIONFILE" ; then
  echo Pathways unchanged - no update required
else
  # Append time of pathways update to metadata
  echo '  "updatedAt": "'$(date -u)'"' >> "$METADATA_PATH"

  # Finalize the pathways metadata.
  echo '}' >> "$METADATA_PATH"

  echo Generating pathway data loader
  export DIAGRAMS_PATH="${PATHWAYS_DIR}/pathway-diagrams.json"
  export METABOLITES_PATH="${PATHWAYS_DIR}/pathway-metabolites.json"
  (cd "${MODULES_DIR}/pathway-loader" && npm run build)
  cp "$TMPDIR"/newversion "$VERSIONFILE"
fi
