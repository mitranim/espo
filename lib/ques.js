'use strict'

const {call, slice, isFunction, validate} = require('fpx')
const {Subscription} = require('./subscription')
const {deinit} = require('./deinit')
const {bindAll, pull, flushBy, forceEach} = require('./utils')

class Que {
  constructor (deque) {
    validate(isFunction, deque)
    if (this.constructor === Que) bindAll(this)
    this.state = this.states.IDLE
    this.pending = []
    this.deque = deque
  }

  push (value) {
    this.pending.push(value)
    if (this.state === this.states.IDLE) this.flush()
  }

  pull (value) {
    pull(this.pending, value)
  }

  dam () {
    if (this.state === this.states.IDLE) this.state = this.states.DAMMED
  }

  flush () {
    if (this.state === this.states.FLUSHING) return
    this.state = this.states.FLUSHING
    try {flushBy.call(this, this.pending, deque)}
    finally {this.state = this.states.IDLE}
  }

  isEmpty () {
    return !this.pending.length
  }

  isDammed () {
    return this.state === this.states.DAMMED
  }

  deinit () {
    this.pending.splice(0)
  }
}

exports.Que = Que

Que.prototype.states = {
  IDLE: 'IDLE',
  DAMMED: 'DAMMED',
  FLUSHING: 'FLUSHING',
}

// Avoids extra args from flushBy
function deque (value) {
  this.deque(value)
}

class TaskQue extends Que {
  constructor () {
    super(call)
    if (this.constructor === TaskQue) bindAll(this)
  }

  push (fun) {
    validate(isFunction, fun)
    const task = fun.bind(this, ...slice(arguments, 1))
    super.push(task)
    return super.pull.bind(this, task)
  }
}

exports.TaskQue = TaskQue

class MessageQue extends TaskQue {
  constructor () {
    super()
    if (this.constructor === MessageQue) bindAll(this)
    this.subscriptions = []
  }

  push () {
    super.push(triggerSubscriptions, arguments)
  }

  subscribe (callback) {
    const sub = new Subscription(this, callback)
    this.subscriptions.push(sub)
    return sub
  }

  unsubscribe (sub) {
    pull(this.subscriptions, sub)
  }

  deinit () {
    super.deinit()
    flushBy(this.subscriptions, deinit)
  }
}

exports.MessageQue = MessageQue

function triggerSubscriptions (args) {
  forceEach(this.subscriptions, triggerSubscription, args)
}

function triggerSubscription (subscription, args) {
  subscription.trigger(...args)
}
