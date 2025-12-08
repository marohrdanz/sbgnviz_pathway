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

// This module inputs the report data and makes it available to the rest of the application.
//
// The module also provides utility functions for normalizing, reordering, and summarizing the
// data.
//
// The data exists in three representations:
//
// 1. As an array of rows.  Each row is an array of column fields.
//    - The first row contains "Sample" in the first field and the Sample IDs in the remaining fields.
//    - The following rows contain the metabolite name in the first field and its values in the remaining fields.
//
// 2. As a Map from Metabolite Names to (Maps from Sample IDs to values).
//
// 3. As a single TSV string.  Rows are terminated by newline ('\n') characters.  Within each row,
//    columns are separated by tab ('\t') characters.
//
// I imagine these three representations were used because:
//
// - Data is input by require in representation 1 and it is convenient for most tabular
//   operations (e.g. row normalization).
//
// - Representation 2 is convenient for accessing by sample id / covariate name.
//
// - Representation 3 is required for passing data to sbgnViz.
//

const { jStat } = require("jstat");
const covariates = require("./covariates.js");
const utils = require("./utils.js");

// A map from normalization method identifiers to details of the
// normalization method.  See normalizationMethods below.
const normMethods = new Map();

class DataSet {
  // Initialize the DataSet with data in representation 1 and/or 2 as described above.
  // Data will be automatically converted from one format to the otder, if needed, on
  // demand and memoized.  If the DataSet is initialized with data in both formats, no
  // consistency checks are made.
  constructor(lines, dict) {
    if (!lines && !dict) {
      throw new Error("new DataSet: neither lines nor dict provided");
    }
    this._lines = lines;
    this._dict = dict;
  }

  // Return the data in representation 1.
  // Convert from representation 2 on demand.
  get lines() {
    if (!this._lines) {
      this._lines = unparseDataDict(this._dict);
    }
    return this._lines;
  }

  // Return the data in representation 2.
  // Convert from representation 1 on demand.
  get dict() {
    if (!this._dict) {
      this._dict = parseToDataDict(this._lines);
    }
    return this._dict;
  }

  // Convenience function:
  // - Returns true iff the dataset contains data for the specified compound.
  has(compoundName) {
    // We *could* try to avoid unnecessary format conversions, but it's very
    // likely that there will be more dictionary type lookups going forward,
    // so just let it convert on demand if needed.
    return this.dict.has(compoundName);
  }

  // Convenience function:
  // - Returns the data values map for the specified compound.
  get(compoundName) {
    return this.dict.get(compoundName);
  }

  // Convenience function:
  // - Returns an array of the compounds in the dataset:
  getCompoundNames() {
    // Do not trigger auto-conversion unnecessarily.
    if (this._dict) {
      return [...this._dict.keys()];
    }
    return this._lines.slice(1).map((line) => line[0]);
  }

  // Convenience function:
  // - Returns an array of the samples in the dataset:
  getSampleNames() {
    return this.lines[0].slice(1);
  }

  // Summarize the data values by the covariate group to which they belong
  // and return a new Dataset containing those summary values.
  summarizeByGroup(covariateName) {
    const uniqueValues = covariates.getUniqueCovariateValues(covariateName);
    const summarizedData = new Map();
    uniqueValues.forEach((uniqVal) => {
      const samples = covariates.getSamplesForValue(covariateName, uniqVal);
      this.getCompoundNames().forEach((compound) => {
        if (!summarizedData.has(compound)) {
          summarizedData.set(compound, new Map());
        }
        const values = [...this.get(compound).entries()]
          .filter(([sampleID, value]) => samples.includes(sampleID))
          .map(([sampleID, value]) => value);
        if (values.length > 0) {
          summarizedData
            .get(compound)
            .set(`${covariateName}_${uniqVal}`, jStat.median(values));
        }
      });
    });
    return new DataSet(null, summarizedData);
  }

  // Returns a new DataSet with the samples reordered to be in the order
  // given in newSampleOrder.
  // newSampleOrder is an array of sample ids.
  //
  reorderSamples(newSampleOrder) {
    // Create an array of indices into the original rows
    const sampleLine = this.lines[0];
    const orders = newSampleOrder.map((sample) => sampleLine.indexOf(sample));
    // Include the index of the metabolite name column (0) at the start.
    orders.unshift(0);
    // Reorder every line.
    const reorderedData = this.lines.map((line) => {
      return orders.map((index) => {
        return line[index];
      });
    });
    return new DataSet(reorderedData);
  }

  // Returns a new DataSet containing only compounds in the specified list.
  subsetCompounds(compounds) {
    const filteredLines = this.lines.slice(1).filter (line => compounds.includes(line[0]));
    return new DataSet (this.lines.slice(0,1).concat(filteredLines));
  }

  // Return a new DataSet with data that has been normalized using the specified method.
  normalize(method) {
    if (!normMethods.has(method)) {
      throw new Error(`DataSet.normalize: unknown method ${method}`);
    }
    return normMethods.get(method)(this);
  }

  // Return the maximum absolute value in the dataSet.
  maxAbsValue() {
    return this.lines.slice(1).reduce((acc, line) => {
      const val = jStat(line.slice(1)).abs().max();
      return val > acc ? val : acc;
    }, 0);
  }

  // Return the median absolute value in the dataSet.
  medianAbsValue() {
    const allValues = this.lines
      .slice(1)
      .map((line) => line.slice(1))
      .flat();
    const val = jStat(allValues).abs().median();
    return val;
  }

  // Return the dataSet scaled by the specified factor.
  // Results are limited to the color range we use with sbgnviz [-100..100].
  // Values outside that range produce undefined colors (I have seen gray).
  scale(factor) {
    const scaledLines = this.lines.map((line, index) => {
      if (index == 0) {
        return line; // Header line.
      } else {
        return line.map((val, idx) => {
          if (idx == 0) {
            return val; // The row label.
          } else {
            val = parseFloat(val) * factor;
            if (val < -100) return -100;
            if (val > 100) return 100;
            return val;
          }
        });
      }
    });
    return new DataSet(scaledLines);
  }
}

// This function converts a data matrix in representation 1 (an array of rows, each being as array of fields)
// to representation 2 (a Map from Compound Names to Sample ID --> value maps).
//
function parseToDataDict(data) {
  const samples = data[0].slice(1);
  const dataDict = new Map();
  data.slice(1).forEach((rowValues) => {
    const compoundName = rowValues[0];
    if (compoundName == "") {
      console.error("Blank compound name", { rowValues }); // This should not happen anymore.
    } else {
      const compoundMap = new Map();
      rowValues.slice(1).forEach((value, index) => {
        compoundMap.set(samples[index], parseFloat(value));
      });
      dataDict.set(compoundName, compoundMap);
    }
  });
  return dataDict;
}

// Convert a dataDict to an array of rows, each being an array of sample values.
function unparseDataDict(dataDict) {
  let first = true;
  let sampleNames = [];
  const rows = [...dataDict.entries()].map(([compound, map]) => {
    if (first) {
      sampleNames = [...map.keys()];
      first = false;
    }
    return [compound].concat(sampleNames.map((id) => map.get(id)));
  });
  if (first) {
    throw new Error("unparseDataDict: dataDict contains no data");
  }
  const firstLine = ["Samples"].concat(sampleNames);
  return [firstLine].concat(rows);
}

// The following function generates a dataSet row normalization function.
// The generated function applies to a DataSet and returns a new DataSet
// whose rows have been normalized by the specified normalizeFn.
//
// The normalizeFn applies to an array of numbers (one row of data) and
// returns an array of the same length.
//
function genRowNormalizer(normalizeFn) {
  return function (dataSet) {
    const normLines = dataSet.lines.map((line, index) => {
      if (index == 0) {
        return line;
      } else {
        const id = line[0];
        const norm = normalizeFn(line.slice(1).map((ele) => parseFloat(ele)));
        return [id].concat(norm);
      }
    });
    return new DataSet(normLines);
  };
}

// A table of the normalization methods we have implemented.
const normalizationMethods = [
  {
    value: "z-score",
    text: "z score",
    tooltip: "(x-mean(x))/sd(x)",
    normalizer: genRowNormalizer(utils.zNormalize),
  },
  {
    value: "median",
    text: "median centered",
    tooltip: "x-median(x)",
    normalizer: genRowNormalizer(utils.medianCenter),
  },
];

normalizationMethods.forEach((method) => {
  normMethods.set(method.value, method.normalizer);
});

function getNormalizationMethods() {
  return normalizationMethods.map((method) => {
    return { value: method.value, text: method.text, tooltip: method.tooltip };
  });
}

module.exports = {
  DataSet,
  getNormalizationMethods,
};
