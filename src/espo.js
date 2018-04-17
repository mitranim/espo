// Minifiable aliases
const Object_ = Object
const NOP     = Object_.prototype
const create  = Object_.create
const Array_  = Array
const NAP     = Array_.prototype

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

const derefGetter = {$: {get() {return this.deref()}, configurable: true}}

export function Que(deque) {
  validateInstance(this, Que)
  validate(deque, isFunction)
  this.state = IDLE
  this.deque_ = deque
  this.pending_ = []
}

const QP = Que.prototype

QP.states = {
  IDLE,
  DAMMED,
  FLUSHING,
}

QP.push = function push(value) {
  this.pending_.push(value)
  if (this.state === IDLE) this.flush()
}

// Hazardous. Questionable.
QP.pull = function pull_(value) {
  pull(this.pending_, value)
}

// Hazardous. Questionable.
QP.has = function has(value) {
  return includes(this.pending_, value)
}

QP.dam = function dam() {
  if (this.state === IDLE) this.state = DAMMED
}

QP.flush = function flush() {
  if (this.state === FLUSHING) return
  this.state = FLUSHING
  try {flushBy.call(this, this.pending_, this.deque_)}
  finally {this.state = IDLE}
}

QP.isEmpty = function isEmpty() {
  return !this.pending_.length
}

QP.isDammed = function isDammed() {
  return this.state === DAMMED
}

QP.deinit = function deinit_() {
  this.pending_.length = 0
}

export function TaskQue() {
  validateInstance(this, TaskQue)
  Que.call(this, runTask)
}

const TQP = TaskQue.prototype = create(QP)

TQP.push = function push(fun) {
  validate(fun, isFunction)
  QP.push.call(this, arguments)
  return QP.pull.bind(this, arguments)
}

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

const MQP = MessageQue.prototype = create(QP)

MQP.push = function push() {
  QP.push.call(this, arguments)
}

MQP.subscribe = function subscribe(callback) {
  const sub = new Subscription(this, callback)
  this.subscriptions_.push(sub)
  return sub
}

MQP.unsubscribe = function unsubscribe(sub) {
  pull(this.subscriptions_, sub)
}

MQP.deinit = function deinit_() {
  QP.deinit.call(this)
  flushBy(this.subscriptions_, deinit)
}

export function Subscription(observable, callback) {
  validateInstance(this, Subscription)
  validate(observable, isObservable)
  validate(callback, isFunction)
  this.state = ACTIVE
  this.observable_ = observable
  this.callback_ = callback
}

const SP = Subscription.prototype

SP.states = {
  ACTIVE,
  IDLE,
}

SP.trigger = function trigger() {
  if (this.state === ACTIVE) {
    this.callback_.apply(this, arguments)
  }
}

SP.deinit = function deinit_() {
  if (this.state === ACTIVE) {
    this.state = IDLE
    this.observable_.unsubscribe(this)
  }
}

export function Observable() {
  this.state = IDLE
  this.subscriptions_ = []
  this.que_ = new Que(triggerSubscriptions.bind(this))
}

const OP = Observable.prototype

OP.states = {
  IDLE,
  ACTIVE,
}

// override in subclass
OP.onInit = function onInit() {}

// override in subclass
OP.onDeinit = function onDeinit() {}

OP.subscribe = function subscribe(callback) {
  validate(callback, isFunction)

  if (this.state === IDLE) {
    this.state = ACTIVE
    this.onInit()
  }

  const sub = new Subscription(this, callback)
  this.subscriptions_.push(sub)
  return sub
}

OP.unsubscribe = function unsubscribe(sub) {
  pull(this.subscriptions_, sub)
  if (this.state === ACTIVE && !this.subscriptions_.length) {
    this.state = IDLE
    this.onDeinit()
  }
}

OP.trigger = function trigger() {
  this.que_.push(arguments)
}

OP.deinit = function deinit_() {
  flushBy(this.subscriptions_, deinit)
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

const AP = Atom.prototype = create(OP, derefGetter)

AP.deref = function deref_() {
  return this.value_
}

AP.swap = function swap(mod) {
  validate(mod, isFunction)
  // relies on strict mode
  arguments[0] = this.deref()
  this.reset(mod.apply(undefined, arguments))
}

AP.reset = function reset(next) {
  const prev = this.value_
  this.value_ = next
  if (!is(prev, next)) this.trigger(this)
}

export function Agent(value) {
  validateInstance(this, Agent)
  Atom.call(this, value)
}

const AGP = Agent.prototype = create(AP)

AGP.reset = function reset(next) {
  const prev = this.deref()
  try {AP.reset.call(this, next)}
  finally {deinitDiff(prev, next)}
}

AGP.unown = function unown_() {
  const {value} = this
  this.value_ = undefined
  try {
    this.trigger(this)
    return value
  }
  catch (err) {
    deinitDiff(value)
    throw err
  }
}

AGP.deinit = function deinit_() {
  try {AP.deinit.call(this)}
  finally {this.reset(undefined)}
}

export function Reaction() {
  validateInstance(this, Reaction)
  this.nextContext_ = undefined
  this.lastContext_ = undefined
  this.deref = this.$ = this.deref.bind(this)
}

const RP = Reaction.prototype

RP.deref = function deref_(ref) {
  validate(ref, isRef)
  if (this.nextContext_ && isObservable(ref)) this.nextContext_.subscribeTo(ref)
  return ref.deref()
}

RP.run = function run(fun, onTrigger) {
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
}

RP.loop = function loop(fun) {
  validate(fun, isFunction)
  const self = this
  function reactionLoop() {
    self.run(fun, reactionLoop)
  }
  reactionLoop()
}

RP.deinit = function deinit_() {
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

const RCP = ReactionContext.prototype

RCP.states = {
  PENDING,
  TRIGGERED,
  DEAD,
}

RCP.subscribeTo = function subscribeTo(observable) {
  if (this.state === PENDING) {
    const sub = observable.subscribe(this.trigger_)
    validate(sub, isSubscription)
    this.subscriptions_.push(sub)
  }
}

RCP.trigger = function trigger() {
  if (this.state === PENDING) {
    this.state = TRIGGERED
    this.onTrigger_.call(undefined, this.reaction_)
  }
}

RCP.deinit = function deinit_() {
  this.state = DEAD
  flushBy(this.subscriptions_, deinit)
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

const CP = Computation.prototype = create(OP, derefGetter)

CP.deref = function deref_() {
  if (this.state === IDLE) this.value_ = this.def_(this.reaction_)
  return this.value_
}

CP.onInit = function onInit() {
  this.reaction_.loop(this.computationUpdate_)
}

CP.onDeinit = function onDeinit() {
  this.reaction_.deinit()
}

function computationUpdate(computation, reaction) {
  const prev = computation.value_
  const next = computation.value_ = computation.def_(reaction)
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
  self.onTrigger_ = onTrigger.bind(undefined, self)
}

const QRP = Query.prototype = create(OP, derefGetter)

QRP.deref = function deref_() {
  if (this.state === IDLE) {
    this.value_ = this.query_(this.observableRef_.deref())
  }
  return this.value_
}

QRP.onInit = function onInit() {
  this.sub_ = this.observableRef_.subscribe(this.onTrigger_)
  this.value_ = this.query_(this.observableRef_.deref())
}

QRP.onDeinit = function onDeinit() {
  this.sub_.deinit()
  this.sub_ = undefined
}

function onTrigger(query, observableRef) {
  const prev = query.value_
  const next = query.value_ = query.query_(observableRef.deref())
  if (!query.equal_(prev, next)) query.trigger(query)
}

export function PathQuery(observableRef, path, equal) {
  validateInstance(this, PathQuery)
  validate(path, isPath)
  Query.call(
    this,
    observableRef,
    function getAtPath(value) {return getIn(value, path)},
    equal
  )
}

PathQuery.prototype = create(Query.prototype)

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

// Undocumented
export function validateInstance(instance, Class) {
  if (!isInstance(instance, Class)) throw Error(`Cannot call a class as a function`)
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
  return value === null || value === NOP
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
    NOP.hasOwnProperty.call(value, 'callee')
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
