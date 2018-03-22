import * as f from 'fpx'

const {isFrozen} = Object

/**
 * Interfaces
 */

export function isDeinitable(value) {
  return f.isComplex(value) && f.isFunction(value.deinit)
}

export function isOwner(value) {
  return isDeinitable(value) && f.isFunction(value.unown)
}

export function isRef(value) {
  return f.isComplex(value) && f.isFunction(value.deref)
}

// Happens to be a subset of `isObservable`. Potential confusion. How to fix?
export function isSubscription(value) {
  return isDeinitable(value) && f.isFunction(value.trigger)
}

export function isObservable(value) {
  return isDeinitable(value) && f.isFunction(value.subscribe) && f.isFunction(value.unsubscribe)
}

export function isObservableRef(value) {
  return isRef(value) && isObservable(value)
}

export function isAtom(value) {
  return isObservableRef(value) && f.isFunction(value.swap) && f.isFunction(value.reset)
}

export function isAgent(value) {
  return isAtom(value) && isOwner(value)
}

/**
 * Classes
 */

export class Que {
  constructor(deque) {
    f.validate(deque, f.isFunction)
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
    this.pending.splice(0)
  }
}

Que.prototype.states = {
  IDLE: 'IDLE',
  DAMMED: 'DAMMED',
  FLUSHING: 'FLUSHING',
}

export class TaskQue extends Que {
  constructor() {
    super(runTask)
  }

  push(fun) {
    f.validate(fun, f.isFunction)
    super.push(arguments)
    return super.pull.bind(this, arguments)
  }
}

// If args = `[fun, 10, 20, 30]`
// Then result = `fun.call(this, 10, 20, 30)`
function runTask(args) {
  const fun = args[0]
  args[0] = this
  return fun.call.apply(fun, args)
}

export class MessageQue extends TaskQue {
  constructor() {
    super()
    this.subscriptions = []
  }

  push() {
    super.push(triggerSubscriptions, arguments)
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
    f.validate(observable, isObservable)
    f.validate(callback, f.isFunction)
    this.observable = observable
    this.callback = callback
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

Subscription.prototype.states = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
}

export class Observable {
  constructor() {
    this.state = this.states.IDLE
    this.subscriptions = []
    this.que = new Que(triggerSubscriptions.bind(this))
  }

  // override in subclass
  onInit() {}

  // override in subclass
  onDeinit() {}

  subscribe(callback) {
    f.validate(callback, f.isFunction)

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

Observable.prototype.states = {
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
    f.validate(mod, f.isFunction)
    arguments[0] = this.value  // relies on strict mode
    this.reset(mod(...arguments))
  }

  reset(next) {
    const prev = this.value
    this.value = next
    if (!f.is(prev, next)) this.trigger(this)
  }
}

// WTB better name
export class Agent extends Atom {
  reset(next) {
    const prev = this.value
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
    this.nextContext = null
    this.lastContext = null
    this.deref = this.deref.bind(this)
  }

  deref(ref) {
    f.validate(ref, isRef)
    if (this.nextContext && isObservable(ref)) this.nextContext.subscribeTo(ref)
    return ref.deref()
  }

  run(fun, onTrigger) {
    f.validate(fun, f.isFunction)
    f.validate(onTrigger, f.isFunction)

    if (this.nextContext) throw Error(`Unexpected overlapping .run()`)

    this.nextContext = new ReactionContext(this, onTrigger)

    try {
      return fun(this)
    }
    finally {
      const {nextContext, lastContext} = this
      this.lastContext = nextContext
      this.nextContext = null
      if (lastContext) lastContext.deinit()
    }
  }

  loop(fun) {
    f.validate(fun, f.isFunction)
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
        this.nextContext = null
        this.lastContext = null
      }
    }
  }

  static loop(fun) {
    f.validate(fun, f.isFunction)
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
    this.state = this.states.PENDING
    this.reaction = reaction
    this.onTrigger = onTrigger
    this.trigger = this.trigger.bind(this)
    this.subscriptions = []
  }

  subscribeTo(observable) {
    if (this.state === this.states.PENDING) {
      const sub = observable.subscribe(this.trigger)
      f.validate(sub, isSubscription)
      this.subscriptions.push(sub)
    }
  }

  trigger() {
    if (this.state === this.states.PENDING) {
      this.state = this.states.TRIGGERED
      this.onTrigger.call(null, this.reaction)
    }
  }

  deinit() {
    this.state = this.states.DEAD
    flushBy(this.subscriptions, deinit)
  }
}

ReactionContext.prototype.states = {
  PENDING: 'PENDING',
  TRIGGERED: 'TRIGGERED',
  DEAD: 'DEAD',
}

export class Computation extends Observable {
  constructor(def, equal) {
    f.validate(def, f.isFunction)
    f.validate(equal, f.isFunction)
    super()
    this.def = def
    this.equal = equal
    this.reaction = new Reaction()
    this.value = undefined
    this.computationUpdate = computationUpdate.bind(null, this)
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
    f.validate(observableRef, isObservableRef)
    f.validate(query, f.isFunction)
    f.validate(equal, f.isFunction)
    this.observableRef = observableRef
    this.query = query
    this.equal = equal
    this.value = undefined
    this.sub = null
    this.onTrigger = onTrigger.bind(null, this)
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
    this.sub = null
  }
}

function onTrigger(query, observableRef) {
  const prev = query.value
  const next = query.value = query.query(observableRef.deref())
  if (!query.equal(prev, next)) query.trigger(query)
}

export class PathQuery extends Query {
  constructor(observableRef, path, equal) {
    f.validate(path, isPath)
    super(
      observableRef,
      function getAtPath(value) {return f.getIn(value, path)},
      equal
    )
  }
}

function isPath(value) {
  return f.isList(value) && f.every(value, f.isPrimitive)
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
  return f.getIn(deref(ref), path)
}

export const global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

export function isMutable(value) {
  return f.isComplex(value) && !isFrozen(value)
}

export function assign(object) {
  f.validate(object, isMutable)
  for (let i = 0; ++i < arguments.length;) {
    const src = arguments[i]
    if (f.isComplex(src)) for (const key in src) object[key] = src[key]
  }
  return object
}

export function pull(array, value) {
  f.validate(array, f.isArray)
  const index = f.indexOf(array, value)
  if (index !== -1) array.splice(index, 1)
  return array
}

export function each(coll, fun) {
  if (f.isList(coll)) {
    for (let i = -1; ++i < coll.length;) fun(coll[i], i)
  }
  else if (f.isComplex(coll)) {
    for (const key in coll) fun(coll[key], key)
  }
}

// TODO finalise the API, then document
export function forceEach(list, fun, a, b, c) {
  f.validate(list, f.isList)
  f.validate(fun, f.isFunction)

  let error = null
  for (let i = -1; (i += 1) < list.length;) {
    try {fun.call(this, list[i], a, b, c)}
    catch (err) {error = err}
  }
  if (error) throw error
}

// TODO finalise the API, then document
export function flushBy(values, fun, a, b, c) {
  f.validate(fun, f.isFunction)
  f.validate(values, f.isArray)
  f.validate(values, isNonFrozen)
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

function isNonFrozen(value) {
  return !isFrozen(value)
}

/**
 * Utils (internal)
 */

// TODO: can this be made non-recursive for better stack traces?
function deinitDiffAcyclic(prev, next, visitedRefs) {
  if (f.is(prev, next)) return
  if (isDeinitable(prev)) {
    prev.deinit()
    return
  }

  if (f.isObject(prev)) {
    // Don't bother traversing non-plain structures.
    // This allows to safely include third party refs with unknown structure.
    if (!f.isDict(prev) && !f.isArray(prev)) return

    // This skips cyclic references
    if (f.includes(visitedRefs, prev)) return

    visitedRefs.push(prev)
    traverseDiffBy(deinitDiffAcyclic, prev, next, visitedRefs)
  }
}

// Ugly, TODO simplify
function traverseDiffBy(fun, prev, next, visitedRefs) {
  f.validate(fun, f.isFunction)

  if (f.isList(prev)) {
    let error = null
    for (let i = -1; (i += 1) < prev.length;) {
      const prevValue = prev[i]
      if (f.includes(next, prevValue)) continue
      const nextValue = f.isList(next) ? next[i] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
    return
  }

  if (f.isObject(prev)) {
    let error = null
    for (const key in prev) {
      const prevValue = prev[key]
      const nextValue = f.isObject(next) ? next[key] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
  }
}
