'use strict'

function reexport (foreignExport) {
  for (const key in foreignExport) {
    if (key in exports) throw Error(`Duplicate export: ${key}`)
    exports[key] = foreignExport[key]
  }
}

reexport(require('./agent'))
reexport(require('./atom'))
reexport(require('./computation'))
reexport(require('./lifetime'))
reexport(require('./observable'))
reexport(require('./query'))
reexport(require('./ques'))
reexport(require('./reaction'))
reexport(require('./ref'))
reexport(require('./subscription'))
reexport(require('./utils'))
