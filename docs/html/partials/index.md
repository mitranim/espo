## Overview

`Espo`: **e**xtensions for **s**tateful **p**r**o**gramming in JavaScript. Source: <a href="https://github.com/Mitranim/espo" target="_blank">https://github.com/Mitranim/espo</a>

Library for reactive and stateful programming: observables, implicit reactivity, automatic resource cleanup.

Relatively small: ≈ 8 KiB minified. Dependency-free.

See sibling libraries:

  * Emerge: <a href="https://github.com/Mitranim/emerge" target="_blank">https://github.com/Mitranim/emerge</a>. Efficient patching and merging of plain JS data.
  * fpx: <a href="https://mitranim.com/fpx/" target="_blank">https://mitranim.com/fpx/</a>. Utils for functional programming.

Install with `npm`. Current version: `{{VERSION}}`.

```sh
npm i --save espo
```

All examples imply an import:

```js
const {someFunction} = require('espo')
```

On this page, all Espo words are exported into global scope. You can run the examples in the browser console.

---

## Interfaces

Espo's "interfaces" are abstract definitions _and_ runtime boolean tests. Espo
utilities and classes check their inputs with these interfaces rather than with
`instanceof`.

### `isDeinitable(value)`

```js
interface isDeinitable {
  deinit(): void
}
```

Interface for objects that have a _lifetime_ and must be deinitialized before
you can leave them to the GC. `.deinit()` should make the object inert,
releasing any resources it owns, tearing down any subscriptions, etc.

`.deinit()` must be idempotent and reentrant: redundant calls to `.deinit()`,
even when accidentally overlapping with an ongoing `.deinit()` call, should have
no adverse effects.

```js
isDeinitable(null)            // false
isDeinitable(new Que())       // true
isDeinitable({deinit () {}})  // true
```

See complementary functions [`deinit`](#-deinit-ref-) and
[`deinitDiff`](#-deinitdiff-prev-next-).

---

### `isOwner(value)`

```js
interface isOwner extends isDeinitable {
  unown(): any
}
```

Interface for objects that wrap a value, automatically managing its lifetime.
Deiniting an owner should also deinit the inner value. See
[ownership](https://doc.rust-lang.org/book/ownership.html#ownership) in Rust.

`.unown()` should remove the inner value from the owner without deiniting it,
and return it to the caller. See
[move](https://doc.rust-lang.org/book/ownership.html#move-semantics) in Rust.

See [`Agent`](#-agent-value-) and [`agent.unown()`](#-agent-unown-) for
practical examples.

See complementary function [`unown`](#-unown-ref-).

```js
isOwner(new Atom())   // false
isOwner(new Agent())  // true
```

---

### `isRef(value)`

```js
interface isRef {
  deref(): any
}
```

Interface for objects that wrap a value, such as [`Atom`](#-atom-value-) or any other [observable ref](#-isobservableref-value-). `.deref()` should return the underlying value.

```js
isRef(new Atom())      // true
new Atom(100).deref()  // 100
```

Though it's not part of the interface, all Espo refs alias `.deref()` as `.$` (a getter) for brevity and compatibility with destructuring.

---

### `isObservable(value)`

```js
interface isObservable extends isDeinitable {
  subscribe(subscriber: ƒ(...any)): isSubscription
  unsubscribe(subscription: isSubscription): void
}
```

Interface for objects that let you subscribe to notifications, such as
[`MessageQue`](#-messageque-), [`Atom`](#-atom-value-) or
[`Computation`](#-computation-def-equal-). See [`isSubscription`](#-issubscription-value-)
below.

---

### `isObservableRef(value)`

```js
interface isObservableRef extends isRef, isDeinitable {
  subscribe(subscriber: ƒ(observable)): isSubscription
  unsubscribe(subscription: isSubscription): void
}
```

Signifies that you can subscribe to be notified whenever the value wrapped
by the object changes, and call `.deref()` to get the new value.

Example: [`Atom`](#-atom-value-).

---

### `isAtom(value)`

```js
interface isAtom extends isObservableRef {
  swap(ƒ(...any), ...any): void
  reset(any): void
}
```

Interface for observable references with FP-style state transitions, in the style
of [`clojure.core/atom`](https://clojuredocs.org/clojure.core/atom).

See [`Atom`](#-atom-value-).

---

### `isAgent(value)`

```js
interface isAgent extends isAtom, isOwner {}
```

Interface for observable references with FP-style state transitions that
automatically manage the lifetimes of owned resources.

See [`Agent`](#-agent-value-).

---

### `isSubscription(value)`

```js
interface isSubscription extends isDeinitable {
  trigger(...any): void
}
```

Interface for subscription objects returned by
[`observable.subscribe()`](#-observable-subscribe-subscriber-). The `.trigger()`
method is called by the observable that created the subscription. Calling
`.deinit()` should stop the subscription _immediately_, even if the observable
has a pending notification.

---

## Classes

Espo provides several utility classes. Some of them are intended for direct
use, some should be subclassed.

### `Que(deque)`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Synchronous, unbounded, FIFO queue. Takes a `deque` function that will process
the values pushed into the queue in a strictly linear order. The calls to
`deque` never overlap.

Resilient to exceptions. If `deque` throws an exception when more values are
pending, the other values will still be processed, and the exception will be
delayed until the end.

```js
function deque (value) {
  if (value === 'first') {
    que.push('second')
    que.push('third')
  }
  console.info(value)
}

const que = new Que(deque)

que.push('first')

// prints:
// 'first'
// 'second'
// 'third'
```

#### `que.push(value)`

Adds `value` to the end of the queue. It will be processed by `deque` after all
other values that are already in the queue. If the que is not
[dammed](#-que-dam-), this automatically triggers `.flush()`.

```js
const que = new Que(
  function deque (value) {
    if (value === 'first') {
      que.push('second')
      que.push('third')
    }
    console.info(value)
  }
)

que.push('first')

// prints:
// 'first'
// 'second'
// 'third'
```

#### `que.pull(value)`

Attempts to remove one occurrence of `value` from the pending buffer. Hazardous, use with care.

#### `que.has(value)`

Returns `true` if `value` is currently enqueued. Hazardous, use with care.

#### `que.dam()`

Pauses an idle que. A dammed que accumulates values added by `.push()`, but
doesn't flush automatically. This allows you to delay processing, batching
multiple values. Call `.flush()` to unpause and resume processing.

Has no effect if the que is already flushing at the time of the call.

```js
const que = new Que(
  function deque (value) {console.info(value)}
)

que.dam()

// nothing happens yet
que.push('first')
que.push('second')

// prints 'first' and 'second'
que.flush()
```

#### `que.flush()`

Unpauses and resumes processing. You only need to call it after `.dam()`.

#### `que.isEmpty()`

Self-explanatory.

#### `que.isDammed()`

Self-explanatory.

#### `que.deinit()`

Empties the pending value buffer. The que remains usable afterwards.

---

### `TaskQue()`

`extends` [`Que`](#-que-deque-)

Special case of `Que`: a synchronous, unbounded, FIFO task queue. You push
functions into it, and they execute in a strictly linear order.

```js
const taskQue = new TaskQue()

function first () {
  console.info('first started')
  taskQue.push(second)
  console.info('first ended')
}

function second () {
  console.info('second')
}

taskQue.push(first)

// prints:
// 'first started'
// 'first ended'
// 'second'
```

#### `taskQue.push(task, ...args)`

Adds `task` to the end of the queue. It will be called with `args` as arguments
and `taskQue` as `this` after executing all other tasks that are already in the
queue. If the que is not dammed, this automatically triggers `.flush()`.

Returns a function that removes the task from the que when called.

```js
const taskQue = new TaskQue()

// optional, for batching
taskQue.dam()

const abort = taskQue.push(function report () {console.info('reporting')})

// if you wish to abort
// abort()

// if dammed
taskQue.flush()
```

---

### `MessageQue()`

`extends` [`Que`](#-que-deque-)

`implements` [`isObservable`](#-isobservable-value-)

An "event que" / "message bus" / "many-to-many channel" / "event emitter". Call
[`.subscribe()`](#-messageque-subscribe-subscriber-) to add subscribers, then
[`.push()`](#-messageque-push-args-) to broadcast messages. Can be dammed and
flushed just like a normal [`Que`](#-que-deque-).

Resilient to exceptions. Subscribers don't interfere with each other. If a
subscriber throws an exception, others will still be notified, and the exception
will be delayed until the end of the broadcast. Similarly, exceptions in one
broadcast don't interfere with the other pending broadcasts.

```js
const mq = new MessageQue()

const sub = mq.subscribe((...args) => {
  console.info(args)
})

// will print ['hello', 'world!']
mq.push('hello', 'world!')

sub.deinit()
```

#### `messageQue.subscribe(subscriber)`

where `subscriber: ƒ(...any)`

Conscripts `subscriber` to be called on every
[broadcast](#-messageque-push-args-).
Returns a subscription object that you can `.deinit()`. Deiniting a subscription
is immediate, even during an ongoing broadcast.

```js
const mq = new MessageQue()

const sub = mq.subscribe(function subscriber (...args) {})

// call when you're done
sub.deinit()
```

#### `messageQue.unsubscribe(subscription)`

Same as `subscription.deinit()`.

#### `messageQue.push(...args)`

Broadcasts `...args` to all current subscribers.

---

### `Observable()`

`implements` [`isDeinitable`](#-isdeinitable-value-), [`isObservable`](#-isobservable-value-)

Abstract class for implementing [`observables`](#-isobservable-value-) and
[`observable refs`](#-isobservableref-value-). Not useful on its own.
See [`Atom`](#-atom-value-) and [`Computation`](#-computation-def-equal-), which are based
on this.

Uses subscription counting to lazily initialize and deinitialize. Calls
`.onInit()` when adding the first subscription, and `.onDeinit()` when removing
the last. May initialize and deinitialize repeatedly over the course of its
lifetime. A subclass may override `.onInit()` and `.onDeinit()` to setup and
teardown any external resources it needs, such as HTTP requests or websockets.

#### `observable.subscribe(subscriber)`

where `subscriber: ƒ(...any)`

Conscripts `subscriber` to be called every time the observable is
[triggered](#-observable-trigger-args-).

Returns a [subscription object](#-issubscription-value-) that you can
`.deinit()`. Deiniting a subscription is immediate, even during an ongoing
trigger.

```js
const sub = someObservable.subscribe(function subscriber (...args) {
  // ...
})

// call when you're done
sub.deinit()
```

#### `observable.unsubscribe(subscription)`

Same as `subscription.deinit()`.

#### `observable.trigger(...args)`

Call to notify subscribers, passing `...args` to each. Triggers never overlap:
if `.trigger()` is called during _another ongoing trigger_, the redundant call
is put on an internal [`Que`](#-que-deque-) to be executed later.

#### `observable.onInit()`

Called when adding the first subscription.

#### `observable.onDeinit()`

Called when removing the last subscription.

#### `observable.deinit()`

Deinits all current subscriptions. This incidentally triggers `.onDeinit()` if
the observable is active.

---

### `Atom(value)`

`extends` [`Observable`](#-observable-)

`implements` [`isAtom`](#-isatom-value-)

Basic observable reference. Inspired by
[`clojure.core/atom`](https://clojuredocs.org/clojure.core/atom).
Should be paired with [Emerge](https://github.com/Mitranim/emerge)
for efficient nested updates.

```js
const atom = new Atom(10)

atom.deref()  // 10

const sub = atom.subscribe(atom => {
  console.info(atom.deref())
})

atom.swap(value => value + 1)
// prints 11

atom.swap(value => value + 100)
// prints 111

sub.deinit()
```

#### `atom.deref()`

Returns the underlying value:

```js
const atom = new Atom({num: 100})

console.info(atom.deref())
// {num: 100}
```

Also aliased as `atom.$` for brevity:

```js
console.info(atom.$)
// {num: 100}
```

#### `atom.swap(mod, ...args)`

where `mod: ƒ(currentValue, ...args)`

Sets the value of `atom` to the result of calling `mod` with the current value
and the optional args. Triggers subscribers if the value has changed at all.

```js
const atom = new Atom(10)

atom.deref()  // 10

// no additional args
atom.swap(value => value * 2)

atom.deref()  // 20

const add = (a, b, c) => a + b + c

// additional args
atom.swap(add, 1, 2)

atom.deref()  // add(20, 1, 2) = 23
```

### `atom.reset(value)`

Resets `atom`'s value to the provided `value` and triggers subscribers if the
value has changed at all.

```js
const atom = new Atom(10)

atom.reset(20)

atom.deref()  // 20
```

---

### `Agent(value)`

`extends` [`Atom`](#-atom-value-)

`implements` [`isAgent`](#-isagent-value-)

Combines three big ideas. It's a tool for building:

  * a hierarchy of objects with explicit [ownership](https://doc.rust-lang.org/book/ownership.html#ownership);
  * that automatically manages [object lifetimes](#-isdeinitable-value-);
  * and is fully [observable](#-isobservableref-value-).

In addition to its `Atom` qualities, an agent automatically manages the
lifetimes of the objects it contains, directly or indirectly. Modifying an
agent's value via `agent.swap()` or `agent.reset()` invokes
[`deinitDiff`](#-deinitdiff-prev-next-) on the previous and next value,
automatically deiniting any removed objects that implement
[`isDeinitable`](#-isdeinitable-value-).

```js
const {patch} = require('emerge')

class Resource {
  constructor (name) {this.name = name}
  deinit () {console.info('deiniting:', this.name)}
}

const agent = new Agent({first: new Resource('first')})

agent.swap(patch, {second: new Resource('second')})

agent.deref()
// {inner: {first: Resource{name: 'first'}, second: Resource{name: 'second'}}}

// Any replaced or removed object is automatically deinited

agent.swap(patch, {first: new Resource('third')})
// 'deiniting: first'

agent.swap(patch, {second: null})
// 'deiniting: second'

agent.deref()
// {inner: {first: Resource{name: 'third'}}}

agent.deinit()
// 'deiniting: third'

agent.deref()
// undefined
```

#### `agent.swap(mod, ...args)`

In addition to modifying the agent's value (see
[`atom.swap()`](#-atom-swap-mod-args-)), diffs the previous and the next
value, deiniting any removed objects.

See the example above.

#### `agent.reset(value)`

In addition to modifying the agent's value (see
[`atom.reset()`](#-atom-reset-value-)), diffs the previous and the next value,
deiniting any removed objects.

See the example above.

#### `agent.deinit()`

In addition to deiniting subscriptions (see
[`observable.deinit()`](#-observable-deinit-)), resets the agent to `undefined`,
deiniting the previous value.

See the example above.

#### `agent.unown()`

Resets `agent` to `undefined`, returning the previous value as-is, without
deiniting it. If one of the subscriptions triggered by `.unown()` produces an
exception before `.unown()` returns, the value is automatically deinited to
avoid leaks.

In Rust terms, `.unown()` implies
[moving](https://doc.rust-lang.org/book/ownership.html#move-semantics) the value
out of the agent. The caller _must take responsibility_ for the lifetime of the
returned value.

```js
const atom = new Atom(10)

const sub = atom.subscribe(atom => {
  console.info('updated:', atom.deref())
})

const agent = new Agent({sub})

agent.deref()
// {sub: Subscription{state: 'ACTIVE', ...}}

atom.reset(20)
// 'updated: 20'

const value = agent.unown()
// {sub: Subscription{state: 'ACTIVE', ...}}

// The value has been moved out of the agent
agent.deref()
// undefined

// The subscription is still active
atom.reset(30)
// 'updated: 30'

// We must take responsibility for its lifetime
value.sub.deinit()
```

For comparison, `.reset()` will diff and deinit the previous value:

```js
const atom = new Atom(10)

const sub = atom.subscribe(atom => {
  console.info('updated:', atom.deref())
})

const agent = new Agent({sub})

agent.deref()
// {sub: Subscription{state: 'ACTIVE', ...}}

atom.reset(20)
// 'updated: 20'

agent.reset(undefined)

sub
// Subscription{state: 'IDLE', ...}

atom.reset(30)
// nothing
```

---

### `Reaction()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Enables implicit reactivity driven by _procedural data access_. Write code that looks like a plain imperative function, but is actually reactive. With `Reaction`, you don't subscribe or unsubscribe manually. Simply pull data from [`observable refs`](#-isobservableref-value-). The subscriptions are updated on each run, and therefore may change over time.

See [`Computation`](#-computation-def-equal-) for a reaction that is itself observable.

```js
const one = new Atom(10)
const other = new Atom(20)

const reaction = Reaction.loop(({deref}) => {
  console.info(deref(one), deref(other))
})
// prints 10, 20

one.reset('hello')
// prints 'hello', 20

other.reset('world')
// prints 'hello', 'world'

reaction.deinit()
```

#### `reaction.run(fun, onTrigger)`

where `fun: ƒ(reaction)`, `onTrigger: ƒ(reaction)`

Runs `fun` in the context of the reaction, subscribing to any
[`observable refs`](#-isobservableref-value-)
passed to `.deref()` during the run. Returns the result of `fun`.
`onTrigger` will be called when any of those observable refs is triggered.

The subscriptions created during a `.run()` race with each other. As soon as one
is triggered, all subscriptions are invalidated and `onTrigger` is called. Until
the next `.run()`, which is typically [immediate](#static-reaction-loop-fun-),
no further triggers will occur, but subscriptions remain "active" until the end
of the next `.run()`, at which point they're replaced with the new subscriptions
and deinited. They're also deinited on `.deinit()`. Overlapping the subscription
lifetimes allows to avoid premature deinitialization of lazy observables.

```js
const reaction = new Reaction()

const atom = new Atom(10)

reaction.run(
  function effect ({deref}) {
    return deref(atom)
  },
  function update () {
    console.info('notified')
    // maybe rerun, maybe delay
  }
)
// 10

atom.reset(20)
// 'notified'

reaction.deinit()
```

#### `reaction.deref(ref)` <span class="text-italic fg-gray font-smaller">bound method</span>

Outside a `.run()`, equivalent to [`deref(ref)`](#-deref-ref-). During a
`.run()`, and if `ref` implements [`isObservable `](#-isobservable-value-),
implicitly subscribes to `ref`. See the examples above.

`.deref` is instance-bound for convenient destructuring.

#### `reaction.loop(fun)`

where `fun: ƒ(Reaction)`

Runs `fun` immediately, then reruns it on every change in the watched observables. See the first usage example.

```js
// Doesn't do anything
const reaction = new Reaction()

const atom = new Atom(10)

reaction.loop(({deref}) => {
  console.info(deref(atom))
})
// prints '10'

atom.reset(20)
// prints '20'

reaction.deinit()
```

Also aliased as `reaction.$(ref)` for brevity:

```js
reaction.loop(({$}) => {
  console.info($(atom))
})
```

#### static `Reaction.loop(fun)`

Creates and starts a reaction using its `loop` method. If the first run produces an exception, automatically deinits the reaction to prevent subscription leaks. See the first usage example above.

---

### `Computation(def, equal)`

where `def: ƒ(Reaction), equal: ƒ(any, any): bool`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Defines a reactive computation that pulls data from multiple observable refs.
Filters redundant updates using the `equal` function. Based on
[`Reaction`](#-reaction-). Lazy: doesn't update when it has no subscribers.

Inspired by [Reagent's `reaction`](https://github.com/Day8/re-frame/blob/master/docs/SubscriptionFlow.md#how-flow-happens-in-reagent).

```js
const eq = (a, b) => a === b
const one = new Atom(10)
const other = new Atom({outer: {inner: 20}})
const inOther = new PathQuery(other, ['outer', 'inner'], eq)

const computation = new Computation(({deref}) => {
  return deref(one) + deref(inOther)
}, eq)

computation.deref()  // undefined

const sub = computation.subscribe(({deref}) => {
  console.info(deref())
})

computation.deref()  // 30

one.reset('hello')
// 'hello20'

other.reset({outer: {inner: ' world'}})
// 'hello world'

sub.deinit()

// computation is now inert and safe to leave to GC
// alternatively, call computation.deinit() to drop all subs
```

---

### `Query(observableRef, query, equal)`

where `query: ƒ(any): any, equal: ƒ(any, any): bool`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Creates an observable that derives its value from `observableRef` by calling
`query` and filters redundant updates by calling `equal`. Lazy: doesn't update
when it has no subscribers.

```js
const eq = (a, b) => a === b
const atom = new Atom({outer: {inner: 10}})
const query = new Query(atom, (value => value.outer.inner * 2), eq)

query.deref()  // undefined

const sub = query.subscribe(query => {
  console.info(query.deref())
})

query.deref()  // 20

atom.reset({outer: {inner: 20}})
// prints 40

// now the query is inert again
sub.deinit()
```

In RxJS terms, `new Query(observableRef, query, equal)` is equivalent to
`observable.map(query).distinctUntilChanged(equal)`.

---

### `PathQuery(observableRef, path, equal)`

where `path: [string|number], equal: ƒ(any, any): bool`

`extends` [`Query`](#-query-observableref-query-equal-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Special case of `Query`. Shortcut to accessing value by path.

```js
new PathQuery(observableRef, path, equal)
// equivalent to:
new Query(observableRef, value => derefIn(value, path), equal)
```

```js
const eq = (a, b) => a === b
const atom = new Atom({outer: {inner: 10}})
const query = new PathQuery(atom, ['outer', 'inner'], eq)

query.deref()  // undefined

const sub = query.subscribe(query => {
  console.info(query.deref())
})

query.deref()  // 10

atom.reset({outer: {inner: 20}})
// prints 20

// now the query is inert again
sub.deinit()
```

---

## Utils

### `global`

Current global context. Browser: `window`, Node.js: `global`, webworkers: `self`, and so on.

---

### `isMutable(value)`

True if `value` can be mutated (add/remove/modify properties). This includes
most objects and functions. False if `value` is frozen or a primitive (nil,
string, number, etc).

```js
isMutable({})                  =   true
isMutable(isMutable)           =   true
isMutable(null)                =   false
isMutable(Object.freeze({}))   =   false
```

---

### `assign(object, ...sources)`

Similar to [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). Mutates `object`, assigning enumerable properties (own and inherited) from each `source`. Returns the same `object`.

Stricter than `Object.assign`: requires the input to be mutable, doesn't silently replace a primitive with an object.

Be wary: mutation is often misused. When dealing with data, you should program
in a functional style, treating your data structures as immutable. Use a library
like [Emerge](https://github.com/Mitranim/emerge) for data transformations.

```js
assign()                        =  {}
assign({})                      =  {}
assign({}, {one: 1}, {two: 2})  =  {one: 1, two: 2}
```

---

### `pull(array, value)`

Mutates `array`, removing one occurrence of `value` from the start, comparing by an equivalent of <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is" target="_blank">`Object.is`</a>.

Counterpart to the built-ins [`Array.prototype.push`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push) and [`Array.prototype.unshift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift).

```js
const array = [10, 20]

pull(array, 10)

array
// [20]
```

---

### `deinit(ref)`

Complementary function for [`isDeinitable`](#-isdeinitable-value-). Calls
`ref.deinit()` if available. Safe to call on values that don't implement
[`isDeinitable`](#-isdeinitable-value-).

```js
const ref = {
  deinit () {
    console.info('deiniting')
  }
}

deinit(ref)
// 'deiniting'

// calling with a non-deinitable does nothing
deinit('non-deinitable')
```

---

### `deinitDiff(prev, next)`

Utility for automatic management of object lifetimes. See
[`isDeinitable`](#-isdeinitable-value-), [`isOwner`](#-isowner-value-),
[`Agent`](#-agent-value-) for more details and examples.

Diffs `prev` and `next`, deiniting any objects that implement [`isDeinitable`](#-isdeinitable-value-) and are present in `prev` but not in `next`. The diff algorithm recursively traverses plain data structures, but stops at non-plain objects, allowing you to safely include third party objects of unknown size and structure.

Definition of "plain data":

  * primitive: number, string, boolean, symbol, `null`, `undefined`
  * object based on `null` or `Object.prototype`
  * array

Everything else is considered non-data and is not traversed.

Resilient to exceptions: if a deiniter or a property accessor produces an
exception, `deinitDiff` will still traverse the rest of the tree, delaying
exceptions until the end.

Detects and avoids circular references.

```js
class Resource {
  constructor (name) {this.name = name}
  deinit () {console.info('deiniting:', this.name)}
}

class BlackBox {
  constructor (inner) {this.inner = inner}
}

const prev = {
  root: new Resource('Sirius'),
  dict: {
    inner: new Resource('Arcturus'),
  },
  list: [new Resource('Rigel')],
  // Sun is untouchable to deinitDiff because it's wrapped
  // into a non-plain object that doesn't implement isDeinitable
  blackBox: new BlackBox(new Resource('Sun'))
}

const next = {
  root: prev.root,
  dict: {
    inner: new Resource('Bellatrix')
  },
  list: null,
}

deinitDiff(prev, next)

// 'deiniting: Arcturus'
// 'deiniting: Rigel'

deinitDiff(next, null)

// 'deiniting: Sirius'
// 'deiniting: Bellatrix'
```

---

### `unown(ref)`

Complementary function for [`isOwner`](#-isowner-value-). Calls `ref.unown()`,
returning the inner value. Safe to call on values that don't implement
[`isOwner`](#-isowner-value-).

See [`agent.unown()`](#-agent-unown-) for examples.

---

### `deref(ref)`

Complementary function for [`isRef`](#-isref-value-). Calls `ref.deref()` and
continues recursively, eventually returning a non-ref. Safe to call on values
that don't implement [`isRef`](#-isref-value-).

```js
deref('value')                      // 'value'
deref(new Atom('value'))            // 'value'
deref(new Atom(new Atom('value')))  // 'value'
deref({deref () {return 'value'}})  // 'value'
```

---

### `derefIn(ref, path)`

Derefs the ref and returns the value at `path`, similar to [`fpx.getIn`](https://mitranim.com/fpx/#-getin-value-path-). When called on values that don't implement [`isRef`](#-isref-value-), this is equivalent to `fpx.getIn`.

```js
derefIn(new Atom({one: {two: 2}}), ['one', 'two'])
// 2
derefIn(new Atom({nested: new Atom('val')}), ['nested'])
// Atom('val')
derefIn({one: {two: 2}}, ['one', 'two'])
// 2
```

---

## Author

Nelo Mitranim: https://mitranim.com
