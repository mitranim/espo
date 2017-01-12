'use strict'

const {getIn, is, call, bind, bindApply, and, or, not, id,
  slice, indexOf, append, remove,
  isComplex, isString, isFunction, validate, validateEach} = require('fpx')
const {isFrozen, defineProperty} = Object
const pub = exports

/**
 * Utils
 */

pub.global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

const isMutable = pub.isMutable = and(isComplex, not(isFrozen))

// Duck-typed version of `instanceof`.
pub.isImplementation = isImplementation
function isImplementation (iface, value) {
  if (value == null) return false
  for (const key in iface) {
    if (typeof value[key] !== typeof iface[key]) return false
  }
  return true
}

pub.bindAll = bindAll
function bindAll (object) {
  for (const key in object) {
    const value = object[key]
    if (isFunction(value)) object[key] = value.bind(object)
  }
  return object
}

// Same as `const`, but for object properties.
pub.final = final
function final (object, key, value) {
  return defineProperty(object, key, {value, enumerable: true, writable: false})
}

pub.assign = assign
function assign (object) {
  return slice(arguments, 1).reduce(assignOne, isMutable(object) ? object : {})
}

function assignOne (object, src) {
  if (src) for (const key in src) object[key] = src[key]
  return object
}

pub.push = push
function push (list, value) {
  list.push(value)
  return list
}

pub.pull = pull
function pull (list, value) {
  const index = indexOf(list, value)
  if (~index) list.splice(index, 1)
  return list
}

pub.setIn = setIn
function setIn (object, maybePath, value) {
  validate(isMutable, object)
  validateEach(isString, maybePath)
  return maybePath.reduce(bind(setNext, value), object)
}

function setNext (value, target, key, index, path) {
  return target[key] = (
    index === path.length - 1 ? value :
    isMutable(target[key])    ? target[key] :
    {}
  )
}

pub.redef = redef
function redef (storage, path, fun) {
  validate(isFunction, fun)
  return setIn(storage, path, fun(getIn(storage, path)))
}

pub.defonce = defonce
function defonce (storage, path, fun) {
  validate(isFunction, fun)
  return redef(storage, path, or(id, bindApply(fun, slice(arguments, 3))))
}

/**
 * Classes
 */

const IDLE     = 'IDLE'
const DAMMED   = 'DAMMED'
const FLUSHING = 'FLUSHING'

pub.Que = Que
function Que (deque) {
  if (!isImplementation(Que.prototype, this)) return new Que(deque)
  validate(isFunction, deque)
  bindAll(this)
  this.deque = deque
  this.state = IDLE
  this.pending = []
}

assign(Que.prototype, {
  states: {
    IDLE,
    DAMMED,
    FLUSHING,
  },
  push (value) {
    this.pending.push(value)
    if (this.state === IDLE) this.flush()
    return bind(pull, this.pending, value)
  },
  dam () {
    if (this.state === IDLE) this.state = DAMMED
  },
  flush () {
    if (this.state === FLUSHING) return
    this.state = FLUSHING
    try {flushQue.call(this)}
    finally {this.state = IDLE}
  },
  isEmpty () {
    return !this.pending.length
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

pub.TaskQue = TaskQue
function TaskQue () {
  if (!isImplementation(TaskQue.prototype, this)) return new TaskQue()
  Que.call(this, call)
}

assign(TaskQue.prototype, Que.prototype, {
  push (fun) {
    return Que.prototype.push.call(this, fun.bind(this, ...slice(arguments, 1)))
  },
})

pub.Atom = Atom
function Atom (state) {
  if (!isImplementation(Atom.prototype, this)) return new Atom(state)
  bindAll(this)
  this.que = TaskQue()
  this.state = state
  this.watchers = []
}

assign(Atom.prototype, {
  swap (mod) {
    validate(isFunction, mod)
    const [prev, next] = commitState.apply(this, arguments)
    if (!is(prev, next)) this.enque(this.notifyWatchers, prev, next)
    return next
  },
  notifyWatchers (prev, next) {
    const notifyWatcher = fun => {fun(this, prev, next)}
    this.watchers.forEach(notifyWatcher)
  },
  addWatcher (fun) {
    validate(isFunction, fun)
    this.watchers = append(this.watchers, fun)
    return this.removeWatcher.bind(this, fun)
  },
  removeWatcher (fun) {
    this.watchers = remove(this.watchers, fun)
  },
  enque (task) {
    return this.que.push(task.bind(this, ...slice(arguments, 1)))
  },
})

function commitState (mod) {
  const prev = this.state
  const next = this.state = mod(prev, ...slice(arguments, 1))
  return [prev, next]
}
