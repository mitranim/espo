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

---

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

---

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

---

### `final(object, key, value)`

Like `const`, but for object properties. Like `let` in Swift or `final` in Java.
Defines a property that can't be reassigned or deleted. Returns `object`.

```js
const object = {}
final(object, 'one', 1)
object.one === 1
object.one = 10  // exception in strict mode
```

---

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

---

### `push(list, value)`

Mutates `list`, appending `value`. Similar to `list.push(value)`, but takes
exactly one argument and returns `list`.

```js
push([10], 20) = [10, 20]
```

---

### `pull(list, value)`

Mutates `list`, removing one occurrence of `value`, comparing values with
<a href="http://mitranim.com/fpx/#-is-one-other-" target="_blank">`fpx.is`</a>
. Returns `list`.

```js
pull([10, 20], 10) = [20]
```

---

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

---

### `redef(storage, path, reconstructor)`

Like `setIn`, but accepts a reconstructor function that will receive the current
value at `path` and return the new value to be set. Returns the resulting value.

```js
function report (value) {console.info(value)}
const que = redef(global, ['dev', 'que'], que => que || Que(report))
```

---

### `defonce(storage, path, constructor, ...args)`

Similar to `redef`, but won't even call the `constructor` if a value already
exists at `path`. Accepts additional arguments to pass to the constructor.

```js
function report (value) {console.info(value)}
const que = defonce(global, ['dev', 'que'], Que, report)
```

---

### `valueDescriptors(values)`

Converts a dict of properties into _enumerable_ property descriptors for
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create" target="_blank">`Object.create`</a>
or
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty" target="_blank">`Object.defineProperty`</a>.

```js
Object.create(somePrototype, valueDescriptors({
  someProperty: 100,
  someMethod () {},
}))
```

---

### `hiddenDescriptors(values)`

Converts a dict of properties into _non-enumerable_ property descriptors for
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create" target="_blank">`Object.create`</a>
or
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty" target="_blank">`Object.defineProperty`</a>.

```js
Object.create(somePrototype, hiddenDescriptors({
  someProperty: 100,
  someMethod () {},
}))
```

---

### `subclassOf(Superclass, Subclass)`

Utility for manual inheritance. Makes the given subclass constructor inherit
from the given superclass. This includes instance properties, instance methods,
static properties, static methods.

Unless you know you want this, use
<a href="http://babeljs.io/learn-es2015/#ecmascript-2015-features-classes" target="_blank">ES2015 classes</a>
instead.

```js
function Super () {
  if (!(this instanceof Super)) return new Super(...arguments)
  bindAll(this)
}

// Instance
assign(Super.prototype, {
  instanceProp: '<my instance prop>',
  instanceMethod () {},
})

// Statics
assign(Super, {
  staticProp: '<my static prop>',
  staticMethod () {},
})

function Sub () {
  if (!(this instanceof Sub)) return new Sub(...arguments)
  Super.apply(this, arguments)
}

subclassOf(Super, Sub)

// Sub now has instance and static props from Super
```

---

### `subclassWithProps(Superclass, props)`

Creates a new subclass of `Superclass` with `props` added to its prototype. The
resulting subclass may be called without `new`.

```js
const Subclass = subclassWithProps(SomeSuperclass, {
  subProp: '<my instance prop>',
  subMethod () {},
})

const sub = Subclass()
```

---

### `subclassBy(getProps)`

Creates a function that will accept a superclass and produce a
[`subclassWithProps`](#-subclasswithprops-superclass-props-) with the result of
calling `getProps` with the superclass.

Useful when developing an API with customisable class transforms.

```js
const transform = subclassBy(Superclass => {
  const {prototype: {someMethod}} = Superclass
  return {
    someProp: '<my instance prop>',
    someMethod () {
      // super
      someMethod.apply(this, arguments)
    },
  }
})

const Subclass = transform(SomeSuperclass)

const sub = Subclass()
```

---

### `hackClassBy(getProps)`

Similar to [`subclassBy`](#-subclassby-getprops-). Creates a function that will
accept a superclass, but instead of creating a new subclass, it will assign the
result of `getProps` directly to its prototype.

Useful when developing an API with chainable class transforms, when you don't
care about "losing" the original superclass. Should cost less memory and
performance than `subclassBy`. Requires care: if one of the methods you're
hacking dynamically reads its "super" method from the same prototype, you'll get
infinite recursion. In this case, simply swap this for `subclassBy`.

```js
const transform = hackClassBy(Superclass => {
  const {prototype: {someMethod}} = Superclass

  return {
    someProp: '<my instance prop>',
    someMethod () {
      // super
      someMethod.apply(this, arguments)
    },
  }
})

const Subclass = transform(SomeSuperclass)

Subclass === SomeSuperclass  // true

const sub = Subclass()
```

---
