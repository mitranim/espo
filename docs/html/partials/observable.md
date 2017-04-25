### `Observable()`

`implements` [`isDeinitable`](#-isdeinitable-value-), [`isObservable`](#-isobservable-value-)

Base class for implementing [`observables`](#-isobservable-value-) and
[`observable refs`](#-isobservableref-value-). Not useful on its own.
See [`Atom`](#-atom-value-) and [`Computation`](#-computation-def-equal-), which are based
on this.

Uses subscription counting to lazily initialise and deinitialise. Calls
`.onInit()` when adding the first subscription, and `.onDeinit()` when removing
the last. May initialise and deinitialise repeatedly over the course of its
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
