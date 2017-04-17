'use strict'

function reexport (foreignExport) {
  for (const key in foreignExport) {
    if (key in exports) throw Error(`Duplicate export: ${key}`)
    exports[key] = foreignExport[key]
  }
}

reexport(require('./atom'))
reexport(require('./deinit'))
reexport(require('./lifecycle'))
reexport(require('./observable'))
reexport(require('./query'))
reexport(require('./ques'))
reexport(require('./reaction'))
reexport(require('./runner'))
reexport(require('./utils'))
