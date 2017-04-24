### `PathQuery(observableRef, path, equal)`

where `equal: ƒ(any, any): bool`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Reactive equivalent of [`derefIn(observableRef, path)`](#-derefin-ref-path-).
Filters redundant updates using the `equal` function. You can pair this with
<a href="https://github.com/Mitranim/emerge" target="_blank">Emerge</a> for
data transformations and deep value equality.

Lazy: doesn't update when it has no subscribers.

```js
// This will do for numbers
function equal (one, other) {
  return one === other
}

const atom = new Atom({outer: {inner: 10}})

const query = new PathQuery(atom, ['outer', 'inner'], equal)

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

In RxJS terms, `new PathQuery(observable, path, equal)` is roughly equivalent to
`observable.map(value => fpx.getIn(value, path)).distinct(equal)`.

---
