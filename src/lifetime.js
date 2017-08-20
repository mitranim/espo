import {includes, is, isList, isArray, isDict, isObject, isFunction, validate} from 'fpx'

/**
 * Interfaces
 */

export function isDeinitable (value) {
  return isObject(value) && isFunction(value.deinit)
}

export function isOwner (value) {
  return isDeinitable(value) && isFunction(value.unwrap)
}

/**
 * Utils
 */

export function deinit (value) {
  if (isDeinitable(value)) value.deinit()
}

export function deinitDiff (prev, next) {
  deinitDiffAcyclic(prev, next, [])
}

export function unwrap (value) {
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
    let error = null
    for (let i = -1; (i += 1) < prev.length;) {
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
    let error = null
    for (const key in prev) {
      const prevValue = prev[key]
      const nextValue = isObject(next) ? next[key] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
  }
}
