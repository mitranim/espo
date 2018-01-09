import {call, getIn, getAt, slice, includes, every, indexOf, pipe,
  is, isList, isArray, isDict, isObject, isFunction, isPrimitive, isComplex,
  validate} from 'fpx'

const {isFrozen} = Object
const {reduce} = Array.prototype

/**
 * Interfaces
 */

export function isDeinitable(value) {
  return isObject(value) && isFunction(value.deinit)
}

export function isOwner(value) {
  return isDeinitable(value) && isFunction(value.unown)
}

export function isRef(value) {
  return isObject(value) && isFunction(value.deref)
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
    this.state = this.states.IDLE
    this.pending = []
    this.deque = deque
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
    super(call)
  }

  push(fun) {
    validate(fun, isFunction)
    const task = fun.bind(this, ...slice(arguments, 1))
    super.push(task)
    return super.pull.bind(this, task)
  }
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
    validate(observable, isObservable)
    validate(callback, isFunction)
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
    validate(mod, isFunction)
    this.reset(mod(this.value, ...slice(arguments, 1)))
  }

  reset(next) {
    const prev = this.value
    this.value = next
    if (!is(prev, next)) this.trigger(this)
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
      this.nextContext = null
      if (lastContext) lastContext.deinit()
    }
  }

  // TODO document
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
        this.nextContext = null
        this.lastContext = null
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
    validate(def, isFunction)
    validate(equal, isFunction)
    super()
    this.def = def
    this.equal = equal
    this.reaction = new Reaction()
    this.value = undefined
  }

  deref() {
    if (this.state === this.states.IDLE) this.value = this.def(this.reaction)
    return this.value
  }

  onInit() {
    this.reaction.loop(computationUpdate.bind(null, this))
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
    this.sub = null
  }

  deref() {
    if (this.state === this.states.IDLE) {
      this.value = this.query(this.observableRef.deref())
    }
    return this.value
  }

  onInit() {
    this.sub = this.observableRef.subscribe(onTrigger.bind(null, this))
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
    validate(path, isPath)
    super(observableRef, pipe(deref, getAt.bind(null, path)), equal)
  }
}

function isPath(value) {
  return isList(value) && every(value, isPrimitive)
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

export const global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

export function isMutable(value) {
  return isComplex(value) && !isFrozen(value)
}

export function assign(object) {
  validate(object, isMutable)
  return reduce.call(arguments, assignOne)
}

function assignOne(object, src) {
  if (src) for (const key in src) object[key] = src[key]
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
    for (let i = -1; ++i < coll.length;) fun(coll[i], i)
  }
  if (isComplex(coll)) {
    for (const key in coll) fun(coll[key], key)
  }
}

// TODO finalise the API, then document
export function forceEach(list, fun, a, b, c) {
  validate(list, isList)
  validate(fun, isFunction)

  let error = null
  for (let i = -1; (i += 1) < list.length;) {
    try {fun.call(this, list[i], a, b, c)}
    catch (err) {error = err}
  }
  if (error) throw error
}

// TODO finalise the API, then document
export function flushBy(values, fun, a, b, c) {
  validate(fun, isFunction)
  validate(values, isArray)
  validate(values, isMutable)
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

function deinitDiffAcyclic(prev, next, visitedRefs) {
  if (is(prev, next)) return
  if (isDeinitable(prev)) {
    prev.deinit()
    return
  }

  if (isObject(prev)) {
    // Don't bother traversing non-plain objects. This allows to safely include
    // third party objects with unknown structure.
    if (!isDict(prev) && !isArray(prev)) return

    // This skips cyclic references
    if (includes(visitedRefs, prev)) return

    visitedRefs.push(prev)
    traverseDiffBy(deinitDiffAcyclic, prev, next, visitedRefs)
  }
}

// Ugly, TODO simplify
function traverseDiffBy(fun, prev, next, visitedRefs) {
  validate(fun, isFunction)

  if (isList(prev)) {
    let error = null
    for (let i = -1; (i += 1) < prev.length;) {
      const prevValue = prev[i]
      if (includes(next, prevValue)) continue
      const nextValue = isList(next) ? next[i] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
    return
  }

  if (isObject(prev)) {
    let error = null
    for (const key in prev) {
      const prevValue = prev[key]
      const nextValue = isObject(next) ? next[key] : undefined
      try {fun(prevValue, nextValue, visitedRefs)}
      catch (err) {error = err}
    }
    if (error) throw error
  }
}
