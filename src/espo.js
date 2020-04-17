// Note: the code is written with ES5-style classes to avoid Babel garbage
// in the transpiled code. In large methods, `this` is aliased to `self` for
// better minification. Private properties are mangled for the same reason.

// Minifiable aliases
const Object_     = Object
const NOP         = Object_.prototype
const create      = Object_.create
const descriptors = Object_.getOwnPropertyDescriptors
const Array_      = Array
const NAP         = Array_.prototype

/**
 * Interfaces
 */

export function isDeinitable(value) {
  return isComplex(value) && isFunction(value.deinit)
}

export function isOwner(value) {
  return isDeinitable(value) && isFunction(value.unown)
}

export function isRef(value) {
  return isComplex(value) && isFunction(value.deref)
}

// Happens to be a subset of `isObservable`. Potential confusion. How to fix?
export function isSubscription(value) {
  return isDeinitable(value) && isFunction(value.trigger)
}

export function isObservable(value) {
  return isDeinitable(value) && isFunction(value.subscribe) && isFunction(value.unsubscribe)
}

export function isObservableRef(value) {
  return isRef(value) && isObservable(value)
}

export function isAtom(value) {
  return isObservableRef(value) && isFunction(value.swap) && isFunction(value.reset)
}

export function isAgent(value) {
  return isAtom(value) && isOwner(value)
}

/**
 * Classes
 */

const ACTIVE = 'ACTIVE'
const DAMMED = 'DAMMED'
const DEAD = 'DEAD'
const FLUSHING = 'FLUSHING'
const IDLE = 'IDLE'
const PENDING = 'PENDING'
const TRIGGERED = 'TRIGGERED'


export function Que(deque) {
  validateInstance(this, Que)
  validate(deque, isFunction)
  this.state = IDLE
  this.deque_ = deque
  this.pending_ = []
}

const QP = Que.prototype = {
  constructor: Que,

  states: {
    IDLE,
    DAMMED,
    FLUSHING,
  },

  push(value) {
    this.pending_.push(value)
    if (this.state === IDLE) this.flush()
  },

  // Hazardous. Questionable.
  pull(value) {
    pull(this.pending_, value)
  },

  // Hazardous. Questionable.
  has(value) {
    return includes(this.pending_, value)
  },

  dam() {
    if (this.state === IDLE) this.state = DAMMED
  },

  flush() {
    if (this.state === FLUSHING) return
    this.state = FLUSHING
    try {flushBy.call(this, this.pending_, this.deque_)}
    finally {this.state = IDLE}
  },

  isEmpty() {
    return !this.pending_.length
  },

  isDammed() {
    return this.state === DAMMED
  },

  deinit() {
    this.pending_.length = 0
  },
}


export function TaskQue() {
  validateInstance(this, TaskQue)
  Que.call(this, runTask)
}

TaskQue.prototype = create(QP, descriptors({
  constructor: TaskQue,

  push(fun) {
    validate(fun, isFunction)
    QP.push.call(this, arguments)
    return QP.pull.bind(this, arguments)
  },
}))

// if args = `[fun, 10, 20, 30]`
// then result = `fun.call(this, 10, 20, 30)`
function runTask(args) {
  const fun = args[0]
  args[0] = this
  return fun.call.apply(fun, args)
}


export function MessageQue() {
  validateInstance(this, MessageQue)
  Que.call(this, triggerSubscriptions)
  this.subscriptions_ = []
}

MessageQue.prototype = create(QP, descriptors({
  constructor: MessageQue,

  push() {
    QP.push.call(this, arguments)
  },

  subscribe(callback) {
    const sub = new Subscription(this, callback)
    this.subscriptions_.push(sub)
    return sub
  },

  unsubscribe(sub) {
    pull(this.subscriptions_, sub)
  },

  deinit() {
    QP.deinit.call(this)
    flushBy(this.subscriptions_, deinit)
  },
}))


export function Subscription(observable, callback) {
  validateInstance(this, Subscription)
  validate(observable, isObservable)
  validate(callback, isFunction)
  this.state = ACTIVE
  this.observable_ = observable
  this.callback_ = callback
}

Subscription.prototype = {
  constructor: Subscription,

  states: {
    ACTIVE,
    IDLE,
  },

  trigger() {
    if (this.state === ACTIVE) {
      this.callback_.apply(this, arguments)
    }
  },

  deinit() {
    if (this.state === ACTIVE) {
      this.state = IDLE
      this.observable_.unsubscribe(this)
    }
  },
}


export function Observable() {
  this.state = IDLE
  this.subscriptions_ = []
  this.que_ = new Que(triggerSubscriptions.bind(this))
}

const OP = Observable.prototype = {
  constructor: Observable,

  states: {
    IDLE,
    ACTIVE,
  },

  // override in subclass
  onInit() {},

  // override in subclass
  onDeinit() {},

  subscribe(callback) {
    validate(callback, isFunction)

    if (this.state === IDLE) {
      this.state = ACTIVE
      this.onInit()
    }

    const sub = new Subscription(this, callback)
    this.subscriptions_.push(sub)
    return sub
  },

  unsubscribe(sub) {
    pull(this.subscriptions_, sub)
    if (this.state === ACTIVE && !this.subscriptions_.length) {
      this.state = IDLE
      this.onDeinit()
    }
  },

  trigger() {
    this.que_.push(arguments)
  },

  deinit() {
    flushBy(this.subscriptions_, deinit)
  },
}

function triggerSubscriptions(args) {
  forceEach(this.subscriptions_.slice(), triggerSubscription, args)
}

function triggerSubscription(subscription, args) {
  subscription.trigger.apply(subscription, args)
}


export function Atom(value) {
  validateInstance(this, Atom)
  Observable.call(this)
  this.value_ = value
}

const AP = Atom.prototype = create(OP, descriptors({
  constructor: Atom,

  get $() {return this.deref()},

  deref() {return this.value_},

  // The arguments trick relies on strict mode to be correct and on engine
  // nuances to be fast. At the time of writing, this must use `.apply` rather
  // than native spread to avoid a massive slowdown in V8.
  swap(fun) {
    validate(fun, isFunction)
    arguments[0] = this.deref()
    this.reset(fun.apply(undefined, arguments))
  },

  reset(next) {
    const prev = this.value_
    this.value_ = next
    if (!is(prev, next)) this.trigger(this)
  },
}))


export function Agent(value) {
  validateInstance(this, Agent)
  Atom.call(this, value)
}

Agent.prototype = create(AP, descriptors({
  constructor: Agent,

  reset(next) {
    const prev = this.deref()
    try {AP.reset.call(this, next)}
    finally {deinitDiff(prev, next)}
  },

  unown() {
    const value = this.value_
    this.value_ = undefined
    try {
      this.trigger(this)
      return value
    }
    catch (err) {
      deinitDiff(value)
      throw err
    }
  },

  deinit() {
    try {AP.deinit.call(this)}
    finally {deinitDeep(this.value_)}
  },
}))


export function Reaction() {
  validateInstance(this, Reaction)
  this.nextContext_ = undefined
  this.lastContext_ = undefined
  this.deref = this.$ = this.deref.bind(this)
}

Reaction.prototype = {
  constructor: Reaction,

  deref(ref) {
    validate(ref, isRef)
    if (this.nextContext_ && isObservable(ref)) this.nextContext_.subscribeTo(ref)
    return ref.deref()
  },

  run(fun, onTrigger) {
    validate(fun, isFunction)
    validate(onTrigger, isFunction)

    if (this.nextContext_) throw Error(`Unexpected overlapping .run()`)

    this.nextContext_ = new ReactionContext(this, onTrigger)

    try {
      return fun(this)
    }
    finally {
      const nextContext = this.nextContext_
      const lastContext = this.lastContext_
      this.lastContext_ = nextContext
      this.nextContext_ = undefined
      if (lastContext) lastContext.deinit()
    }
  },

  loop(fun) {
    validate(fun, isFunction)
    const self = this
    function reactionLoop() {
      self.run(fun, reactionLoop)
    }
    reactionLoop()
  },

  deinit() {
    const nextContext = this.nextContext_
    const lastContext = this.lastContext_
    try {
      if (nextContext) nextContext.deinit()
    }
    finally {
      try {
        if (lastContext) lastContext.deinit()
      }
      finally {
        this.nextContext_ = undefined
        this.lastContext_ = undefined
      }
    }
  },
}

Reaction.loop = function loop(fun) {
  validate(fun, isFunction)
  const reaction = new this()
  try {
    reaction.loop(fun)
    return reaction
  }
  catch (err) {
    reaction.deinit()
    throw err
  }
}


function ReactionContext(reaction, onTrigger) {
  const self = this
  validateInstance(self, ReactionContext)
  self.state = PENDING
  self.reaction_ = reaction
  self.onTrigger_ = onTrigger
  self.trigger_ = self.trigger.bind(self)
  self.subscriptions_ = []
}

ReactionContext.prototype = {
  constructor: ReactionContext,

  states: {
    PENDING,
    TRIGGERED,
    DEAD,
  },

  subscribeTo(observable) {
    if (this.state === PENDING) {
      const sub = observable.subscribe(this.trigger_)
      validate(sub, isSubscription)
      this.subscriptions_.push(sub)
    }
  },

  trigger() {
    if (this.state === PENDING) {
      this.state = TRIGGERED
      this.onTrigger_.call(undefined, this.reaction_)
    }
  },

  deinit() {
    this.state = DEAD
    flushBy(this.subscriptions_, deinit)
  },
}


export function Computation(def, equal) {
  const self = this
  validateInstance(self, Computation)
  validate(def, isFunction)
  validate(equal, isFunction)
  Observable.call(self)
  self.def_ = def
  self.equal_ = equal
  self.reaction_ = new Reaction()
  self.value_ = undefined
  self.computationUpdate_ = computationUpdate.bind(undefined, self)
}

Computation.prototype = create(OP, descriptors({
  constructor: Computation,

  get $() {return this.deref()},

  deref() {
    if (this.state === IDLE) {
      const def = this.def_
      this.value_ = def(this.reaction_)
    }
    return this.value_
  },

  onInit() {
    this.reaction_.loop(this.computationUpdate_)
  },

  onDeinit() {
    this.reaction_.deinit()
  },
}))


function computationUpdate(computation, reaction) {
  const def = computation.def_
  const prev = computation.value_
  const next = computation.value_ = def(reaction)
  if (!computation.equal_(prev, next)) computation.trigger(computation)
}


export function Query(observableRef, query, equal) {
  const self = this
  validateInstance(self, Query)
  validate(observableRef, isObservableRef)
  validate(query, isFunction)
  validate(equal, isFunction)
  Observable.call(self)
  self.observableRef_ = observableRef
  self.query_ = query
  self.equal_ = equal
  self.value_ = undefined
  self.sub_ = undefined
  self.onTrigger_ = onQueryTrigger.bind(undefined, self)
}

Query.prototype = create(OP, descriptors({
  constructor: Query,

  get $() {return this.deref()},

  deref() {
    if (this.state === IDLE) this.value_ = queryDeref(this)
    return this.value_
  },

  onInit() {
    this.sub_ = this.observableRef_.subscribe(this.onTrigger_)
    this.value_ = queryDeref(this)
  },

  onDeinit() {
    this.sub_.deinit()
    this.sub_ = undefined
  },
}))

function onQueryTrigger(query) {
  const prev = query.value_
  const next = query.value_ = queryDeref(query)
  if (!query.equal_(prev, next)) query.trigger(query)
}

function queryDeref(query) {
  const fun = query.query_
  return fun(query.observableRef_.deref())
}

export function PathQuery(observableRef, path, equal) {
  validateInstance(this, PathQuery)
  validate(path, isPath)
  function getAtPath(value) {return getIn(value, path)}
  Query.call(this, observableRef, getAtPath, equal)
}

PathQuery.prototype = create(Query.prototype, descriptors({constructor: PathQuery}))

/**
 * Utils (public)
 */

export function deinit(value) {
  if (isDeinitable(value)) value.deinit()
}

export function deinitDiff(prev, next) {
  deinitDiffAcyclic(prev, next, setNew())
}

// TODO document
export function deinitDeep(value) {
  deinitDiffAcyclic(value, undefined, setNew())
}

export function unown(value) {
  return isOwner(value) ? value.unown() : undefined
}

export function deref(ref) {
  if (isRef(ref)) {
    const value = ref.deref()
    return value === ref ? value : deref(value)
  }
  return ref
}

export function derefIn(ref, path) {
  return getIn(deref(ref), path)
}

// The "pure" annotation is for UglifyJS.
export const global = /* #__PURE__ */Function('return this')()  // eslint-disable-line

export function isMutable(value) {
  return isComplex(value) && !Object_.isFrozen(value)
}

export function assign(object) {
  validate(object, isMutable)
  for (let i = 0; ++i < arguments.length;) {
    const src = arguments[i]
    if (isComplex(src)) for (const key in src) object[key] = src[key]
  }
  return object
}

export function pull(array, value) {
  validate(array, isArray)
  const index = indexOf(array, value)
  if (index !== -1) array.splice(index, 1)
  return array
}

export function each(coll, fun) {
  if (isList(coll)) {
    for (let i = 0; i < coll.length; i += 1) fun(coll[i], i)
  }
  else if (isComplex(coll)) {
    for (const key in coll) fun(coll[key], key)
  }
}

// TODO finalize the API, then document
export function forceEach(list, fun, a, b, c) {
  validate(list, isList)
  validate(fun, isFunction)

  let error = undefined
  for (let i = 0; i < list.length; i += 1) {
    try {fun.call(this, list[i], a, b, c)}
    catch (err) {error = err}
  }
  if (error) throw error
}

// TODO finalize the API, then document
export function flushBy(values, fun, a, b, c) {
  validate(fun, isFunction)
  validate(values, isArray)
  try {
    while (values.length) {
      fun.call(this, values.shift(), a, b, c)
    }
  }
  catch (err) {
    flushBy.call(this, values, fun, a, b, c)
    throw err
  }
}

// Undocumented
export function validateInstance(value, Class) {
  if (!isInstance(value, Class)) {
    throw Error(`Expected ${show(value)} to be an instance of ${show(Class)}`)
  }
}

/**
 * Internal
 */

// TODO: can this be made non-recursive for better stack traces?
function deinitDiffAcyclic(prev, next, visitedRefs) {
  if (is(prev, next)) return

  if (isDeinitable(prev)) {
    prev.deinit()
    return
  }

  // Don't bother traversing non-plain structures.
  // This allows to safely include third party objects with unknown structure.
  if (!isArray(prev) && !isDict(prev)) return

  // This avoids cyclic references.
  if (setHas(visitedRefs, prev)) return

  setAdd(visitedRefs, prev)
  diffAndDeinit(prev, next, visitedRefs)
}

// Ugly code is inlined to create fewer stackframes. Depending on the data
// layout, these functions tend to recur pretty deeply. More stackframes are
// annoying when profiling or debugging.
function diffAndDeinit(prev, next, visitedRefs) {
  if (isArray(prev)) {
    const isNextArray = isArray(next)
    let error = undefined
    for (let i = 0; i < prev.length; i += 1) {
      const prevValue = prev[i]
      if (isNextArray && includes(next, prevValue)) continue
      const nextValue = isNextArray ? next[i] : undefined
      try {deinitDiffAcyclic(prev[i], nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
    return
  }

  // Assume `isDict(prev)`.
  const isNextDict = isDict(next)
  let error = undefined
  for (const key in prev) {
    const nextValue = isNextDict ? next[key] : undefined
    try {deinitDiffAcyclic(prev[key], nextValue, visitedRefs)}
    catch (err) {error = err}
  }
  if (error) throw error
}

/*
Store visited refs in a set where possible, falling back on a list. For large
structures, a list becomes our bottleneck; a set is MUCH faster.
*/
let setNew = undefined
let setAdd = undefined
let setHas = undefined
if (typeof Set === 'function') {
  setNew = function setNew() {return new Set()} // eslint-disable-line no-undef
  setAdd = function setAdd(set, val) {set.add(val)}
  setHas = function setHas(set, val) {return set.has(val)}
}
else {
  setNew = function setNew() {return []}
  setAdd = function setAdd(set, val) {set.push(val)}
  setHas = function setHas(set, val) {return includes(set, val)}
}

function get(value, key) {
  return value == null ? undefined : value[key]
}

function getIn(value, path) {
  validate(path, isList)
  for (let i = 0; i < path.length; i += 1) value = get(value, path[i])
  return value
}

function includes(list, value) {
  return indexOf(list, value) !== -1
}

function indexOf(list, value) {
  for (let i = 0; i < list.length; i += 1) if (is(list[i], value)) return i
  return -1
}

function is(one, other) {
  return one === other || (isNaN(one) && isNaN(other))
}

function isNaN(value) {
  return value !== value  // eslint-disable-line no-self-compare
}

function isNatural(value) {
  return typeof value === 'number' && ((value % 1) === 0) && value >= 0
}

function isPrimitive(value) {
  return !isComplex(value)
}

function isComplex(value) {
  return isObject(value) || isFunction(value)
}

function isInstance(value, Class) {
  return isComplex(value) && value instanceof Class
}

function isFunction(value) {
  return typeof value === 'function'
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function isDict(value) {
  if (!isObject(value)) return false
  const proto = Object_.getPrototypeOf(value)
  return proto === null || proto === NOP
}

function isArray(value) {
  return isInstance(value, Array_)
}

function isList(value) {
  return isObject(value) && (
    isArray(value) || (
      isNatural(value.length) &&
      (!isDict(value) || NOP.hasOwnProperty.call(value, 'callee'))
    )
  )
}

function isPath(value) {
  return isList(value) && NAP.every.call(value, isPrimitive)
}

function validate(value, test) {
  if (!test(value)) throw Error(`Expected ${show(value)} to satisfy test ${show(test)}`)
}

function show(value) {
  return (
    isFunction(value) && value.name
    ? value.name
    : isArray(value) || isDict(value)
    ? JSON.stringify(value)
    : String(value)
  )
}
