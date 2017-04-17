'use strict'

const {call, slice, includes, isFunction, validate} = require('fpx')
const {bindAll, pull, flushBy, validateState} = require('./utils')

class Que {
  constructor (deque) {
    validate(isFunction, deque)
    if (this.constructor === Que) bindAll(this)
    this.state = this.states.IDLE
    this.pending = []
    this.deque = deque
  }

  push (value) {
    const queCursor = new QueCursor(this, value)
    this.pending.push(queCursor)
    if (this.state === this.states.IDLE) this.flush()
    return queCursor
  }

  dam () {
    if (this.state === this.states.IDLE) this.state = this.states.DAMMED
  }

  flush () {
    if (this.state === this.states.FLUSHING) return
    this.state = this.states.FLUSHING
    try {flushBy.call(this, this.pending, dequeTask)}
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

function dequeTask (task) {
  try {
    task.done(this.deque(task.initialValue), task.reasons.SUCCESS)
  }
  catch (err) {
    task.done(err, task.reasons.ERROR)
    throw err
  }
}

class QueCursor {
  constructor (que, initialValue) {
    validate(isQue, que)
    this.que = que
    this.initialValue = initialValue
    this.value = undefined
    this.state = this.states.PENDING
    this.reason = undefined
    this.callbacks = []
  }

  onDone (fun) {
    validate(isFunction, fun)
    if (this.state === this.states.PENDING) this.callbacks.push(fun)
    else fun(this)
  }

  done (value, reason) {
    validateState(this.states.PENDING, this.state)
    if (!(reason in this.reasons)) throw Error(`Unknown reason: ${reason}`)
    pull(this.que.pending, this)
    this.state = this.states.DONE
    this.value = value
    this.reason = reason
    flushBy(this.callbacks, call, this)
  }

  abort (value) {
    const wasActive = includes(this.que.pending, this)
    this.done(value, this.reasons.ABORT)
    return wasActive
  }

  deinit () {
    pull(this.que.pending, this)
    this.callbacks.splice(0)
  }
}

QueCursor.prototype.states = {
  PENDING: 'PENDING',
  DONE: 'DONE',
}

QueCursor.prototype.reasons = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  ABORT: 'ABORT',
}

exports.QueCursor = QueCursor

function isQue (value) {
  return value instanceof Que
}

class TaskQue extends Que {
  constructor () {
    super(call)
    if (this.constructor === TaskQue) bindAll(this)
  }

  push (fun) {
    validate(isFunction, fun)
    return super.push(fun.bind(this, ...slice(arguments, 1)))
  }
}

exports.TaskQue = TaskQue
