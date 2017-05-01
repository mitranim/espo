'use strict'

const {slice, is, isFunction, validate} = require('fpx')
const {bindAll} = require('./utils')
const {Observable} = require('./observable')

class Atom extends Observable {
  constructor (value) {
    super()
    if (this.constructor === Atom) bindAll(this)
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
