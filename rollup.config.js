'use strict'

module.exports = [
  {
    entry: 'src/espo.js',
    dest: 'es/espo.js',
    format: 'es',
    external: ['fpx'],
    plugins: [
      require('rollup-plugin-babel')({exclude: 'node_modules/**'}),
    ],
  },
  {
    entry: 'es/espo.js',
    dest: 'dist/espo.js',
    format: 'cjs',
    external: ['fpx'],
  },
  // For evaluating minified size
  {
    entry: 'dist/espo.js',
    dest: 'dist/espo.min.js',
    format: 'cjs',
    external: ['fpx'],
    plugins: [
      require('rollup-plugin-uglify')({
        mangle: true,
        toplevel: true,
        compress: true,
      }),
    ],
  },
  {
    entry: 'docs/scripts/docs.js',
    dest: 'gh-pages/scripts/docs.js',
    format: 'iife',
    plugins: [
      require('rollup-plugin-babel')({exclude: 'node_modules/**'}),
      require('rollup-plugin-alias')({espo: require('./package').module}),
      require('rollup-plugin-node-resolve')({browser: true}),
    ],
  },
]
