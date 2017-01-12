## Utils

### `global`

Current global context. In browser, it's `window`, in Node.js, it's `global`, in
webworkers, it's `self`, and so on.

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

----

### `isImplementation(iface, value)`

Rough approximation of `X implements interface Y` from statically typed
languages. Takes an object emulating an "interface" and a value that needs to be
tested. True if `value` has at least the same properties as `iface`,
with the same types; ignores any other properties on `value`.

Duck-typed replacement for `instanceof`, particularly useful in "class" constructors.

```js
const iface = {prop: 'blah', method () {}}
isImplementation(iface, {})                                 =  false
isImplementation(iface, {prop: 'blah blah', method () {}})  =  true

// Usage in constructors

function A () {
  if (!isImplementation(A.prototype, this)) return new A()
}

assign(A.prototype, {someMethod () {}})

function B () {
  if (!isImplementation(B.prototype, this)) return new B()
  A.call(this)
}

// B doesn't inherit directly from A; it uses A as a mixin.
// Therefore, the B constructor wouldn't work properly if A used an `instanceof` check.
assign(B.prototype, A.prototype)

// This succeeds because isImplementation(A.prototype, B()) = true
const b = B()
```

----

### `bindAll(object)`

Finds all properties of `object` that are functions and binds them to `object`
so they become bound methods and can be freely detached.

```js
// Setup
const object = {self () {return this}}
object.self() === object

// Detached methods don't work if unbound
const self = object.self
self() === global

// After `bindAll`, detached methods work
bindAll(object)
const boundSelf = object.self
boundSelf === object
```

----

### `final(object, key, value)`

Like `const`, but for object properties. Like `let` in Swift or `final` in Java.
Defines a property that can't be reassigned or deleted. Returns `object`.

```js
const object = {}
final(object, 'one', 1)
object.one === 1
object.one = 10  // exception in strict mode
```

----

### `assign(target, ...sources)`

Mutates `target`, assigning enumerable properties (own and inherited) from each
`source`. Returns `target`.

Mutation is often misused. It's necessary when dealing with prototypes, but when
working with data, you should program in a functional style. Use a library like
<a href="https://github.com/Mitranim/emerge" target="_blank">Emerge</a>
for functional transformations.

```js
assign()                        =  {}
assign({})                      =  {}
assign({}, {one: 1}, {two: 2})  =  {one: 1, two: 2}
```

----

### `push(list, value)`

Mutates `list`, appending `value`. Similar to `list.push(value)`, but takes
exactly one argument and returns `list`.

```js
push([10], 20) = [10, 20]
```

----

### `pull(list, value)`

Mutates `list`, removing one occurrence of `value`, comparing values with
<a href="http://mitranim.com/fpx/#-is-one-other-" target="_blank">`fpx.is`</a>
. Returns `list`.

```js
pull([10, 20], 10) = [20]
```

----

### `setIn(object, path, value)`

Mutates `object`, assigning `value` at `path`, where `path` is a list of keys.
If the path doesn't exist, it's created as a series of nested dicts. Returns
`value`.

You should never use this for data. When dealing with data, you should program
in a functional style, using a library like
<a href="https://github.com/Mitranim/emerge" target="_blank">Emerge</a>.

```js
const tree = {}
setIn(tree, ['one', 'two'], 100)
// tree is now {one: {two: 100}}
```

----

### `redef(storage, path, reconstructor)`

Like `setIn`, but accepts a reconstructor function that will receive the current
value at `path` and return the new value to be set. Returns the resulting value.

```js
function report (value) {console.info(value)}
const que = redef(global, ['dev', 'que'], que => que || Que(report))
```

----

### `defonce(storage, path, constructor, ...args)`

Similar to `redef`, but won't even call the `constructor` if a value already
exists at `path`. Accepts additional arguments to pass to the constructor.

```js
function report (value) {console.info(value)}
const que = defonce(global, ['dev', 'que'], Que, report)
```

----
