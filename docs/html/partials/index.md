## Overview

`Espo`: **e**xtensions for **s**tateful **p**r**o**gramming in JavaScript. Enables reactive programming with automatic state cleanup. Source: <a href="https://github.com/mitranim/espo" target="_blank">https://github.com/mitranim/espo</a>.

Relatively small: ≈ 7 KiB minified. The optional view adapters add tiny dependencies for around ≈ 4 KiB. One of them is Emerge, see below.

See sibling libraries:

  * Emerge: <a href="https://github.com/mitranim/emerge" target="_blank">https://github.com/mitranim/emerge</a>. Efficient patching and merging of plain JS data.
  * fpx: <a href="https://mitranim.com/fpx/" target="_blank">https://mitranim.com/fpx/</a>. Utils for functional programming.

Install with `npm`. Current version: `{{VERSION}}`. The changelog is maintained in [`readme.md`](https://github.com/mitranim/espo#changelog).

```sh
npm i espo
```

All examples imply an import:

```js
import * as es from 'espo'
```

To allow running examples in the browser console, this page has the following imports in the global scope:

* `es` or `espo`: this library.
* `em` or `emerge`: Emerge (data manipulation).
* `f` or `fpx`: fpx (general utilities).

---

## Table of Contents

* [Overview](#overview)
* [Introduction](#introduction)
* [Interfaces](#interfaces)
* [Classes](#classes)
* [Utils](#utils)
* [React Views](#react-views)

---

## Introduction

Espo combines multiple ideas into one unique package:

* Using immutable data. (Haskell, Clojure, Erlang, Emerge, Redux, etc.)
* Storing immutable data in observable references. (Clojure, RxJS, MobX, Redux, etc.)
* Subscribing to observables implicitly, just by pulling data from them. (Reagent.)
* Automatically calling deinitializers when dropping stateful objects. (Rust, Swift, C++.)
* Observables that initialize data fetching when someone's pulling data from them. (RxJS.)

Espo provides primitives; with some assembly, you can do astounding things.

<details class="details">
  <summary>Example: an observable that automatically fetches data when used.</summary>

```js
class DataSource extends es.Agent {
  constructor(params) {
    super({value: undefined, error: undefined, req: undefined})
    this.params = params
  }

  onInit() {
    // Suppose this returns an `XMLHttpRequest` instance.
    const req = httpRequest(this.params, (error, value) => {
      if (error) this.$ = {...this.$, error, req: undefined}
      else this.$ = {...this.$, value, error: undefined, req: undefined}
    })

    // Enables automatic deinitialization when `req` is replaced.
    req.deinit = req.abort

    this.$ = {...this.$, req}
  }

  onDeinit() {
    this.$ = {...this.$, req: undefined}
  }
}

// Minor note: consider using Emerge instead of `{...}` for added efficiency.
```
</details>

<details class="details">
  <summary>Example: using that observable in a view component. Attempting to read its value automatically subscribes the view component to updates, and automatically triggers data fetching. The first read from the observable will contain the request, so we can display loading indicators and errors as needed.</summary>

```js
// Some assembly required.

import * as es from 'espo'
import {Component} from 'react'
import {initViewComponent} from 'espo/react'

class ViewComponent extends Component {
  constructor() {
    super(...arguments)
    initViewComponent(this)
  }
}

// Actual usage.

const userSrc = new DataSource({url: '/api/user'})

class View extends ViewComponent {
  render() {
    const {value: user, error, req} = userSrc.$
    return // ...
  }
}
```
</details>

<details class="details">
  <summary>Example: an observable that recomputes data from multiple sources. (See <code>ViewComponent</code> setup above.)</summary>

```js
const one = new es.Atom(10)
const two = new es.Atom(20)
const sum = es.computation(() => one.$ + two.$)

class View extends ViewComponent {
  render() {
    return sum.$ // Start at 30; always up to date
  }
}
```
</details>

---

## Interfaces

Espo defines a few "interfaces" which are simultaneously abstract definitions _and_ runtime boolean tests. Espo checks its inputs with these interfaces rather than with `instanceof`.

### `isDeinitable(value)`

```js
interface isDeinitable {
  deinit(): void
}
```

Interface for objects that have a _lifetime_ and must be deinitialized before
you can leave them to the GC. `.deinit()` must make the object inert,
releasing any resources it owns, tearing down any subscriptions, etc.

`.deinit()` must be idempotent and reentrant: redundant calls to `.deinit()`,
even when accidentally overlapping with an ongoing `.deinit()` call, should have
no adverse effects.

```js
es.isDeinitable(null)           // false
es.isDeinitable(new es.Que())   // true
es.isDeinitable({deinit() {}})  // true
```

See complementary functions [`deinit`](#deinit-ref-) and
[`deinitDiff`](#deinitdiff-prev-next-).

---

### `isOwner(value)`

```js
interface isOwner extends isDeinitable {
  unown(): any
}
```

Interface for objects that wrap a [deinitable](#isdeinitable-value-) value and manage its lifetime. Deiniting an owner should also deinit its inner value. See [ownership](https://doc.rust-lang.org/book/ownership.html#ownership) in Rust.

`.unown()` should remove the inner value from the owner without deiniting it, and return it to the caller. See [move](https://doc.rust-lang.org/book/ownership.html#move-semantics) in Rust.

See [`Agent`](#agent-value-) and [`agent.unown()`](#agent-unown-) for practical examples.

See the complementary function [`unown`](#unown-ref-).

```js
es.isOwner(new es.Atom())   // false
es.isOwner(new es.Agent())  // true
```

---

### `isRef(value)`

```js
interface isRef {
  deref(): any
}
```

Interface for objects that wrap a value, such as [`Atom`](#atom-value-) or any other [observable ref](#isobservableref-value-). The method `.deref()` must return the underlying value.

```js
const atom = new es.Atom(100)
es.isRef(atom) // true
atom.deref()   // 100
atom.$         // 100
```

All Espo refs provide the `.$` shortcut mandated by [`isObservableRef`](#isobservableref-value-); see below.

---

### `isObservable(value)`

```js
interface isObservable extends isDeinitable {
  subscribe(subscriber: ƒ(...any))          : isSubscription
  unsubscribe(subscription: isSubscription) : void
  trigger(...any)                           : void
}
```

Interface for objects that let you subscribe to notifications, such as [`Atom`](#atom-value-) or [`Computation`](#computation-def-equal-). An "observable" can be considered a stream of arbitrary values. The callback provided to `.subscribe()` receives the arguments passed to `.trigger()`.

See [`isSubscription`](#issubscription-value-) below.

```js
const atom = new es.Atom(100)
es.isObservable(atom) // true
```

---

### `isObservableRef(value)`

```js
interface isObservableRef extends isRef, isObservable {
  get $                                     : any
  subscribe(subscriber: ƒ(isObservableRef)) : isSubscription // Override.
  trigger()                                 : void           // Override.
}
```

Combination of "observable" and "reference". This is something that encapsulates a value and can notify about changes to that value.

Unlike [`isObservable`](#isobservable-value-), by convention, the callback passed to `.subscribe()` receives the observable itself as its only argument, and `.trigger()` doesn't take any parameters.

In addition to being able to take the value by `.deref()`, this interface mandates the presence of the `.$` getter. In reactive contexts such as [`Reaction.loop`](#reaction-loop-fun-), `.$` must implicitly establish subscriptions, while `.deref()` must _not_ implicitly establish subscriptions. This important convention is followed by Espo's own observable refs such as [`Atom`](#atom-value-) and [`Computation`](#computation-def-equal-).

```js
const atom = new es.Atom(100)
es.isObservableRef(atom) // true
atom.$                   // 100
```

---

### `isAtom(value)`

```js
interface isAtom extends isObservableRef {
  set $                        : void
  swap(ƒ(any, ...any), ...any) : void
  reset(any)                   : void
}
```

Interface for observable references which encourage the "functional" style of modifying their state. Lifted from [`clojure.core/atom`](https://clojuredocs.org/clojure.core/atom).

The `.$` setter must be equivalent to calling `.reset()` with the provided value.

See [`Atom`](#atom-value-) for usage examples.

---

### `isAgent(value)`

```js
interface isAgent extends isAtom, isOwner {}
```

Interface for observable references with "functional" state transitions that automatically manage the lifetimes of owned resources.

See [`Agent`](#agent-value-) for explanation and usage.

---

### `isSubscription(value)`

```js
interface isSubscription extends isDeinitable {
  trigger(...any): void
}
```

Interface for subscription objects returned by [`Observable.prototype.subscribe()`](#observable-subscribe-subscriber-). The `.trigger()` method is called by the observable that created the subscription. Calling `.deinit()` should stop the subscription _immediately_, even if the observable is in the process of notifying its subscribers.

---

## Classes

Espo provides several utility classes. Some of them are intended for direct
use, some should be subclassed.

### `Observable()`

`implements` [`isDeinitable`](#isdeinitable-value-), [`isObservable`](#isobservable-value-)

Abstract class for implementing [`observables`](#isobservable-value-) and [`observable refs`](#isobservableref-value-). Should be subclassed. See [`Atom`](#atom-value-) and [`Computation`](#computation-def-equal-), which are based on this.

Espo's observables have an extremely powerful feature: they call `.onInit()` when adding the first subscription, and `.onDeinit()` when removing the last one. A subclass may override `.onInit()` and `.onDeinit()` to setup and teardown any external resources it needs, such as HTTP requests or websockets.

The following example implements an observable that automatically fetches a resource when a consumer subscribes to it:

```js
class extends es.Agent {
  constructor(params) {
    super({value: undefined, error: undefined, req: undefined})
    this.params = params
  }

  onInit() {
    const req = httpRequest(this.params, (error, value) => {
      if (error) this.$ = {...this.$, error, req: undefined}
      else this.$ = {...this.$, value, error: undefined, req: undefined}
    })

    // Enables automatic deinitialization when `req` is replaced.
    req.deinit = req.abort

    this.$ = {...this.$, req}
  }

  onDeinit() {
    this.$ = {...this.$, req: undefined}
  }
}
```

#### `observable.subscribe(subscriber)`

where `subscriber: ƒ(...any)`

Conscripts the `subscriber` function to be called every time the observable is
[triggered](#observable-trigger-args-). Returns a [subscription object](#issubscription-value-) that you can `.deinit()`. Deiniting a subscription is immediate, even during an ongoing trigger.

```js
const sub = someObservable.subscribe((...args) => {
  // ...
})

// Prevents further notifications.
sub.deinit()
```

#### `observable.unsubscribe(subscription)`

Same as `subscription.deinit()`.

#### `observable.trigger(...args)`

Call to notify subscribers, passing `...args` to each. Triggers never overlap:
if `.trigger()` is called during _another ongoing trigger_, the redundant call
is put on an internal [`Que`](#que-deque-) to be executed later.

#### `observable.onInit()`

Called when adding the first subscription.

#### `observable.onDeinit()`

Called when removing the last subscription.

#### `observable.deinit()`

Deinits all current subscriptions. This incidentally triggers `.onDeinit()` if
the observable is active.

---

### `Atom(value)`

`extends` [`Observable`](#observable-)

`implements` [`isAtom`](#isatom-value-)

Basic observable reference. Inspired by [`clojure.core/atom`](https://clojuredocs.org/clojure.core/atom). Should be paired with [Emerge](https://github.com/mitranim/emerge) for efficient nested updates.

```js
const atom = new es.Atom(10)

atom.$  // 10

const sub = atom.subscribe(atom => {
  console.info(atom.$)
})

atom.swap(value => value + 1)
// Prints 11

atom.swap(value => value + 100)
// Prints 111

sub.deinit()
```

#### `atom.deref()` or `atom.$`

Returns the underlying value:

```js
const atom = new es.Atom({num: 100})

console.info(atom.deref())
// {num: 100}

console.info(atom.$)
// {num: 100}
```

In a reactive context such as [`Reaction.run`](#reaction-run-fun-ontrigger-) or [`Reaction.loop`](#reaction-loop-fun-), `atom.$` will implicitly establish subscriptions. See those methods for examples.

#### `atom.swap(fun, ...args)`

where `fun: ƒ(currentValue, ...args)`

Sets the value of `atom` to the result of calling `fun` with the current value and the optional args. Triggers subscriptions if the value has changed at all.

```js
const atom = new es.Atom(10)

atom.$ // 10

// Usage without additional args.
atom.swap(value => value * 2)

atom.$ // 20

// Additional args are useful with predefined functions.
atom.swap(add, 1, 2)

atom.$ // add(20, 1, 2) = 23

function add(a, b, c) {return a + b + c}
```

#### `atom.reset(value)` or `atom.$ = X`

Resets `atom`'s value to the provided `value` and triggers subscriptions if the value has changed at all.

```js
const atom = new es.Atom(10)

atom.reset(20)

atom.$ // 20

// Equivalent to .reset(), also triggers subscribers.
atom.$ = 30

atom.$ // 30
```

---

### `Agent(value)`

`extends` [`Atom`](#atom-value-)

`implements` [`isAgent`](#isagent-value-)

Combines three big ideas:

  * A tool for building a hierarchy of objects with explicit [ownership](https://doc.rust-lang.org/book/ownership.html#ownership).
  * That automatically manages object lifetimes via [`.deinit()`](#isdeinitable-value-).
  * And is fully [observable](#isobservableref-value-).

In addition to its `Atom` qualities, an agent automatically manages the lifetimes of the objects it contains, directly or indirectly. Modifying an agent's value via `agent.$`, `agent.swap()` or `agent.reset()` invokes [`deinitDiff`](#deinitdiff-prev-next-) on the previous and next value, automatically deiniting any removed objects that implement [`isDeinitable`](#isdeinitable-value-).

```js
import * as es from 'espo'
import * as em from 'emerge'

class Resource {
  constructor(name) {this.name = name}
  deinit() {console.info('deiniting:', this.name)}
}

const agent = new es.Agent({first: new Resource('first')})

agent.swap(em.patch, {second: new Resource('second')})

agent.$
// {inner: {first: Resource{name: 'first'}, second: Resource{name: 'second'}}}

// Any replaced or removed object is automatically deinited:

agent.swap(em.patch, {first: new Resource('third')})
// 'deiniting: first'

agent.swap(em.patch, {second: null})
// 'deiniting: second'

agent.$
// {inner: {first: Resource{name: 'third'}}}

agent.deinit()
// 'deiniting: third'

agent.$
// undefined
```

#### `agent.swap(fun, ...args)`

In addition to modifying the agent's value (see [`atom.swap()`](#atom-swap-fun-args-)), diffs the previous and the next value, deiniting any removed objects.

See the example above.

#### `agent.reset(value)` or `agent.$ = X`

In addition to modifying the agent's value (see [`atom.reset()`](#atom-reset-value-or-atom-x)), diffs the previous and the next value, deiniting any removed objects.

See the example above.

#### `agent.deinit()`

In addition to deiniting subscriptions (see [`observable.deinit()`](#observable-deinit-)), resets the agent to `undefined`, deiniting the previous value.

See the example above.

#### `agent.unown()`

Resets `agent` to `undefined`, returning the previous value as-is, without deiniting it. If one of the subscriptions triggered by `.unown()` produces an exception before `.unown()` returns, the value is automatically deinited to avoid leaks.

In Rust terms, `.unown()` implies [moving](https://doc.rust-lang.org/book/ownership.html#move-semantics) the value out of the agent. The caller _must take responsibility_ for the lifetime of the returned value.

```js
const atom = new es.Atom(10)

const sub = atom.subscribe(atom => {
  console.info('updated:', atom.$)
})

// This will manage the subscription created by `atom`.
const agent = new es.Agent({sub})

agent.$
// {sub: Subscription{state: 'ACTIVE', ...}}

// The subscription is active:
atom.$ = 20
// 'updated: 20'

const {sub} = agent.unown()
// Subscription{state: 'ACTIVE', ...}

// The value has been moved out of the agent:
agent.$
// undefined

// The subscription is still active:
atom.$ = 30
// 'updated: 30'

// We must take responsibility for its lifetime:
sub.deinit()
```

For comparison, `.reset()` or `.$ = X` will diff and deinit the previous value:

```js
const atom = new es.Atom(10)

const sub = atom.subscribe(atom => {
  console.info('updated:', atom.$)
})

const agent = new es.Agent({sub})

agent.$
// {sub: Subscription{state: 'ACTIVE', ...}}

atom.$ = 20
// 'updated: 20'

agent.$ = undefined

sub
// Subscription{state: 'IDLE', ...}

atom.$ = 30
// nothing
```

---

### `Reaction()`

`implements` [`isDeinitable`](#isdeinitable-value-)

Enables implicit reactivity driven by _procedural data access_. Write code that looks like a plain imperative function, but is actually reactive. With `Reaction`, you don't subscribe or unsubscribe manually. Simply pull data from [`observable refs`](#isobservableref-value-). The subscriptions are updated on each run, and therefore may change over time.

See [`Computation`](#computation-def-equal-) for a reaction that is itself observable.

```js
const one = new es.Atom(10)
const other = new es.Atom(20)

const reaction = es.Reaction.loop(() => {
  console.info(one.$, other.$)
})
// Prints 10, 20

one.$ = 'hello'
// Prints 'hello', 20

other.$ = 'world'
// Prints 'hello', 'world'

reaction.deinit()
```

#### `reaction.run(fun, onTrigger): any`

where `fun: ƒ(): any`, `onTrigger: ƒ(): void`

Runs `fun` in the context of the reaction, subscribing to any [`observable refs`](#isobservableref-value-) whose value is taken via `.$` during the run. Returns the result of `fun`. `onTrigger` will be called when any of those observable refs is triggered.

The subscriptions created during a `.run()` race with each other. As soon as one is triggered, all subscriptions are invalidated and `onTrigger` is called. Until the next `.run()`, which is typically [immediate](#static-reaction-loop-fun-), no further triggers will occur, but subscriptions remain "active" until the end of the next `.run()`, at which point they're replaced with the new subscriptions and deinited. They're also deinited on `.deinit()`. Overlapping the subscription lifetimes avoids premature deinitialization of observables.

```js
const atom = new es.Atom(10)

const reaction = new es.Reaction()

const value = reaction.run(
  function effect() {
    return atom.$
  },
  function update() {
    console.info('notified')
    // maybe rerun, maybe delay
  }
)
// Returns 10.

atom.$ = 20
// Prints "notified".

reaction.deinit()
```

#### `reaction.loop(fun)`

where `fun: ƒ(): void`

Runs `fun` immediately, then reruns it on every change in the watched observables. See the first usage example.

```js
// Doesn't do anything
const reaction = new es.Reaction()

const atom = new es.Atom(10)

reaction.loop(() => {
  console.info(atom.$)
})
// Prints 10

atom.$ = 20
// Prints 20

reaction.deinit()
```

#### static `Reaction.loop(fun)`

Creates and starts a reaction using its `loop` method. If the first run produces an exception, automatically deinits the reaction to prevent subscription leaks. See the first usage example above.

---

### `Computation(def, equal)`

where `def: ƒ(): any`, `equal: ƒ(any, any): bool`

`extends` [`Observable`](#observable-)

`implements` [`isObservableRef`](#isobservableref-value-)

Defines a reactive computation that pulls data from multiple observable refs. Filters redundant updates using the `equal` function. Internally uses a [`Reaction`](#reaction-). Lazy: doesn't update when it has no subscribers.

Inspired by [Reagent's `reaction`](https://github.com/Day8/re-frame/blob/master/docs/SubscriptionFlow.md#how-flow-happens-in-reagent).

```js
const one = new es.Atom(10)
const other = new es.Atom({one: {two: 20}})
const inOther = new es.PathQuery(other, ['one', 'two'], Object.is)

const comp = new es.Computation(() => one.$ + inOther.$, Object.is)

comp.$ // 30

const sub = comp.subscribe(() => {
  console.info(comp.$)
})

one.$ = 'hello '
// 'hello 20'

other.$ = {one: {two: 'world'}}
// 'hello world'

sub.deinit()

// Computation is now inert and safe to leave to GC.
// Alternatively, call `comp.deinit()` to drop all subs.
```

---

### `computation(def): Computation`

where `def: ƒ(): any`

Shortcut to `new Computation` where the equality function is [SameValueZero](https://www.ecma-international.org/ecma-262/6.0/#sec-samevaluezero) as defined by the language spec (basically `===` that work on `NaN`).

```js
const one = new es.Atom(10)
const two = new es.Atom(20)
const comp = es.computation(() => one.$ + two.$)

comp.$ // 30
```

---

### `Query(observableRef, query, equal)`

where `query: ƒ(any): any`, `equal: ƒ(any, any): bool`

`extends` [`Observable`](#observable-)

`implements` [`isObservableRef`](#isobservableref-value-)

Creates an observable that derives its value from `observableRef` by calling `query` and filters redundant updates by calling `equal`. Lazy: doesn't update when it has no subscribers.

```js
const atom = new es.Atom({one: {two: 10}})
const query = new es.Query(atom, (value => value.one.two * 2), Object.is)

query.$ // 20

const sub = query.subscribe(query => {
  console.info(query.$)
})

atom.$ = {one: {two: 20}}
// Prints 40

// Now the query is inert again.
sub.deinit()
```

In RxJS terms, `new es.Query(observableRef, query, equal)` is equivalent to `observable.map(query).distinctUntilChanged(equal)`.

---

### `query(observableRef, query): Query`

where `query: ƒ(any): any`

Shortcut to `new Query` where the equality function is [SameValueZero](https://www.ecma-international.org/ecma-262/6.0/#sec-samevaluezero) as defined by the language spec (basically `===` that work on `NaN`).

```js
const atom = new es.Atom({one: {two: 10}})
const query = es.query(atom, val => val.one.two)

query.$ // 10
```

---

### `PathQuery(observableRef, path, equal)`

where `path: [string|number]`, `equal: ƒ(any, any): bool`

`extends` [`Query`](#query-observableref-query-equal-)

`implements` [`isObservableRef`](#isobservableref-value-)

Special case of `Query`. Shortcut to accessing the value by the property path in a way that's safe against `null` and `undefined`.

```js
new es.PathQuery(observableRef, ['one', 'two'], equal)
// Equivalent to (but safer):
new es.Query(observableRef, value => value.one.two, equal)
```

```js
const atom = new es.Atom({one: {two: 10}})
const query = new es.PathQuery(atom, ['one', 'two'], Object.is)

query.$ // 10

const sub = query.subscribe(query => {
  console.info(query.$)
})

atom.$ = {one: {two: 20}}
// Prints 20

// Now the query is inert again.
sub.deinit()
```

---

### `pathQuery(observableRef, path): PathQuery`

where `path: [string|number]`

Shortcut to `new PathQuery` where the equality function is [SameValueZero](https://www.ecma-international.org/ecma-262/6.0/#sec-samevaluezero) as defined by the language spec (basically `===` that work on `NaN`).

```js
const atom = new es.Atom({one: {two: 10}})
const pathQuery = es.pathQuery(atom, ['one', 'two'])

pathQuery.$ // 10
```

---

## Utils

Complementary utility functions.

### `deinit(ref)`

Complementary function for [`isDeinitable`](#isdeinitable-value-). Calls `ref.deinit()` if available. Safe to call on values that don't implement [`isDeinitable`](#isdeinitable-value-).

```js
const ref = {
  deinit() {
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

Utility for automatic management of object lifetimes. See [`isDeinitable`](#isdeinitable-value-), [`isOwner`](#isowner-value-), [`Agent`](#agent-value-) for more details and examples.

Diffs `prev` and `next`, deiniting any objects that implement [`isDeinitable`](#isdeinitable-value-) and are present in `prev` but not in `next`. The diff algorithm recursively traverses plain data structures, but stops at non-plain objects, allowing you to safely include third party objects of unknown size and structure.

Definition of "plain data":

  * primitive: number, string, boolean, symbol, `null`, `undefined`
  * object based on `null` or `Object.prototype`
  * array

Everything else is considered non-data and is not traversed.

Resilient to exceptions: if a deiniter or a property accessor produces an exception, `deinitDiff` will still traverse the rest of the tree, delaying exceptions until the end.

Detects and avoids circular references.

```js
class Resource {
  constructor(name) {this.name = name}
  deinit() {console.info('deiniting:', this.name)}
}

// Prevents auto-deinitialization of what it contains.
class BlackBox {
  constructor(inner) {this.inner = inner}
}

const prev = {
  root: new Resource('Sirius'),
  dict: {
    inner: new Resource('Arcturus'),
  },
  list: [new Resource('Rigel')],
  // Sol is untouchable to `deinitDiff` because it's wrapped
  // into a non-plain object that doesn't implement `isDeinitable`.
  blackBox: new BlackBox(new Resource('Sol')),
}

const next = {
  root: prev.root,
  dict: {
    inner: new Resource('Bellatrix'),
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

Complementary function for [`isOwner`](#isowner-value-). Calls `ref.unown()`, returning the inner value. Safe to call on values that don't implement [`isOwner`](#isowner-value-).

See [`agent.unown()`](#agent-unown-) for examples.

---

### `deref(ref)`

Complementary function for [`isRef`](#isref-value-). Calls `ref.deref()` once, if possible. Safe to call on values that don't implement [`isRef`](#isref-value-).

```js
deref('value')                           // 'value'
deref(new es.Atom('value'))              // 'value'
deref(new es.Atom(new es.Atom('value'))) // new es.Atom('value')
deref({deref() {return 'value'}})        // 'value'
```

---

### `derefDeep(ref)`

Complementary function for [`isRef`](#isref-value-). Calls `ref.deref()` and continues recursively, eventually returning a non-ref. Safe to call on values that don't implement [`isRef`](#isref-value-).

This function is _non-reactive_. To deref by path reactively, use `scan`.

```js
deref('value')                           // 'value'
deref(new es.Atom('value'))              // 'value'
deref(new es.Atom(new es.Atom('value'))) // 'value'
deref({deref() {return 'value'}})        // 'value'
```

---

### `derefIn(ref, path)`

Derefs the ref and returns the value at `path`, similar to [`fpx.getIn`](https://mitranim.com/fpx/#-getin-value-path-). When called on values that don't implement [`isRef`](#isref-value-), this is equivalent to `fpx.getIn`.

This function is _non-reactive_. To deref by path reactively, use `scan`.

```js
derefIn(new es.Atom({one: {two: 2}}), ['one', 'two'])
// 2
derefIn(new es.Atom({nested: new es.Atom('val')}), ['nested'])
// Atom('val')
derefIn({one: {two: 2}}, ['one', 'two'])
// 2
```

---

### `scan(ref, ...path)`

Derefs the ref and returns the value at `path`. Similar to `derefIn(ref, path)`, but reactive. If this happens in a reactive context, such as [`Reaction.run`](#reaction-run-fun-ontrigger-) or a view component render, this will implicitly subscribe to that path via [`pathQuery`](#pathquery-observableref-path-pathquery).

```js
const atom = new es.Atom({one: {two: 10}})

Reaction.loop(() => {
  console.log(es.scan(atom, 'one', 'two')) // Initially 10, always up to date.
})
```

---

### `contextSubscribe(obs)`

where `obs: isObservable`

Enables implicit reactivity when implementing observable refs. Must be called in `get $`, but not in `deref()`.

```js
class MyAtom extends es.Observable {
  constructor(value) {
    this.value = value
  }

  get $() {
    es.contextSubscribe(this)
    return this.deref()
  }

  set $(value) {
    this.reset(value)
  }

  deref() {
    return this.value
  }
}
```

---

### `replaceContextSubscribe(subscribe)`

where `subscribe: ƒ(isObservable)`

Tool for creating a context in which observable refs are implicitly reactive. Used internally by [`Reaction`](#reaction-). Usage is tricky; see the source of [`Reaction.run`](#reaction-run-fun-ontrigger-) to get an idea.

---

## React Views

Espo comes with an optional React adapter that allows views to automatically subscribe to observable refs just by using them. Unsubscription is also automatic. As a bonus, this can automatically trigger data fetching via `.onInit` and `.onDeinit`; see [`Observable`](#observable-) for an example.

### `initViewComponent(view)`

Setup:

```js
import * as es from 'espo'
import {Component} from 'react'
import {initViewComponent} from 'espo/react'

class ViewComponent extends Component {
  constructor() {
    super(...arguments)
    initViewComponent(this)
  }
}
```

Usage:

```js
const atom = new es.Atom(10)

class View extends ViewComponent {
  render() {
    return <div>{atom.$}</div> // Always up to date.
  }
}
```

---

## Author

Nelo Mitranim: https://mitranim.com
