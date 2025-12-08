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

const utils = require("./utils.js");

const covariates = require("./covariates.js");
const compoundNameMap = require("./compoundNameMap.js");
const dataTools = require("./dataTools.js");

// This module receives the raw data from the global variable $PIPE.experimentData, which will be
// defined by the data-loader module created by pipeline-processing.R.
const datasets = $PIPE.experimentData.datasets.map((dset) => {
  const data = new dataTools.DataSet(dset.dataTable);
  const compoundInfo = new compoundNameMap.CompoundNameMap(dset.dataType);
  return { data, compoundInfo };
});

module.exports = {
  jStat,
  utils,
  covariates,
  dataTools,
  datasets: datasets,
};
Object.assign(window.$PIPE, module.exports);
