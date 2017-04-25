### `Computation(def, equal)`

where `def: ƒ(Reaction), equal: ƒ(any, any): bool`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

Defines a reactive computation that pulls data from multiple observable refs.
Filters redundant updates using the `equal` function. Based on
[`Reaction`](#-reaction-). Lazy: doesn't update when it has no subscribers.

Inspired by [Reagent's `reaction`](https://github.com/Day8/re-frame/blob/master/docs/SubscriptionFlow.md#how-flow-happens-in-reagent).

```js
const eq = (a, b) => a === b
const one = new Atom(10)
const other = new Atom({outer: {inner: 20}})
const inOther = new PathQuery(other, ['outer', 'inner'], eq)

const computation = new Computation(({deref}) => {
  return deref(one) + deref(inOther)
}, eq)

computation.deref()  // undefined

const sub = computation.subscribe(({deref}) => {
  console.info(deref())
})

computation.deref()  // 30

one.swap(value => 'hello')
// 'hello20'

other.swap(value => ({outer: {inner: ' world'}}))
// 'hello world'

sub.deinit()

// computation is now inert and safe to leave to GC
// alternatively, call computation.deinit() to drop all subs
```

---
