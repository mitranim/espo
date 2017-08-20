import {isFunction, isObject, validate} from 'fpx'
import {isDeinitable} from './lifetime'

/**
 * Interfaces
 */

// Happens to be a subset of `isObservable`. Potential confusion. How to fix?
export function isSubscription (value) {
  return isDeinitable(value) && isFunction(value.trigger)
}

/**
 * Classes
 */

export class Subscription {
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

Subscription.prototype.states = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
}

// Duplicated to avoid circular dependency
function isObservable (value) {
  return isObject(value) && isFunction(value.subscribe) && isFunction(value.unsubscribe)
}
