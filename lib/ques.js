'use strict'

const {call, slice, includes, isFunction, validate} = require('fpx')
const {bindAll, pull, assign} = require('./utils')

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
    // TODO should this only be allowed to run once?
    return this.pull.bind(this, value)
  }

  pull (value) {
    return includes(this.pending, value) && (pull(this.pending, value), true)
  }

  dam () {
    if (this.state === this.states.IDLE) this.state = this.states.DAMMED
  }

  flush () {
    if (this.state === this.states.FLUSHING) return
    this.state = this.states.FLUSHING
    try {flushQue.call(this)}
    finally {this.state = this.states.IDLE}
  }

  isEmpty () {
    return !this.pending.length
  }

  clear () {
    this.pending.splice(0)
  }
}

exports.Que = Que

assign(Que.prototype, {
  states: {
    IDLE: 'IDLE',
    DAMMED: 'DAMMED',
    FLUSHING: 'FLUSHING',
  },
})

function flushQue () {
  try {
    while (this.pending.length) this.deque(this.pending.shift())
  }
  catch (err) {
    flushQue.call(this)
    throw err
  }
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
