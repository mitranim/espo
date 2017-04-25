### `Reaction()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Enables implicit, procedurally-driven reactivity. Write code that looks like a
plain synchronous function, but is actually reactive. With `Reaction`, you
should never again subscribe or unsubscribe manually. Simply pull data from
[`observable refs`](#-isobservableref-value-). The subscriptions are updated on
each run, and therefore may change over time.

See [`Computation`](#-computation-def-equal-) for an observable variant.

```js
const one = new Atom(10)
const other = new Atom(20)

const reaction = Reaction.loop(({deref}) => {
  console.info(deref(one), deref(other))
})
// prints 10, 20

one.swap(value => 'hello')
// prints 'hello', 20

other.swap(value => 'world')
// prints 'hello', 'world'

reaction.deinit()
```

#### `reaction.run(fun, onTrigger)`

where `fun: ƒ(reaction)`, `onTrigger: ƒ(reaction)`

Runs `fun` in the context of the reaction, subscribing to any
[`observable refs`](#-isobservableref-value-)
passed to `.deref()` during the run. Returns the result of `fun`.
`onTrigger` will be called when any of the subscribed observables are triggered.

The subscriptions created during a `.run()` race with each other. As soon as one
is triggered, all subscriptions are invalidated and `onTrigger` is called. Until
the next `.run()`, which is usually immediate, no further triggers will occur,
but subscriptions remain "active" until the end of the next `.run()`, at which
point they're replaced with the new subscriptions and deinited. They're also
deinited on `.deinit()`. Overlapping the subscription lifetimes allows to avoid
premature deinitialisation of lazy observables.

```js
const atom = new Atom(10)

const reaction = new Reaction()

reaction.run(
  function effect ({deref}) {
    return deref(atom)
  },
  function update () {
    console.info('notified')
    // maybe rerun
  }
)
// 10

atom.swap(value => 20)
// 'notified'

reaction.deinit()
```

#### `reaction.deref(ref)`

Outside a `.run()`, equivalent to [`deref(ref)`](#-deref-ref-). During a
`.run()`, and if `ref` implements [`isObservable `](#-isobservable-value-),
implicitly subscribes to `ref`. See the examples above.

#### static `Reaction.loop(fun)`

Creates and starts a reaction that reruns `fun` on every change. See the examples
above.

---
