var path = require("path");
var webpack = require("webpack");
var TerserPlugin = require("terser-webpack-plugin");

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

const babelCjs = {
  test: /\.(js|mjs|cjs|ts)$/,
  exclude: [/node_modules/, /test/],
  use: {
    loader: "babel-loader",
    options: {
      presets: [
        ["@babel/preset-env", { targets: "defaults" }],
        ["@babel/preset-typescript", { allowDeclareFields: true }],
      ],
    },
  },
};

const babelEsm = {
  test: /\.(js|mjs|cjs|ts)$/,
  exclude: [/node_modules/, /test/],
  use: {
    loader: "babel-loader",
    options: {
      presets: [
        ["@babel/preset-env", { targets: "defaults", modules: false }],
        ["@babel/preset-typescript", { allowDeclareFields: true }],
      ],
    },
  },
};

const banner = new webpack.BannerPlugin({ banner: license, entryOnly: true });
const terser = new TerserPlugin();

module.exports = [
  // ============ UMD (full bundle) ============
  {
    entry: "./src/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/umd"),
      filename: "nrvideo.min.js",
      library: "nrvideo",
      libraryTarget: "umd",
      libraryExport: "default",
    },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [{ test: /\.(?:js|mjs|cjs|ts)$/, exclude: [/node_modules/, /test/], use: { loader: "babel-loader", options: { presets: [["@babel/preset-env"], ["@babel/preset-typescript", { allowDeclareFields: true }]] } } }] },
    plugins: [banner],
  },

  // ============ CJS (full bundle) ============
  // No `library` name — `commonjs2` sets module.exports = entry's exports
  // namespace directly. With `library: "nrvideo"`, webpack wraps as
  // `module.exports.nrvideo = ...`, which combined with babel's
  // _interopRequireDefault leaves `_videoCore.default.VideoTracker`
  // undefined and crashes at class-extends time.
  {
    entry: "./src/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/cjs"),
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelCjs] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },

  // ============ ESM (full bundle) ============
  {
    entry: "./src/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/esm"),
      filename: "index.js",
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelEsm] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },

  // ============ BROWSER ENTRY ============
  // CJS
  {
    entry: "./src/browser/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/cjs/browser"),
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelCjs] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },

  // ESM
  {
    entry: "./src/browser/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/esm/browser"),
      filename: "index.js",
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelEsm] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },

  // ============ VEGA ENTRY ============
  // CJS
  {
    entry: "./src/connectedDevice/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/cjs/vega"),
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelCjs] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },

  // ESM
  {
    entry: "./src/connectedDevice/index.ts",
    output: {
      path: path.resolve(__dirname, "./dist/esm/vega"),
      filename: "index.js",
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    devtool: "source-map",
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [babelEsm] },
    optimization: { minimize: true, minimizer: [terser] },
    plugins: [banner],
  },
];
