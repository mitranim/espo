## Interfaces

Espo's "interfaces" are abstract definitions and, at the same time, boolean tests
for class instances.

### `isDeconstructible(value)`

Defines an object with a `deconstructor` method. It should be the opposite of
`constructor`: deinitialise the object into inert state.

See [`Deconstructor`](#-deconstructor-).

```js
interface Deconstructible {
  deconstructor(): void
}

isDeconstructible({})
// false

class Deconstructible {
  constructor () {
    this.state = acquireExternalState()
  }

  deconstructor () {
    this.state.free()
    this.state = null
  }
}

isDeconstructible(new Deconstructible())
// true
```

---

### `isReactiveSource(value)`

See [`Atom`](#-atom-state-) and [`Subber`](#-subber-).

```js
interface ReactiveSource {
  deconstructor(): void
  read(query): any
  addSubscriber(subscriber): removeSubscriber
  removeSubscriber(subscriber): void
}

isReactiveSource({})
// false

isReactiveSource(new Atom())
// true
```

---
