### `PathQuery(observableRef, path)`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Reactive equivalent of [`derefIn(observableRef, path)`](#-derefin-ref-path-).
Lazy: doesn't update when it has no subscribers.

```js
const atom = new Atom({outer: {inner: 10}})

const query = new PathQuery(atom, ['outer', 'inner'])

query.deref()  // undefined

const sub = query.subscribe(query => {
  console.info(query.deref())
})

query.deref()  // 10

atom.swap(value => ({outer: {inner: 20}}))
// prints 20

// now the query is inert again
sub.deinit()
```

---
