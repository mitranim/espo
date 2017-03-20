'use strict'

const {getIn, call, bind, bindApply, and, or, not, id, test,
  slice, indexOf, includes, append, remove, mapVals,
  is, isComplex, isString, isFunction, isPrimitive,
  validate, validateEach} = require('fpx')
const {isFrozen, defineProperty, getOwnPropertyDescriptors, create, setPrototypeOf} = Object
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

// TODO consider documenting
pub.validateState = validateState
function validateState (allowedStates, state) {
  validate(isPrimitive, state)
  validateEach(isPrimitive, allowedStates)

  if (!includes(allowedStates, state)) {
    throw Error(
      `Unexpected state ${state}, must be one of: ${allowedStates.join(', ')}`
    )
  }
}

// TODO consider documenting
pub.valueDescriptor = valueDescriptor
function valueDescriptor (value) {
  return {value, enumerable: true, writable: true, configurable: true}
}

const valueDescriptors = pub.valueDescriptors = bind(mapVals, valueDescriptor)

// TODO consider documenting
pub.hiddenDescriptor = hiddenDescriptor
function hiddenDescriptor (value) {
  return {value, enumerable: false, writable: true, configurable: true}
}

pub.hiddenDescriptors = bind(mapVals, hiddenDescriptor)

pub.subclassOf = subclassOf
function subclassOf (Superclass, Subclass) {
  validate(isFunction, Subclass)
  validate(isFunction, Superclass)
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = create(Superclass.prototype, hiddenDescriptor({constructor: Subclass}))
}

// TODO consider documenting
pub.subclassStatics = subclassStatics
function subclassStatics (Subclass, Superclass) {
  if (setPrototypeOf) setPrototypeOf(Subclass, Superclass)
  else {
    const descriptors = getOwnPropertyDescriptors(Superclass)
    for (const key in descriptors) {
      if (!includes(functionProperties, key)) {
        defineProperty(Subclass, key, descriptors[key])
      }
    }
  }
}

const functionProperties = ['length', 'name', 'arguments', 'caller', 'prototype']

pub.subclassWithProps = subclassWithProps
function subclassWithProps (Superclass, props) {
  function Subclass () {
    if (!(this instanceof Subclass)) return new Subclass(...arguments)
    Superclass.apply(this, arguments)
  }
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = Object.create(
    Superclass.prototype,
    assign({}, valueDescriptors(props), {constructor: hiddenDescriptor(Subclass)})
  )
  return Subclass
}

pub.subclassBy = subclassBy
function subclassBy (getProps) {
  validate(isFunction, getProps)
  return function subclassBy_ (Superclass) {
    return subclassWithProps(Superclass, getProps(Superclass))
  }
}

pub.hackClassBy = hackClassBy
function hackClassBy (getProps) {
  validate(isFunction, getProps)
  return function hackClassBy_ (Class) {
    assign(Class.prototype, getProps(Class))
    return Class
  }
}

/**
 * Interfaces
 */

function isDeconstructible (value) {
  return isDeconstructible_(value)
}

const isDeconstructible_ = test({deconstructor: isFunction})

/**
 * Classes
 */

pub.Que = Que
function Que (deque) {
  if (!isImplementation(Que.prototype, this)) return new Que(deque)
  validate(isFunction, deque)
  bindAll(this)
  this.deque = deque
  this.state = this.states.IDLE
  this.pending = []
}

assign(Que.prototype, {
  states: {
    IDLE: 'IDLE',
    DAMMED: 'DAMMED',
    FLUSHING: 'FLUSHING',
  },
  push (value) {
    this.pending.push(value)
    if (this.state === this.states.IDLE) this.flush()
    // TODO should this only be allowed to run once?
    return this.pull.bind(this, value)
  },
  pull (value) {
    return includes(this.pending, value) && (pull(this.pending, value), true)
  },
  dam () {
    if (this.state === this.states.IDLE) this.state = this.states.DAMMED
  },
  flush () {
    if (this.state === this.states.FLUSHING) return
    this.state = this.states.FLUSHING
    try {flushQue.call(this)}
    finally {this.state = this.states.IDLE}
  },
  isEmpty () {
    return !this.pending.length
  },
  clear () {
    this.pending.splice(0)
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
    const prev = this.state
    const next = this.state = mod(prev, ...slice(arguments, 1))
    if (!is(prev, next)) {
      this.que.push(this.notifyWatchers.bind(this, prev, next))
    }
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
})

pub.Deconstructor = Deconstructor
function Deconstructor () {
  if (!(this instanceof Deconstructor)) return new Deconstructor()

  defineProperty(this, 'deconstructor', {
    enumerable: false,
    writable: false,
    value: this.deconstructor.bind(this),
  })
}

defineProperty(Deconstructor.prototype, 'deconstructor', {
  enumerable: false,
  value: function deconstructor () {
    for (const key in this) {
      const value = this[key]
      delete this[key]
      if (isDeconstructible(value)) {
        try {
          value.deconstructor()
        }
        catch (err) {
          deconstructor.call(this)
          throw err
        }
      }
    }
  }
})

// WTB better name
pub.Lifecycler = Lifecycler
function Lifecycler () {
  if (!isImplementation(Lifecycler.prototype, this)) {
    return new Lifecycler()
  }

  bindAll(this)

  this.state = this.states.IDLE
  this.root = null
  this.deinitQue = TaskQue()
  this.deinitQue.dam()
}

assign(Lifecycler.prototype, {
  states: {
    IDLE: 'IDLE',
    INITED: 'INITED',
    INITING: 'INITING',
    ABORTING_INIT: 'ABORTING_INIT',
    DEINITING: 'DEINITING',
  },

  init (root, initer) {
    validateState([this.states.IDLE], this.state)

    validate(isFunction, initer)

    this.state = this.states.INITING

    try {
      this.root = root
      initer(root, this.onDeinit)
      this.state = this.states.INITED
    }
    catch (err) {
      this.state = this.states.ABORTING_INIT
      this.deinit()
      throw err
    }

    return this.root
  },

  reinit (root, reiniter) {
    validate(isFunction, reiniter)
    this.deinit()
    return this.init(root, reiniter)
  },

  deinit (deiniter) {
    validateState([this.states.IDLE, this.states.INITED, this.states.ABORTING_INIT], this.state)

    if (this.state === this.states.IDLE) return

    this.state = this.states.DEINITING

    try {
      // Push before flushing: guaranteed to run if another deiniter throws exception.
      if (isFunction(deiniter)) this.onDeinit(deiniter)
      this.deinitQue.flush()
    }
    finally {
      this.deinitQue.dam()
      this.root = null
      this.state = this.states.IDLE
    }
  },

  onDeinit (deiniter) {
    validate(isFunction, deiniter)
    return this.deinitQue.push(deiniter.bind(null, this.root, this.onDeinit))
  },

  deconstructor () {
    this.deinit()
  },
})

assign(Lifecycler, {
  init () {
    const lifecycler = Lifecycler()
    lifecycler.init(...arguments)
    return lifecycler
  }
})

// WTB better name
pub.FixedLifecycler = FixedLifecycler
function FixedLifecycler ({getRoot, initer, deiniter}) {
  if (!isImplementation(FixedLifecycler.prototype, this)) {
    return new FixedLifecycler(...arguments)
  }

  validate(isFunction, getRoot)
  validate(isFunction, initer)
  validate(isFunction, deiniter)

  Lifecycler.call(this)

  this.getRoot = getRoot
  this.initer = initer
  this.deiniter = deiniter
}

assign(FixedLifecycler.prototype, Lifecycler.prototype, {
  init () {
    const root = this.getRoot(this.root, this.onDeinit)
    if (root) Lifecycler.prototype.init.call(this, root, this.initer)
  },

  reinit () {
    Lifecycler.prototype.reinit.call(this, this.getRoot(this.root, this.onDeinit), this.reiniter)
  },

  deinit () {
    Lifecycler.prototype.deinit.call(this, this.deiniter)
  },

  deconstructor () {
    this.deinit()
    this.getRoot = null
    this.initer = null
    this.deiniter = null
  },
})
