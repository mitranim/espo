// Note: the code is written with ES5-style classes to avoid Babel garbage
// in the transpiled code. In large methods, `this` is aliased to `self` for
// better minification. Private properties are mangled for the same reason.

// Minifiable aliases
const Object_                   = Object
const NOP                       = Object_.prototype
const create                    = Object_.create
const getOwnPropertyDescriptors = Object_.getOwnPropertyDescriptors
const getPrototypeOf            = Object_.getPrototypeOf
const hasOwnProperty            = NOP.hasOwnProperty
const Array_                    = Array
const NAP                       = Array_.prototype

const global = Function('return this')() // eslint-disable-line no-new-func

/*
Shared between compatible versions of Espo. Used via:
  * `replaceContextSubscribe`
  * `contextSubscribe`
*/
const ESPO_CONTEXT = global.ESPO_CONTEXT || (global.ESPO_CONTEXT = {})

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
  return isDeinitable(value) &&
    isFunction(value.subscribe) &&
    isFunction(value.unsubscribe) &&
    isFunction(value.trigger)
}

// Note: the test `'$' in value` intentionally allows getters and inherited
// properties.
export function isObservableRef(value) {
  return isRef(value) && isObservable(value) && '$' in value
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
const IDLE = 'IDLE'
const PENDING = 'PENDING'
const TRIGGERED = 'TRIGGERED'

export function Subscription(obs, fun) {
  validateInstance(this, Subscription)
  validate(obs, isObservable)
  validate(fun, isFunction)

  this.state = ACTIVE
  this.obs_ = obs
  this.fun_ = fun
}

Subscription.prototype = {
  constructor: Subscription,

  states: {ACTIVE, IDLE},

  trigger() {
    if (this.state === ACTIVE) {
      this.fun_.apply(this, arguments)
    }
  },

  deinit() {
    if (this.state === ACTIVE) {
      this.state = IDLE
      this.obs_.unsubscribe(this)
    }
  },
}

export function Observable() {
  this.state = IDLE
  this.subs_ = []
  this.que_ = []
  this.triggering_ = false
}

const OP = Observable.prototype = {
  constructor: Observable,

  states: {IDLE, ACTIVE},

  // override in subclass
  onInit() {},

  // override in subclass
  onDeinit() {},

  subscribe(fun) {
    validate(fun, isFunction)

    if (this.state === IDLE) {
      this.state = ACTIVE
      this.onInit()
    }

    const sub = new Subscription(this, fun)
    this.subs_.push(sub)
    return sub
  },

  unsubscribe(sub) {
    pull(this.subs_, sub)
    if (this.state === ACTIVE && !this.subs_.length) {
      this.state = IDLE
      this.onDeinit()
    }
  },

  /*
  Technical note: this code used to be much clearer when expressed through
  smaller utilities, but created many junk stackframes. In this implementation,
  code is inlined to create fewer stackframes, which makes debugging much
  easier.

  TODO: as an optimization, we could avoid allocating `self.que_` until there's
  an overlapping trigger.
  */
  trigger() {
    const self = this
    self.que_.push(arguments)
    if (self.triggering_) return
    self.triggering_ = true

    while (self.que_.length) {
      const args = self.que_.shift()
      const subs = self.subs_.slice()
      let err = undefined

      for (let i = 0; i < subs.length; i += 1) {
        const sub = subs[i]
        try {
          sub.trigger.apply(sub, args)
        }
        catch (error) {
          // Errors beyond the first are swallowed. TODO improve?
          if (!err) err = error
        }
      }

      if (err) {
        self.que_.length = 0
        self.triggering_ = false
        throw err
      }
    }

    self.triggering_ = false
  },

  deinit() {
    flushBy(this.subs_, deinit)
  },
}

export function Atom(value) {
  validateInstance(this, Atom)
  Observable.call(this)
  this.value_ = value
}

const AP = Atom.prototype = create(OP, getOwnPropertyDescriptors({
  constructor: Atom,

  get $() {
    contextSubscribe(this)
    return this.deref()
  },

  set $(value) {
    this.reset(value)
  },

  deref() {
    return this.value_
  },

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
    if (is(prev, next)) return
    this.value_ = next
    this.trigger(this)
  },
}))

export function Agent(value) {
  validateInstance(this, Agent)
  Atom.call(this, value)
}

Agent.prototype = create(AP, getOwnPropertyDescriptors({
  constructor: Agent,

  reset(next) {
    const prev = this.value_
    if (is(prev, next)) return
    this.value_ = next
    deinitDiff(prev, next)
    this.trigger(this)
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
  const self = this
  validateInstance(self, Reaction)
  self.state = IDLE
  self.subsPrev_ = undefined
  self.subsNext_ = undefined
}

Reaction.prototype = {
  constructor: Reaction,

  states: {IDLE, ACTIVE, PENDING, TRIGGERED},

  run(fun, onTrigger) {
    validate(fun, isFunction)
    validate(onTrigger, isFunction)
    const self = this

    rejectState(self.state, ACTIVE)
    self.state = ACTIVE

    // The length assertion is not expected to fail in actual use.
    self.subsNext_ = onlyEmptyArray(self.subsNext_)

    const trigger = reactionTrigger.bind(self, onTrigger)
    const subscribe = reactionSubscribe.bind(self, trigger)
    const subscribePrev = replaceContextSubscribe(subscribe)

    try {
      return fun()
    }
    finally {
      const subsPrev = self.subsPrev_
      const subsNext = self.subsNext_
      self.subsPrev_ = subsNext
      self.subsNext_ = subsPrev
      if (subsPrev) flushBy(subsPrev, deinit)
      if (self.state === ACTIVE) self.state = PENDING
      replaceContextSubscribe(subscribePrev)
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
    const self = this

    rejectState(self.state, ACTIVE)
    self.state = IDLE

    if (self.subsPrev_) flushBy(self.subsPrev_, deinit)
    if (self.subsNext_) flushBy(self.subsNext_, deinit)
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

function reactionTrigger(onTrigger) {
  const self = this

  if (self.state === TRIGGERED) {
    return
  }

  if (self.state === PENDING) {
    this.state = TRIGGERED
    onTrigger()
    return
  }

  unexpectedState(self.state)
}

function reactionSubscribe(onTrigger, obs) {
  validate(obs, isObservable)

  const self = this

  if (self.state === ACTIVE) {
    const sub = obs.subscribe(onTrigger)
    self.subsNext_.push(sub)
    return
  }

  unexpectedState(self.state)
}

export function Computation(def, equalFun) {
  const self = this
  validateInstance(self, Computation)
  validate(def, isFunction)
  validate(equalFun, isFunction)

  Observable.call(self)

  self.def_ = def
  self.equalFun_ = equalFun
  self.reaction_ = new Reaction()
  self.value_ = undefined
  self.update_ = computationUpdate.bind(undefined, self)
}

Computation.prototype = create(OP, getOwnPropertyDescriptors({
  constructor: Computation,

  get $() {
    const value = this.deref()
    contextSubscribe(this)
    return value
  },

  deref() {
    if (this.state === IDLE) {
      this.value_ = this.def_(this.reaction_)
    }
    return this.value_
  },

  onInit() {
    this.reaction_.loop(this.update_)
  },

  onDeinit() {
    this.reaction_.deinit()
  },
}))

function computationUpdate(computation, reaction) {
  const prev = computation.value_
  const next = computation.def_(reaction)
  const equalFun = computation.equalFun_
  if (!equalFun(prev, next)) {
    computation.value_ = next
    computation.trigger(computation)
  }
}

export function computation(fun) {
  return new Computation(fun, is)
}

export function Query(ref, queryFun, equalFun) {
  const self = this
  validateInstance(self, Query)
  validate(ref, isObservableRef)
  validate(queryFun, isFunction)
  validate(equalFun, isFunction)

  Observable.call(self)

  self.ref_ = ref
  self.queryFun_ = queryFun
  self.equalFun_ = equalFun
  self.value_ = undefined
  self.sub_ = undefined
  self.onTrigger_ = onQueryTrigger.bind(undefined, self)
}

Query.prototype = create(OP, getOwnPropertyDescriptors({
  constructor: Query,

  get $() {
    if (this.state === IDLE) this.value_ = queryDeref(this)
    contextSubscribe(this)
    return this.value_
  },

  deref() {
    return this.value_
  },

  onInit() {
    this.sub_ = this.ref_.subscribe(this.onTrigger_)
    this.value_ = queryDeref(this)
  },

  onDeinit() {
    this.sub_.deinit()
    this.sub_ = undefined
  },
}))

function onQueryTrigger(query) {
  const prev = query.value_
  const next = queryDeref(query)
  const equalFun = query.equalFun_
  if (!equalFun(prev, next)) {
    query.value_ = next
    query.trigger(query)
  }
}

function queryDeref(query) {
  const queryFun = query.queryFun_
  return queryFun(query.ref_.deref())
}

export function query(ref, queryFun) {
  return new Query(ref, queryFun, is)
}

export function PathQuery(ref, path, equalFun) {
  validateInstance(this, PathQuery)
  validate(ref, isObservableRef)
  validate(path, isPath)
  function getAtPath(value) {return getIn(value, path)}
  Query.call(this, ref, getAtPath, equalFun)
}

PathQuery.prototype = create(Query.prototype, getOwnPropertyDescriptors({
  constructor: PathQuery,
}))

export function pathQuery(ref, path) {
  return new PathQuery(ref, path, is)
}

/**
 * Utils (public)
 */

export function deinit(value) {
  if (isDeinitable(value)) value.deinit()
}

export function deinitDiff(prev, next) {
  deinitDiffAcyclic(prev, next, setNew())
}

// TODO document.
export function deinitDeep(value) {
  deinitDiffAcyclic(value, undefined, setNew())
}

export function unown(value) {
  return isOwner(value) ? value.unown() : undefined
}

export function deref(value) {
  return isRef(value) ? value.deref() : value
}

export function derefDeep(value) {
  while (isRef(value)) {
    const val = value.deref()
    if (val === value) return val
    value = val
  }
  return value
}

export function derefIn(ref, path) {
  return getIn(derefDeep(ref), path)
}

export function scan(value) {
  const path = NAP.slice.call(arguments, 1)

  if (ESPO_CONTEXT.subscribe && isObservableRef(value)) {
    return pathQuery(value, path).$
  }

  return derefIn(value, path)
}

// TODO document.
export function flushBy(values, fun, a, b, c) {
  validate(fun, isFunction)
  validate(values, isQue)
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

export function contextSubscribe(obs) {
  validate(obs, isObservable)
  const subscribe = ESPO_CONTEXT.subscribe
  if (subscribe) subscribe(obs)
}

/*
Missing feature: it would be useful to validate that the value of
`.subscribe` that we're replacing is exactly the value that was set in the
last `replaceContextSubscribe` call. This would catch errors such as some
library code setting its callback and forgetting to unset it. One possible
scenario is when the unset code is not placed in a `finally` clause, and an
exception prevents it from running.
*/
export function replaceContextSubscribe(subscribe) {
  if (subscribe) validate(subscribe, isFunction)
  const prev = ESPO_CONTEXT.subscribe
  ESPO_CONTEXT.subscribe = subscribe
  return prev
}

export function withContextSubscribe(subscribe, fun) {
  if (subscribe) validate(subscribe, isFunction)
  validate(fun, isFunction)
  const prev = ESPO_CONTEXT.subscribe
  ESPO_CONTEXT.subscribe = subscribe
  try {return fun()}
  finally {ESPO_CONTEXT.subscribe = prev}
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

function pull(array, value) {
  validate(array, isArray)
  const index = indexOf(array, value)
  if (index !== -1) array.splice(index, 1)
  return array
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
  const proto = getPrototypeOf(value)
  return proto === null || proto === NOP
}

function isArray(value) {
  return isInstance(value, Array_)
}

function isList(value) {
  return isObject(value) && (
    isArray(value) || (
      isNatural(value.length) &&
      (!isDict(value) || hasOwnProperty.call(value, 'callee'))
    )
  )
}

function isQue(value) {
  return isObject(value) &&
    isNatural(value.length) &&
    isFunction(value.push) &&
    isFunction(value.shift)
}

function isPath(value) {
  return isList(value) && NAP.every.call(value, isPrimitive)
}

function validate(value, test) {
  if (!test(value)) throw Error(`expected ${show(value)} to satisfy test ${show(test)}`)
}

function validateInstance(value, Class) {
  if (!isInstance(value, Class)) {
    throw Error(`expected ${show(value)} to be an instance of ${show(Class)}`)
  }
}

function rejectState(actual, unwanted) {
  if (actual === unwanted) unexpectedState(actual)
}

function unexpectedState(state) {
  throw Error(`unexpected state ${show(state)}`)
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

function onlyEmptyArray(value) {
  if (value == null) return []
  validate(value, isArray)
  if (value.length) throw Error(`expected empty array`)
  return value
}
