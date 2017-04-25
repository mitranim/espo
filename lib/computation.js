'use strict'

const {isFunction, validate} = require('fpx')
const {Observable} = require('./observable')
const {Reaction} = require('./reaction')
const {bindAll} = require('./utils')

class Computation extends Observable {
  constructor (def, equal) {
    validate(isFunction, def)
    validate(isFunction, equal)
    super()
    if (this.constructor === Computation) bindAll(this)
    this.def = def
    this.equal = equal
    this.reaction = null
    this.value = undefined
  }

  deref () {
    return this.value
  }

  onInit () {
    this.reaction = Reaction.loop(computationUpdate.bind(this))
  }

  onDeinit () {
    this.reaction.deinit()
    this.reaction = null
  }
}

exports.Computation = Computation

function computationUpdate (reaction) {
  const prev = this.value
  const next = this.value = this.def(reaction)
  if (!this.equal(prev, next)) this.trigger(this)
}
