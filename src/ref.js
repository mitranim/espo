import {get, isFunction, isObject} from 'fpx'

/**
 * Interfaces
 */

export function isRef (value) {
  return isObject(value) && isFunction(value.deref)
}

/**
 * Utils
 */

export function deref (ref) {
  if (isRef(ref)) {
    const value = ref.deref()
    return value === ref ? value : deref(value)
  }
  return ref
}

export function derefIn (ref, path) {
  return deref(path.reduce(derefByKey, ref))
}

function derefByKey (cursor, key) {
  if (isRef(cursor)) {
    const value = cursor.deref()
    return (value === cursor ? get : derefByKey)(value, key)
  }
  return get(cursor, key)
}

export function derefAt (path, ref) {
  return derefIn(ref, path)
}
