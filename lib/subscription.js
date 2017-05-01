'use strict'

const {isFunction, validate} = require('fpx')
const {isDeinitable} = require('./lifetime')

/**
 * Interfaces
 */

// Happens to be a subset of `isObservable`. Potential confusion. How to fix?
exports.isSubscription = isSubscription
function isSubscription (value) {
  return isDeinitable(value) && isFunction(value.trigger)
}

/**
 * Classes
 */

class Subscription {
  constructor (observable, callback) {
    validate(isObservable, observable)
    validate(isFunction, callback)
    this.observable = observable
    this.callback = callback
    this.state = this.states.ACTIVE
  }

  trigger () {
    if (this.state === this.states.ACTIVE) {
      this.callback(...arguments)
    }
  }

  deinit () {
    if (this.state === this.states.ACTIVE) {
      this.state = this.states.IDLE
      this.observable.unsubscribe(this)
    }
  }
}

exports.Subscription = Subscription

Subscription.prototype.states = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
}

// Duplicated to avoid circular dependency
function isObservable (value) {
  return Boolean(value) && isFunction(value.subscribe) && isFunction(value.unsubscribe)
}
