## Overview

Library for reactive and stateful programming: observables, implicit reactivity, automatic resource cleanup.

Documentation: https://mitranim.com/espo/.

## Installation and Usage

```sh
npm i --save espo
```

```js
const {someFunction} = require('espo')
```

See the API reference: https://mitranim.com/espo/.

## Changelog

### 0.4.5

Improvements in `Computation` and `Query`:

* After recomputing the value and performing the equality check, the new value is stored only when not equal to the previous value. If equal, the previous value is kept. This may slightly improve change detection performance and memory efficiency.

* The function passed to `new Computation` is now called with the computation instance as `this`. This can be convenient when subclassing `Computation` and defining the computation function as a method.

### 0.4.4

When possible, `deinitDiff` and `deinitDeep` now use `Set` instead of `[]` to keep track of visited objects. Performs much better when traversing large structures. In environments without `Set`, this falls back on `[]`.

### 0.4.3

Minor internal cosmetics.

### 0.4.2

Bugfixed `Agent.prototype.unown` after recent changes.

### 0.4.1

Added missing "constructor" to a few prototypes.

### 0.4.0

Improved minification. Breaking.

* Code is now written with ES5-style classes to avoid Babel garbage in the output. This significantly reduces the amount of transpiled code and makes it much nicer to read.

* In the transpiled version, classes don't have IIFEs anymore, which means they're not stripped away by dead code elimination due to side-effectful prototype mutations. This turns out to be a benefit, since it further reduces the size, while DCE, realistically, tends to not work in real-world application bundles.

* Mangle all properties in all classes, except `.state` and `.states`. This reduces the API surface and chances of confusion, and greatly reduces the minified size.

* Aliased `.deref()` as `.$` (a getter) in all classes that implement `isObservableRef`. In addition, aliased `.deref` as `.$` (same method) in `Reaction`. This works with ES2015 destructuring, saves a lot of typing, and minifies a lot better, at the cost of lower readability.

* Added `Que.prototype.has` (tentative).

TLDR: Espo went from ≈10 KiB to ≈8 KiB, while slimming down the API surface and providing the nice `$` shortcuts.

### 0.3.3

Better compatibility with minification.

  * in the transpiled version, annotate class IIFEs with `#__PURE__`

  * don't assign to prototypes outside the autogenerated IIFEs

  * in combination with tree shaking, this finally allows UglifyJS to remove unused classes

## Misc

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
