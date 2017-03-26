'use strict'

const {test, isFunction, validate} = require('fpx')
const {bindAll, validateState, assign} = require('./utils')
const {TaskQue} = require('./ques')

/**
 * Interfaces
 */

function isDeconstructible (value) {
  return isDeconstructible_(value)
}

const isDeconstructible_ = test({deconstructor: isFunction})

/**
 * Classes
 */

class Deconstructor {}

exports.Deconstructor = Deconstructor

Object.defineProperty(Deconstructor.prototype, 'deconstructor', {
  enumerable: false,
  value: function deconstructor () {
    for (const key in this) {
      const value = this[key]
      delete this[key]
      if (isDeconstructible(value)) {
        try {
          value.deconstructor()
        }
        catch (err) {
          this.deconstructor()
          throw err
        }
      }
    }
  }
})

// WTB better name
class Lifecycler {
  constructor () {
    if (this.constructor === Lifecycler) bindAll(this)
    this.state = this.states.IDLE
    this.deinitQue = new TaskQue()
    this.deinitQue.dam()
  }

  init (initer) {
    validateState([this.states.IDLE], this.state)

    validate(isFunction, initer)

    this.state = this.states.INITING

    try {
      initer(this)
      this.state = this.states.INITED
    }
    catch (err) {
      this.state = this.states.ABORTING_INIT
      this.deinit()
      throw err
    }

    return this
  }

  reinit (reiniter) {
    validate(isFunction, reiniter)
    this.deinit()
    return this.init(reiniter)
  }

  deinit (deiniter) {
    validateState([this.states.IDLE, this.states.INITED, this.states.ABORTING_INIT], this.state)

    if (this.state === this.states.IDLE) return this

    this.state = this.states.DEINITING

    try {
      // Push before flushing: guaranteed to run if another deiniter throws exception.
      if (isFunction(deiniter)) this.onDeinit(deiniter)
      this.deinitQue.flush()
    }
    finally {
      this.deinitQue.dam()
      this.state = this.states.IDLE
    }

    return this
  }

  onDeinit (deiniter) {
    return this.deinitQue.push(deiniter, this)
  }

  deconstructor () {
    this.deinit()
  }

  static init () {
    return new Lifecycler().init(...arguments)
  }
}

exports.Lifecycler = Lifecycler

assign(Lifecycler.prototype, {
  states: {
    IDLE: 'IDLE',
    INITED: 'INITED',
    INITING: 'INITING',
    ABORTING_INIT: 'ABORTING_INIT',
    DEINITING: 'DEINITING',
  },
})

// WTB better name
class FixedLifecycler extends Lifecycler {
  constructor ({initer, deiniter}) {
    validate(isFunction, initer)
    validate(isFunction, deiniter)

    super()

    if (this.constructor === FixedLifecycler) bindAll(this)

    this.initer = initer
    this.deiniter = deiniter
  }

  init () {
    validateState([this.states.IDLE], this.state)
    return super.init(this.initer)
  }

  reinit () {
    this.deinit()
    return this.init()
  }

  deinit () {
    return super.deinit(this.deiniter)
  }

  deconstructor () {
    this.deinit()
    this.initer = null
    this.deiniter = null
  }
}

exports.FixedLifecycler = FixedLifecycler
