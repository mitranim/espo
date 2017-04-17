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
