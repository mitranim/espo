## Interfaces

Espo's "interfaces" are abstract definitions and, at the same time, boolean tests
for class instances.

### `isDeconstructible(value)`

The `deconstructor` method should be the opposite of `constructor` that
deinitialises the object into inert state.

See [`Deconstructor`](#-deconstructor-).

```js
interface isDeconstructible {
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
