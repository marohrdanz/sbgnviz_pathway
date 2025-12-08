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

// Manages the custom scoring columns in the pathways table.
//
const { utils, jStat, covariates, pathways, } = $PIPE;

const pathwayTable = require("./pathwayTable.js");

const extraColumns = new Map(); // Maps the names of user-added scorers to a score object.

const UI = {}; // UI elements.

// Maps algorithm names to an algorithm record.
const Algorithms = new Map();

// Add algorithm record for computing the average ANOVA F-score between groups.
// The aim of this algorithm is to find the pathway most affected by the difference
// between groups.  This algorithm does not attempt to rank "up-ness" or "down-ness",
// since some nodes may be up while others are down. But a pathway with many highly
// differentially expressed compounds is "interesting" by this metric.  It uses
// average instead of total F-score to prioritize pathways of a high proportion of
// differentially expressed compounds over big pathways that simply incorporate everything.
Algorithms.set("aveDE", {
  name: "AveDE",
  summary:
    "The average ANOVA F-score between groups across the measured metabolites.",
  calcScore: genAnovaDE("calcAveDE", jStat.mean),
});

// Add algorithm record the computing the maximum ANOVA F-score between groups.
// The aim of this algorithm is to find the singly most differentially expressed compound
// between the groups.
Algorithms.set("maxDE", {
  name: "MaxDE",
  summary:
    "The maximum ANOVA F-score between groups across the measured metabolites.",
  calcScore: genAnovaDE("calcMaxDE", jStat.max),
});

// This function returns a function for computing an ANOVA F-score summary statistic
// for a pathway.
//
// This function takes two parameters:
// - The name of the generated function (for trace/debugging purposes), and
// - A function for summarizing an array of F-scores to a single value.
//
// The returned function takes four parameters:
// - the pathway to evaluate,
// - an array of the compounds in the data,
// - two maps from compound names to data arrays, one for each group of samples.
// The returned function's return value is the given pathway's score.
function genAnovaDE(name, reducer) {
  const debug = false;
  return function calcAveDE(pathway, compounds, gr1Cache, gr2Cache) {
    // Compute the F-scores for each compound present in the pathway.
    const scores = [];
    const compoundsInData = [];
    for (const compound of compounds) {
      const gr1Data = gr1Cache.get(compound);
      const gr2Data = gr2Cache.get(compound);
      if (gr1Data.length > 1 && gr2Data.length > 1) {
        scores.push(jStat([gr1Data, gr2Data]).anovafscore());
        compoundsInData.push(compound);
      }
    }
    if (debug) {
      console.log(name + ":", {
        pathway,
        scores: ArrayZip(scores, compoundsInData),
      });
    }
    // Reduce the scores for the measured compounds to a single number.
    // If no measured compounds in the pathway, returns 0 rather than
    // a potentially non-sensical result.
    return scores.length == 0 ? 0 : reducer(scores);
  };
}

// Converts N arrays into one array, each element of which contains N values.
// The returned array is as long as the longest given array.
function ArrayZip(...arrays) {
  const len = jStat.max(arrays.map((a) => a.length));
  const zip = [];
  for (let ii = 0; ii < len; ii++) {
    zip.push(arrays.map((a) => a[ii]));
  }
  return zip;
}

const state = {
  nameValid: false, // The name UI element has a valid value.
  groupsValid: false, // Both group selectors have valid values.
  selectedColumn: "", // Last scorer selected (or empty string if none).
};

// A list of all possible covariates:
const covariateNames = covariates.getCovariateNames();

// The possible values of the currently selected covariate:
// Updated in initGroupSelectors.
var covariateValues = [];

// Initialize the module when the document is loaded.
document.addEventListener("DOMContentLoaded", function () {
  // The DIV containing the table editor.
  UI.container = document.getElementById("pm-pathwayScoringMethods");

  // The dropdown for selecting the test to edit/remove, or "Add New".
  UI.columnSelect = document.getElementById("pm-test-select");

  // The algorithm selector and its summary description.
  UI.scoreAlgorithm = document.getElementById("pm-score-algorithm");
  UI.algorithmSummary = document.getElementById("pm-algorithm-summary");

  // The covariate to apply the scoring algorithm to.
  UI.scoreCovariate = document.getElementById("pm-score-covSelect");

  // The values of the covariate to include in the two groups to compare.
  UI.grp1Select = document.getElementById("pm-score-grp1Select");
  UI.grp2Select = document.getElementById("pm-score-grp2Select");
  UI.groupError = document.getElementById("pm-group-error");

  // The name for this column, and any issues with that name.
  UI.nameInput = document.getElementById("pm-name-input");
  UI.nameError = document.getElementById("pm-name-error");

  // The buttons in the module.
  UI.applyButton = document.getElementById("pm-apply-button");
  UI.resetButton = document.getElementById("pm-reset-button");
  UI.removeButton = document.getElementById("pm-remove-button");

  // Populate the algorithm selector. Set its initial value to "aveDE".
  setOptions(
    UI.scoreAlgorithm,
    [...Algorithms.entries()].map(([key, alg]) => [key, alg.name]),
    "aveDE",
  );
  // Populate the description of the currently selected algorithm.
  UI.algorithmSummary.innerText = Algorithms.get(
    UI.scoreAlgorithm.value,
  ).summary;

  // Populate the covariate selector.
  setOptions(
    UI.scoreCovariate,
    covariateNames.map((name, index) => [index, name]),
    0,
  );

  // Add listeners for the buttons that hide/show the table editor.
  addTableEditorListeners();

  // Add click and change handlers for the entire table editor.
  // The change handlers will determine the specific element concerned.
  UI.container.addEventListener("change", changeHandler);
  UI.container.addEventListener("click", clickHandler);
});

function addTableEditorListeners() {
  // Event listeners for when the user clicks on the hide/show table editor buttons.
  const pathwayTableEditor = document.getElementById(
    "pm-pathwayScoringMethods",
  );
  const showPathwayTableEditor = document.getElementById(
    "pm-showPathwayScoringMethods",
  );
  const hidePathwayTableEditor = document.getElementById(
    "pm-hidePathwayScoringMethods",
  );
  // User clicks on "Show Table Editor":
  // - Show table editor.
  // - Hide "Show Table Editor" button.
  // - Show "Hide Table Editor" button.
  showPathwayTableEditor.addEventListener("click", (ev) => {
    pathwayTableEditor.style.display = "";
    showPathwayTableEditor.style.display = "none";
    hidePathwayTableEditor.style.display = "";
    showUI();
  });
  // User clicks on "Hide Table Editor":
  // - Hide table editor.
  // - Hide "Hide Table Editor" button.
  // - Show "Show Table Editor" button.
  hidePathwayTableEditor.addEventListener("click", (ev) => {
    pathwayTableEditor.style.display = "none";
    showPathwayTableEditor.style.display = "";
    hidePathwayTableEditor.style.display = "none";
  });
}

// Handles click events anywhere within the pathway table editor.
//
function clickHandler(ev) {
  if (ev.target == UI.resetButton) {
    // When reset button clicked:
    // - disable the reset button until a change is made.
    // - allow the user to select another column.
    UI.resetButton.disabled = true;
    UI.columnSelect.disabled = false;
    showUI();
  } else if (ev.target == UI.applyButton) {
    // Apply the changes to the currently selected column.
    updateColumn();
  } else if (ev.target == UI.removeButton) {
    // Remove the currently selected column.
    const columnid = UI.columnSelect.value;
    extraColumns.delete(columnid);
    state.selectedColumn = "";
    showUI();
    showUserScores();
  }
}

// Checks the value of the column (test) name input, sets state.nameValid
// appropriately. If an invalid name is detected, it displays the reason
// why in the nameError element.
// The column name input is invalid if:
// - it's empty, or
// - it matches any column other than the currently selected one.
function checkNameValid() {
  state.nameValid = true;
  UI.nameError.innerText = "";
  // Blank names are invalid.
  if (UI.nameInput.value == "") {
    state.nameValid = false;
    UI.nameError.innerText = "Name must not be blank";
    return;
  }
  // Names that match any column except the current one.
  extraColumns.forEach((column, key) => {
    if (column.testName == UI.nameInput.value && key != UI.columnSelect.value) {
      state.nameValid = false;
      UI.nameError.innerText = "Name cannot match another column";
    }
  });
}

// Handle change events anywhere within the pathway table editor UI.
function changeHandler(ev) {
  // Actually handle the change.
  handleChangeEvent(ev);
  // Afterwards:
  // - Check that the name is valid.
  // - Check whether the Apply button can be used.
  checkNameValid();
  // The Apply button is disabled if:
  // - no change has been made (i.e. the reset button is disabled),
  // - the column name is invalid, or
  // - the group selection is invalid.
  UI.applyButton.disabled =
    UI.resetButton.disabled || !state.nameValid || !state.groupsValid;

  function handleChangeEvent(ev) {
    if (ev.target == UI.columnSelect) {
      // The user changed the selected column:
      // - Determine the newly selected column.
      // - Redisplay the table editor.
      state.selectedColumn =
        UI.columnSelect.value == "add_new" ? "" : UI.columnSelect.value;
      showUI();
      return;
    }

    if (ev.target == UI.scoreAlgorithm) {
      // The user changed the scoring algorithm:
      // - Change the algorithm summary.
      // - Enable the reset button.
      // - Update the column name.
      UI.algorithmSummary.innerText = Algorithms.get(ev.target.value).summary;
      UI.resetButton.disabled = false;
      setColumnNameFromSelections();
      return;
    }

    if (ev.target == UI.nameInput) {
      // The user changed the column name input:
      // - Enable the reset button.
      // - Disable the column selection dropdown.
      UI.resetButton.disabled = false;
      UI.columnSelect.disabled = true;
      return;
    }

    if (ev.target == UI.scoreCovariate) {
      // The user changed the covariate to score:
      // - Enable the reset button.
      // - Reinitialize the group selectors.
      // - Update the column name.
      UI.resetButton.disabled = false;
      initGroupSelectors();
      setColumnNameFromSelections();
    }

    if (ev.target == UI.grp1Select) {
      // The user changed which covariate values are in group 1:
      // - Enable the reset button.
      // - Disable the column selection dropdown.
      // - Update the overall status of both group selectors.
      UI.resetButton.disabled = false;
      UI.columnSelect.disabled = true;
      updateValueSelectors(ev.target, UI.grp2Select);
      return;
    }
    if (ev.target == UI.grp2Select) {
      // The user changed which covariate values are in group 2:
      // - Enable the reset button.
      // - Disable the column selection dropdown.
      // - Update the overall status of both group selectors.
      UI.resetButton.disabled = false;
      UI.columnSelect.disabled = true;
      updateValueSelectors(ev.target, UI.grp1Select);
      return;
    }
  }
}

// Sets the column name input from the selected algorithm and covariate.
function setColumnNameFromSelections() {
  const algName = Algorithms.get(UI.scoreAlgorithm.value).name;
  const cvName = UI.scoreCovariate.children[UI.scoreCovariate.value].innerText;
  UI.nameInput.value = `${algName}(${cvName})`;
}

// Updates the status of both group selectors.
// - target is the group selector that the user just changed.
// - other is the other one.
function updateValueSelectors(target, other) {
  // Ensure any covariate that is selected in the target group is
  // not selected in the other group.
  for (let ii = 0; ii < covariateValues.length; ii++) {
    if (target.children[ii].selected) other.children[ii].selected = false;
  }
  // Check that at least covariate value is selected in each group.
  let targetValid = false;
  let otherValid = false;
  for (let ii = 0; ii < covariateValues.length; ii++) {
    if (target.children[ii].selected) {
      targetValid = true;
    }
    if (other.children[ii].selected) {
      otherValid = true;
    }
    if (targetValid && otherValid) {
      state.groupsValid = true;
      UI.groupError.innerText = "";
      return;
    }
  }
  // If at least one group has no value selected, display an appropriate
  // error and set groupsValid to false.
  UI.groupError.innerText =
    "At least one covariate must be selected for each group.";
  state.groupsValid = false;
}

// Internally, columns are assigned a unique id (not shown to the user).
// This variable is used to generate the unique id and is increased by one
// for each new column created.
var nextNum = 0;

function updateColumn() {
  // Obtain the column id and its details based on the column select dropdown.
  let columnId = UI.columnSelect.value;
  let columnDetails;
  if (columnId == "add_new") {
    // Create a new column id.
    columnId = "user-defined-test-" + nextNum++;
    columnDetails = {};
  } else {
    columnDetails = extraColumns.get(columnId);
  }
  // Set the column details from the values of the UI elements.
  columnDetails.testName = UI.nameInput.value;
  columnDetails.scoreCovariate = UI.scoreCovariate.value;
  columnDetails.algorithm = UI.scoreAlgorithm.value;
  columnDetails.group1 = [];
  columnDetails.group2 = [];
  for (let ii = 0; ii < UI.grp1Select.children.length; ii++) {
    if (UI.grp1Select.children[ii].selected) {
      columnDetails.group1.push(UI.grp1Select.children[ii].value);
    }
    if (UI.grp2Select.children[ii].selected) {
      columnDetails.group2.push(UI.grp2Select.children[ii].value);
    }
  }
  computeUserTestValues(columnDetails);
  extraColumns.set(columnId, columnDetails);
  state.selectedColumn = columnId;
  showUI();
  showUserScores();
}

function showUserScores() {
  const customScores = [...extraColumns.entries()].map(
    ([id, testInfo], index) => {
      return {
        name: testInfo.testName,
        scores: testInfo.scores,
        sortOrder: index,
      };
    },
  );
  pathwayTable.showCustomScores(customScores);
}

function showUI() {
  // Set the options in the column name dropdown from the extra columns
  // that have been defined. Always append the "add_new" option.
  setOptions(
    UI.columnSelect,
    [...extraColumns.entries()]
      .map(([v, e]) => [v, e.testName])
      .concat([["add_new", "Add New"]]),
    state.selectedColumn || "add_new",
  );

  const newColumnDetails = {
    testName: "",
    scoreCovariate: 0,
    group1: [0],
    group2: [1],
    algorithm: "aveDE",
  };
  const columnDetails =
    state.selectedColumn == ""
      ? newColumnDetails
      : extraColumns.get(state.selectedColumn);

  UI.scoreAlgorithm.value = columnDetails.algorithm;
  UI.scoreCovariate.value = columnDetails.scoreCovariate;
  // Groups 1 and 2 selectors.
  initGroupSelectors(columnDetails.group1, columnDetails.group2);

  // Name input.
  if (columnDetails.testName) {
    UI.nameInput.value = columnDetails.testName;
  } else {
    setColumnNameFromSelections();
  }
  checkNameValid();

  // Cancel, Reset, and Apply Buttons.
  // Disable applyButton if just selected an existing test.
  UI.applyButton.disabled =
    UI.columnSelect.value != "add_new" ||
    !state.nameValid ||
    !state.groupsValid;
  UI.resetButton.disabled = true;
  UI.columnSelect.disabled = false;
  UI.removeButton.disabled = UI.columnSelect.value == "add_new";
}

function initGroupSelectors(group1 = [0], group2 = [1]) {
  const dataInterface = pathwayTable.getDataInterface();
  const theDataSet = dataInterface.theDataSet;
  const samplesInData = theDataSet.getSampleNames();

  const cvName = covariateNames[UI.scoreCovariate.value];
  covariateValues = covariates.getUniqueCovariateValues(cvName)
    .filter (value => {
      for (const sample of covariates.getSamplesForValue(cvName, value)) {
	if (samplesInData.includes(sample)) {
	  return true;
	}
      }
      return false;
  });

  // Group 1 dropdown and label.
  setOptions(
    UI.grp1Select,
    covariateValues.map((name, index) => [index, name]),
  );
  group1.forEach((val) => {
    UI.grp1Select.children[val].selected = true;
  });
  setOptions(
    UI.grp2Select,
    covariateValues.map((name, index) => [index, name]),
  );
  group2.forEach((val) => {
    UI.grp2Select.children[val].selected = true;
  });
  updateValueSelectors(UI.grp1Select, UI.grp2Select);
}

function newLabel(target, text) {
  const label = utils.E("label");
  label.setAttribute("for", target);
  label.innerText = text;
  return label;
}

function newRow(elements) {
  const div = utils.E("div");
  elements.forEach((el) => div.appendChild(el));
  return div;
}

function emptyElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setOptions(selectElement, entries, initialValue) {
  while (selectElement.firstChild) {
    selectElement.removeChild(selectElement.firstChild);
  }
  entries.forEach(([value, text]) => {
    const opt = utils.E("option");
    opt.value = value;
    opt.innerText = text;
    selectElement.appendChild(opt);
  });
  if (initialValue !== undefined) selectElement.value = initialValue;
}

function computeUserTestValues(columnDetails) {
  // Determine the samples in groups 1 and 2.
  const cvName = covariateNames[columnDetails.scoreCovariate];
  const gr1Samples = samplesInGroup(columnDetails.group1);
  const gr2Samples = samplesInGroup(columnDetails.group2);

  const dataInterface = pathwayTable.getDataInterface();
  const compoundType = dataInterface.theCompoundInfo.getCompoundType();
  const theDataSet = dataInterface.theDataSet;

  // Cache data arrays for group1 and group2 samples, since many compounds belong to
  // multiple pathways.
  const gr1Cache = new Map();
  const gr2Cache = new Map();

  columnDetails.scores = new Map();
  pathways.getPathwayNames().forEach((pathway) => {
    // Determine the compounds in the pathway.
    const pathwayCompounds = pathways.getPathwayCompounds(
      pathway,
      compoundType,
    );
    // Get the names used in the data for these compounds.
    const dataCompounds = pathwayCompounds.map((compound) =>
      dataInterface.displayNameToDataName(compound),
    );
    // Ensure the sample data for groups 1 and 2 is loaded for
    // every compound in the pathway.
    dataCompounds.forEach(cacheCompound);
    // Calculate the algorithm score for the pathway.
    const score = Algorithms.get(columnDetails.algorithm).calcScore(
      pathway,
      dataCompounds,
      gr1Cache,
      gr2Cache,
    );
    // Save the calculated score.
    columnDetails.scores.set(pathway, +score.toFixed(3));
  });

  // Return an array of all the sample identifiers
  // that have a covariate value in the specified group.
  function samplesInGroup(group) {
    return group
      .map((gidx) => covariateValues[gidx])
      .map((gname) => covariates.getSamplesForValue(cvName, gname))
      .flat();
  }

  // Ensure the values for the given compound are in caches.
  function cacheCompound(compound) {
    // If it's in one, it's also in the other.
    if (gr1Cache.has(compound)) return;
    if (theDataSet.has(compound)) {
      // The compound was measured:
      // - Get the data values for that compound.
      // - For each group, add the values for the samples in that
      //   group to the appropriate cache.
      const compoundValues = theDataSet.get(compound);
      gr1Cache.set(
        compound,
        gr1Samples.map((sample) => compoundValues.get(sample)),
      );
      gr2Cache.set(
        compound,
        gr2Samples.map((sample) => compoundValues.get(sample)),
      );
    } else {
      // The compound was not measured:
      // - Add empty arrays to avoid looking the compound up again.
      gr1Cache.set(compound, []);
      gr2Cache.set(compound, []);
    }
  }
}

module.exports = {};
