'use strict'

const {prototype: {hasOwnProperty}, defineProperty} = Object
const {test, isFunction, validate} = require('fpx')
const {TaskQue} = require('./ques')
const {bindAll, validateState, validateStates, isMutable} = require('./utils')

/**
 * Utils
 */

exports.deconstruct = deconstruct
function deconstruct (value) {
  if (isDeconstructible(value)) value.deconstructor()
}

exports.deconstructProperties = deconstructProperties
function deconstructProperties (object) {
  if (!isMutable(object)) return
  for (const key in object) {
    if (!hasOwnProperty.call(object, key)) continue
    const value = object[key]
    try {
      if (isDeconstructible(value)) {
        delete object[key]
        value.deconstructor()
      }
    }
    catch (err) {
      deconstructProperties(object)
      throw err
    }
  }
}

/**
 * Interfaces
 */

exports.isDeconstructible = isDeconstructible
function isDeconstructible (value) {
  return isDeconstructible_(value)
}

const isDeconstructible_ = test({deconstructor: isFunction})

/**
 * Classes
 */

class Deconstructor {}

// We transpile classes with loose settings, normal methods are enumerable.
defineProperty(Deconstructor.prototype, 'deconstructor', {
  enumerable: false,
  value: function deconstructor () {
    deconstructProperties(this)
  },
})

exports.Deconstructor = Deconstructor

// WTB better name
class Lifecycler {
  constructor () {
    if (this.constructor === Lifecycler) bindAll(this)
    this.state = this.states.IDLE
    this.deinitQue = new TaskQue()
    this.deinitQue.dam()
  }

  init (initer) {
    validateState(this.states.IDLE, this.state)

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
    validateStates([this.states.IDLE, this.states.INITED, this.states.ABORTING_INIT], this.state)

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

Lifecycler.prototype.states = {
  IDLE: 'IDLE',
  INITED: 'INITED',
  INITING: 'INITING',
  ABORTING_INIT: 'ABORTING_INIT',
  DEINITING: 'DEINITING',
}

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
    validateState(this.states.IDLE, this.state)
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
