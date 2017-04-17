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
    const prev = this.value
    const next = this.value = mod(this.value, ...slice(arguments, 1))
    if (!is(prev, next)) this.trigger()
  }
}

exports.Atom = Atom
