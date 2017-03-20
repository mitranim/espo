'use strict'

function reexport (foreignExport) {
  for (const key in foreignExport) exports[key] = foreignExport[key]
}

reexport(require('./espo'))
