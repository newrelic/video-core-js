var path = require('path')
var webpack = require('webpack')

var pkg = require('./package.json')
var license = '@license ' + pkg.license +
    '\n' + pkg.name + ' ' + pkg.version +
    '\nCopyright New Relic <http://newrelic.com/>' +
    '\n@author ' + pkg.author

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'nrvideo-core.min.js',
    library: 'nrvideo'
  },
  devtool: 'source-map',
  module: {
    loaders: [
      {
        test: path.join(__dirname, 'src'),
        loader: 'babel-loader'
      }
    ]
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: license,
      entryOnly: true
    })
  ]
}
