'use strict'

/**
 * Dependencies
 */

const $ = require('gulp-load-plugins')()
const bs = require('browser-sync').create()
const del = require('del')
const gulp = require('gulp')
const statilConfig = require('./statil')

/**
 * Globals
 */

const srcScriptFiles = 'src/**/*.js'
const srcDocScriptFiles = 'docs/scripts/**/*.js'
const srcDocHtmlFiles = 'docs/html/**/*'
const srcDocStyleFiles = 'docs/styles/**/*.scss'
const srcDocStyleMain = 'docs/styles/docs.scss'

const outDocRootDir = 'gh-pages'
const outDocStyleDir = 'gh-pages/styles'

/**
 * Tasks
 */

/* --------------------------------- Clear ---------------------------------- */

gulp.task('clear', () => (
  // Skips dotfiles like `.git` and `.gitignore`
  del(`${outDocRootDir}/*`).catch(console.error.bind(console))
))

/* --------------------------------- HTML -----------------------------------*/

gulp.task('docs:html:build', () => (
  gulp.src(srcDocHtmlFiles)
    .pipe($.statil(statilConfig))
    .pipe(gulp.dest(outDocRootDir))
))

gulp.task('docs:html:watch', () => {
  $.watch(srcDocHtmlFiles, gulp.series('docs:html:build'))
})

/* -------------------------------- Styles ----------------------------------*/

gulp.task('docs:styles:build', () => (
  gulp.src(srcDocStyleMain)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.cleanCss({
      keepSpecialComments: 0,
      aggressiveMerging: false,
      advanced: false,
      compatibility: {properties: {colors: false}},
    }))
    .pipe(gulp.dest(outDocStyleDir))
))

gulp.task('docs:styles:watch', () => {
  $.watch(srcDocStyleFiles, gulp.series('docs:styles:build'))
})

/* --------------------------------- Lint ---------------------------------- */

gulp.task('lint', () => (
  gulp.src([srcScriptFiles, srcDocScriptFiles])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
))

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
        },
      ],
    },
    port: 6539,
    files: 'gh-pages',
    open: false,
    online: false,
    ui: false,
    ghostMode: false,
    notify: false,
  })
))

/* -------------------------------- Default ---------------------------------*/

gulp.task('buildup', gulp.parallel(
  'docs:html:build',
  'docs:styles:build'
))

gulp.task('watch', gulp.parallel(
  'docs:html:watch',
  'docs:styles:watch',
  'docs:server'
))

gulp.task('build', gulp.series('clear', 'buildup', 'lint'))

gulp.task('default', gulp.series('build', 'watch'))
