'use strict'

const {getIn, slice, includes, test, validate, is, isFunction} = require('fpx')
const {TaskQue} = require('./ques')
const {bindAll, pull} = require('./utils')

/**
 * Interfaces
 */

exports.isReactiveSource = isReactiveSource
function isReactiveSource (value) {
  return isReactiveSource_(value)
}

const isReactiveSource_ = test({
  read: isFunction,
  addSubscriber: isFunction,
  removeSubscriber: isFunction,
})

/**
 * Classes
 */

class Atom {
  constructor (state) {
    if (this.constructor === Atom) bindAll(this)
    this.que = new TaskQue()
    this.state = state
    this.watchers = []
  }

  read (query) {
    return getIn(this.state, query)
  }

  addSubscriber (fun) {
    return this.addWatcher(fun)
  }

  removeSubscriber (value) {
    return this.removeWatcher(value)
  }

  swap (mod) {
    const prev = this.state
    const next = this.state = mod(prev, ...slice(arguments, 1))
    if (!is(prev, next)) {
      this.que.push(this.notifyWatchers.bind(this, prev, next))
    }
    return next
  }

  // BC
  addWatcher (fun) {
    validate(isFunction, fun)
    if (!includes(this.watchers, fun)) this.watchers.push(fun)
    return this.removeWatcher.bind(this, fun)
  }

  // BC
  removeWatcher (value) {
    pull(this.watchers, value)
  }

  // BC
  notifyWatchers (prev, next) {
    const notifyWatcher = fun => {fun(this, prev, next)}
    this.watchers.slice().forEach(notifyWatcher)
  }
}

exports.Atom = Atom
