var path = require('path')
var webpack = require('webpack')

var pkg = require('./package.json')
var license = '@license ' + pkg.license +
    '\n' + pkg.name + ' ' + pkg.version +
    '\nCopyright New Relic <http://newrelic.com/>' +
    '\n@author ' + pkg.author

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: pkg.name + ".min.js",
    library: "nrvideo",
    libraryTarget: "umd",
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
};
