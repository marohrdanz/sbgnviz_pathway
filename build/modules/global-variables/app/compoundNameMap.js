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

// Module compoundNameMap.js
//
// This module provides methods for mapping between the various names associated with
// each compound.  Important special casees are mapping between names in the daya and
// possibly abbreviated names in the display.
//
class CompoundNameMap {
  constructor(compoundName) {
    this.dataTypeInfo = $PIPE.dataTypes.get(compoundName);

    this.compoundNamesColumn = this.dataTypeInfo.compoundNamesColumn;
    this.displayNamesColumn = this.dataTypeInfo.displayNamesColumn;
    this.columnNames = this.dataTypeInfo.nameKeyTable[0];
    this.displayNameIndex = this.columnNames.indexOf(this.displayNamesColumn);

    const dataType = this.getCompoundType();
    const nameKeyName = `${this.getCompoundType({ capitalize: true })}NameKey`;
    console.log(
      `Loaded ${nameKeyName}. Using "${this.compoundNamesColumn}" for ${dataType} names in the data and ${this.displayNamesColumn} for display names.`,
    );

    if (this.columnNames.indexOf(this.compoundNamesColumn) < 0) {
      console.error(
        `${nameKeyName} does not have a ${this.compoundNamesColumn} column`,
      );
    }
    if (this.displayNameIndex < 0) {
      console.error(
        `${nameKeyName} does not have a ${this.displayNamesColumn} column (used for pathway display)`,
      );
    }
  }

  getCompoundType(opts) {
    return this.dataTypeInfo.getCompoundType(opts);
  }

  getCompoundNameMap(fromColumn, toColumn) {
    if (!fromColumn) {
      const err = "fromColumn not defined";
      console.error(`compoundNameMap.js: ${err}`);
      throw new Error(err);
    }
    if (!toColumn) {
      const err = "toColumn not defined";
      console.error(`compoundNameMap.js: ${err}`);
      throw new Error(err);
    }
    if (toColumn == fromColumn) {
      const err = "fromColumn and toColumn are the same";
      console.error(`compoundNameMap.js: ${err}`, { fromColumn, toColumn });
      throw new Error(err);
    }
    const fromIndex = this.getColumnIndex(fromColumn);
    const toIndex = this.getColumnIndex(toColumn);

    return new Map(
      this.dataTypeInfo.nameKeyTable
        .slice(1)
        .map((row) => [row[fromIndex], row[toIndex]]),
    );
  }

  getColumnIndex(columnName) {
    let actualColumnName = columnName;
    if (columnName == "$DataName") actualColumnName = this.compoundNamesColumn;
    if (columnName == "$DisplayName")
      actualColumnName = this.displayNamesColumn;
    const index = this.columnNames.indexOf(actualColumnName);
    if (index < 0) {
      const err = "Unknown column name";
      console.error(`compoundNameMap.js: ${err}`, {
        columnName,
        actualColumnName,
        columnNames: this.columnNames,
      });
      throw new Error(err);
    }
    return index;
  }

  getNameKeyColumns() {
    return this.columnNames.slice();
  }

  getColumnValues(columnName) {
    const columnIndex = this.getColumnIndex(columnName);
    return this.dataTypeInfo.nameKeyTable
      .slice(1)
      .map((row) => row[columnIndex]);
  }

  getDisplayNames() {
    return this.dataTypeInfo.nameKeyTable
      .slice(1)
      .map((row) => row[this.displayNameIndex]);
  }
}

// Module exports.
//
module.exports = {
  CompoundNameMap,
};
