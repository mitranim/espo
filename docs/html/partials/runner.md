### `Runner()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Enables _implicit reactivity_. Write reactive code that looks like a
synchronous, declarative function. With `Runner`, you should never have to
manually subscribe and unsubscribe from observables again. Simply pull data from
[`observable refs`](#-isobservableref-value-) and implicitly get subscribed. The
subscriptions are updated on each run, and therefore may change over time.

```js
const one = new Atom(10)
const other = new Atom(20)

const runner = Runner.loop(({deref}) => {
  console.info(deref(one), deref(other))
})
// prints 10, 20

one.swap(value => 'hello')
// prints 'hello', 20

other.swap(value => 'world')
// prints 'hello', 'world'

runner.deinit()
```

#### `runner.run(fun, onTrigger)`

where `fun: ƒ(runner)`, `onTrigger: ƒ(runner)`

Runs `fun` in the runner's reactive context, subscribing to any
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

const runner = new Runner()

runner.run(
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

runner.deinit()
```

#### `runner.deref(ref)`

Outside a `.run()`, equivalent to [`deref(ref)`](#-deref-ref-). During a
`.run()`, and if `ref` implements [`isObservable `](#-isobservable-value-),
implicitly subscribes to `ref`. See the examples above.

#### static `Runner.loop(fun)`

Creates and starts a runner that reruns `fun` on every change. See the examples
above.

---
