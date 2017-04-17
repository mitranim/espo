'use strict'

const {prototype: {hasOwnProperty}} = Object
const {slice, is, isDict, isFunction, validate} = require('fpx')
const {bindAll, assign, isMutable, retryBy} = require('./utils')

/**
 * Interfaces
 */

exports.isDeinitable = isDeinitable
function isDeinitable (value) {
  return Boolean(value) && isFunction(value.deinit)
}

/**
 * Utils
 */

exports.deinit = deinit
function deinit (value) {
  if (isDeinitable(value)) value.deinit()
}

/**
 * Classes
 */

class DeinitDict {
  constructor (refs) {
    if (this.constructor === DeinitDict) bindAll(this)
    assign(this, refs)
  }

  own (refs) {
    replaceProperties(this, refs)
  }

  ownBy (mod) {
    validate(isFunction, mod)
    this.own(mod(deinitables(this), ...slice(arguments, 1)))
  }

  deinit () {
    disownProperties(this)
  }
}

exports.DeinitDict = DeinitDict

/**
 * Utils (private)
 */

function disownProperties (object) {
  if (!isMutable(object)) {
    throw Error(`Expected a mutable object, got: ${object}`)
  }
  retryBy(disownAllProperties, object)
}

function disownAllProperties (object) {
  disownPropertiesExcept(object, null)
}

// Should this produce an exception if some `refs` are non-deinitable objects?
function replaceProperties (object, refs) {
  if (!isMutable(object)) {
    throw Error(`Expected a mutable object, got: ${object}`)
  }
  if (refs == null) {
    disownProperties(object)
    return
  }
  if (!isDict(refs)) {
    throw Error(`Expected nil or a plain dict of keys->refs`)
  }
  try {
    retryBy(disownPropertiesExcept, object, refs)
  }
  finally {
    assign(object, refs)
  }
}

function disownPropertiesExcept (object, exceptions) {
  for (const key in object) {
    if (!hasOwnProperty.call(object, key)) continue
    const value = object[key]
    if (isDeinitable(value)) {
      delete object[key]
      if (!dictIncludes(exceptions, value)) value.deinit()
    }
  }
}

function dictIncludes (dict, value) {
  for (const key in dict) if (is(dict[key], value)) return true
  return false
}

function deinitables (dict) {
  const out = {}
  for (const key in dict) if (isDeinitable(dict[key])) out[key] = dict[key]
  return out
}
