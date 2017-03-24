## Classes

Espo provides several utility classes. They're subclassable in ES2015.
Properties and methods are enumerable and instance-bound.

### `Que(deque)`

Synchronous, unbounded, FIFO queue. Takes a `deque` function that will process
the values put on the queue in a strict linear order. The calls to `deque` never
overlap.

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

Returns a bound `que.pull` for `value` (see below).

```js
function deque (value) {
  if (value === 'first') {
    que.push('second')
    que.push('third')
  }
  console.info(value)
}

const que = new Que(deque)

const abortFirst = que.push('first')

// prints:
// 'first'
// 'second'
// 'third'
```

#### `que.pull(value)`

Removes the first occurrence of `value` from `que`, using
<a href="http://mitranim.com/fpx/#-is-one-other-" target="_blank">`fpx.is`</a>
for equality checks. Has no effect if all occurrences of `value` have already
been dequed.

```js
function deque (value) {console.info(value)}
const que = new Que(deque)
que.dam()
const abort = que.push('test')
abort()
que.flush()
// nothing happens
```

#### `que.dam()`

Pauses an idle que. A dammed que accumulates values added by `.push()`, but
doesn't flush automatically. This allows you to delay processing, batching
multiple values. Call `.flush()` to unpause and resume processing.

Has no effect if the que is already flushing at the time of the call.

```js
function deque (value) {console.info(value)}

const que = new Que(deque)

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

---

### `TaskQue()`

Special case of `Que`: a synchronous, unbounded, FIFO task queue. You put
functions on it, and they execute in a strict linear order.

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

See example above.

Adds `task` to the end of the queue. It will be called with `args` as arguments
and `taskQue` as `this` after executing all other tasks that are already in the
queue. If the que is not dammed, this automatically triggers `.flush()`.

Returns a function that removes the task from the que when called.

```js
const taskQue = new TaskQue()
taskQue.dam()
const abort = taskQue.push(function report () {console.info('reporting')})
abort()
taskQue.flush()
// nothing happens
```

#### `taskQue.dam()`

See [`que.dam()`](#-que-dam-).

#### `taskQue.flush()`

See [`que.flush()`](#-que-flush-).

#### `taskQue.isEmpty()`

See [`que.isEmpty()`](#-que-isempty-).

---

### `Atom(state)`

Satisfies [`isReactiveSource`](#-isreactivesource-value-).

Very similar to
<a href="https://clojuredocs.org/clojure.core/atom" target="_blank">`clojure.core/atom`</a>.

Conceptually, it can be viewed as:

  * a cross between "smart pointer to an immutable value" and "observable"
  * a unit of reactive state with a strictly linear timeline that advances transactionally

You can use `Atom` as a unit of reactivity in JS applications, particularly as
a substitute for Redux. In this case, it's highly recommended to pair it with
<a href="https://github.com/Mitranim/emerge" target="_blank">Emerge</a> for
efficient functional transformations of nested data structures.

```js
const atom = new Atom(10)

const removeSubscriber = atom.addSubscriber((atom, prev, next) => {
  console.info(prev, next)
})

atom.swap(value => value + 1)
// reports 10, 11

atom.swap(value => value + 100)
// reports 11, 111

removeSubscriber()
```

#### `atom.state`

Current value of `atom`.

#### `atom.swap(mod, ...args)`

where `mod = ƒ(atom.state, ...args)`

Calls `mod` with the current value of the atom and the optional extra args.
Resets `atom` to the resulting value and notifies the subscribers. Returns the
newly committed state.

Swap commits the new state immediately, before it returns. However, subscriber
notifications are put on an internal [`TaskQue`](#-taskque-) so that they never
overlap. This means that if you're calling `swap` inside an ongoing subscriber
notification, the next notification will happen "asynchronously" in relation to
this code, even though it runs in the same call stack.

```js
const atom = new Atom(10)
// atom.state = 10
const add = (a, b, c) => a + b + c
const newState = atom.swap(add, 1, 2)
// newState = atom.state = add(10, 1, 2) = 13
```

#### `atom.addSubscriber(fun)`

where `fun = ƒ(atom, prevState, nextState)`

Registers `fun` as a subscriber that will be called on each state transition.
Returns a function that removes `fun` from the subscribers when called.

#### `atom.removeSubscriber(fun)`

Removes `fun` from the subscribers.

---

### `Subber()`

Satisfies [`isDeconstructible`](#-isdeconstructible-value-).

Utility for establishing multiple subscriptions to multiple reactive data
sources, implicitly, without any syntactic noise. It allows you to run a
function that simply tries to read the data, which becomes the basis of
subscriptions.

```js
const holly = new Atom({left: 10})
const molly = new Atom({right: 20})

const subber = new Subber()

function reader (subber) {
  return subber.read(holly, ['left']) * subber.read(molly, ['right'])
}

function updater (subber) {
  console.info('new value:', subber.run(reader, updater))
}

const value = subber.run(reader, updater)

value === 200
// true

subber.value === value
// true

holly.swap(state => ({left: state.left * 3}))
// $ 'got notified'

subber.value === 600
```

#### `read(source, query)`

where `source: isReactiveSource`

Queries `source` with `query` via `source.read()`. Implicitly establishes
a reactive subscription when called within a `subber.run()` (see below).

#### `run(reader, updater)`

where `reader: ƒ(subber)`, `updater: ƒ(subber)`

Calls `reader`, passing self as the argument. During this call, every call to
`subber.read()` implicitly establishes a reactive subscription for the given
source/query pair. Multiple `.read()` calls create multiple subscriptions.
Whenever the result of any of these queries changes, the subber will remove
_all_ existing subscriptions and call `updater`, which is free to call
`subber.run()` and restart the cycle.

It's ok to `subber.run()` again before the updater has been called. It will
forget the previous subscriptions and the previous updater, replacing them with
the new ones.

---

### `Deconstructor()`

Satisfies [`isDeconstructible`](#-isdeconstructible-value-).

Aggregator of deconstructibles that you assign directly onto it. It will
deconstruct each of them when destroyed.

```js
const dc = new Deconstructor()

dc.lc = new Lifecycler()

// nesting works
dc.otherDc = new Deconstructor()

dc.otherDc.lc = new Lifecycler()

dc.deconstructor()

// both dc's are now empty, and both lc's have been deconstructed
```

---

### `Lifecycler()`

Satisfies [`isDeconstructible`](#-isdeconstructible-value-).

Utility for reversible initialisation and reinitialisation.

TODO document motivation and usage.

`initer`, `reiniter`, `deiniter` look like this: `ƒ(root, onDeinit): void`

#### `init(root, initer)`

#### `reinit(newRoot, reiniter)`

#### `deinit([deiniter])`

#### `onDeinit(deiniter)`

#### `Lifecycler.init(root, initer)`

---

### `FixedLifecycler(config)`

Satisfies [`isDeconstructible`](#-isdeconstructible-value-).

Version of [`Lifecycler`](#-lifecycler-) for cases where the actions for getting
root, initing, and deiniting are always the same.

TODO document motivation and usage.

`config`:

```
interface {
  getRoot(prevRoot, onDeinit): any
  initer(root, onDeinit): void
  deiniter(root, onDeinit): void
}
```

#### `init()`

#### `reinit()`

#### `deinit()`

---
