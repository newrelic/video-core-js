var path = require("path");
var webpack = require("webpack");

var pkg = require("./package.json");
var license =
  "@license " +
  pkg.license +
  "\n" +
  pkg.name +
  " " +
  pkg.version +
  "\nCopyright New Relic <http://newrelic.com/>\n" +
  "@author " +
  pkg.author;

module.exports = [
  // UMD Build
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/umd"),
      filename: "nrvideo" + ".min.js",
      library: "nrvideo",
      libraryTarget: "umd",
      libraryExport: "default",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(?:js|mjs|cjs)$/,
          exclude: [
            /node_modules/,
            /test/,
          ],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env"]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // CommonJS Build
  // No `library` name — `commonjs2` then sets module.exports = entry's
  // exports namespace directly. With `library: "nrvideo"`, webpack would
  // wrap as `module.exports.nrvideo = ...`, which combined with babel's
  // _interopRequireDefault on consumers leaves `_videoCore.default.VideoTracker`
  // undefined and crashes at class-extends time.
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/cjs"),
      filename: "index.js",
      libraryTarget: "commonjs2", // CommonJS format
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [
            /node_modules/,
            /test/,
          ],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // ES Module Build
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/esm"),
      filename: "index.js",
      library: {
        type: "module", // ES Module format
      },
    },
    experiments: {
      outputModule: true, // Enable ES Module output
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [
            /node_modules/,
            /test/,
          ],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // ============ BROWSER ENTRY ============
  // CommonJS Build
  {
    entry: "./src/browser/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/cjs/browser"),
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [/node_modules/, /test/],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({ banner: license, entryOnly: true }),
    ],
  },
  // ES Module Build
  {
    entry: "./src/browser/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/esm/browser"),
      filename: "index.js",
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [/node_modules/, /test/],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({ banner: license, entryOnly: true }),
    ],
  },
  // ============ VEGA ENTRY ============
  // CommonJS Build
  {
    entry: "./src/connectedDevice/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/cjs/vega"),
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [/node_modules/, /test/],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({ banner: license, entryOnly: true }),
    ],
  },
  // ES Module Build
  {
    entry: "./src/connectedDevice/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/esm/vega"),
      filename: "index.js",
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: [/node_modules/, /test/],
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({ banner: license, entryOnly: true }),
    ],
  },
];
