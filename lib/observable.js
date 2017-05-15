'use strict'

const {isFunction, validate} = require('fpx')
const {Que} = require('./ques')
const {deinit, isDeinitable} = require('./lifetime')
const {Subscription} = require('./subscription')
const {forceEach, pull, flushBy} = require('./utils')
const {isRef} = require('./ref')

/**
 * Interfaces
 */

exports.isObservable = isObservable
function isObservable (value) {
  return isDeinitable(value) && isFunction(value.subscribe) && isFunction(value.unsubscribe)
}

exports.isObservableRef = isObservableRef
function isObservableRef (value) {
  return isRef(value) && isObservable(value)
}

/**
 * Classes
 */

class Observable {
  constructor () {
    this.state = this.states.IDLE
    this.subscriptions = []
    this.que = new Que(triggerSubscriptions.bind(this))
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

exports.Observable = Observable

Observable.prototype.states = {
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
}

function triggerSubscriptions (args) {
  forceEach(this.subscriptions.slice(), triggerSubscription, args)
}

function triggerSubscription (subscription, args) {
  subscription.trigger(...args)
}
