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

const appName = "Data Checker";
console.log("Starting " + appName);

require("./css/global-variables.css");
require("./pipeline.js");

const { datasets, pathways, utils } = $PIPE;
const E = utils.E;

// Can only check one dataset for now.
if (datasets.length != 1) {
  console.error(
    appName + ": got unexpected number of datasets: " + datasets.length,
  );
}

const theCompoundInfo = datasets[0].compoundInfo;
const theDataSet = datasets[0].data;
const compoundName = theCompoundInfo.getCompoundType();
const compoundPluralName = theCompoundInfo.getCompoundType({ plural: true });
const compoundCapsName = theCompoundInfo.getCompoundType({ capitalize: true });
const compoundPluralCapsName = theCompoundInfo.getCompoundType({
  capitalize: true,
  plural: true,
});

let dataErrorDetected = false;

// The HTML for this section is not ready until
// this event is processed.
document.addEventListener("DOMContentLoaded", function () {
  // If the user asked for validation by appending
  // ?validate=true to the report's URL.
  if (utils.getURLParameter("validate")) {
    checkMissingCompounds();
    checkDuplicateCompounds();
    checkUnknownPathways();
    checkUnknownPathwayCompounds();
    checkUnshownCompounds();
  }

  const errorSection = document.getElementById("gv-data-error");
  if (dataErrorDetected) {
    // Error detected so show the error section
    errorSection.style.display = "";
  } else {
    // No errors detected. Remove the error section so it
    // doesn't appear in the table of contents.
    // N.B. display=none is set on the HTML element so
    // that it does not display before we can remove it.
    errorSection.parentElement.removeChild(errorSection);
  }
});

// Check that all compounds in the data have an entry in the compound name key.
//
// If not:
// - Display the missing compound section
// - Add an entry for each missing compound
// - Set dataErrorDetected to true
//
function checkMissingCompounds() {
  const curatedNameMap = theCompoundInfo.getCompoundNameMap(
    "$DataName",
    "$DisplayName",
  );
  const compoundNames = theDataSet.getCompoundNames();

  const allmetabs = compoundNames.map((mm) => curatedNameMap.get(mm));
  const unknownCompounds = document.getElementById("gv-unknownMetaboliteNames");

  let missingCompounds = false;
  let first = true;
  compoundNames
    .filter((metab) => !curatedNameMap.has(metab))
    .sort()
    .forEach((metab) => {
      if (first) {
        first = false;
      } else {
        const comma = document.createTextNode(", ");
        unknownCompounds.appendChild(comma);
      }
      const missing = E("SPAN.missingMetabolite");
      missing.innerText = metab;
      unknownCompounds.appendChild(missing);
      missingCompounds = true;
    });
  if (missingCompounds) {
    const unknownCompoundSummary = document.getElementById(
      "gv-unknownMetaboliteSummary",
    );
    unknownCompoundSummary.innerText = `Data set only has ${allmetabs.filter((a) => a).length} out of ${allmetabs.length} ${compoundPluralName} defined in the ${compoundCapsName} Name Key.`;
    // Make missing compounds section visible.
    const unknownCompoundsDiv = document.getElementById(
      "gv-unknownMetabolitesDiv",
    );
    unknownCompoundsDiv.style.display = "";
    dataErrorDetected = true;
  }
}

// Check the appropriate columns of the compound name key for missing (blank) or duplicate compounds.
//
// If any checked column has errors:
// - Add an error section for that column to the report
// - Add an entry for each missing or duplicate compound to the section
// - Set dataErrorDetected to true
//
function checkDuplicateCompounds() {
  const duplicateCompoundsDiv = document.getElementById(
    "gv-duplicateMetabolitesDiv",
  );
  let duplicateCompounds = false;
  theCompoundInfo
    .getNameKeyColumns()
    .filter((columnName) =>
      theCompoundInfo.dataTypeInfo.uniqueColumnNames.includes(columnName),
    )
    .forEach((columnName) => {
      const columnValues = getColumnValues(columnName);
      const uniqueColumnValues = [...new Set(columnValues)];
      if (
        columnValues.length != uniqueColumnValues.length ||
        uniqueColumnValues.includes("-")
      ) {
        duplicateCompounds = true;
        const duplicatesError = E("DIV.duplicateMetabolites");
        const h3 = E("H3");
        h3.innerText = `Column ${columnName} in The ${compoundCapsName} Name Key has duplicate and/or missing values.`;
        duplicatesError.appendChild(h3);
        const p = E("P");
        p.innerText =
          "The following values appear multiple times in this column:";
        duplicatesError.appendChild(p);
        const list = E("DIV");
        let first = true;
        uniqueColumnValues
          .map((value) => [
            value,
            columnValues.filter((vv) => vv == value).length,
          ])
          .filter(([value, count]) => value == "" || value == "-" || count > 1)
          .forEach(([value, count]) => {
            if (first) {
              first = false;
            } else {
              const comma = document.createTextNode(", ");
              list.appendChild(comma);
            }
            const name = E("SPAN");
            if (value == "") value = "***BLANK***";
            else if (value == "-") value = "***DASH***";
            name.innerText = `${value} (${count})`;
            list.appendChild(name);
          });
        duplicatesError.appendChild(list);
        duplicateCompoundsDiv.appendChild(duplicatesError);
      }
    });
  if (duplicateCompounds) {
    duplicateCompoundsDiv.style.display = "";
    dataErrorDetected = true;
  }

  // Return the values in the specified column.  For columns that permit
  // dashes, remove them from the returned list.
  function getColumnValues(columnName) {
    const columnValues = theCompoundInfo.getColumnValues(columnName);
    if (
      theCompoundInfo.dataTypeInfo.dashAllowedColumnNames.includes(columnName)
    ) {
      return columnValues.filter((val) => val != "-");
    } else {
      return columnValues;
    }
  }
}

// Check that all the Pathways referred to in the Compound Name Key are defined.
//
// If not:
// - Display the unknown pathways section of the report
// - Add an entry for each unknown pathway to that section
// - Set dataErrorDetected to true
//
function checkUnknownPathways() {
  const unknownPathwaysDiv = document.getElementById("gv-unknownPathwaysDiv");
  const unknownPathwayNames = document.getElementById("gv-unknownPathwayNames");
  let unknownPathways = false;
  const pathwayNames = pathways.getPathwayNames();
  const referencedPathwayNames =
    theCompoundInfo.getColumnValues("Primary Pathway");
  new Set(referencedPathwayNames).forEach((pathway) => {
    if (!pathwayNames.includes(pathway)) {
      if (unknownPathways) {
        const comma = document.createTextNode(", ");
        unknownPathwayNames.appendChild(comma);
      } else {
        unknownPathways = true;
      }
      const name = E("SPAN");
      const count = referencedPathwayNames.filter(
        (name) => name == pathway,
      ).length;
      name.innerText = `${pathway} (${count})`;
      unknownPathwayNames.appendChild(name);
    }
  });
  if (unknownPathways) {
    unknownPathwaysDiv.style.display = "";
    dataErrorDetected = true;
  }
}

// Check that the compounds referred to in the pathway diagrams are defined in the Compound Name Key.
//
// If not:
// - Display the undefined compounds section of the report
// - Add an entry for each pathway with undefined compounds
//   - Include the names of each undefined compound in the pathway
// - Set dataErrorDetected to true
//
function checkUnknownPathwayCompounds() {
  const displayNames = theCompoundInfo.getDisplayNames();
  let missingPathwayCompounds = false;
  const unknownPathwayCompoundsDiv = document.getElementById(
    "gv-unknownPathwayMetabolitesDiv",
  );
  pathways
    .getPathwayNames()
    .sort()
    .forEach((pathwayName) => {
      const macros = pathways.getPathwayCompounds(pathwayName, compoundName);
      const nMembers = macros.filter((metab) =>
        displayNames.includes(metab),
      ).length;
      if (nMembers != macros.length) {
        const pathwayError = E("DIV.pathwayMissingMetabolites");
        const h3 = E("H3");
        h3.innerText = `Pathway ${pathwayName} has only ${nMembers} out of ${macros.length} ${compoundPluralName} defined as DisplayNames in the ${compoundCapsName} Name Key.`;
        pathwayError.appendChild(h3);
        const p = E("P");
        p.innerText = `The following ${compoundPluralName} appear in the pathway but are not defined in the ${compoundCapsName} Name Key:`;
        pathwayError.appendChild(p);
        const list = E("DIV");
        let first = true;
        macros
          .filter((metab) => !displayNames.includes(metab))
          .sort()
          .forEach((metab) => {
            if (first) {
              first = false;
            } else {
              const comma = document.createTextNode(", ");
              list.appendChild(comma);
            }
            const name = E("SPAN");
            name.innerText = metab;
            list.appendChild(name);
          });
        pathwayError.appendChild(list);
        unknownPathwayCompoundsDiv.appendChild(pathwayError);
        missingPathwayCompounds = true;
      }
    });
  if (missingPathwayCompounds) {
    unknownPathwayCompoundsDiv.style.display = "";
    dataErrorDetected = true;
  }
}

// Check for any compound display names that are not shown in any pathway diagram.
//
// If not:
// - Display the unshown compounds section of the report
// - Add an entry for each unshown compound
// - Set dataErrorDetected to true
//
function checkUnshownCompounds() {
  // Get set of all compounds shown in at least one pathway.
  const shownCompounds = pathways
    .getPathwayNames()
    .map(
      (pathwayName) =>
        new Set(pathways.getPathwayCompounds(pathwayName, compoundName)),
    )
    .reduce((acc, val) => acc.union(val), new Set());
  // Get array of all compounds not shown in any pathway.
  const unshownCompounds = theCompoundInfo
    .getDisplayNames()
    .filter((compound) => !shownCompounds.has(compound))
    .sort();
  if (unshownCompounds.length > 0) {
    // Display unshown compounds.
    // Determine whuch unshown compounds are also in the data.
    const curatedNameMap = theCompoundInfo.getCompoundNameMap(
      "$DataName",
      "$DisplayName",
    );
    const compoundsInData = new Set(
      theDataSet
        .getCompoundNames()
        .filter((metab) => curatedNameMap.has(metab))
        .map((metab) => curatedNameMap.get(metab)),
    );
    const unshownCompoundsDiv = document.getElementById(
      "gv-unshownMetabolitesDiv",
    );
    const p = E("P");
    p.innerText = `The following ${unshownCompounds.length} ${compoundPluralName} are defined in the ${compoundCapsName} Name Key but are not shown in any pathway`;
    let dataHasUnshown = false;
    let first = true;
    unshownCompounds.forEach((compound) => {
      if (first) {
        first = false;
        p.appendChild(document.createTextNode(": "));
      } else {
        p.appendChild(document.createTextNode(", "));
      }
      const sp = E("SPAN");
      sp.innerText = compound;
      if (compoundsInData.has(compound)) {
        sp.style.fontWeight = 900;
        dataHasUnshown = true;
      }
      p.appendChild(sp);
    });
    p.appendChild(document.createTextNode("."));
    if (dataHasUnshown) {
      p.appendChild(
        document.createTextNode(
          ` (${compoundPluralCapsName} in this dataset are bolded.)`,
        ),
      );
    }
    unshownCompoundsDiv.appendChild(p);
    unshownCompoundsDiv.style.display = "";
    dataErrorDetected = true;
  }
}
