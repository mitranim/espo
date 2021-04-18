# Implementation Notes

## Automatic Deinit

This library has a standard destructor interface:

```ts
interface isDe {
  deinit(): void
}
```

Whenever a property of an object proxied via `DeinitPh` or `ObsPh` is replaced or deleted, we call `.deinit()` on the previous value, if implemented. In addition, when an observable is deinited, all properties are cleared with `.deinit()`, as appropriate. This allows convenient, _correct_ state management.

Non-enumerable properties are exempt. In this case, `.owner` will _not_ be auto-deinited, but `.owned` will be:

```js
class State extends es.Deinit {
  constructor(owner, owned) {
    super()
    Object.defineProperty(this, 'owner', {value: owner})
    this.owned = owned
  }
}

new State(owner, owned).deinit()
// owned.deinit()
```

For convenience, use this shortcut:

```js
es.priv(this, 'owner', owner)
```
