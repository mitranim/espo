const Object_ = Object
const OP      = Object_.prototype
const Array_  = Array
const AP      = Array_.prototype

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

export class Que {
  constructor(deque) {
    validate(deque, isFunction)
    this.states = queStates
    this.state = this.states.IDLE
    this.deque = deque
    this.pending = []
  }

  push(value) {
    this.pending.push(value)
    if (this.state === this.states.IDLE) this.flush()
  }

  pull(value) {
    pull(this.pending, value)
  }

  dam() {
    if (this.state === this.states.IDLE) this.state = this.states.DAMMED
  }

  flush() {
    if (this.state === this.states.FLUSHING) return
    this.state = this.states.FLUSHING
    try {flushBy.call(this, this.pending, this.deque)}
    finally {this.state = this.states.IDLE}
  }

  isEmpty() {
    return !this.pending.length
  }

  isDammed() {
    return this.state === this.states.DAMMED
  }

  deinit() {
    this.pending.length = 0
  }
}

const queStates = {
  IDLE: 'IDLE',
  DAMMED: 'DAMMED',
  FLUSHING: 'FLUSHING',
}

export class TaskQue extends Que {
  constructor() {
    super(runTask)
  }

  push(fun) {
    validate(fun, isFunction)
    super.push(arguments)
    return super.pull.bind(this, arguments)
  }
}

// if args = `[fun, 10, 20, 30]`
// then result = `fun.call(this, 10, 20, 30)`
function runTask(args) {
  const fun = args[0]
  args[0] = this
  return fun.call.apply(fun, args)
}

export class MessageQue extends Que {
  constructor() {
    super(triggerSubscriptions)
    this.subscriptions = []
  }

  push() {
    super.push(arguments)
  }

  subscribe(callback) {
    const sub = new Subscription(this, callback)
    this.subscriptions.push(sub)
    return sub
  }

  unsubscribe(sub) {
    pull(this.subscriptions, sub)
  }

  deinit() {
    super.deinit()
    flushBy(this.subscriptions, deinit)
  }
}

export class Subscription {
  constructor(observable, callback) {
    validate(observable, isObservable)
    validate(callback, isFunction)
    this.observable = observable
    this.callback = callback
    this.states = subscriptionStates
    this.state = this.states.ACTIVE
  }

  trigger() {
    if (this.state === this.states.ACTIVE) {
      this.callback(...arguments)
    }
  }

  deinit() {
    if (this.state === this.states.ACTIVE) {
      this.state = this.states.IDLE
      this.observable.unsubscribe(this)
    }
  }
}

const subscriptionStates = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
}

export class Observable {
  constructor() {
    this.states = observableStates
    this.state = this.states.IDLE
    this.subscriptions = []
    this.que = new Que(triggerSubscriptions.bind(this))
  }

  // override in subclass
  onInit() {}

  // override in subclass
  onDeinit() {}

  subscribe(callback) {
    validate(callback, isFunction)

    if (this.state === this.states.IDLE) {
      this.state = this.states.ACTIVE
      this.onInit()
    }

    const sub = new Subscription(this, callback)
    this.subscriptions.push(sub)
    return sub
  }

  unsubscribe(sub) {
    pull(this.subscriptions, sub)
    if (this.state === this.states.ACTIVE && !this.subscriptions.length) {
      this.state = this.states.IDLE
      this.onDeinit()
    }
  }

  trigger() {
    this.que.push(arguments)
  }

  deinit() {
    flushBy(this.subscriptions, deinit)
  }
}

const observableStates = {
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
}

function triggerSubscriptions(args) {
  forceEach(this.subscriptions.slice(), triggerSubscription, args)
}

function triggerSubscription(subscription, args) {
  subscription.trigger(...args)
}

export class Atom extends Observable {
  constructor(value) {
    super()
    this.value = value
  }

  deref() {
    return this.value
  }

  swap(mod) {
    validate(mod, isFunction)
    // relies on strict mode
    arguments[0] = this.deref()
    this.reset(mod(...arguments))
  }

  reset(next) {
    const prev = this.value
    this.value = next
    if (!is(prev, next)) this.trigger(this)
  }
}

export class Agent extends Atom {
  reset(next) {
    const prev = this.deref()
    try {super.reset(next)}
    finally {deinitDiff(prev, next)}
  }

  unown() {
    const {value} = this
    this.value = undefined
    try {
      this.trigger(this)
      return value
    }
    catch (err) {
      deinitDiff(value)
      throw err
    }
  }

  deinit() {
    try {super.deinit()}
    finally {this.reset(undefined)}
  }
}

export class Reaction {
  constructor() {
    this.nextContext = undefined
    this.lastContext = undefined
    this.deref = this.deref.bind(this)
  }

  deref(ref) {
    validate(ref, isRef)
    if (this.nextContext && isObservable(ref)) this.nextContext.subscribeTo(ref)
    return ref.deref()
  }

  run(fun, onTrigger) {
    validate(fun, isFunction)
    validate(onTrigger, isFunction)

    if (this.nextContext) throw Error(`Unexpected overlapping .run()`)

    this.nextContext = new ReactionContext(this, onTrigger)

    try {
      return fun(this)
    }
    finally {
      const {nextContext, lastContext} = this
      this.lastContext = nextContext
      this.nextContext = undefined
      if (lastContext) lastContext.deinit()
    }
  }

  loop(fun) {
    validate(fun, isFunction)
    const loop = () => {
      this.run(fun, loop)
    }
    loop()
  }

  deinit() {
    const {nextContext, lastContext} = this
    try {
      if (nextContext) nextContext.deinit()
    }
    finally {
      try {
        if (lastContext) lastContext.deinit()
      }
      finally {
        this.nextContext = undefined
        this.lastContext = undefined
      }
    }
  }

  static loop(fun) {
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
}

class ReactionContext {
  constructor(reaction, onTrigger) {
    this.states = reactionContextStates
    this.state = this.states.PENDING
    this.reaction = reaction
    this.onTrigger = onTrigger
    this.trigger = this.trigger.bind(this)
    this.subscriptions = []
  }

  subscribeTo(observable) {
    if (this.state === this.states.PENDING) {
      const sub = observable.subscribe(this.trigger)
      validate(sub, isSubscription)
      this.subscriptions.push(sub)
    }
  }

  trigger() {
    if (this.state === this.states.PENDING) {
      this.state = this.states.TRIGGERED
      this.onTrigger.call(undefined, this.reaction)
    }
  }

  deinit() {
    this.state = this.states.DEAD
    flushBy(this.subscriptions, deinit)
  }
}

const reactionContextStates = {
  PENDING: 'PENDING',
  TRIGGERED: 'TRIGGERED',
  DEAD: 'DEAD',
}

export class Computation extends Observable {
  constructor(def, equal) {
    validate(def, isFunction)
    validate(equal, isFunction)
    super()
    this.def = def
    this.equal = equal
    this.reaction = new Reaction()
    this.value = undefined
    this.computationUpdate = computationUpdate.bind(undefined, this)
  }

  deref() {
    if (this.state === this.states.IDLE) this.value = this.def(this.reaction)
    return this.value
  }

  onInit() {
    this.reaction.loop(this.computationUpdate)
  }

  onDeinit() {
    this.reaction.deinit()
  }
}

function computationUpdate(computation, reaction) {
  const prev = computation.value
  const next = computation.value = computation.def(reaction)
  if (!computation.equal(prev, next)) computation.trigger(computation)
}

export class Query extends Observable {
  constructor(observableRef, query, equal) {
    super()
    validate(observableRef, isObservableRef)
    validate(query, isFunction)
    validate(equal, isFunction)
    this.observableRef = observableRef
    this.query = query
    this.equal = equal
    this.value = undefined
    this.sub = undefined
    this.onTrigger = onTrigger.bind(undefined, this)
  }

  deref() {
    if (this.state === this.states.IDLE) {
      this.value = this.query(this.observableRef.deref())
    }
    return this.value
  }

  onInit() {
    this.sub = this.observableRef.subscribe(this.onTrigger)
    this.value = this.query(this.observableRef.deref())
  }

  onDeinit() {
    this.sub.deinit()
    this.sub = undefined
  }
}

function onTrigger(query, observableRef) {
  const prev = query.value
  const next = query.value = query.query(observableRef.deref())
  if (!query.equal(prev, next)) query.trigger(query)
}

export class PathQuery extends Query {
  constructor(observableRef, path, equal) {
    validate(path, isPath)
    super(
      observableRef,
      function getAtPath(value) {return getIn(value, path)},
      equal
    )
  }
}

/**
 * Utils (public)
 */

export function deinit(value) {
  if (isDeinitable(value)) value.deinit()
}

export function deinitDiff(prev, next) {
  deinitDiffAcyclic(prev, next, [])
}

// TODO document
export function deinitDeep(value) {
  deinitDiffAcyclic(value, undefined, [])
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

/**
 * Utils (internal)
 */

// TODO: can this be made non-recursive for better stack traces?
function deinitDiffAcyclic(prev, next, visitedRefs) {
  if (is(prev, next)) return

  if (isDeinitable(prev)) {
    prev.deinit()
    return
  }

  // Don't bother traversing non-plain structures.
  // This allows to safely include third party refs with unknown structure.
  if (!isArray(prev) && !isDict(prev)) return

  // This skips cyclic references
  if (includes(visitedRefs, prev)) return

  visitedRefs.push(prev)
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
  return isObject(value) && isPlainPrototype(Object_.getPrototypeOf(value))
}

function isPlainPrototype(value) {
  return value === null || value === OP
}

function isArray(value) {
  return isInstance(value, Array_)
}

// Could be made much faster in V8 by retrieving the prototype before checking
// any properties. Should check other engines before making such "weird"
// optimizations.
function isList(value) {
  return isObject(value) && isNatural(value.length) && (
    !isPlainPrototype(Object_.getPrototypeOf(value)) ||
    OP.hasOwnProperty.call(value, 'callee')
  )
}

function isPath(value) {
  return isList(value) && AP.every.call(value, isPrimitive)
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
