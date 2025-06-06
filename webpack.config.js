var path = require("path");
var webpack = require("webpack");
var WebpackObfuscator = require("webpack-obfuscator");

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
          exclude: /node_modules/,
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
      new WebpackObfuscator(
        {
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"]
      ),
    ],
  },
  // CommonJS Build
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/cjs"),
      filename: "index.js",
      library: "nrvideo",
      libraryTarget: "commonjs2", // CommonJS format
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
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
      new WebpackObfuscator(
        {
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"]
      ),
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
          exclude: /node_modules/,
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
      new WebpackObfuscator(
        {
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"]
      ),
    ],
  },
];