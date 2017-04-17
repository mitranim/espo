'use strict'

const {create} = Object
const {deinit} = require('./deinit')

exports.DeinitDict = DeinitDict
function DeinitDict () {
  return new Proxy(new DcInner(), dcProxyHandlers)
}

const dcProxyHandlers = {
  set (target, key, next) {
    const prev = target[key]
    target[key] = next
    if (prev !== next) deinit(prev)
    return true
  },

  deleteProperty (target, key) {
    const prev = target[key]
    const deleted = delete target[key]
    deinit(prev)
    return deleted
  },
}

function DcInner () {}

DcInner.prototype = create(null, {
  constructor: {
    enumerable: false,
    // Fib for debug names
    value: DeinitDict,
  },

  deinitor: {
    enumerable: false,
    value: function deleteAll () {
      for (const key in this) delete this[key]
    },
  }
})
