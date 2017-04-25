## Interfaces

Espo's "interfaces" are runtime boolean tests that also serve as abstract
definitions. Espo checks its inputs with these interfaces rather than `instanceof`.

#### `isDeinitable(value)`

```js
interface isDeinitable {
  deinit(): void
}
```

`.deinit()` should make the object inert, releasing any resources it owns,
tearing down any subscriptions, etc. After a `.deinit()` call, it should be safe
to leave the object to the GC.


```js
isDeinitable(null)            // false
isDeinitable(new Que())       // true
isDeinitable({deinit () {}})  // true
```

Use [`DeinitDict`](#-deinitdict-) to aggregate multiple deinitables.

---

#### `isRef(value)`

```js
interface isRef {
  deref(): any
}
```

Interface for objects that wrap a value, such as [`Atom`](#-atom-value-) or any
other [observable ref](#-isobservableref-value-). `.deref()` should return the
underlying value. Note: an object may point to _itself_, returning `this` from
`.deref()`.

```js
isRef(new Atom())      // true
new Atom(100).deref()  // 100
```

---

#### `isObservable(value)`

```js
interface isObservable {
  subscribe(subscriber: ƒ(...any)): isSubscription
  unsubscribe(subscription: isSubscription): void
}
```

Interface for objects that let you subscribe to notifications, such as
[`MessageQue`](#-messageque-), [`Atom`](#-atom-value-) or
[`Computation`](#-computation-def-equal-). See [`isSubscription`](#-issubscription-value-)
below.

---

#### `isObservableRef(value)`

```js
interface isObservableRef {
  deref(): any
  subscribe(subscriber: ƒ(observable)): isSubscription
  unsubscribe(subscription: isSubscription): void
}
```

Signifies that you can subscribe to be notified whenever the value wrapped
by the object changes, and call `.deref()` to get the new value.

Example: [`Atom`](#-atom-value-).

---

#### `isSubscription(value)`

```js
interface isSubscription {
  trigger(...any): void
  deinit(): void
}
```

Interface for subscription objects returned by
[`observable.subscribe()`](#-observable-subscribe-subscriber-).
The `.trigger()` method is called by the observable that created the
subscription. Calling `.deinit()` should stop the subscription _immediately_,
even if the observable has a pending notification.

---
