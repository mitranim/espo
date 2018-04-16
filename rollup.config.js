'use strict'

module.exports = [
  {
    input: 'src/espo.js',
    output: {file: 'es/espo.js', format: 'es'},
    plugins: [
      require('rollup-plugin-babel')({exclude: 'node_modules/**'}),
    ],
  },
  {
    input: 'es/espo.js',
    output: {file: 'dist/espo.js', format: 'cjs'},
  },
  // For evaluating minified size
  {
    input: 'dist/espo.js',
    output: {file: 'dist/espo.min.js', format: 'cjs'},
    plugins: [
      require('rollup-plugin-uglify')({
        mangle: {toplevel: true},
        compress: true,
      }),
    ],
  },
  {
    input: 'docs/scripts/docs.js',
    output: {file: 'gh-pages/scripts/docs.js', format: 'iife'},
    plugins: [
      require('rollup-plugin-babel')({exclude: 'node_modules/**'}),
      require('rollup-plugin-alias')({espo: require('./package').module}),
      require('rollup-plugin-node-resolve')({browser: true}),
    ],
  },
]
