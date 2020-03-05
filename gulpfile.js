'use strict'

/**
 * Dependencies
 */

const $ = require('gulp-load-plugins')()
const afr = require('afr')
const cp = require('child_process')
const del = require('del')
const gulp = require('gulp')
// Peer dependency
const File = require('vinyl')
const log = require('fancy-log')
const uglifyEs = require('uglify-es')
const uglifyJs = require('uglify-js')
const webpack = require('webpack')
const {Transform} = require('stream')
const statilConfig = require('./statil')
const webpackConfig = require('./webpack.config')

/**
 * Globals
 */

const srcScriptFiles = 'src/**/*.js'
const srcDocScriptFiles = 'docs/scripts/**/*.js'
const srcDocHtmlFiles = 'docs/html/**/*'
const srcDocStyleFiles = 'docs/styles/**/*.scss'
const srcDocStyleMain = 'docs/styles/docs.scss'

const outEsDir = 'es'
const outDistDir = 'dist'
const outDocRootDir = 'gh-pages'
const outDocStyleDir = 'gh-pages/styles'

process.env.COMMIT = cp.execSync('git rev-parse --short HEAD').toString().trim()

const GulpErr = msg => ({showStack: false, toString: () => msg})

// Simpler and better than gulp-uglify
function uglifyStream(uglify, options) {
  return new Transform({
    objectMode: true,
    transform(file, __, done) {
      if (!file.isBuffer()) {
        done()
        return
      }

      const {relative, contents} = file
      const output = uglify.minify(String(contents), options)

      if (!output) {
        done(GulpErr(`Unable to minify ${relative}`))
        return
      }

      const {error, warnings, code} = output
      if (error) {
        done(GulpErr(error))
        return
      }
      if (warnings) for (const warning of warnings) log.warn(warning)

      done(undefined, new File({
        path: relative,
        contents: Buffer.from(code),
      }))
    },
  })
}

/**
 * Tasks
 */

/* --------------------------------- Clear ---------------------------------- */

gulp.task('clear', () => (
  // Skips dotfiles like `.git` and `.gitignore`
  del(`${outDocRootDir}/*`).catch(console.error.bind(console))
))

/* ---------------------------------- Lib -----------------------------------*/

gulp.task('lib:build', () => (
  gulp.src(srcScriptFiles)
    .pipe($.babel())
    // Mangles "private" properties to reduce API surface and potential confusion
    .pipe(uglifyStream(uglifyEs, {
      mangle: {keep_fnames: true, properties: {regex: /_$/}},
      compress: false,
      output: {beautify: true},
    }))
    .pipe(gulp.dest(outEsDir))
    .pipe($.babel({
      plugins: [
        ['transform-es2015-modules-commonjs', {strict: true}],
      ],
    }))
    .pipe(gulp.dest(outDistDir))
    // Ensures ES5 compliance and lets us measure minified size
    .pipe(uglifyStream(uglifyJs, {
      mangle: {toplevel: true},
      compress: {warnings: false},
    }))
    .pipe(new Transform({
      objectMode: true,
      transform(file, __, done) {
        log(`Minified size: ${file.relative} — ${file._contents.length} bytes`)
        done()
      },
    }))
))

gulp.task('lib:watch', () => {
  $.watch(srcScriptFiles, gulp.series('lib:build'))
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

/* -------------------------------- Scripts ---------------------------------*/

gulp.task('docs:scripts:build', done => {
  buildWithWebpack(webpackConfig, done)
})

gulp.task('docs:scripts:watch', () => {
  watchWithWebpack(webpackConfig)
})

function buildWithWebpack(config, done) {
  return webpack(config, (err, stats) => {
    if (err) {
      done(GulpErr(err))
    }
    else {
      log('[webpack]', stats.toString(config.stats))
      done(stats.hasErrors() ? GulpErr('webpack error') : null)
    }
  })
}

function watchWithWebpack(config) {
  const compiler = webpack(config)

  const watcher = compiler.watch({}, (err, stats) => {
    log('[webpack]', stats.toString(config.stats))
    if (err) log('[webpack]', err.message)
  })

  return {compiler, watcher}
}

/* --------------------------------- Lint ---------------------------------- */

gulp.task('lint', () => (
  gulp.src([srcScriptFiles, srcDocScriptFiles])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
))

/* -------------------------------- Server ----------------------------------*/

gulp.task('docs:server', () => {
  const ds = new class extends afr.Devserver {
    onRequest(req, res) {
      req.url = req.url.replace(/^\/espo\//, '').replace(/^[/]*/, '/')
      super.onRequest(req, res)
    }
  }()
  ds.watchFiles(outDocRootDir)
  ds.serveFiles(outDocRootDir)
  ds.listen(6539)
})

/* -------------------------------- Default ---------------------------------*/

gulp.task('buildup', gulp.parallel(
  'lib:build',
  'docs:html:build',
  'docs:styles:build'
))

gulp.task('watch', gulp.parallel(
  'lib:watch',
  'docs:html:watch',
  'docs:styles:watch',
  'docs:scripts:watch',
  'docs:server'
))

gulp.task('build', gulp.series('clear', 'buildup', 'lint', 'docs:scripts:build'))

gulp.task('default', gulp.series('build', 'watch'))
