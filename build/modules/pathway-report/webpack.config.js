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

const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineChunkHtmlPlugin = require("inline-chunk-html-plugin");
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require("webpack");
if (!process.env.OUTPUT_DIR) { // full path to output directory
  throw new Error("Required env OUTPUT_DIR is not defined");
}

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      })
    ]
  },
  resolve: {
    fallback: {
      fs: false,
      tls: false,
      net: false,
      path: false,
      zlib: false,
      http: false,
      https: false,
      stream: require.resolve("stream-browserify"),
      crypto: false,
      timers: false,
      child_process: false,
      "crypto-browserify": require.resolve("crypto-browserify"),
    },
  },
  entry: "./app/main.js",
  mode: "production",
  output: {
    path: `${process.env.OUTPUT_DIR}`,
    filename: "bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['cssnano', {
                    preset: ['default', {
                      discardComments: {
                        removeAll: true
                      }
                    }]
                  }]
                ]
              }
            }
          }
        ],
      },
      {
        test: /\.(svg|gif|png|eot|woff|ttf)$/,
        use: ["url-loader"],
      },
      {
        test: /\.(csv|tsv)$/i,
        use: ["csv-loader"],
      },
      {
        test: /\.(xml|nwt|sbgn)$/i,
        use: "raw-loader",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: "./index.html",
    }),
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/bundle/]),
    new webpack.BannerPlugin({
      banner:`/*!
sbgnviz_pathway pathway-report module
Copyright (c) 2025 The University of Texas MD Anderson Cancer Center
Licensed under MIT https://opensource.org/license/MIT
*/
      `.trim(),
      entryOnly: true,
      raw: true,
    })
  ],
};
