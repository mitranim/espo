'use strict'

const {and, not, slice, indexOf,
  isComplex, isFunction, isArray, isList, isObject, validate} = require('fpx')
const {isFrozen, defineProperty} = Object
const pub = exports

pub.global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

pub.isMutable = isMutable
function isMutable (value) {
  return isMutable_(value)
}

const isMutable_ = and(isComplex, not(isFrozen))

// Binds enumerables, therefore doesn't work with spec-compliant classes.
// TODO support spec-compliant classes.
pub.bindAll = bindAll
function bindAll (object) {
  for (const key in object) {
    const value = object[key]
    if (isFunction(value)) object[key] = value.bind(object)
  }
  return object
}

// TODO document or remove.
// Like `const`, but for object properties.
pub.final = final
function final (object, key, value) {
  return defineProperty(object, key, {value, enumerable: true, writable: false})
}

// TODO document or remove.
pub.priv = priv
function priv (object, key, value) {
  return defineProperty(object, key, {value, enumerable: false, writable: true})
}

// TODO document or remove.
pub.privFinal = privFinal
function privFinal (object, key, value) {
  return defineProperty(object, key, {value, enumerable: false, writable: false})
}

pub.assign = assign
function assign (object) {
  validate(isMutable, object)
  return slice(arguments, 1).reduce(assignOne, object)
}

function assignOne (object, src) {
  if (src) for (const key in src) object[key] = src[key]
  return object
}

pub.pull = pull
function pull (array, value) {
  validate(isArray, array)
  const index = indexOf(array, value)
  if (~index) array.splice(index, 1)
  return array
}

// TODO finalise the API, then document
pub.each = each
function each (value, fun) {
  if (isList(value)) eachElem(value, fun)
  else if (isObject(value)) eachProp(value, fun)
}

function eachElem (value, fun) {
  validate(isList, value)
  validate(isFunction, fun)
  for (let i = -1; ++i < value.length;) fun(value[i], i)
}

function eachProp (value, fun) {
  validate(isObject, value)
  validate(isFunction, fun)
  for (const key in value) fun(value[key], key)
}

// TODO finalise the API, then document
pub.forceEach = forceEach
function forceEach (list, fun, a, b, c) {
  validate(isList, list)
  validate(isFunction, fun)

  let error
  for (let i = -1; ++i < list.length;) {
    try {fun.call(this, list[i], a, b, c)}
    catch (err) {error = err}
  }
  if (error) throw error
}

// TODO finalise the API, then document
pub.flushBy = flushBy
function flushBy (values, fun, a, b, c) {
  validate(isFunction, fun)
  validate(isArray, values)
  validate(isMutable, values)
  try {
    while (values.length) {
      fun.call(this, values.shift(), a, b, c)
    }
  }
  catch (err) {
    flushBy.call(this, values, fun, a, b, c)
    throw err
  }
}

// Dangerous
// TODO consider documenting
pub.retryBy = retryBy
function retryBy (fun, a, b, c) {
  if (!isFunction(fun)) {
    throw Error(`Expected a function, got ${fun}`)
  }
  try {
    return fun(a, b, c)
  }
  catch (err) {
    retryBy(fun, a, b, c)
    throw err
  }
}
