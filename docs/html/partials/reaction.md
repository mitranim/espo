### `Reaction(def)`

`extends` [`Observable`](#-observable-)

`implements` [`isObservableRef`](#-isobservableref-value-)

where `def: ƒ(runner)`

Defines a reactive computation that depends on any number of observable refs in
terms of a single declarative function. Based on [`Runner`](#-runner-). Lazy:
doesn't update when it has no subscribers.

```js
const one = new Atom(10)
const other = new Atom({outer: {inner: 20}})
const inOther = new PathQuery(other, ['outer', 'inner'], (a, b) => a === b)

const reaction = new Reaction(({deref}) => {
  return deref(one) + deref(inOther)
})

reaction.deref()  // undefined

const sub = reaction.subscribe(({deref}) => {
  console.info(deref())
})

reaction.deref()  // 30

one.swap(value => 'hello')
// 'hello20'

other.swap(value => ({outer: {inner: ' world'}}))
// 'hello world'

sub.deinit()

// reaction is now inert and safe to leave to GC
// alternatively, call reaction.deinit() to drop all subs
```

---
