### `Observable()`

`implements` [`isDeinitable`](#-isdeinitable-value-), [`isObservable`](#-isobservable-value-)

Base class for implementing [`observables`](#-isobservable-value-) and
[`observable refs`](#-isobservableref-value-). Not useful on its own.
See [`Atom`](#-atom-value-) and [`Reaction`](#-reaction-def-), which are based
on this.

Uses subscription counting to lazily initialise and deinitialise. Calls
`.onInit()` when adding the first subscription, and `.onDeinit()` when removing
the last. May initialise and deinitialise repeatedly over the course of its
lifetime. A subclass may override `.onInit()` and `.onDeinit()` to setup and
teardown any external resources it needs, such as HTTP requests or websockets.

#### `observable.subscribe(subscriber)`

where `subscriber: ƒ(observable)`

Conscripts `subscriber` to be called every time the observable is
[triggered](#-observable-trigger-).

Returns a subscription object that you can `.deinit()`. Deiniting a subscription
is immediate, even during an ongoing trigger.

```js
const sub = someObservableRef.subscribe(function subscriber (observable) {
  // get current value, do stuff
  observable.deref()
})

// call when you're done
sub.deinit()
```

#### `observable.unsubscribe(subscription)`

Same as `subscription.deinit()`.

#### `observable.trigger()`

Call to notify subscribers. Non-reentrant: if `.trigger()` is called during an
ongoing trigger, the redundant call is ignored.

#### `observable.onInit()`

Called when adding the first subscription.

#### `observable.onDeinit()`

Called when removing the last subscription.

#### `observable.deinit()`

Deinits all current subscriptions. This incidentally triggers `.onDeinit()` if
the observable is active.

---
