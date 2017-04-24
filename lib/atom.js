'use strict'

const {slice, is, isFunction, validate} = require('fpx')
const {Observable} = require('./observable')
const {bindAll} = require('./utils')

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

  reset (value) {
    const prev = this.value
    const next = this.value = value
    if (!is(prev, next)) this.trigger(this)
  }
}

exports.Atom = Atom
