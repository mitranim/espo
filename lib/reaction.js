'use strict'

const {isFunction, validate} = require('fpx')
const {isObservable} = require('./observable')
const {isRef} = require('./ref')
const {isSubscription} = require('./subscription')
const {deinit} = require('./lifetime')
const {flushBy} = require('./utils')

class Reaction {
  constructor () {
    this.nextContext = null
    this.lastContext = null
    this.deref = this.deref.bind(this)
  }

  deref (ref) {
    validate(isRef, ref)
    if (this.nextContext && isObservable(ref)) this.nextContext.subscribeTo(ref)
    return ref.deref()
  }

  run (fun, onTrigger) {
    validate(isFunction, fun)
    validate(isFunction, onTrigger)

    if (this.nextContext) throw Error(`Unexpected overlapping .run()`)

    this.nextContext = new ReactionContext(this, onTrigger)

    try {
      return fun(this)
    }
    finally {
      const {nextContext, lastContext} = this
      this.lastContext = nextContext
      this.nextContext = null
      if (lastContext) lastContext.deinit()
    }
  }

  // TODO document
  loop (fun) {
    validate(isFunction, fun)
    const loop = () => {
      this.run(fun, loop)
    }
    loop()
  }

  deinit () {
    const {nextContext, lastContext} = this
    try {
      if (nextContext) nextContext.deinit()
    }
    finally {
      if (lastContext) lastContext.deinit()
    }
  }

  static loop (fun) {
    validate(isFunction, fun)
    const reaction = new this()
    try {
      reaction.loop(fun)
      return reaction
    }
    catch (err) {
      reaction.deinit()
      throw err
    }
  }
}

exports.Reaction = Reaction

class ReactionContext {
  constructor (reaction, onTrigger) {
    this.state = this.states.PENDING
    this.reaction = reaction
    this.onTrigger = onTrigger
    this.trigger = this.trigger.bind(this)
    this.subscriptions = []
  }

  subscribeTo (observable) {
    if (this.state === this.states.PENDING) {
      const sub = observable.subscribe(this.trigger)
      validate(isSubscription, sub)
      this.subscriptions.push(sub)
    }
  }

  trigger () {
    if (this.state === this.states.PENDING) {
      this.state = this.states.TRIGGERED
      this.onTrigger.call(null, this.reaction)
    }
  }

  deinit () {
    this.state = this.states.DEAD
    flushBy(this.subscriptions, deinit)
  }
}

ReactionContext.prototype.states = {
  PENDING: 'PENDING',
  TRIGGERED: 'TRIGGERED',
  DEAD: 'DEAD',
}
