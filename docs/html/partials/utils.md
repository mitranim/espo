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

### `bindAll(object)`

Takes a mutable object and binds all of its methods to it, via
[`Function.prototype.bind`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
They become _bound methods_ and can be freely detached.

Currently supports only enumerable properties (both own and inherited), and
therefore doesn't work with spec-compliant classes.

Returns the same `object`.

```js
// Setup
const object = {getSelf () {return this}}
object.getSelf() === object

// Detached unbound method: doesn't work
const unbound = object.getSelf
unbound() === global  // true

// Detached bound method: works
bindAll(object)
const bound = object.getSelf
bound() === object  // true
```

---

### `assign(object, ...sources)`

Similar to
[`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign).
Mutates `object`, assigning enumerable properties (own and inherited) from each
`source`. Returns the same `object`.

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

Mutates `array`, removing one occurrence of `value` from the start, comparing by
[`fpx.is`](https://mitranim.com/fpx/#-is-one-other-). Returns `array`.

Counterpart to the built-ins
[`Array.prototype.push`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push)
and
[`Array.prototype.unshift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift).

```js
const array = [10, 20]
pull(array, 10)  // returns `array`
array  // [20]
```

---

### `deref(ref)`

Safely dereferences the provided [`ref`](#-isref-value-), recursively calling
`.deref()` until it produces a non-ref.

```js
deref(10)                                            // 10
deref({deref () {return 100}})                       // 100
deref({deref () {return {deref () {return 1000}}}})  // 1000
```

---

### `derefIn(ref, path)`

Like [`deref`](#-deref-ref-) but on a nested path. Recursively dereferences any
nested refs while drilling down.

```js
derefIn(10, [])  // 10

const ref = {
  deref () {
    return {
      nested: {
        deref () {
          return 100
        }
      }
    }
  }
}

derefIn(ref, ['nested'])  // 100
```

---

### `derefAt(path, ref)`

Same as `derefIn(ref, path)`. Useful for
[partial application](https://mitranim.com/fpx/#-bind-fun-args-)
when `path` is known in advance.

---
