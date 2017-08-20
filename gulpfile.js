'use strict'

/* ***************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const bs = require('browser-sync').create()
const del = require('del')
const gulp = require('gulp')
const statilConfig = require('./statil')

/* ******************************** Globals **********************************/

const src = {
  scripts: 'src/**/*.js',
  docScripts: 'docs/scripts/**/*.js',
  docHtml: 'docs/html/**/*',
  docStyles: 'docs/styles/**/*.scss',
  docStylesMain: 'docs/styles/docs.scss',
  docFonts: 'node_modules/font-awesome/fonts/**/*',
}

const out = {
  docRoot: 'gh-pages',
  docStyles: 'gh-pages/styles',
  docFonts: 'gh-pages/fonts',
}

/* ********************************* Tasks ***********************************/

/* --------------------------------- Clear ---------------------------------- */

gulp.task('clear', () => (
  // Skips dotfiles like `.git` and `.gitignore`
  del(`${out.docRoot}/*`).catch(console.error.bind(console))
))

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
      compatibility: {properties: {colors: false}},
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

/* --------------------------------- Lint ---------------------------------- */

gulp.task('lint', () => (
  gulp.src([src.scripts, src.docScripts])
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
  'docs:styles:build',
  'docs:fonts:build'
))

gulp.task('watch', gulp.parallel(
  'docs:html:watch',
  'docs:styles:watch',
  'docs:fonts:watch',
  'docs:server'
))

gulp.task('build', gulp.series('clear', 'buildup', 'lint'))

gulp.task('default', gulp.series('build', 'watch'))
