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
