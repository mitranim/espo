'use strict'

/* ***************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const bs = require('browser-sync').create()
const del = require('del')
const {exec} = require('child_process')
const gulp = require('gulp')
const statilConfig = require('./statil')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')

/* ******************************** Globals **********************************/

const src = {
  lib: 'lib/**/*.js',
  dist: 'dist/**/*.js',
  docHtml: 'docs/html/**/*',
  docStyles: 'docs/styles/**/*.scss',
  docStylesMain: 'docs/styles/docs.scss',
  docFonts: 'node_modules/font-awesome/fonts/**/*',
  test: 'test/**/*.js'
}

const out = {
  lib: 'dist',
  docRoot: 'gh-pages',
  docStyles: 'gh-pages/styles',
  docFonts: 'gh-pages/fonts',
}

const testCommand = require('./package').scripts.test

function noop () {}

let testProc

/* ********************************* Tasks ***********************************/

/* --------------------------------- Clear ---------------------------------- */

gulp.task('lib:clear', () => (
  del(out.lib).catch(noop)
))

gulp.task('docs:clear', () => (
  // Skips dotfiles like `.git` and `.gitignore`
  del(out.docRoot + '/*').catch(noop)
))

gulp.task('clear', gulp.parallel('lib:clear', 'docs:clear'))

/* ---------------------------------- Lib -----------------------------------*/

gulp.task('lib:compile', () => (
  gulp.src(src.lib)
    .pipe($.babel())
    .pipe(gulp.dest(out.lib))
))

// Purely for evaluating minified code size.
gulp.task('lib:minify', () => (
  gulp.src(src.dist, {ignore: '**/*.min.js'})
    .pipe($.uglify({
      mangle: true,
      compress: {warnings: false, screw_ie8: true},
      wrap: true
    }))
    .pipe($.rename(path => {
      path.extname = '.min.js'
    }))
    .pipe(gulp.dest(out.lib))
))

gulp.task('lib:test', done => {
  if (testProc) {
    // Just started, let it finish
    if (testProc.exitCode == null) return
    testProc.kill()
  }

  $.util.log('Test started')

  testProc = exec(testCommand, (err, stdout, stderr) => {
    process.stdout.write(stdout)
    process.stderr.write(stderr)

    if (err) {
      throw new $.util.PluginError('lib:test', 'Test failed', {showProperties: false})
    } else {
      $.util.log('Test finished')
      done()
    }
  })
})

gulp.task('lib:build', gulp.series('lib:compile', 'lib:minify'))

gulp.task('lib:watch', () => {
  $.watch(src.lib, gulp.parallel('lib:test', gulp.series('lib:build')))
  $.watch(src.test, gulp.series('lib:test'))
})

/* --------------------------------- HTML -----------------------------------*/

gulp.task('docs:html:build', () => (
  gulp.src(src.docHtml)
    .pipe($.statil(statilConfig))
    .pipe(gulp.dest(out.docRoot))
))

gulp.task('docs:html:watch', () => {
  $.watch(src.docHtml, gulp.series('docs:html:build'))
})

/* -------------------------------- Styles ----------------------------------*/

gulp.task('docs:styles:build', () => (
  gulp.src(src.docStylesMain)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.cleanCss({
      keepSpecialComments: 0,
      aggressiveMerging: false,
      advanced: false,
      compatibility: {properties: {colors: false}}
    }))
    .pipe(gulp.dest(out.docStyles))
))

gulp.task('docs:styles:watch', () => {
  $.watch(src.docStyles, gulp.series('docs:styles:build'))
})

/* -------------------------------- Fonts -----------------------------------*/

gulp.task('docs:fonts:build', () => (
  gulp.src(src.docFonts).pipe(gulp.dest(out.docFonts))
))

gulp.task('docs:fonts:watch', () => {
  $.watch(src.docFonts, gulp.series('docs:fonts:build'))
})

/* ------------------------------- Scripts ----------------------------------*/

gulp.task('docs:scripts:build', done => {
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      throw new $.util.PluginError('webpack', err, {showProperties: false})
    }
    $.util.log('[webpack]', stats.toString(webpackConfig.stats))
    if (stats.hasErrors()) {
      throw new $.util.PluginError('webpack', 'plugin error', {showProperties: false})
    }
    done()
  })
})

gulp.task('docs:scripts:watch', () => {
  function report (err, stats) {
    $.util.log('[webpack]', stats.toString(webpackConfig.stats))
    if (err) console.error(err)
  }

  const compiler = webpack(webpackConfig)

  // Call watcher.close() to stop
  const _watcher = compiler.watch({}, report)
})

/* -------------------------------- Server ----------------------------------*/

gulp.task('docs:server', () => (
  bs.init({
    startPath: '/espo/',
    server: {
      baseDir: 'gh-pages',
      middleware: [
        (req, res, next) => {
          req.url = req.url.replace(/^\/espo\//, '').replace(/^[/]*/, '/')
          next()
        }
      ]
    },
    port: 6539,
    files: 'gh-pages',
    open: false,
    online: false,
    ui: false,
    ghostMode: false,
    notify: false
  })
))

/* -------------------------------- Default ---------------------------------*/

gulp.task('buildup', gulp.parallel(
  'lib:build',
  'docs:html:build',
  'docs:styles:build',
  'docs:fonts:build'
))

gulp.task('watch', gulp.parallel(
  'lib:watch',
  'docs:html:watch',
  'docs:styles:watch',
  'docs:fonts:watch',
  'docs:scripts:watch',
  'docs:server'
))

gulp.task('build', gulp.series('clear', 'buildup', 'lib:test', 'docs:scripts:build'))

gulp.task('default', gulp.series('clear', 'buildup', 'lib:test', 'watch'))