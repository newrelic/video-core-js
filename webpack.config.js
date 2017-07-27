var path = require('path')
var webpack = require('webpack')

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
      banner: 'NEW RELIC',
      entryOnly: true
    })
  ]
}
