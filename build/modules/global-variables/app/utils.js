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

const { jStat } = require("jstat");
const sha256 = require("sha256");

// Convert a string containing tab-separated data
// to an array of lines, each being an array of
// fields. No attempt is made to equalize the
// number of fields per line.
// There is no ability to protect or quote the
// newlines separating lines or the tabs separating
// fields.
function stringToArray(dataString) {
  const rows = dataString.split("\n");
  return rows.map((row) => row.split("\t"));
}

// spec is a string consisting of an HTML tag name,
// optionally followed by "#" and a node identifier,
// optionally followed by multiple "."s and class identifiers.
// For instance: "div#buttonbar.fancy.vertical".
function E(spec) {
  const classNames = spec.split(".");
  const tagId = classNames[0].split("#");
  const element = document.createElement(tagId[0]);
  if (tagId.length > 1) element.id = tagId[1];
  classNames.slice(1).forEach((name) => {
    element.classList.add(name);
  });
  return element;
}

// Converts an array of numeric values into an array
// of their z-normalized values.
function zNormalize(values) {
  const std = jStat.stdev(values, true);
  const mean = jStat.mean(values);
  const normValues = values.map(
    (value) => (value - mean) / (std == 0 ? 1 : std),
  );
  return normValues;
}

// Converts an array of numeric values into an array
// of their median centered values.
function medianCenter(values) {
  const median = jStat.median(values);
  return values.map((value) => value - median);
}

// Populates a select element in the DOM by appending option elements
// for each of the given covariates to the select element's children.
// - selectSelector is a query selector for the select node. e.g. "#covariates".
// - values in an array of the option values to add.
// - texts are the strings to display in the option elements. If not
//   specified, the values are used here as well.
function appendCovariates(selectSelector, values, texts) {
  if (!texts) texts = values;
  const selectElement = document.querySelector(selectSelector);
  for (let ii = 0; ii < values.length; ii++) {
    const opt = E("option");
    opt.value = values[ii];
    opt.innerText = texts[ii];
    selectElement.appendChild(opt);
  }
}

// Create a class for converting (via the map method) a numeric
// value between -100 and +100 into a that ranges from loColor
// at -100, through midColor at 0, to hiColor at 100.
class ColorMapper {
  constructor(loColor, midColor, hiColor) {
    const white = hexToRgb("#ffffff");
    this.loRGB = hexToRgb(loColor) || white;
    this.midRGB = hexToRgb(midColor) || white;
    this.hiRGB = hexToRgb(hiColor) || white;
  }

  map(value) {
    if (value < 0) {
      return blendColors(-value / 100, this.loRGB, this.midRGB);
    } else {
      return blendColors(value / 100, this.hiRGB, this.midRGB);
    }
  }
}

// Blend two colors in the RGB colorspace.
// c1 and c2 are two RGB colors.
// f is the proportion of c1 to include.
// if f >= 1, return c1.
// if f <= 0, return c2.
// Otherise return a blend.
function blendColors(f, c1, c2) {
  const numericalLimit = 1e-14;
  if (f < 0 || f > 1) {
    // Only issue error notice if it is not due to limited precision
    if (f < -numericalLimit || f > 1 + numericalLimit) {
      console.error("blendColors: f outside range [0..1]:", f);
    }
    f = f < 0 ? 0 : 1;
  }
  return rgbToHex(
    f * c1.r + (1 - f) * c2.r,
    f * c1.g + (1 - f) * c2.g,
    f * c1.b + (1 - f) * c2.b,
  );
}

// Convert a number between 0 and 255 into a two digit hex code.
function componentToHex(c) {
  const hex = (+c.toFixed(0)).toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

// Convert three numbers between 0 and 255 into a seven character
// color code string. e.g. "#00ff00".
function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// Convert a seven character color code string into a struct containing
// three elements: r, g, and b, each being a number in the range 0 to 255.
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Very simple alternative to DataTable if the latter is unavailable.
// tableSelector is a selector string that identifies the table to populate.
// initOptions is similar to the options structure passed to DataTable:
// - The only field used is columns, which must be an array of structures.
// - The only field used is title, which is used to set the column header.
// i.e.: columns: [ { title: "My Title" }, ... ]
// dataRows is an array of row data.  Each element is an array of data for the
// cells in the row.
//
// Any previous content of the table is destroyed.
//
function generateTable(tableSelector, initOptions, dataRows) {
  const table = document.querySelector(tableSelector);
  if (!table || table.tagName != "TABLE") {
    console.error(
      "utils.generateTable: tableSelector did not find a table:",
      table,
    );
    return;
  }
  while (table.firstChild) table.removeChild(table.firstChild);
  const head = document.createElement("THEAD");
  let row = document.createElement("TR");
  initOptions.columns.forEach((column) => {
    const cell = document.createElement("TH");
    cell.innerText = column.title;
    row.appendChild(cell);
  });
  head.appendChild(row);
  const body = document.createElement("TBODY");
  dataRows.forEach((rowData) => {
    row = document.createElement("TR");
    rowData.forEach((colData) => {
      const cell = document.createElement("TD");
      cell.innerText = colData;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.appendChild(head);
  table.appendChild(body);
}

// Returns the value of the URL parameter called name.
// Returns an empty string if no parameter with that name.
function getURLParameter(name) {
  return (
    decodeURIComponent(
      (new RegExp("[?|&]" + name + "=" + "([^&;]+?)(&|#|;|$)").exec(
        location.search,
      ) || [, ""])[1].replace(/\+/g, "%20"),
    ) || ""
  );
}

module.exports = {
  ColorMapper: ColorMapper,
  appendCovariates: appendCovariates,
  stringToArray: stringToArray,
  zNormalize: zNormalize,
  medianCenter: medianCenter,
  generateTable: generateTable,
  E: E,
  sha256,
  getURLParameter: getURLParameter,
};
