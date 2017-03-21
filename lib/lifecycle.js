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
          deconstructor.call(this)
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
    this.root = null
    this.deinitQue = new TaskQue()
    this.deinitQue.dam()
  }

  init (root, initer) {
    validateState([this.states.IDLE], this.state)

    validate(isFunction, initer)

    this.state = this.states.INITING

    try {
      this.root = root
      initer(root, this.onDeinit)
      this.state = this.states.INITED
    }
    catch (err) {
      this.state = this.states.ABORTING_INIT
      this.deinit()
      throw err
    }

    return this.root
  }

  reinit (root, reiniter) {
    validate(isFunction, reiniter)
    this.deinit()
    return this.init(root, reiniter)
  }

  deinit (deiniter) {
    validateState([this.states.IDLE, this.states.INITED, this.states.ABORTING_INIT], this.state)

    if (this.state === this.states.IDLE) return

    this.state = this.states.DEINITING

    try {
      // Push before flushing: guaranteed to run if another deiniter throws exception.
      if (isFunction(deiniter)) this.onDeinit(deiniter)
      this.deinitQue.flush()
    }
    finally {
      this.deinitQue.dam()
      this.root = null
      this.state = this.states.IDLE
    }
  }

  onDeinit (deiniter) {
    validate(isFunction, deiniter)
    return this.deinitQue.push(deiniter.bind(null, this.root, this.onDeinit))
  }

  deconstructor () {
    this.deinit()
  }

  static init () {
    const lifecycler = new Lifecycler()
    lifecycler.init(...arguments)
    return lifecycler
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
  constructor ({getRoot, initer, deiniter}) {
    super()

    validate(isFunction, getRoot)
    validate(isFunction, initer)
    validate(isFunction, deiniter)

    if (this.constructor === FixedLifecycler) bindAll(this)

    this.getRoot = getRoot
    this.initer = initer
    this.deiniter = deiniter
  }

  init () {
    const root = this.getRoot(this.root, this.onDeinit)
    if (root) super.init(root, this.initer)
  }

  reinit () {
    super.reinit(this.getRoot(this.root, this.onDeinit), this.reiniter)
  }

  deinit () {
    super.deinit(this.deiniter)
  }

  deconstructor () {
    this.deinit()
    this.getRoot = null
    this.initer = null
    this.deiniter = null
  }
}

exports.FixedLifecycler = FixedLifecycler
