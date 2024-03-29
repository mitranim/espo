## Overview

Observables via [proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). Particularly suited for UI programming. Features:

* Implicit sub/resub, just by accessing properties.
* Implicit trigger, by property modification.
* Any object can be made observable; see [`obs`](#function-obsref). Subclassing is available but not required.
* Arbitrary properties can be observed. No need for special annotations. (Opt-out via non-enumerables.)
* Implicit resource cleanup: automatically calls `.deinit()` on removed/replaced objects.
* Your objects are squeaky clean, with no added library junk other than mandatory `.deinit()`.
* Nice-to-use in plain JS. Doesn't rely on decorators, TS features, etc.
* Easy to wire into any UI system. Comes with optional adapters for React (`react.mjs`) and custom DOM elements (`dom.mjs`).

Tiny (a few KiB _un_-minified) and dependency-free. Native JS module.

Known limitations:

* No special support for collections.
* When targeting IE, requires transpilation and ES2015 polyfills.

## TOC

* [Usage](#usage)
  * [Install](#install)
  * [Trichotomy of proxy/handler/target](#trichotomy-of-proxyhandlertarget)
  * [Implicit sub/resub](#implicit-subresub)
  * [Auto-deinit](#auto-deinit)
  * [Enumerable vs non-enumerable](#enumerable-vs-non-enumerable)
  * [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass)
* [API](#api)
  * [`interface isDe`](#interface-isdeval)
  * [`interface isObs`](#interface-isobsval)
  * [`interface isTrig`](#interface-istrigval)
  * [`interface isSub`](#interface-issubval)
  * [`interface isSubber`](#interface-issubberval)
  * [`interface isRunTrig`](#interface-isruntrigval)
  * [`function ph`](#function-phref)
  * [`function self`](#function-selfref)
  * [`function de`](#function-deref)
  * [`function obs`](#function-obsref)
  * [`function comp`](#function-compref-fun)
  * [`function lazyComp`](#function-lazycompref-fun)
  * [`class Deinit`](#class-deinit)
  * [`class Obs`](#class-obs)
  * [`class Comp`](#class-compfun)
  * [`class LazyComp`](#class-lazycompfun)
  * [`class Loop`](#class-loopref-issub)
  * [`class Moebius`](#class-moebiusref-isruntrig)
  * [`class DeinitPh`](#class-deinitph)
  * [`class ObsPh`](#class-obsph)
  * [`class CompPh`](#class-compphfun)
  * [`class LazyCompPh`](#class-lazycompphfun)
  * [`class Sched`](#class-sched)
  * [`const sch`](#const-sch)
  * [`function mut`](#function-mutref-src)
  * [`function deinit`](#function-deinitval)
  * [Undocumented](#undocumented)

## Usage

### Install

```sh
npm i -E espo
```

Espo uses native JS modules, which work both in Node and browsers. It's even usable in browsers without a bundler; use either an importmap (polyfillable), an exact file path, or a full URL.

```js
import * as es from 'espo'

import * as es from './node_modules/espo/espo.mjs'

import * as es from 'https://cdn.jsdelivr.net/npm/espo@0.8.2/espo.mjs'
```

### Trichotomy of proxy/handler/target

While Espo is fairly magical (🧚 fairy magical?), the user must be aware of proxies. In Espo, your objects aren't "observables" in a classic sense, full of special properties and methods. Instead, they remain clean, but wrapped into a `Proxy`, together with a _proxy handler_ object, which is the actual state of the observable, with subscribers, explicit sub/unsub methods, and so on.

Mostly, you wrap via [`obs`](#function-obsref) or by subclassing [`Obs`](#class-obs), and just use the resulting proxy as if it was the original object. [Implicit sub/resub](#implicit-subresub) relies on proxy features. For explicit sub/unsub, access the proxy handler via [`ph`](#function-phref), and call the handler's methods.

```js
import * as es from 'espo'

const target = {someProp: 'someVal'}

// Same as `es.obs(target)`, but without support for `.onInit`/`.onDeinit`.
const obs = new Proxy(target, new es.ObsPh())

obs.someProp // 'someVal'

// The `es.ObsPh` object we instantiated before.
const ph = es.ph(obs)

ph.sub(function onTrigger() {})
```

### Implicit sub/resub

Espo provides features, such as [`comp`](#function-compref-fun) or [`Loop`](#class-loopref-issub), where you provide a function, and within that function, access to any observables' properties automatically establishes subscriptions. Triggering those observables causes a recomputation or a rerun. The timing of these events can be fine-tuned for your needs; [`lazyComp`](#function-lazycompref-fun) doesn't immediately recompute, and [`Moebius`](#class-moebiusref-isruntrig) doesn't immediately rerun.

See [`Loop`](#class-loopref-issub) for a simple example.

This is extremely handy for UI programming. Espo comes with optional adapters for React (`react.mjs`) and custom DOM elements (`dom.mjs`).

Example with React:

```js
import * as es from 'espo'
import * as esr from 'espo/react.mjs'

// Base class for your views. Has implicit reactivity in `render`.
class View extends Component {
  constructor() {
    super(...arguments)
    esr.viewInit(this)
  }
}

const one = es.obs({val: 10})
const two = es.obs({val: 20})

// Auto-updates on observable mutations.
class Page extends View {
  render() {
    return <div>current total: {one.val + two.val}</div>
  }
}
```

Example with custom DOM elements:

```js
import * as es from 'espo'
import * as ed from 'espo/dom.mjs'

const one = es.obs({val: 10})
const two = es.obs({val: 20})

class TotalElem extends ed.RecElem {
  // Runs on initialization and when triggered by observables.
  run() {
    this.textContent = `current total: ${one.val + two.val}`
  }
}
customElements.define(`a-total`, TotalElem)

class TotalText extends ed.RecText {
  constructor() {super(), this.upd()}

  // Runs on initialization and when triggered by observables.
  run() {
    this.textContent = `current total: ${one.val + two.val}`
  }
}
```

### Auto-deinit

In addition to observables, Espo implements automatic resource cleanup, relying on the following interface:

```ts
interface isDe {
  deinit(): void
}
```

On all Espo proxies, whenever an enumerable property is replaced or removed, the previous value is automatically deinited, if it implements this method.

All Espo proxies provide a `.deinit` method, which will:

* Call `.deinit` on the proxy handler, dropping all subscriptions.
* Call `.deinit` on all enumerable properties of the target (if implemented).
* Call `.deinit` on the proxy target (if implemented).

This allows your object hierarchies to have simple, convenient, correct lifecycle management.

### Enumerable vs non-enumerable

Non-enumerable properties are exempt from all Espo trickery. Their modifications don't trigger notifications, and they're never auto-deinited.

In the following example, `.owned` is auto-deinited, but `.owner` is not:

```js
class State extends es.Deinit {
  constructor(owner, owned) {
    super()
    this.owned = owned
    Object.defineProperty(this, 'owner', {value: owner})
  }
}

new State(owner, owned).deinit()
// Implicitly calls: `owned.deinit()`
```

For convenience, use the shortcuts `priv` and `privs`:

```js
es.privs(this, {owner})
```

### `new Proxy` vs function vs subclass

The core of Espo's functionality is the proxy handler classes. Ultimately, functions like [`obs`](#function-obsref) and classes like [`Obs`](#class-obs) are shortcuts for the following, with some additional wiring:

```js
new Proxy(target, new es.ObsPh())
```

Customization is done by subclassing one of the proxy handler classes, such as [`ObsPh`](#class-obsph), and providing the custom handler to your proxies, usually via `static get ph()` in your class. Everything else is just a shortcut.

The advantage of subclassing [`Deinit`](#class-deinit) or `Obs` is that after the `super()` call, `this` is already a proxy. This matters for bound methods, passing `this` to other code, and so on. When implementing your own observable classes, the recommendation is to _subclass `Deinit` or `Obs` when possible_, to minimize gotchas.

## API

Also see changelog: [changelog.md](changelog.md).

### `interface isDe(val)`

Short for "is deinitable". Implemented by every Espo object. All Espo proxies support automatic deinitialization of _arbitrary_ properties that implement this interface, when such properties are replaced or removed.

```ts
interface isDe {
  deinit(): void
}
```

### `interface isObs(val)`

Short for "is observable". Implemented by Espo proxy handlers such as [`ObsPh`](#class-obsph).

```ts
interface isObs {
  trig   ()           : void
  sub    (sub: isSub) : void
  unsub  (sub: isSub) : void
  deinit ()           : void
}

es.isObs(es.obs({}))        // false
es.isObs(es.ph(es.obs({}))) // true
```

### `interface isTrig(val)`

Short for "is triggerable". Part of some other interfaces.

```ts
interface isTrig {
  trig(): void
}
```

### `interface isSub(val)`

Short for "is subscriber / subscription". Interface for "triggerables" that get notified by observables. May be either a function, or an object implementing `isTrig`.

`isSub` is used for explicit subscriptions, such as `ObsPh.prototype.sub`, and must also be provided to [`Loop`](#class-loopref-issub).

Support for objects with a `.trig` method, in addition to functions, allows to avoid "bound methods", which is a common technique that leads to noisy code and inefficiencies.

```ts
type isSub = isTrig | () => void
```

### `interface isSubber(val)`

Internal interface. Used for implementing implicit reactivity by [`Loop`](#class-loopref-issub) and [`Moebius`](#class-moebiusref-isruntrig).

```ts
interface isSubber {
  subTo(obs: isObs): void
}
```

### `interface isRunTrig(val)`

Must be implemented by objects provided to [`Moebius`](#class-moebiusref-isruntrig). Allows a two-stage trigger: `.run` is invoked immediately; `.trig` is invoked on observable notifications, and may choose to loop back into `.run`.

```ts
interface isRunTrig {
  run(...any): void
  trig(): void
}
```

### `function ph(ref)`

Takes an Espo proxy and returns its handler. In Espo, the proxy handler is the _actual_ observable in a traditional sense, with subs/unsubs/triggers.

Because JS has no standard support for fetching a proxy's handler, this relies on special-case support from Espo proxy handlers, and will not work on others.

```js
const ref = es.obs({val: 10})

// Runtime exception: method doesn't exist.
ref.sub(onUpdate)

// This works: `ph` returns an instance of `ObsPh`,
// which is the actual observable state.
es.ph(ref).sub(onUpdate)

// Clears any current subscriptions,
// without invoking `deinit` on the target.
es.ph(ref).deinit()

function onUpdate() {}
```

### `function self(ref)`

Takes an Espo proxy and returns the underlying target. Mostly for internal use.

Because JS has no standard support for fetching a proxy's target, this relies on special-case support from Espo proxy handlers, and will not work on others.

### `function de(ref)`

Shortcut for:

```js
new Proxy(ref, es.deinitPh)
```

Takes an arbitrary object and returns a proxy that supports automatic deinit of replaced/removed enumerable properties that implement [`isDe`](#interface-isdeval). Non-enumerable properties are [exempt](#enumerable-vs-non-enumerable). The proxy always implements `isDe`, which will deinit _all_ enumerable properties on the target.

In all other respects, the proxy is the same as its target.

When implementing your own classes, the recommended approach is to subclass [`Deinit`](#class-deinit) instead. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

### `function obs(ref)`

Shortcut for the following, with some additional wiring:

```js
new Proxy(ref, new es.ObsPh())
```

Takes an arbitrary object and returns a proxy that combines the functionality of [`de`](#function-deref) with support for implicit reactivity. In reactive contexts, such as during a [`Loop`](#class-loopref-issub) or [`Moebius`](#class-moebiusref-isruntrig) run, accessing any of its enumerable properties, either directly or indirectly, will implicitly subscribe to this observable.

In all other respects, the proxy is the same as its target.

When implementing your own classes, the recommended approach is to subclass [`Obs`](#class-obs) instead. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

If the target implements `.onInit`, the handler will call it when adding the first subscription. If the target implements `.onDeinit`, the handler will call it when removing the last subscription:

```js
class X {
  constructor() {return es.obs(this)}
  onInit() {console.log('initing')}
  onDeinit() {console.log('deiniting')}
}
```

To use a different proxy handler class, implement `static get ph()` in your class; `obs` will prefer it:

```js
class X {
  constructor() {return es.obs(this)}

  static get ph() {return MyObsPh}
}

class MyObsPh extends es.ObsPh {}

// Proxy whose handler is an instance of `MyObsPh`.
new X()
```

### `function comp(ref, fun)`

Shortcut for the following, with some additional wiring:

```js
new Proxy(ref, new es.CompPh(fun))
```

Takes an arbitrary object and returns a variant of [`obs`](#function-obsref) which, in addition to its normal properties and behaviors, runs the attached function to compute additional properties, or recompute existing properties.

Very lazy. The recomputation doesn't run immediately. It runs on the first attempt to access any property. Then, it reruns _only_ when triggered by one of the observables accessed by the callback. However, it subscribes to those observables _only_ when it has its own subscribers. If you never subscribe to the computation, it will compute no more than once.

Remembers which observables were accessed by the callback, either directly or indirectly. Whenever the computation has its own subscribers, it's also subscribed to those observables, and their triggers cause recomputations. Whenever the computation has _no_ subscribers, it's also _not_ subscribed to those observables, but still remembers them.

The callback _must be synchronous_: not `async function` and not `function*`.

When implementing your own classes, the recommended approach is to subclass [`Comp`](#class-compfun) instead. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

```js
const one = es.obs({val: 10})
const two = es.obs({val: 20})

const ref = es.comp({val: 30}, ref => {
  ref.total = ref.val + one.val + two.val
})

// Allows active recomputation. Without this, changes would be ignored.
es.ph(ref).sub(function onUpdate() {})

console.log(ref.total) // 60

one.val = 40

console.log(ref.total) // 90

ref.deinit()
```

Just like `obs`, this function supports overriding the preferred proxy handler class via `static get ph()` in the target's class.

### `function lazyComp(ref, fun)`

Shortcut for the following, with some additional wiring:

```js
new Proxy(ref, new es.LazyCompPh(fun))
```

Even lazier than normal [`comp`](#function-compref-fun): when triggered by observables accessed in the callback, it merely marks itself as "outdated", but doesn't immediately recompute, and therefore doesn't notify its own subscribers of any changes. You must _pull_ the data from it. It doesn't _push_.

Aside from the lazy recomputation, it remains a proper observable. Any modifications of its properties may trigger notifications.

### `class Deinit()`

Class-shaped version of [`de`](#function-deref). Implemented as:

```js
class Deinit {constructor() {return de(this)}}
```

For your classes, subclassing this is recommended over `de`. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

### `class Obs()`

Class-shaped version of [`obs`](#function-obsref). Implemented as:

```js
class Obs {constructor() {return obs(this)}}
```

For your classes, subclassing this is recommended over `obs`. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

### `class Comp(fun)`

Class-shaped version of [`comp`](#function-compref-fun). Implemented as:

```js
class Comp {constructor(fun) {return comp(this, fun)}}
```

For your classes, subclassing this is recommended over `comp`. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

### `class LazyComp(fun)`

Class-shaped version of [`lazyComp`](#function-lazycompref-fun). Implemented as:

```js
class LazyComp {constructor(fun) {return lazyComp(this, fun)}}
```

For your classes, subclassing this is recommended over `lazyComp`. See [`new Proxy` vs function vs subclass](#new-proxy-vs-function-vs-subclass) for the "why".

### `class Loop(ref: isSub)`

Tool for implicit reactivity. Code that runs within a `Loop` implicitly subscribes to Espo observables just by accessing their properties. Especially suited for automatic UI updates.

See the example below. Also see the optional adapter `dom.mjs`, which implements implicit reactivity in custom DOM elements.

```js
const one = es.obs({val: 10})
const two = es.obs({val: 20})

const loop = new es.Loop(() => {
  console.log('current total:', one.val + two.val)
})
loop.trig()
// current total: 30

one.val = 30
// current total: 50

two.val = 40
// current total: 70

loop.deinit()
```

### `class Moebius(ref: isRunTrig)`

Tool for implicit reactivity. Similar to [`Loop`](#class-loopref-issub), more flexible, and more complex to use. Instead of taking _one_ function, it takes _two_, in the form of an object that implements `.run` and `.trig`. Calling `moebius.run` invokes `ref.run`, automatically subscribing to any observables whose properties were accessed. When those properties trigger, `moebius` will call `ref.trig`, which has the freedom to loop back into `moebius.run`, directly or indirectly. Whether this becomes a loop, is completely up to you. Also, unlike `Loop`, `moebius.run` is not void: it returns the result of calling the underlying `ref.run`.

It's difficult to provide an example not too abstract. See the optional adapter `react.mjs`, which uses `Moebius` for automatic reactivity in React components.

### `class DeinitPh()`

Proxy handler used by [`de`](#function-deref) and [`Deinit`](#class-deinit). Stateless; Espo uses a single global instance exported as `deinitPh`. Exported for subclassing.

### `class ObsPh()`

Proxy handler used by [`obs`](#function-obsref) and [`Obs`](#class-obs). Exported for customization by advanced users.

This is the real "observable" in a traditional sense. It implements [`isObs`](#interface-isobsval), handling subscription/unsubscription/notification.

Use `obs` or `Obs` to turn arbitrary objects into observable proxies. For explicit sub/unsub, use [`ph`](#function-phref) to access the underlying `ObsPh`. For implicit sub/unsub via [`Loop`](#class-loopref-issub) or [`Moebius`](#class-moebiusref-isruntrig), accessing the handler is unnecessary.

To use a custom subclass of `ObsPh` (or something totally different), either directly pass it to `new Proxy`, or implement `static get ph()` in your target class:

```js
class X extends es.Obs {
  static get ph() {return MyObsPh}
}

class MyObsPh extends es.ObsPh {}
```

### `class CompPh(fun)`

Proxy handler used by [`comp`](#function-compref-fun) and [`Comp`](#class-compfun). Exported for customization by advanced users.

### `class LazyCompPh(fun)`

Proxy handler used by [`lazyComp`](#function-lazycompref-fun) and [`LazyComp`](#class-lazycompfun). Exported for customization by advanced users.

### `class Sched()`

Tool for pausing and batching observable notifications. Only one instance exists, exported as [`sch`](#const-sch). See below.

### `const sch`

Singular [`Sched`](#class-sched) instance, used by Espo for pausing and batching observable notifications.

Use `sch.pause` and `sch.resume`, _always_ via `try/finally`, to group multiple triggers into one. When the scheduler is paused, observable triggers are queued up inside the scheduler, and flushed when it's resumed.

`pause` and `resume` are reentrant/stackable: it's okay to call them while already paused. The scheduler keeps a counter, and flushes when the counter goes down to 0.

For simply setting multiple properties, use the shortcut [`mut`](#function-mutref-src).

Example:

```js
const ref = es.obs({one: 10, two: 20, three: 30})

es.sch.pause()
try {
  ref.one++
  ref.two++
  ref.three++
}
finally {
  es.sch.resume()
}
```

### `function mut(ref, src)`

Shortcut for mutating multiple properties while paused via [`sch`](#const-sch), to avoid multiple triggers/notifications.

```js
const ref = es.obs({one: 10, two: 20, three: 30})

// This will set two properties, but trigger exactly once.
es.mut(ref, {one: 40, two: 50})

ref
// {one: 40, two: 50, three: 30}
```

### `function deinit(val)`

Calls `val.deinit()` if implemented. Otherwise a nop. Convenient for deiniting arbitrary values.

### Undocumented

Espo is friendly to 🔧🐒. Many useful tools are exposed but undocumented, to avoid bloating the docs. Take the time to skim the source file `espo.mjs`.

## License

https://unlicense.org

## Misc

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
