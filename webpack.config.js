'use strict'

const pt = require('path')
const webpack = require('webpack')

const PROD = process.env.NODE_ENV === 'production'
const SRC_DIR = pt.resolve('docs/scripts')
const OUT_DIR = pt.resolve('gh-pages/scripts')

module.exports = {
  mode: process.env.NODE_ENV || 'development',

  entry: {
    docs: pt.join(SRC_DIR, 'docs.js'),
  },

  output: {
    path: OUT_DIR,
    filename: '[name].js',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        include: SRC_DIR,
        use: {loader: 'babel-loader'},
      },
    ],
  },

  resolve: {
    alias: {
      espo: pt.join(process.cwd(), 'es/espo.js'),
    },
  },

  node: {
    process: 'mock',
  },

  plugins: [
    new webpack.EnvironmentPlugin(process.env),
  ],

  optimization: !PROD ? undefined : {
    minimize: true,
    minimizer: [
      new (require('uglifyjs-webpack-plugin'))({
        cache: true,
        parallel: true,
        sourceMap: true,
        uglifyOptions: {
          mangle: {toplevel: true},
          compress: {warnings: false},
          output: {comments: false},
        },
      }),
    ],
  },

  // optimization: {minimize: false, minimizer: []},

  // Source maps require TWO separate options:
  //   `devtool: 'source-map'` in webpack config
  //   `sourceMap: true` in uglify plugin options
  devtool: !PROD ? false : 'source-map',

  stats: {
    assets: false,
    builtAt: false,
    colors: true,
    entrypoints: false,
    hash: false,
    modules: false,
    timings: true,
    version: false,
  },
}
