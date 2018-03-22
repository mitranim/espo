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
`onTrigger` will be called when any of those observable refs is triggered.

The subscriptions created during a `.run()` race with each other. As soon as one
is triggered, all subscriptions are invalidated and `onTrigger` is called. Until
the next `.run()`, which is typically [immediate](#static-reaction-loop-fun-),
no further triggers will occur, but subscriptions remain "active" until the end
of the next `.run()`, at which point they're replaced with the new subscriptions
and deinited. They're also deinited on `.deinit()`. Overlapping the subscription
lifetimes allows to avoid premature deinitialisation of lazy observables.

```js
const reaction = new Reaction()

const atom = new Atom(10)

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

#### `reaction.deref(ref)` <span class="text-italic fg-gray font-smaller">bound method</span>

Outside a `.run()`, equivalent to [`deref(ref)`](#-deref-ref-). During a
`.run()`, and if `ref` implements [`isObservable `](#-isobservable-value-),
implicitly subscribes to `ref`. See the examples above.

`.deref()` is instance-bound for convenient destructuring.

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

#### static `Reaction.loop(fun)`

Creates and starts a reaction using its `loop` method. If the first run produces an exception, automatically deinits the reaction to prevent subscription leaks. See the first usage example above.
