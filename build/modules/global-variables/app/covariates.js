/*

MIT License

Copyright (c) 2025 The University of Texas MD Anderson Cancer Center

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Module covariates.js
//
// This module inputs a CSV file containing covariate information about each
// sample.  The path to the file is given by process.env.PDATA_PATH.
//
// Each line of the file consists of a sequence of fields separated by commas.  Blank lines
// after the header are ignored.
//
// The first (header) line consists of the reserved symbol ID followed by the names of the covariates.
// Covariate names cannot contain underscores (_) due to constraints in main.js.  If there are
// any underscores in the covariate names, they will be silently converted to spaces.
//
// Following the header line is one line for each sample.  The first field is the name (ID) of the
// sample.  Subsequent fields contain that sample's covariate values for the corresponding
// covariates in the header line.  Underscores in these lines are permitted.
//
// Example PDATA file:
// ID,Group,Time
// 210315_LL_Tissue_HF_WK0_A,A,0week
// 210315_LL_Tissue_HF_WK0_B,B,0week
// 210315_LL_Tissue_HF_WK0_C,C,0week

const debug = false;

// This module receives the covariate data (pDataLines) from the global variable Window.$EXPERIMENT_DATA,
// which will be defined by the data-loader module created by pipeline-processing.R.
const pDataLines = $PIPE.experimentData.sampleCovariateData;
const { sampleMaps, covariateNames } = csvToSampleMaps(pDataLines);

// To allow the user to modify the order of values for a covariate, we maintain
// the ordered values for each covariate in uniqueCovariateValues,
// which is a Map from covariate --> array of values.
// See moveCovariateValue below for changing the order of values for a covariate.
//
const uniqueCovariateValues = new Map(
  ["ID"]
    .concat(covariateNames)
    .map((covariate) => [covariate, calcUniqueCovariateValues(covariate)]),
);

// Return the names of the covariates as an array.
//
// For example: [ 'Group', 'Time' ]
//
function getCovariateNames() {
  if (debug) console.log("getCovariateNames", covariateNames);
  return covariateNames.slice();
}

// Return a covariate --> value map for the specified sample.
//
// For example: Map { 'ID' => 'sample1', 'Group' => 'A', 'Time' => 'week0' }
//
function getSampleInfo(sampleID) {
  if (!sampleMaps.has(sampleID)) {
    console.error("No covariate info for sample", sampleID);
    return new Map([["ID", sampleID]]);
  }
  const sampleInfo = sampleMaps.get(sampleID);
  if (debug) console.log("getSampleInfo", sampleID, sampleInfo);
  return sampleInfo;
}

// Return a sampleID --> value map for the specified covariate.
//
// For example: Map { 'sample1' => 'week0', 'sample2' => 'week3' }
//
function getCovariateMap(covariate) {
  const covariateMap = new Map();
  sampleMaps.forEach((map, sampleID) =>
    covariateMap.set(sampleID, map.get(covariate)),
  );
  if (debug) console.log("getCovariateMap", covariate, covariateMap);
  return covariateMap;
}

// Determine the unique values for the specified covariate and return as an array.
//
// For example: [ 'week0', 'week3', 'week6' ]
//
function calcUniqueCovariateValues(covariate) {
  const uniqueValues = [
    ...new Set(
      [...sampleMaps.values()].map((sampleMap) => sampleMap.get(covariate)),
    ),
  ];
  if (debug) console.log("calcUniqueCovariateValues", covariate, uniqueValues);
  return uniqueValues.sort();
}

// Return the array of unique values for the specified covariate.
//
function getUniqueCovariateValues(covariate) {
  const uniqueValues = uniqueCovariateValues.get(covariate);
  if (debug) console.log("getUniqueCovariateValues", covariate, uniqueValues);
  return uniqueValues;
}

// Move the specified value of the given covariate one place
// either up or down as specified by directon.
//
function moveCovariateValue(direction, covariate, value) {
  if (debug) console.log("moveCovariateValue", { direction, covariate, value });
  const values = uniqueCovariateValues.get(covariate);
  const idx = values.indexOf(value);
  if (idx < 0) {
    console.error("Attempt to move unknown value of covariate", {
      value,
      covariate,
    });
    return;
  }
  if (direction == "up" && idx == 0) {
    console.warn("Attempt to move first value of covariate up", {
      value,
      covariate,
    });
    return;
  }
  if (direction == "down" && idx == values.length - 1) {
    console.warn("Attempt to move last value of covariate down", {
      value,
      covariate,
    });
    return;
  }
  const newIdx = direction == "up" ? idx - 1 : idx + 1;
  values.splice(idx, 1); // Remove from old position
  values.splice(newIdx, 0, value); // Insert into new position
  uniqueCovariateValues.set(covariate, values); // Update map
}

// Return an array of sample identifiers whose value for the specified
// covariate equals the specified value.
//
// Also works for covariate=="ID" and value equal to the sample name.
//
// For example: [ 'sample1', 'sample10', 'sample13' ]
//
function getSamplesForValue(covariate, value) {
  const samples = [...sampleMaps.entries()]
    .filter(([sampleID, sampleMap]) => sampleMap.get(covariate) == value)
    .map(([sampleID, sampleMap]) => sampleID);
  if (debug) console.log("getSamplesForValue", covariate, value, samples);
  return samples;
}

// The input data (read from require('....csv')) consists of an array of lines.
// Each line is an array of fields.
// Blank lines are read as [''] (an array containing a single empty string).
//
// Convert the input data into a map from sample names to maps from field names to field values.
//
// The output is an object with two components:
//
// 1. An array of covariate IDs.
//
//    For example:
//    [ 'Group', 'Time']
//
// 2. A map with one entry for each sample.  (There is no entry for the header.)
//    Each map entry is a map from header fields (either sample ID or a covariate name) to its value
//    for that sample.
//
//    For example:
//    Map {
//      'foo' => Map { 'ID' => 'foo', 'Group' => 'A', 'Time' => 'week0' },
//      'bar' => Map { 'ID' => 'bar', 'Group' => 'B', 'Time' => 'week2' },
//      ...
//    }
//
function csvToSampleMaps(lines) {
  const sampleMaps = new Map();
  const headers = lines[0].map((h) => h.replaceAll("_", " ").trim());
  if (headers[0] != "ID") {
    console.error("PData file: first header field is not ID", headers);
  }

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].map((field) => field.trim());
    const sampleID = currentLine[0];
    if (sampleMaps.has(sampleID)) {
      console.warn(
        "Ignoring duplicate covariate info for sample",
        sampleID,
        currentLine,
      );
    }
    if (currentLine.length > 1 || sampleID != "") {
      const map = new Map();

      for (let j = 0; j < headers.length; j++) {
        map.set(headers[j], currentLine[j]);
      }
      sampleMaps.set(sampleID, map);
    }
  }
  return { covariateNames: headers.slice(1), sampleMaps };
}

// Module exports.
//
module.exports = {
  getCovariateNames,
  getSampleInfo,
  getCovariateMap,
  getUniqueCovariateValues,
  moveCovariateValue,
  getSamplesForValue,
};
