'use strict'

const {isFunction, validate} = require('fpx')
const {Observable} = require('./observable')
const {Runner} = require('./runner')
const {bindAll} = require('./utils')

class Reaction extends Observable {
  constructor (def) {
    validate(isFunction, def)
    super()
    if (this.constructor === Reaction) bindAll(this)
    this.def = def
    this.runner = null
    this.value = undefined
  }

  deref () {
    return this.value
  }

  onInit () {
    this.runner = Runner.loop(runner => {
      this.value = this.def(runner)
      this.trigger(this)
    })
  }

  onDeinit () {
    this.runner.deinit()
    this.runner = null
  }
}

exports.Reaction = Reaction
