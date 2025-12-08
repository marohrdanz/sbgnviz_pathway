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

"use strict";

const { utils, pathways } = $PIPE;

const stdTableColumns = []; // The predefined table columns as they appear left-to-right. Populated in populateStandardColumns().

var pathwayDataTable;
var customTableColumns = [];

const dataInterface = {};

// Called after DOMInitialization and when the rest of the page is ready to display a pathway diagram.
//
function initialize(info) {
  Object.assign(dataInterface, info);
  addPathwayTableListeners();
  populateStandardColumns(
    dataInterface.compoundsInData,
    dataInterface.theCompoundInfo,
  );
  showPathwayTable();
}

function getDataInterface() {
  return dataInterface;
}

function showCustomScores(scores) {
  customTableColumns = scores;
  showPathwayTable();
}

// Index of pathway name column in the pathway table.
// Must match table definition in index.html.
const COL_PATHWAY_NAME = 0;

// COMPLETELY remove all traces of any previous pathway table.
function removePathwayTable() {
  if (pathwayDataTable) {
    pathwayDataTable.clear().destroy();
    pathwayDataTable = null;
    const table = document.getElementById("pm-pathwayTable");
    while (table.firstChild) table.removeChild(table.firstChild);
  }
}

function showPathwayTable() {
  removePathwayTable();
  populateTableHeader();
  populateTableBody();
  pathwayDataTable = addDataTableToPathwayTable();

  // Display initial pathway
  setTimeout(function () {
    if (pathwayDataTable) {
      // Show highest priority pathway
      const firstPathwayName = pathwayDataTable.rows().data()[0][
        COL_PATHWAY_NAME
      ];
      showSelectedPathway(firstPathwayName);
    } else {
      showSelectedPathway(pathways.getPathwayNames()[0]);
    }
  }, 100);
}

function addDataTableToPathwayTable() {
  const pathwayTableElement = $("#pm-pathwayTable");

  if (typeof pathwayTableElement.DataTable == "undefined") {
    console.warn("DataTable functionality unavailable");
    const tbody = document.querySelector("#pm-pathwayTable tbody");
    tbody.addEventListener("mousedown", (ev) => {
      console.log("mousedown", ev);
      if (ev.target.tagName == "TD") {
        const pathwayName = ev.target.parentElement.firstChild.innerText;
        showSelectedPathway(pathwayName);
      }
    });
    return null;
  } else {
    const allColumns = [customTableColumns, stdTableColumns].flat();

    const headers = ["Pathway"].concat(allColumns.map((column) => column.name));
    const sortOrder = [
      columnOrder(customTableColumns),
      columnOrder(stdTableColumns),
    ].flat();
    const dataTable = $(pathwayTableElement).DataTable({
      caption: "Pathway Table",
      order: sortOrder.map((name) => [headers.indexOf(name), "desc"]),
      lengthMenu: [5, 10, 25, 50],
    });
    dataTable.on("click", "tbody tr", (ev) => {
      const pathwayName = ev.currentTarget.firstElementChild.innerText;
      showSelectedPathway(pathwayName);
    });
    return dataTable;
  }
}

// Sort the tableColumns by sortOrder and return their names.
function columnOrder(tableColumns) {
  return tableColumns
    .slice()
    .sort((columnA, columnB) => columnA.sortOrder - columnB.sortOrder)
    .map((column) => column.name);
}

// Display the selected pathway.
function showSelectedPathway(pathwayName) {
  if (pathwayDataTable) {
    // Update the selected row in the pathway table.
    // Unselect the currently selected row(s), then select the row for pathwayName.
    pathwayDataTable
      .rows(".selected")
      .nodes()
      .each((row) => row.classList.remove("selected"));
    const selectedRow = pathwayDataTable.row(
      (idx, data) => data[COL_PATHWAY_NAME] == pathwayName,
    );
    selectedRow.node().classList.add("selected");
  } else {
    const rows = [...document.querySelector("#pm-pathwayTable tbody").children];
    rows.forEach((row) => {
      row.style.backgroundColor =
        row.children[COL_PATHWAY_NAME].innerText == pathwayName
          ? "aliceblue"
          : "white";
    });
  }

  // Update the selected pathway name (for when the pathway table is hidden).
  document.getElementById("pm-selectedPathway").innerText = pathwayName;

  // Change the pathway diagram
  dataInterface.changePathwayDiagram(pathwayName);
}

function addPathwayTableListeners() {
  // Event listeners for when the user clicks on the hide/show pathway table buttons.
  const visiblePathwayTable = document.getElementById("pm-visiblePathwayTable");
  const hiddenPathwayTable = document.getElementById("pm-hiddenPathwayTable");
  visiblePathwayTable
    .querySelector("button#pm-hidePathwayTable")
    .addEventListener(
      "click",
      (ev) => {
        visiblePathwayTable.style.display = "none";
        hiddenPathwayTable.style.display = "";
      },
      { passive: true },
    );
  hiddenPathwayTable
    .querySelector("button#pm-showPathwayTable")
    .addEventListener(
      "click",
      (ev) => {
        visiblePathwayTable.style.display = "";
        hiddenPathwayTable.style.display = "none";
      },
      { passive: true },
    );
}

// Populates stdTableColumns.
//
function populateStandardColumns(compoundsInData, compoundInfo) {
  const numCompoundsColumn = {
    name:
      "# " +
      compoundInfo.getCompoundType({
        plural: true,
        capitalize: true,
      }),
    scores: new Map(),
    sortOrder: 3,
  };
  const numMeasuredColumn = {
    name: "# Measured",
    scores: new Map(),
    sortOrder: 2,
  };
  const pctMeasuredColumn = {
    name: "% Measured",
    scores: new Map(),
    sortOrder: 1,
  };

  const compoundType = compoundInfo.getCompoundType();
  pathways.getPathwayNames().forEach((pathwayName) => {
    const compounds = pathways.getPathwayCompounds(pathwayName, compoundType);

    const numCompounds = compounds.length;
    numCompoundsColumn.scores.set(pathwayName, numCompounds);

    const overlap = compounds.filter((mm) => compoundsInData.includes(mm));
    const numMeasured = overlap.length;
    numMeasuredColumn.scores.set(pathwayName, numMeasured);

    pctMeasuredColumn.scores.set(
      pathwayName,
      numCompounds == 0
        ? "0.0"
        : ((100 * numMeasured) / numCompounds).toFixed(2),
    );
  });
  // Order in which the standard columns appear:
  stdTableColumns.push(numCompoundsColumn);
  stdTableColumns.push(numMeasuredColumn);
  stdTableColumns.push(pctMeasuredColumn);
}

function populateTableHeader() {
  const table = document.getElementById("pm-pathwayTable");
  const thead = utils.E("thead");
  const tr = utils.E("tr");

  // Add Pathway column to start.
  const pathwaysCol = utils.E("th");
  pathwaysCol.innerText = "Pathway";
  tr.appendChild(pathwaysCol);

  // Add each score column.
  [customTableColumns, stdTableColumns].flat().forEach((column) => {
    const columnHeader = utils.E("th");
    columnHeader.innerText = column.name;
    tr.appendChild(columnHeader);
  });

  // Finalize table header.
  thead.appendChild(tr);
  table.appendChild(thead);
}

function populateTableBody() {
  // Populate the body of the pathway table.
  // Must be called after populateTableHeader.
  const table = document.getElementById("pm-pathwayTable");
  const tbody = utils.E("tbody");

  // Allow limited standalone testing of pathways (when curatedNameDict is not available)
  pathways.getPathwayNames().forEach((pathwayName) => {
    const brow = utils.E("TR");

    // Pathway column.
    const name = utils.E("TD");
    name.innerText = pathwayName;
    brow.appendChild(name);

    // Other columns.
    [customTableColumns, stdTableColumns].flat().forEach((column) => {
      const cell = utils.E("TD");
      cell.innerText = column.scores.get(pathwayName);
      brow.appendChild(cell);
    });
    tbody.appendChild(brow);
  });

  table.appendChild(tbody);
}

module.exports = {
  initialize,
  getDataInterface,
  showCustomScores,
};
