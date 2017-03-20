## Classes

Espo's "classes" are defined using classic prototypal techniques and don't
follow the ES2015 class spec. They can be called without `new`, methods are
enumerable and instance-bound. In addition, they use
[`isImplementation`](#-isimplementation-iface-value-)
rather than `instanceof` for the constructor self-check, making them
usable as mixins for multiple inheritance. Nevertheless, they're subclassable
in ES2015.

### `Que(deque)`

A synchronous, unbounded, FIFO queue. Takes a `deque` function that will process
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

const que = Que(deque)

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

const que = Que(deque)

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
const que = Que(deque)
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

const que = Que(deque)

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
const taskQue = TaskQue()

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
const taskQue = TaskQue()
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
const atom = Atom(10)

const removeWatcher = atom.addWatcher((atom, prev, next) => {
  console.info(prev, next)
})

atom.swap(value => value + 1)
// reports 10, 11

atom.swap(value => value + 100)
// reports 11, 111

removeWatcher()
```

#### `atom.state`

Current value of `atom`.

#### `atom.swap(mod, ...args)`

where `mod = ƒ(atom.state, ...args)`

Calls `mod` with the current value of the atom and the optional extra args.
Resets `atom` to the resulting value and notifies the watchers. Returns the
newly committed state.

Swap commits the new state immediately, before it returns. However, watcher
notifications are put on an internal [`TaskQue`](#-taskque-) so that they never
overlap. This means that if you're calling `swap` inside an ongoing watcher
notification, the next notification will happen "asynchronously" in relation to
this code, even though it runs in the same call stack.

```js
const atom = Atom(10)
// atom.state = 10
const add = (a, b, c) => a + b + c
const newState = atom.swap(add, 1, 2)
// newState = atom.state = add(10, 1, 2) = 13
```

#### `atom.addWatcher(fun)`

where `fun = ƒ(atom, prevState, nextState)`

Registers `fun` as a watcher that will be called on each state transition.
Returns a function that removes `fun` from the watchers when called.

#### `atom.removeWatcher(fun)`

Removes `fun` from the watchers.

---

### `Deconstructor()`

Satisfies [`isDeconstructible`](#-isdeconstructible-value-).

Aggregator of deconstructibles that you assign directly onto it. It will
deconstruct each of them when destroyed.

```js
const dc = Deconstructor()

dc.lc = Lifecycler()

// nesting works
dc.otherDc = Deconstructor()

dc.otherDc.lc = Lifecycler()

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
