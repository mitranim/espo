'use strict'

const {get, test, testAnd, isFunction, validate} = require('fpx')
const {Que} = require('./ques')
const {deinit} = require('./deinit')
const {Subscription} = require('./subscription')
const {forceEach, pull, bindAll, flushBy} = require('./utils')

/**
 * Interfaces
 */

exports.isRef = isRef
function isRef (value) {
  return Boolean(value) && isFunction(value.deref)
}

exports.isObservable = isObservable
function isObservable (value) {
  return isObservable_(value)
}

const isObservable_ = test({subscribe: isFunction, unsubscribe: isFunction})

exports.isObservableRef = isObservableRef
function isObservableRef (value) {
  return isObservableRef_(value)
}

const isObservableRef_ = testAnd(isRef, {subscribe: isFunction, unsubscribe: isFunction})

/**
 * Utils
 */

exports.deref = deref
function deref (ref) {
  if (isRef(ref)) {
    const value = ref.deref()
    return value === ref ? value : deref(value)
  }
  return ref
}

exports.derefIn = derefIn
function derefIn (ref, path) {
  return deref(path.reduce(derefByKey, ref))
}

function derefByKey (cursor, key) {
  if (isRef(cursor)) {
    const value = cursor.deref()
    return (value === cursor ? get : derefByKey)(value, key)
  }
  return get(cursor, key)
}

exports.derefAt = derefAt
function derefAt (path, ref) {
  return derefIn(ref, path)
}

/**
 * Classes
 */

class Observable {
  constructor () {
    if (this.constructor === Observable) bindAll(this)
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
  forceEach(this.subscriptions, triggerSubscription, args)
}

function triggerSubscription (subscription, args) {
  subscription.trigger(...args)
}
