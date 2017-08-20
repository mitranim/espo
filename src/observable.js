import {isFunction, validate} from 'fpx'
import {Que} from './ques'
import {deinit, isDeinitable} from './lifetime'
import {Subscription} from './subscription'
import {forceEach, pull, flushBy} from './utils'
import {isRef} from './ref'

/**
 * Interfaces
 */

export function isObservable (value) {
  return isDeinitable(value) && isFunction(value.subscribe) && isFunction(value.unsubscribe)
}

export function isObservableRef (value) {
  return isRef(value) && isObservable(value)
}

/**
 * Classes
 */

export class Observable {
  constructor () {
    this.state = this.states.IDLE
    this.subscriptions = []
    this.que = new Que(triggerSubscriptions.bind(null, this))
  }

  // override in subclass
  onInit () {}

  // override in subclass
  onDeinit () {}

  subscribe (callback) {
    validate(isFunction, callback)

    if (this.state === this.states.IDLE) {
      this.state = this.states.ACTIVE
      this.onInit()
    }

    const sub = new Subscription(this, callback)
    this.subscriptions.push(sub)
    return sub
  }

  unsubscribe (sub) {
    pull(this.subscriptions, sub)
    if (this.state === this.states.ACTIVE && !this.subscriptions.length) {
      this.state = this.states.IDLE
      this.onDeinit()
    }
  }

  trigger () {
    this.que.push(arguments)
  }

  deinit () {
    flushBy(this.subscriptions, deinit)
  }
}

Observable.prototype.states = {
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
}

function triggerSubscriptions ({subscriptions}, args) {
  forceEach(subscriptions.slice(), triggerSubscription, args)
}

function triggerSubscription (subscription, args) {
  subscription.trigger(...args)
}
