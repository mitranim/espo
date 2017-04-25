'use strict'

const {isFunction, validate} = require('fpx')
const {Que, TaskQue} = require('./ques')
const {bindAll} = require('./utils')

class Lifecycler {
  constructor () {
    if (this.constructor === Lifecycler) bindAll(this)
    this.state = this.states.IDLE
    this.que = new SingleTaskQue()
    this.deinitQue = new Que(lifecyclerDeinitDeque.bind(this))
    this.deinitQue.dam()
  }

  // Override in subclass
  onInit () {}

  onDeinit (fun) {
    validate(isFunction, fun)
    this.deinitQue.push(fun)
  }

  init () {
    this.que.push(init.bind(this, arguments))
  }

  reinit () {
    this.que.push(reinit.bind(this, arguments))
  }

  deinit () {
    this.que.push(deinit.bind(this))
  }
}

exports.Lifecycler = Lifecycler

// Hidden states: initing, deiniting, pending init, pending deinit
Lifecycler.prototype.states = {
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
}

function lifecyclerDeinitDeque (fun) {
  fun.call(this, this)
}

function init (args) {
  if (this.state !== this.states.IDLE) return
  try {
    this.onInit(...args)
  }
  finally {
    this.state = this.states.ACTIVE
  }
}

function reinit (args) {
  if (this.state === this.states.IDLE) {
    init.apply(this, args)
  }
  else {
    deinit.call(this)
    init.apply(this, args)
  }
}

function deinit () {
  if (this.state !== this.states.ACTIVE) return
  try {
    this.deinitQue.flush()
  }
  finally {
    this.state = this.states.IDLE
    this.deinitQue.dam()
  }
}

class SingleTaskQue extends TaskQue {
  push () {
    this.pending.splice(0)
    super.push(...arguments)
  }
}
