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

// This script processes the pathway diagrams in the diagramsDir defined
// below.  Only diagrams in newt format (.nwt extension) are processed.
//
// Two output files are produced.  Both are JSON files containing Map
// entries (an array of two-element arrays from Map.entries()).
//
// - diagramsFile contains a Map from pathway names --> XML diagrams
// - metabolitesFile contains a Map from pathway names --> arrays of metabolite names.

// The root of directory tree containing input diagram files:
const diagramsDir = process.env.DIAGRAMS_DIR || "/pathways/diagrams/Diagrams";
const outputDir = process.env.OUTPUT_DIR || "/pathways";

// The output files:
const diagramsFile = outputDir + '/pathway-diagrams.json';
const metabolitesFile = outputDir + '/pathway-metabolites.json';

const { resolve } = require ('path');
const { readdir, readFile, writeFile } = require ('fs/promises');
const { parseXml } = require('@rgrove/parse-xml');

const pathwayDiagrams = new Map();
const pathwayMetabolites = new Map();

console.log(`Processing pathway diagrams from ${diagramsDir}`);
readDirectory (diagramsDir)
.then (diagrams => {;
  // Process only .nwt files.
  diagrams = diagrams.filter (path => /\.nwt$/.test(path));
  // Load all .nwt files into the above Maps
  return Promise.all (diagrams.map ((filePath) => loadDiagramFile (filePath)))
})
.then (() => {
  // Output diagrams to diagramsFile
  return writeFile (diagramsFile, JSON.stringify([...pathwayDiagrams.entries()]));
})
.then (() => {
  // Output metabolites to metabolitesFile
  return writeFile (metabolitesFile, JSON.stringify([...pathwayMetabolites.entries()]));
})
.then (() => {
  console.log ('Processing of pathway diagrams completed');
  process.exit (0);
});

// Return a promise for an array of the full pathnames of all files
// (excluding directories) in the file system tree rooted at path.
//
async function readDirectory (path) {
  const filesInPath = await readdir(path, { withFileTypes: true });

  const files = await Promise.all(filesInPath.map((fileInPath) => {
    const resolvedPath = resolve(path, fileInPath.name);
    return fileInPath.isDirectory() ? readDirectory(resolvedPath) : resolvedPath;
  }));

  return files.flat();
}

// Load the diagram file into the pathwayDiagrams and pathwayMetabolites Maps
// and return a Promise to complete.
//
async function loadDiagramFile (filePath) {
  // Generate pathway name from its file name:
  // - Remove all path components except the file name
  // - Remove the .nwt extension
  // - Change all underscores to spaces
  const name = filePath.replace(/.*\//,"").replace(".nwt","").replaceAll("_"," ");
  return readFile (filePath, 'utf8')
  .then (content => {
    // Parse XML content and extract metabolites
    // We use 'simple chemical' nodes for metabolites
    const doc = parseXml (content);
    const metabolites = getMetaboliteNames(doc);
    // Save pathway contents to Maps
    pathwayDiagrams.set (name, content);
    pathwayMetabolites.set (name, metabolites);
  })
  .catch (err => {
    console.error (name, err);
  });
}

// Return as an array the metabolite names used in the parsed
// pathway diagram.  diagramDoc is the output of parseXml.
//
// For example: [ 'ADP', 'ATP', ...]
//
function getMetaboliteNames (diagramDoc) {
  const glyphs = getNamedXmlElements(diagramDoc, 'glyph');
  const metabolites = glyphs.filter (g => g.attributes && g.attributes.class == 'simple chemical');
  const labelNodes = metabolites.map (m => m.children.filter (c => c.name == "label"));
  const labels = labelNodes.map (l => (l[0].attributes.text.trim()));
  return [... new Set (labels)]; // Return unique metabolite names
}

// Return an array of all (*) XmlElements below node that have element.name == nodeName.
// The document tree is searched recursively until an element with the required name
// is encountered.  The node is included in the result, but its children are not.
// The search continues with the node's remaining siblings.
//
// (*) Nodes with element.name == nodeName nested within another node with
// element.name == nodeName are not returned.
//
function getNamedXmlElements (node, nodeName) {
  const children = node.children.filter (child => child.type == 'element');
  const elements = children.map (child => {
    if (child.name == nodeName) {
      return [child];
    } else {
      return getNamedXmlElements (child, nodeName);
    }
  });
  return elements.flat();
}
