### `Query(observableRef, query, equal)`

where `query: ƒ(any): any, equal: ƒ(any, any): bool`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Creates an observable that derives its value from `observableRef` by calling
`query` and filters redundant updates by calling `equal`. Lazy: doesn't update
when it has no subscribers.

```js
const eq = (a, b) => a === b
const atom = new Atom({outer: {inner: 10}})
const query = new Query(atom, (value => value.outer.inner * 2), eq)

query.deref()  // undefined

const sub = query.subscribe(query => {
  console.info(query.deref())
})

query.deref()  // 20

atom.reset({outer: {inner: 20}})
// prints 40

// now the query is inert again
sub.deinit()
```

In RxJS terms, `new Query(observableRef, query, equal)` is equivalent to
`observable.map(query).distinctUntilChanged(equal)`.

---

### `PathQuery(observableRef, path, equal)`

where `path: [string|number], equal: ƒ(any, any): bool`

`extends` [`Query`](#-query-observableref-query-equal-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Special case of `Query`. Shortcut to accessing value by path.

```js
new PathQuery(observableRef, path, equal)
// equivalent to:
new Query(observableRef, value => derefIn(value, path), equal)
```

```js
const eq = (a, b) => a === b
const atom = new Atom({outer: {inner: 10}})
const query = new PathQuery(atom, ['outer', 'inner'], eq)

query.deref()  // undefined

const sub = query.subscribe(query => {
  console.info(query.deref())
})

query.deref()  // 10

atom.reset({outer: {inner: 20}})
// prints 20

// now the query is inert again
sub.deinit()
```
