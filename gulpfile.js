'use strict'

/**
 * Dependencies
 */

const $ = require('gulp-load-plugins')()
const bs = require('browser-sync').create()
const cp = require('child_process')
const del = require('del')
const gulp = require('gulp')
const log = require('fancy-log')
const rollup = require('rollup')
const statilConfig = require('./statil')
const rollupConfig = require('./rollup.config')

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

process.env.VERSION = cp.execSync('git rev-parse --short HEAD').toString().trim()

/**
 * Tasks
 */

/* --------------------------------- Clear ---------------------------------- */

gulp.task('clear', () => (
  // Skips dotfiles like `.git` and `.gitignore`
  del(`${outDocRootDir}/*`).catch(console.error.bind(console))
))

/* -------------------------------- Rollup --------------------------------- */

gulp.task('rollup:build', async () => {
  for (const config of rollupConfig) {
    const bundle = await rollup.rollup(config)
    await bundle.write(config.output)
  }
})

gulp.task('rollup:watch', () => {
  const watcher = rollup.watch(rollupConfig)

  watcher.on('event', event => {
    const {code, input, duration} = event

    if (code === 'START' || code === 'BUNDLE_START' || code === 'END') {
      return
    }

    if (code === 'BUNDLE_END') {
      log('[rollup]', code, input, duration, 'ms')
      return
    }

    log('[rollup]', event)
  })
})

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
      baseDir: outDocRootDir,
      middleware: [
        (req, res, next) => {
          req.url = req.url.replace(/^\/espo\//, '').replace(/^[/]*/, '/')
          next()
        },
      ],
    },
    port: 6539,
    files: outDocRootDir,
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
  'rollup:watch',
  'docs:html:watch',
  'docs:styles:watch',
  'docs:server'
))

gulp.task('build', gulp.series('clear', 'buildup', 'lint', 'rollup:build'))

gulp.task('default', gulp.series('build', 'watch'))
