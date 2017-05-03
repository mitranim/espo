## Interfaces

Espo's "interfaces" are abstract definitions _and_ runtime boolean tests. Espo
utilities and classes check their inputs with these interfaces rather than with
`instanceof`.

### `isDeinitable(value)`

```js
interface isDeinitable {
  deinit(): void
}
```

Interface for objects that have a _lifetime_ and must be deinitialised before
you can leave them to the GC. `.deinit()` should make the object inert,
releasing any resources it owns, tearing down any subscriptions, etc.

```js
isDeinitable(null)            // false
isDeinitable(new Que())       // true
isDeinitable({deinit () {}})  // true
```

See complementary functions [`deinit`](#-deinit-ref-) and
[`deinitDiff`](#-deinitdiff-prev-next-).

---

### `isOwner(value)`

```js
interface isOwner {
  deinit(): void
  unwrap(): any
}
```

Interface for objects that wrap a value, automatically managing its lifetime.
Deiniting an owner should also deinit the inner value. See
[ownership](https://doc.rust-lang.org/book/ownership.html#ownership) in Rust.

`.unwrap()` should remove the inner value from the owner without deiniting it,
and return it to the caller. See
[move](https://doc.rust-lang.org/book/ownership.html#move-semantics) in Rust.

See [`Agent`](#-agent-value-) and [`agent.unwrap()`](#-agent-unwrap-) for
practical examples.

See complementary function [`unwrap`](#-unwrap-ref-).

```js
isOwner(new Atom())   // false
isOwner(new Agent())  // true
```

---

### `isRef(value)`

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

### `isObservable(value)`

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

### `isObservableRef(value)`

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

### `isSubscription(value)`

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