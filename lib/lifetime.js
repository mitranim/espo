'use strict'

const {includes, is, isList, isArray, isDict, isObject, isFunction, validate} = require('fpx')

/**
 * Interfaces
 */

exports.isDeinitable = isDeinitable
function isDeinitable (value) {
  return Boolean(value) && isFunction(value.deinit)
}

exports.isOwner = isOwner
function isOwner (value) {
  return isDeinitable(value) && isFunction(value.unwrap)
}

/**
 * Utils
 */

exports.deinit = deinit
function deinit (value) {
  if (isDeinitable(value)) value.deinit()
}

exports.deinitDiff = deinitDiff
function deinitDiff (prev, next) {
  deinitDiffAcyclic(prev, next, [])
}

exports.unwrap = unwrap
function unwrap (value) {
  return isOwner(value) ? value.unwrap() : undefined
}

/**
 * Internal
 */

function deinitDiffAcyclic (prev, next, visitedRefs) {
  if (is(prev, next)) return
  if (isDeinitable(prev)) {
    prev.deinit()
    return
  }

  if (isObject(prev)) {
    // Don't bother traversing non-plain objects. This allows to safely include
    // third party objects with unknown structure.
    if (!isDict(prev) && !isArray(prev)) return

    // This skips cyclic references
    if (includes(visitedRefs, prev)) return

    visitedRefs.push(prev)
    traverseDiffBy(deinitDiffAcyclic, prev, next, visitedRefs)
  }
}

// Ugly, TODO simplify
function traverseDiffBy (fun, prev, next, visitedRefs) {
  validate(isFunction, fun)

  if (isList(prev)) {
    let error
    for (let i = -1; ++i < prev.length;) {
      const prevValue = prev[i]
      if (includes(next, prevValue)) continue
      const nextValue = isList(next) ? next[i] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
    return
  }

  if (isObject(prev)) {
    let error
    for (const key in prev) {
      const prevValue = prev[key]
      const nextValue = isObject(next) ? next[key] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
  }
}
