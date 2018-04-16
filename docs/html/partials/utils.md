## Utils

### `global`

Current global context. Browser: `window`, Node.js: `global`, webworkers: `self`, and so on.

---

### `isMutable(value)`

True if `value` can be mutated (add/remove/modify properties). This includes
most objects and functions. False if `value` is frozen or a primitive (nil,
string, number, etc).

```js
isMutable({})                  =   true
isMutable(isMutable)           =   true
isMutable(null)                =   false
isMutable(Object.freeze({}))   =   false
```

---

### `assign(object, ...sources)`

Similar to [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). Mutates `object`, assigning enumerable properties (own and inherited) from each `source`. Returns the same `object`.

Stricter than `Object.assign`: requires the input to be mutable, doesn't silently replace a primitive with an object.

Be wary: mutation is often misused. When dealing with data, you should program
in a functional style, treating your data structures as immutable. Use a library
like [Emerge](https://github.com/Mitranim/emerge) for data transformations.

```js
assign()                        =  {}
assign({})                      =  {}
assign({}, {one: 1}, {two: 2})  =  {one: 1, two: 2}
```

---

### `pull(array, value)`

Mutates `array`, removing one occurrence of `value` from the start, comparing by an equivalent of <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is" target="_blank">`Object.is`</a>.

Counterpart to the built-ins [`Array.prototype.push`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push) and [`Array.prototype.unshift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift).

```js
const array = [10, 20]

pull(array, 10)

array
// [20]
```

---

### `deinit(ref)`

Complementary function for [`isDeinitable`](#-isdeinitable-value-). Calls
`ref.deinit()` if available. Safe to call on values that don't implement
[`isDeinitable`](#-isdeinitable-value-).

```js
const ref = {
  deinit () {
    console.info('deiniting')
  }
}

deinit(ref)
// 'deiniting'

// calling with a non-deinitable does nothing
deinit('non-deinitable')
```

---

### `deinitDiff(prev, next)`

Utility for automatic management of object lifetimes. See
[`isDeinitable`](#-isdeinitable-value-), [`isOwner`](#-isowner-value-),
[`Agent`](#-agent-value-) for more details and examples.

Diffs `prev` and `next`, deiniting any objects that implement [`isDeinitable`](#-isdeinitable-value-) and are present in `prev` but not in `next`. The diff algorithm recursively traverses plain data structures, but stops at non-plain objects, allowing you to safely include third party objects of unknown size and structure.

Definition of "plain data":

  * primitive: number, string, boolean, symbol, `null`, `undefined`
  * object based on `null` or `Object.prototype`
  * array

Everything else is considered non-data and is not traversed.

Resilient to exceptions: if a deiniter or a property accessor produces an
exception, `deinitDiff` will still traverse the rest of the tree, delaying
exceptions until the end.

Detects and avoids circular references.

```js
class Resource {
  constructor (name) {this.name = name}
  deinit () {console.info('deiniting:', this.name)}
}

class BlackBox {
  constructor (inner) {this.inner = inner}
}

const prev = {
  root: new Resource('Sirius'),
  dict: {
    inner: new Resource('Arcturus'),
  },
  list: [new Resource('Rigel')],
  // Sun is untouchable to deinitDiff because it's wrapped
  // into a non-plain object that doesn't implement isDeinitable
  blackBox: new BlackBox(new Resource('Sun'))
}

const next = {
  root: prev.root,
  dict: {
    inner: new Resource('Bellatrix')
  },
  list: null,
}

deinitDiff(prev, next)

// 'deiniting: Arcturus'
// 'deiniting: Rigel'

deinitDiff(next, null)

// 'deiniting: Sirius'
// 'deiniting: Bellatrix'
```

---

### `unown(ref)`

Complementary function for [`isOwner`](#-isowner-value-). Calls `ref.unown()`,
returning the inner value. Safe to call on values that don't implement
[`isOwner`](#-isowner-value-).

See [`agent.unown()`](#-agent-unown-) for examples.

---

### `deref(ref)`

Complementary function for [`isRef`](#-isref-value-). Calls `ref.deref()` and
continues recursively, eventually returning a non-ref. Safe to call on values
that don't implement [`isRef`](#-isref-value-).

```js
deref('value')                      // 'value'
deref(new Atom('value'))            // 'value'
deref(new Atom(new Atom('value')))  // 'value'
deref({deref () {return 'value'}})  // 'value'
```

---

### `derefIn(ref, path)`

Derefs the ref and returns the value at `path`, similar to [`fpx.getIn`](https://mitranim.com/fpx/#-getin-value-path-). When called on values that don't implement [`isRef`](#-isref-value-), this is equivalent to `fpx.getIn`.

```js
derefIn(new Atom({one: {two: 2}}), ['one', 'two'])
// 2
derefIn(new Atom({nested: new Atom('val')}), ['nested'])
// Atom('val')
derefIn({one: {two: 2}}, ['one', 'two'])
// 2
```
