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

const appName = "Pipeline";
console.log("Starting " + appName);

function Pipeline() {
  this.dataTypes = new Map();
}

// METHOD Pipeline.getDataTypeTemplate - Returns a template of a DataType object
// containing the required fields.
Pipeline.prototype.getDataTypeTemplate = function getDataTypeTemplate() {
  return {
    // Name of this compound type. Equals getCompoundType().
    getCompoundType: function (options) {
      console.log("function that returns the name of the compound type");
    },
    // Data table from a TSV or CSV file:
    nameKeyTable: [
      ["array-of-column-headers"],
      ["array-of-data-values-for-row-1"],
    ],
    // Column used to name compounds in the data:
    compoundNamesColumn: "name-of-column-containing-compound-names",
    // Column used to name compounds in the pathway diagrams:
    displayNamesColumn: "name-of-column-containing-display-names",
    // Columns whose values must be unique:
    uniqueColumnNames: ["names-of-columns-containing-unique-values"],
    // Columns that can contain a dash to mean a purposefully omitted value.
    dashAllowedColumnNames: [
      "names-of-columns-that-may-contain-purposefully-omitted-values",
    ],
  };
};

// Checks dataType has the required fields and adds it to the dataTypes known to
// the pipeline.
Pipeline.prototype.addDataType = function addDataType(dataType) {
  if (
    typeof dataType.getCompoundType != "function" ||
    typeof dataType.getCompoundType() != "string"
  ) {
    throw "DataSet.getCompoundType must be a function that returns a string";
  }
  if (
    !Array.isArray(dataType.nameKeyTable) ||
    dataType.nameKeyTable.length == 0 ||
    !Array.isArray(dataType.nameKeyTable[0])
  ) {
    throw `DataSet.nameKeyTable must be a non-empty array of arrays`;
  }
  if (!validColumn(dataType.compoundNamesColumn)) {
    throw `DataSet.compoundNamesColumn must be the name of a column in the nameKeyTable`;
  }
  if (!validColumn(dataType.displayNamesColumn)) {
    throw `DataSet.displayNamesColumn must be the name of a column in the nameKeyTable`;
  }
  if (!validColumnArray(dataType.uniqueColumnNames)) {
    throw `DataSet.uniqueColumnNames must be an array containing the names of columns in the nameKeyTable`;
  }
  if (!validColumnArray(dataType.dashAllowedColumnNames)) {
    throw `DataSet.dashAllowedColumnNames must be an array containing the names of columns in the nameKeyTable`;
  }
  this.dataTypes.set(dataType.getCompoundType(), dataType);

  // Helper function. Check that columnName is valid.
  function validColumn(columnName) {
    return (
      typeof columnName == "string" &&
      dataType.nameKeyTable[0].includes(columnName)
    );
  }
  // Helper function. Check that columnNames is an array of valid columnNames.
  function validColumnArray(columnNames) {
    if (!Array.isArray(columnNames)) {
      return false;
    }
    for (const columnName of columnNames) {
      if (!validColumn(columnName)) {
        return false;
      }
    }
    return true;
  }
};

// Export the singular Pipeline instance as the global $PIPE
// for use by other modules.
window.$PIPE = new Pipeline();
