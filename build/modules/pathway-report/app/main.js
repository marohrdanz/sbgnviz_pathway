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

const pathwayTable = require("./pathwayTable.js");
const customScoringMethods = require("./customScoringMethods.js");
const legend = require("./legend.js");

const appName = "Multi-Omic Pathways Data Visualizer";
console.log("Starting " + appName);

require("./css/sbgnviz.css");
if (typeof $ === "undefined") {
  var jQuery = (window.$ = require("jquery"));
}
const sbgnviz = require("sbgnviz");
const filesaver = require("filesaverjs");
const cytoscape = require("cytoscape");
const konva = require("konva");
const tippy = require("tippy.js/dist/tippy.all.min");

const { utils, jStat, covariates, pathways, datasets, dataTools } = $PIPE;

if (datasets.length == 0) {
  console.error(appName + ": no dataset provided");
}

if (datasets.length > 1) {
  console.warn(appName + ": multiple datasets provided. Only using the first");
}
const theCompoundInfo = datasets[0].compoundInfo;
const theCompoundType = theCompoundInfo.getCompoundType();

// Map the display names in the pathway diagrams back to the compound names in the data:
const displayNameMapGbl = theCompoundInfo.getCompoundNameMap(
  "$DisplayName",
  "$DataName",
);
// Map the compound names in the data to the display names in the pathway diagrams:
const compoundNameMapGbl = theCompoundInfo.getCompoundNameMap(
  "$DataName",
  "$DisplayName",
);

const knownCompounds = theCompoundInfo.getColumnValues("$DataName");
const theDataSet = datasets[0].data.subsetCompounds(knownCompounds);

// Map a compound name in the data to the display name used in the pathway diagrams.
// If it's not in the map, try punting that it's the same.
function dataNameToDisplayName(dataName) {
  return compoundNameMapGbl.has(dataName)
    ? compoundNameMapGbl.get(dataName)
    : dataName;
}

// Map a display name used in the pathway diagrams to the compound name used in the data.
// If it's not in the map, try punting that it's the same.
function displayNameToDataName(displayName) {
  return displayNameMapGbl.has(displayName)
    ? displayNameMapGbl.get(displayName)
    : displayName;
}

// Data needed by drawLegend to draw the legend.
var legendData = null; // Data last used to update the graph.
var legendCompound = null; // Compound displayed in the legend.
var legendCovariate = "";

// Get cy extension instances
const cyPanzoom = require("cytoscape-panzoom"); // Needs CSS in index.html
const cyExpandCollapse = require("cytoscape-expand-collapse");
const cyPopper = require("cytoscape-popper");
//version 2.0.1 of cyEdgeEditing
const cyEdgeEditing = require("cytoscape-edge-editing");

// Register cy extensions
cyExpandCollapse(cytoscape, $);
cyPanzoom(cytoscape, $);
cyPopper(cytoscape);
cyEdgeEditing(cytoscape, $, konva);

document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector("div#pm-pathways") == null) {
    // Display version only if viewing outside of report.
    document.getElementById("pm-pathwayVersionNumber").style.display = "";
  }
  createLegendDialog();

  // sbgnviz tooltips are worse than useless.  Disable them.
  // values on sbgnviz are just there for setting the color scheme
  // and are extremely limited. They have no obvious relationship
  // to anything the user of the application cares about.
  // sbgnviz requires that we define tippy.
  tippy.setDefaults({
    onShow: () => false, // abort showing of tooltip.
  });
  let err = false;
  if (!cytoscape.sbgn) {
    console.error ("Incompatible version of cytoscape loaded: no cytoscape.sbgn");
    err = true;
    cytoscape.sbgn = {};
  }
  if (!cytoscape.sbgn.isActive) {
    cytoscape.sbgn.isActive = function isActiveDummy() {
      if (!err) {
	err = true;
	// The very old version of sbgnviz that we use (with modifications)
	// does not implement isActive.  Newer versions of cytoscape use
	// isActive.  This dummy implementation *might* permit operation.
	console.warn ("Incompatible version of cytoscape loaded: no sbgn.isActive: ", { sbgn: cytoscape.sbgn });
      }
    };
  }
  // Register libs needed by sbgnviz.
  sbgnviz.register({
    cytoscape: cytoscape,
    jQuery: jQuery,
    filesaver: filesaver,
    tippy: tippy,
  });
  // Create an sbgnviz instance.
  const s = sbgnviz({
    networkContainerSelector: "#pm-sbgn-network-container",
    imgPath: "node_modules/sbgnviz/src/img",

    // dynamic label size it may be 'small', 'regular', 'large'
    dynamicLabelSize: function () {
      return "large";
    },
    // From https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse
    rearrangeAfterExpandCollapse: function () {
      return false;
    },
    // Whether to animate on drawing changes
    animateOnDrawingChanges: function () {
      return false;
    },
    undoable: false,
  });
  // Create an sbgnviz context.
  const cy = s.getCy();
  // register extensions when cy is ready
  cy.ready(function (data) {
    const panProps = {
      fitPadding: 10,
      fitSelector: ":visible",
      animateOnFit: true,
      animateOnZoom: true,
    };
    cy.panzoom(panProps);
    cy.expandCollapse("");
    cy.edgeEditing();
    // Event handler for mousing over a node.
    cy.on("mouseover", "node", function (event) {
      const node = event.target;
      const displayName = node.data("label");
      if (displayName) {
        const compoundName = displayNameToDataName(displayName);
        if (theDataSet.has(compoundName)) {
          // Only the compound shown in the table changes.
          // No need to check or recompute any datasets.
          changeCompoundTable(compoundName, displayName);
        }
      }
    });
    // Event handler for tapping a node.
    cy.on("tap", "node", (ev) => {
      const data = ev.target.data();
      showGraphNode(data.class, data.label);
    });
  });

  initializeNormalizationMethods();

  const covariateNames = covariates.getCovariateNames();
  utils.appendCovariates("#pm-covariates", ["ID"].concat(covariateNames));

  // Set default data table ordering and grouping.
  if (covariateNames.length == 0) {
    // Order by ID and show replicates.
    $("#pm-covariates").val("ID");
    $("#pm-summarizeSelect").val("replicates");
    $("#pm-summarizeSelect").prop("disabled", true);
  } else {
    // Order by first covariate and show categories.
    $("#pm-covariates").val(covariateNames[0]);
    $("#pm-summarizeSelect").val("categories");
    $("#pm-summarizeSelect").prop("disabled", false);
  }

  const initOptions = {
    ordering: false,
  };
  var sampleValueTable = null;

  // COMPLETELY remove all traces of any previous DataTable.
  function removeCompoundTable() {
    if (sampleValueTable) {
      sampleValueTable.clear().destroy();
      $("#pm-sampleValueTable").empty();
      sampleValueTable = null;
    }
  }

  // Change the compound displayed in the compound table.
  //
  // Use the empty string for compoundName to remove the table.
  //
  function changeCompoundTable(compoundName, displayName) {
    document.getElementById("pm-compoundName").innerText = compoundName;
    document.getElementById("pm-displayName").innerText = compoundName
      ? displayName
      : "";
    updateCompoundTable();
  }

  // These variables determine whether the pathway diagram and the compound table
  // show data summarized by category or individual replicates.
  //
  // They also determine the type of normalization used to color the pathway diagram.
  //
  // They also determine when a derived dataset must be recalculated.  We don't
  // want to recalculate data every time the user mouses over a node and updates
  // the compound data. We also don't want to show outdated data.
  // - A change that potentially invalidates a derived dataset will set it to null.
  //   (For instance, when the covariate drop down changes, it will set both
  //   reorderedData and summarizedData to null since it potentially invalidates both.
  // - A null dataset will be regenerated when needed.
  var showCategories = false;
  var normalizationMethod = ""; // The method used to normalize the data.
  var normalizedData = null; // Data normalized for display.

  // Data for individual replicates, ordered by either ID or a covariate.
  var reorderedData = null; // Normalized data that's been reordered.
  var reorderedOrigData = null; // Original data that's been reordered.
  var sampleOrder = []; // The order used.

  // Data summarized by a covariate.
  var summarizedData = null; // Normalized data that's been summarized.
  var summarizedOrigData = null; // Original data that's been summarized.
  var summarizedBy = ""; // The group order in which they were summarized.

  // This function updates the compound summary table in the pathways section.
  //
  // Call changeCompoundTable above to change the compound shown in the table.
  //
  // Call this function for all other updates to the compound table. For instance,
  // whether to show replicates or categories, sample order, etc.
  //
  // Before calling this function, always call drawSelectedOverlay() to determine
  // which derived datasets, if any, need to be recomputed, unless you're sure
  // that they are all still valid.
  function updateCompoundTable() {
    const compoundName = document.getElementById("pm-compoundName").innerText;
    if (!compoundName) {
      removeCompoundTable();
      return;
    }

    // drawSelectedOverlay determined the covariate to sort/group by and whether to group the data.
    // The dataSet to use is determined by showCategories.
    //
    // This can be one of:
    // - data summarized by group
    // - individual samples in their original order
    // - individual samplues ordered by group
    let dataSet;
    if (showCategories) {
      if (!summarizedOrigData)
        summarizedOrigData = theDataSet.summarizeByGroup(summarizedBy);
      dataSet = summarizedOrigData;
    } else {
      if (!reorderedOrigData)
        reorderedOrigData = theDataSet.reorderSamples(sampleOrder);
      dataSet = reorderedOrigData;
    }

    const compoundValues = dataSet.get(compoundName);
    if (!compoundValues) {
      throw new Error(
        `updateCompoundTable: ${compoundName} is not in the dataSet`,
        { compoundName, dataSet },
      );
    }

    // Set the new table's header row and create a matching array of data rows.
    let dataRows = [];
    if (showCategories) {
      // Add class no-export to the reorder column so we can exclude it from export below.
      initOptions.columns = [
        { title: "Reorder", className: "no-export" },
        { title: summarizedBy },
        { title: "Median value" },
      ];
      for (let [groupName, value] of compoundValues) {
        dataRows.push(["", groupName, parseFloat(value).toString()]);
      }
    } else {
      // Set table columns
      initOptions.columns = [{ title: "ID" }].concat(
        covariateNames.map((covariate) => ({ title: covariate })),
      );
      initOptions.columns.push({ title: compoundName + " value" });
      // Add a data row for each sample.
      const orderedSamples = compoundValues.keys();
      for (let sampleID of orderedSamples) {
        const sampleInfo = covariates.getSampleInfo(sampleID);
        const rowData = [sampleID].concat(
          covariateNames.map((covariate) => sampleInfo.get(covariate)),
        );
        const sampleValue = parseFloat(compoundValues.get(sampleID)).toString();
        rowData.push(sampleValue);
        dataRows.push(rowData);
      }
    }

    // Draw the completed table
    if ($("#pm-sampleValueTable").DataTable) {
      removeCompoundTable();
      // Add buttons for exporting data in a variety of formats.
      // Do not include columns marked with class no-export.
      // We have to add the exportOptions to each button.
      initOptions.dom = "Bfrtip";
      const exportOptions = { columns: ":not(.no-export)" };
      initOptions.buttons = ["copy", "csv", "excel", "print"].map((btn) => ({
        extend: btn,
        exportOptions,
      }));

      // Initialize the table.
      if (showCategories) {
        initOptions.columnDefs = [
          {
            width: "15%",
            target: 0,
            render: function (data, type, row, meta) {
              if (type != "display") return data;
              const upDisabled = meta.row == 0 ? " disabled" : "";
              const upButton =
                '<button class="pm-moveCovariateValue" data-direction="up"' +
                upDisabled +
                "></button>";
              const uidx = row[1].indexOf("_"); // Covariate values in table are groupname_covariate value
              const covariate = row[1].slice(0, uidx);
              const numUniqueValues =
                covariates.getUniqueCovariateValues(covariate).length;
              const downDisabled =
                meta.row == numUniqueValues - 1 ? " disabled" : "";
              const downButton =
                '<button class="pm-moveCovariateValue" data-direction="down"' +
                downDisabled +
                "></button>";
              return upButton + downButton;
            },
          },
          { width: "45%", target: [1, 2] },
        ];
      } else {
        initOptions.columnDefs = [
          { width: 100 / initOptions.columns.length + "%", target: "_all" },
        ];
      }
      sampleValueTable = $("#pm-sampleValueTable").DataTable(initOptions);
      sampleValueTable.rows.add(dataRows);
      sampleValueTable.draw();
    } else {
      console.warn("DataTable not available for sampleValueTable");
      utils.generateTable("#pm-sampleValueTable", initOptions, dataRows);
    }
  }

  $("#pm-nodeDataTable").click((ev) => {
    if (ev.target.classList.contains("pm-moveCovariateValue")) {
      const direction = ev.target.dataset.direction;
      const what = ev.target.parentElement.nextElementSibling.innerText; // Assumes Buttons column immediately followed by covariate column
      const uidx = what.indexOf("_"); // Covariate values in table are groupname_covariate value
      if (uidx < 0) {
        console.warn(
          "pm-moveCovariateValue: covariate value does not contain an underscore:",
          what,
        );
      } else {
        const covariate = what.slice(0, uidx);
        const value = what.slice(uidx + 1);
        covariates.moveCovariateValue(direction, covariate, value);
        summarizedBy = ""; // Force recalculation of summary data.
        sampleOrder = []; // Force reordering.
        drawSelectedOverlay();
        updateCompoundTable();
      }
    }
  });

  function displayLegend() {
    if (!legendData || !legendCompound) {
      return;
    }
    const loColor = document.getElementById("pm-loColor").value;
    const hiColor = document.getElementById("pm-hiColor").value;
    let covariateMap = null;
    if (legendCovariate && legendCovariate != "ID") {
      covariateMap = covariates.getCovariateMap(legendCovariate);
    }
    legend.drawLegend(
      legendData,
      legendCompound,
      loColor,
      hiColor,
      covariateMap,
    );
  }

  $("#pm-save-as-svg").click(function (evt) {
    s.saveAsSvg("pm-network.svg");
  });

  // This function overlays the experiment data onto the pathway diagram
  // according to the selected summarization, ordering, and normalization controls.
  //
  function drawSelectedOverlay() {
    // Verify the data has been normalized as specified.
    checkDataNormalization();
    // Determine the covariate to use for sorting or grouping.
    const selectedCovariate = $("#pm-covariates").val();
    // Determine whether to show replicates or categories.
    if (
      $("#pm-summarizeSelect").prop("disabled") ||
      $("#pm-summarizeSelect").val() == "replicates"
    ) {
      // Draw replicates.
      showCategories = false;
      legendCovariate = selectedCovariate;
      drawBySamples(selectedCovariate);
    } else if (selectedCovariate != "ID") {
      // Draw category summaries.
      showCategories = true;
      legendCovariate = null;
      drawByGroupMedian(selectedCovariate);
    }
    displayLegend();
    return;

    // **** Helper functions. ****

    // Overlay the data for individual replicates.
    function drawBySamples(selectedCovariate) {
      // Determine the sample order based on the selected covariate (or ID).
      const uniqueValues =
        covariates.getUniqueCovariateValues(selectedCovariate);
      let newSampleOrder = [];
      uniqueValues.forEach((uniqVal) => {
        let samples = covariates.getSamplesForValue(
          selectedCovariate,
          uniqVal,
        );
	// Include only samples in the dataset.
	samples = samples.filter(sample => theDataSet.lines[0].includes(sample));
        newSampleOrder = newSampleOrder.concat(samples);
      });
      // If order changed, we need to regenerate reordered data.
      if (!equalOrders(sampleOrder, newSampleOrder)) {
        sampleOrder = newSampleOrder;
        reorderedData = null;
        reorderedOrigData = null;
      }

      // Display ordered normalized samples.
      s.hideAll();
      if (!reorderedData)
        reorderedData = normalizedData.reorderSamples(sampleOrder);
      const hash = utils.sha256(
        "bySamples" + normalizationMethod + sampleOrder.join(","),
      );
      drawDiagramData(reorderedData, hash);
    }

    // Overlay the data summarized by group.
    function drawByGroupMedian(selectedCovariate) {
      // Ensure the normalized data is grouped by the selected covariate.
      if (summarizedBy != selectedCovariate) {
        summarizedBy = selectedCovariate;
        summarizedData = null;
        summarizedOrigData = null;
      }

      // Display summarized groups.
      s.hideAll();
      if (!summarizedData)
        summarizedData = normalizedData.summarizeByGroup(summarizedBy);
      const order = summarizedData.lines[0].slice(1);
      const hash = utils.sha256(
        "byGroup" + normalizationMethod + summarizedBy + order.join(","),
      );
      drawDiagramData(summarizedData, hash);
    }

    // Overlay the dataSet onto the pathway diagram.
    //
    // - Converts the dataset into the format accepted by sbgnviz.
    // - Scales the normalized data to the display range of [-100,100].
    // - Ensures data does not use scientific notation.
    // - Removes any lines with unacceptable values (NaNs).
    // - Prepends a color scheme line.
    //
    // About hashes:
    // sbgnviz takes a "filename" parameter. It appears to cache prior data
    // uploads in some way and *not* display the latest data if the "filename"
    // matches some previous value.
    //
    // Since all our data comes from the same "file" but manipulated in various
    // ways, we have to drived a unique name for each upload.  Previously, we
    // used some string manually derived from the various display options.
    // Now we have too many options, so we generate a sha256 hash of the relevant
    // configuration parameters instead.
    function drawDiagramData(dataSet, hash) {
      const scale =
        normalizationMethod == "z-score"
          ? 100 / 3.0
          : 33.3 / normalizedData.medianAbsValue();
      const lines = dataSet.scale(scale).lines;
      if (lines.length < 2) {
        console.error("drawDiagramData: no data", { lines, fileName });
        return;
      }
      const headerLine = lines[0].join("\t");
      // Remove any dataLines containing NaNs.
      const filteredDataLines = lines
        .slice(1)
        .filter((s) => !/NaN/.test(s.join(" ")));
      // sbgnViz cannot cope with values in scientific notation.
      // So, we convert all values to fixed format.
      // We will also map the name in the data to its display name.
      const fixedDataLines = filteredDataLines.map((line) => {
        const displayName = dataNameToDisplayName(line[0]);
        const fixedValues = line
          .slice(1)
          .map((value) => parseFloat(value).toFixed(10));
        const fixedLine = [displayName].concat(fixedValues).join("\t");
        return fixedLine;
      });
      // Output warning to console if any lines removed. Not expected to happen.
      const numRemoved = lines.length - 1 - filteredDataLines.length;
      if (numRemoved > 0) {
        const badLines = lines.slice(1).filter((s) => /NaN/.test(s.join(" ")));
        console.warn(
          `drawDiagramData: removed ${numRemoved} lines with bad data`,
          badLines,
        );
      }
      // Convert data to a string.
      const filteredData = [headerLine].concat(fixedDataLines).join("\n");

      // Generate a color scheme line to prepend to the data.
      const loColor = document.getElementById("pm-loColor").value;
      const hiColor = document.getElementById("pm-hiColor").value;

      // Note: breakpoints in metaLine (-100,0,100) *must* be integers.
      // We use this fixed range here and scale the data to that range.
      const metaLine = `color\t-100\t${loColor}\t0\t#ffffff\t100\t${hiColor}\n`;

      // Send the data to the pathway visualization.
      // - hash is used as a unique 'filename' for the various normalization, sorting, and grouping
      //   transformations applied to the data.
      s.parseData(metaLine + filteredData, hash, () => {
        console.error("drawDiagramData:parseData failed", {
          headerLine,
          filteredDataLines,
          hash,
        });
      });

      // Record data for generating a legend if needed.
      legendData = filteredData;
    }

    // Return true iff two vectors a and b are identical.
    function equalOrders(a, b) {
      if (a.length != b.length) return false;
      for (let ii = 0; ii < a.length; ii++) {
        if (a[ii] !== b[ii]) return false;
      }
      return true;
    }

    // Normalize the data if needed:
    function checkDataNormalization() {
      if (!normalizedData) {
        // Normalize the data using the currently selected method.
        normalizationMethod = document.getElementById(
          "pm-normalization_methods",
        ).value;
        normalizedData = theDataSet.normalize(normalizationMethod);
        // These depend on the normalized data and will need to be regenerated if needed.
        reorderedData = null;
        summarizedData = null;
      }
    }
  }

  $("#pm-summarizeSelect").change(() => {
    // Whether to show categories or individual replicates changed.
    drawSelectedOverlay();
    updateCompoundTable();
  });

  $("#pm-loColor").change(() => {
    drawSelectedOverlay();
  });

  $("#pm-hiColor").change(() => {
    drawSelectedOverlay();
  });

  $("#pm-covariates").change(function (ev) {
    // The orderBy/summarizeBy covariate changed.
    // Disable summarizeSelect iff selectedCovariate is ID.
    $("#pm-summarizeSelect").prop("disabled", ev.target.value == "ID");
    summarizedBy = ""; // Force recalculation of summarized data.
    sampleOrder = []; // Force reordering of data.
    drawSelectedOverlay();
    updateCompoundTable();
  });

  $("#pm-normalization_methods").change(function () {
    // The display normalization method changed.
    normalizedData = null;
    drawSelectedOverlay();
    updateCompoundTable();
  });

  function changePathwayDiagram(pathwayName) {
    s.removeAll();
    s.loadXMLPathway(
      pathwayName,
      pathways.getPathwayXML(pathwayName),
      function () {
        return drawSelectedOverlay();
      },
    );
  }

  function createLegendDialog() {
    $("#pm-legendDialog").dialog({
      autoOpen: false,
      width: 600,
      show: {
        effect: "blind",
        duration: 1000,
      },
      hide: {
        effect: "explode",
        duration: 1000,
      },
      open: function () {},
      close: function () {
        legendCompound = null; // Don't update closed legend
      },
      buttons: {
        Close: function () {
          $(this).dialog("close");
        },
      },
    });
  }

  function showGraphNode(nodeClass, nodeLabel) {
    // The nodeLabel is a displayName.
    // Try to map it back to the compound name in the data.
    // If we can't, take a punt that it is the same as the displayName.
    const compoundName = displayNameToDataName(nodeLabel);
    if (theDataSet.has(compoundName)) {
      $("#pm-legendDialog").dialog({
        title: `Node detail: ${nodeLabel} (${compoundName})`,
      });
      legendCompound = nodeLabel;
      $("#pm-legendDialog").dialog("open");
      // Draw legend after the dialog is open, so that text size calculations work.
      displayLegend();
    }
  }

  // Initialize the normalization method drop down.
  // - Add an option for each normalization method provided by dataTools.
  // - Set the initial value to the first method listed.
  // - Concatenate the method tooltips for the selector tool tip text.
  //
  function initializeNormalizationMethods() {
    // Get available normalization methods from dataTools.
    const methods = dataTools.getNormalizationMethods();

    // Create an option element for each method and set the initial
    // value to the first one.
    const methodSelector = document.getElementById("pm-normalization_methods");
    methods.forEach((method) => {
      const option = utils.E("option");
      option.value = method.value;
      option.innerText = method.text;
      methodSelector.appendChild(option);
    });
    methodSelector.value = methods[0].value;

    // Set the tooltip value by concatenating the individual method tooltips.
    const tooltip = document.getElementById("pm-normalization-tool-tip");
    tooltip.setAttribute(
      "title-new",
      methods.map((method) => method.text + ": " + method.tooltip).join("; "),
    );
  }

  const compoundsInData = theDataSet
    .getCompoundNames()
    .map(dataNameToDisplayName);
  pathwayTable.initialize({
    theDataSet,
    theCompoundInfo,
    compoundsInData,
    changePathwayDiagram,
    displayNameToDataName,
  });
});
