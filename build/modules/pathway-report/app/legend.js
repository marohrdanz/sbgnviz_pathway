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

const { jStat, utils } = $PIPE;
const d3 = require("d3");

function drawLegend(legendData, legendCompound, loColor, hiColor, groupMap) {
  document.getElementById("pm-figureLegend").innerHTML = "";
  const legendDataLines = legendData.split("\n");
  const header = legendDataLines[0];
  const headerLine = header.split("\t");
  const numSamples = headerLine.length - 1;

  // Limits on font size.
  const minFontSize = 10;
  const maxFontSize = 14;

  const recHeight = 30; // Height of node graphic.
  const initialRecWidth = 200; // Initial width of node graphic (may be increased below to fit content better).

  let cellWidth = Math.ceil(initialRecWidth / numSamples); // Width of one cell
  let recWidth = cellWidth * numSamples; // Width of node graphic
  let fontSize = Math.floor(cellWidth * 0.8); // Font size for cell labels

  // Tweak font size and/or width of node graphic to keep within limits.
  if (fontSize > maxFontSize) {
    fontSize = maxFontSize; // that was easy
  } else if (fontSize < minFontSize) {
    fontSize = minFontSize;
    // Expand width of node graphic.
    cellWidth = Math.ceil(minFontSize / 0.8);
    recWidth = Math.min(cellWidth * numSamples, 2000);
  }

  const textOffset = (cellWidth - fontSize) / 2; // More or less center text

  // Initialize SVG with a dummy height to determine max label length
  const evalHeight = 500; // Dummy height for evaluating label heights.
  const sampleSVG = d3
    .select("#pm-figureLegend")
    .append("svg")
    .attr("width", recWidth)
    .attr("height", evalHeight);

  // Insert labels into the bottom of the SVG.  Once the maximum length is
  // determined we will move them back to their correct positions.
  const labels = [];
  for (let i = 0; i < numSamples; i++) {
    const textX = i * cellWidth + textOffset;
    labels.push(
      sampleSVG
        .append("text")
        .attr("alignment-baseline", "hanging")
        .attr("transform", `translate(${textX},${evalHeight}) rotate(270)`)
        .attr("style", `font-size: ${fontSize}px;`)
        .text(headerLine[i + 1]),
    );
  }

  // Compute the maximum length of a label and thus the desired text position,
  // graphic position, and total legend height.
  const textLengths = labels.map((l) => l.nodes()[0].getComputedTextLength());
  const textY = jStat.max(textLengths); // Bottom of labels.
  const gapHeight = 10; // Space between labels and the graphic node.
  const recY = textY + gapHeight; // Y position of the graphic node.

  // Set final height of legendSVG and move labels to the correct Y position.
  sampleSVG.attr("height", recY + recHeight + 2 + (groupMap ? gapHeight : 0));
  labels.forEach(function (lbl, i) {
    const textX = i * cellWidth + textOffset;
    lbl.attr("transform", `translate(${textX},${textY}) rotate(270)`);
  });

  sampleSVG
    .append("clipPath")
    .attr("id", "clipRect")
    .append("rect")
    .attr("x", 0)
    .attr("y", recY)
    .attr("width", recWidth)
    .attr("height", recHeight)
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("fill-opacity", 0.0)
    .attr("rx", 20);

  const compoundData = legendDataLines.slice(1).filter((line) => {
    const fields = line.split("\t");
    return fields[0] == legendCompound;
  });

  if (compoundData.length > 0) {
    const values = compoundData[0]
      .split("\t")
      .slice(1)
      .map((v) => parseFloat(v));
    const colorMap = new utils.ColorMapper(loColor, "#ffffff", hiColor);
    for (let i = 0; i < numSamples; i++) {
      sampleSVG
        .append("rect")
        .style("fill", colorMap.map(values[i]))
        .attr("x", i * cellWidth)
        .attr("y", recY)
        .attr("width", cellWidth)
        .attr("height", recHeight)
        .attr("clip-path", 'url("#clipRect")');
    }
  }
  for (let i = 1; i < numSamples; i++) {
    sampleSVG
      .append("line")
      .style("stroke", "black")
      .attr("x1", i * cellWidth)
      .attr("y1", recY)
      .attr("x2", i * cellWidth)
      .attr("y2", recY + recHeight)
      .attr("clip-path", 'url("#clipRect")');
  }
  if (groupMap) {
    let prevGroup = groupMap.get(headerLine[1]);
    for (let i = 1; i < numSamples; i++) {
      const thisGroup = groupMap.get(headerLine[i + 1]);
      if (thisGroup != prevGroup) {
        prevGroup = thisGroup;
        sampleSVG
          .append("line")
          .style("stroke", "black")
          .attr("stroke-width", 2)
          .attr("x1", i * cellWidth)
          .attr("y1", recY - gapHeight)
          .attr("x2", i * cellWidth)
          .attr("y2", recY + recHeight + gapHeight);
      }
    }
  }
  sampleSVG
    .append("rect")
    .attr("x", 0)
    .attr("y", recY)
    .attr("width", recWidth)
    .attr("height", recHeight)
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("fill-opacity", 0.0)
    .attr("rx", 20);
}

module.exports = {
  drawLegend: drawLegend,
};
