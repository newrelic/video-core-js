// Builds the webpack configs named in argv into <outDir>/<name>/ and prints
// { name: bundlePath } as JSON. Run as a child process by bundles.spec.js:
// webpack and babel-loader don't run inside Jest's module sandbox.
const path = require("path");
const webpack = require("webpack");
const configs = require("../../webpack.config.js");

const [outDir, ...names] = process.argv.slice(2);

const SELECTORS = {
  umd: (c) => c.output.libraryTarget === "umd",
  cjs: (c) => c.output.path.endsWith(path.join("dist", "cjs")),
  "cjs/browser": (c) => c.output.path.endsWith(path.join("dist", "cjs", "browser")),
};

const selected = names.map((name) => {
  const config = configs.find(SELECTORS[name]);
  const outputPath = path.join(outDir, name);
  return { name, file: path.join(outputPath, config.output.filename), config: { ...config, mode: "production", devtool: false, output: { ...config.output, path: outputPath } } };
});

webpack(selected.map((s) => s.config), (err, stats) => {
  if (err || stats.hasErrors()) {
    console.error(err || stats.toString("errors-only"));
    process.exit(1);
  }
  console.log(JSON.stringify(Object.fromEntries(selected.map((s) => [s.name, s.file]))));
});
