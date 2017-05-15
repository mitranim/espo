'use strict'

const {slice, is, isFunction, validate} = require('fpx')
const {Observable, isObservableRef} = require('./observable')

/**
 * Interfaces
 */

exports.isAtom = isAtom
function isAtom (value) {
  return isObservableRef(value) && isFunction(value.swap) && isFunction(value.reset)
}

/**
 * Classes
 */

class Atom extends Observable {
  constructor (value) {
    super()
    this.value = value
  }

  deref () {
    return this.value
  }

  swap (mod) {
    validate(isFunction, mod)
    this.reset(mod(this.value, ...slice(arguments, 1)))
  }

  reset (next) {
    const prev = this.value
    this.value = next
    if (!is(prev, next)) this.trigger(this)
  }
}

exports.Atom = Atom
