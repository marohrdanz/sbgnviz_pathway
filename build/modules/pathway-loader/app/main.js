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

// Module pathway-loader.js
//
// This module loads the JSON files for the pathways known
// to the system.

// diagrams is a pathwayName --> XML map.
//
// For example: Map { 'Urea Cycle' => 'XML for urea cycle pathway', ... }
//
const diagrams = new Map(require(process.env.DIAGRAMS_PATH));

// metabolites is a pathwayName --> array of strings map.
//
// For example: Map { 'Urea Cycle' => [ 'ADP', 'ATP', ... ], ... }
//
const metabolites = new Map(require(process.env.METABOLITES_PATH));

// Load JSON file containing meta data about the pathways data.
//
const metaData = require(process.env.METADATA_PATH);

// Return an array of all pathway names.
//
// For example: [ 'Urea Cycle', 'Citric Acid Cycle' ]
//
function getPathwayNames() {
  return [...diagrams.keys()];
}

// Return the XML for the specified pathway diagram.
//
function getPathwayXML(pathwayName) {
  return diagrams.get(pathwayName);
}

// Return an array of the compounds of the given compoundType in the specified pathway.
//
// For example: [ 'ADP', 'ATP' ]
//
// Currently, we only know how to return the metabolites.
//
function getPathwayCompounds(pathwayName, compoundType) {
  if (compoundType == "metabolite") {
    return metabolites.get(pathwayName) || [];
  } else {
    return [];
  }
}

// Module exports via global variable.
//
$PIPE.pathways = {
  metaData,
  getPathwayNames,
  getPathwayXML,
  getPathwayCompounds,
};
