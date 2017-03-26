'use strict'

function reexport (foreignExport) {
  for (const key in foreignExport) exports[key] = foreignExport[key]
}

reexport(require('./lifecycle'))
reexport(require('./ques'))
reexport(require('./reactive'))
reexport(require('./subber'))
reexport(require('./utils'))
