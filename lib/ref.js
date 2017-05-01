'use strict'

const {get, isFunction} = require('fpx')

/**
 * Interfaces
 */

exports.isRef = isRef
function isRef (value) {
  return Boolean(value) && isFunction(value.deref)
}

/**
 * Utils
 */

exports.deref = deref
function deref (ref) {
  if (isRef(ref)) {
    const value = ref.deref()
    return value === ref ? value : deref(value)
  }
  return ref
}

exports.derefIn = derefIn
function derefIn (ref, path) {
  return deref(path.reduce(derefByKey, ref))
}

function derefByKey (cursor, key) {
  if (isRef(cursor)) {
    const value = cursor.deref()
    return (value === cursor ? get : derefByKey)(value, key)
  }
  return get(cursor, key)
}

exports.derefAt = derefAt
function derefAt (path, ref) {
  return derefIn(ref, path)
}
