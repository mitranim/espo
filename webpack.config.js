'use strict'

const pt = require('path')
const prod = process.env.NODE_ENV === 'production'

module.exports = {
  entry: {
    docs: pt.resolve('docs/scripts/docs.js'),
  },

  output: {
    path: pt.resolve('gh-pages/scripts'),
    filename: '[name].js'
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          pt.resolve('docs/scripts'),
          pt.resolve('lib'),
        ],
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },

  resolve: {
    alias: {
      // espo: process.cwd(),
      espo: pt.resolve('lib'),
    }
  },

  devtool: prod ? 'source-map' : false,

  // For static build. See gulpfile.
  stats: {
    colors: true,
    chunks: false,
    version: false,
    hash: false,
    assets: false,
  }
}
