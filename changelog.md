## 0.8.0

No significant changes in `espo.mjs`.

Renamed `elem.mjs` to `dom.mjs` and revised it:

* Provide scheduling via `Sched`.
  * Hierarchic updates: ancestors before descendants.
  * Async scheduling and batching.
  * Customizable via pluggable timer.
* Provide reactive base classes:
  * `RecElem` for `HTMLElement` subclasses.
  * `RecText` for `Text` subclasses.
  * `FunText`: specialized version of `RecText` that takes a function and renders its result.
* Remove element prototype hacks.

## 0.7.5

* Interface checks now use both `in` and `typeof === 'function'`.
* Renamed undocumented `lazy` to `lazyGet`.
* In `elem.mjs`, `rec` no longer requires the target DOM element class to define an `init` method. By default it delegates to `reinit`.

## 0.7.4

Added `lazy` (undocumented).

## 0.7.3

Added `pub` and `pubs` (undocumented).

## 0.7.2

`priv` now correctly changes pre-existing properties to non-enumerable.

## 0.7.1

Added `bindAll` (undocumented).

## 0.7.0

Improvements in undocumented function `bind`. Instead of taking method names, it takes methods themselves, and binds them by name. This is compatible with minifiers because they usually don't mangle method names.

## 0.6.5

Minor enhancement: `inert` preserves `this`, just like `paused`.

## 0.6.4

The React adapter works properly again. (After the `0.6.0` rework, wasn't tested until now.)

Added `inert` (undocumented).

## 0.6.3

Comps should now properly notify their subs.

## 0.6.2

After the initial computation on first property access, comp now recomputes only when triggered.

## 0.6.1

Minor correction in files pushed to NPM.

## 0.6.0

Massive revision. Now proxy-based, much simpler, more powerful, more efficient.

* Subclassing `Obs` is no longer required.
* Arbitrary objects can be observed.
* No more "immutable data". The new version is mutability-oriented.
* No more "plain data". The new version is class-oriented.
* No more tree diffing. Change detection is done only on individual properties.
* Observation and auto-deinit works for arbitrary properties.
* No more "containers". Data is observed directly. Two levels have been flattened into one.
* No more "atoms" or conventional properties. Every observed object is an open set of arbitrary properties. No more `$` or `.deref()`.
* No more "queries" or "path queries". Use hierarchies of typed objects instead.
* No more "subscriber" objects. Fewer allocations overall. Allocation-free triggers and updates (from the JS perspective).
* Automatic deduplication of subscriptions.
* Subscriptions may be objects rather than functions. Allows simpler, more efficient code.
* Added an adapter for custom DOM elements.

## 0.5.4

Corrected `withContextSubscribe` so it _actually_ works.

## 0.5.3

Added `withContextSubscribe`.

## 0.5.2

Corrected the definition of `"exports"` in `package.json`.

## 0.5.1

Minor breaking change: removed the `react-change` dependency and the `shouldComponentUpdate` override. This is unrelated to Espo's functionality and was included by inertia when porting from a different repo. User code is free to use it manually.

## 0.5.0

Big breaking changes:

* Reactivity in `Reaction` and view components is now truly implicit. Instead of accepting `$` as a parameter and calling `$(observable)`, you simply dereference observables with `observable.$` everywhere in the code. External implementations of observables must opt into reactivity by calling `contextSubscribe(this)` in the `get $` getter.

* The React/Preact adapter has been moved from [Prax](https://github.com/mitranim/prax) to this repository and drastically simplified. See `initViewComponent`.

* Observables no longer internally use `Que`, and the subscription-triggering code has been inlined into `Observable.prototype.trigger` to create fewer stackframes. This makes debugging much easier.

* As a consequence of ↑, removed `Que`.

* As a consequence of removing `Que`, removed `TaskQue`.

* As a consequence of removing `Que`, removed `MessageQue`.

Small breaking changes:

* `deref` is no longer recursive and only derefs once. Added `derefDeep` to deref deeply.

* Removed `derefIn`.

* Removed the following utilities which shouldn't be part of Espo's API: `global`, `isMutable`, `assign`, `pull`, `each`. Some of them are available in the general utility library [fpx](https://github.com/mitranim/fpx).

Minor improvements:

* `Atom.prototype.$` also has a setter that calls `Atom.prototype.reset`. (Also affects `Agent`.)

* `Agent.prototype.reset` now performs diff and deinit of the previous state before triggering subscriptions. This solves some edge case deinitialization races.

* Removed the auxiliary class `ReactionContext`. `Reaction` now stores subscription arrays and cycles them between runs. This approach is simpler and should result in fewer allocations.

* Added some new utils such as `scan`.

## 0.4.6

Minor compatibility improvement: `flushBy` (which is undocumented) now accepts arbitrary array-like objects with `.push` and `.shift` methods. Can be handy for custom queues.

## 0.4.5

Improvements in `Computation` and `Query`:

* After recomputing the value and performing the equality check, the new value is stored only when not equal to the previous value. If equal, the previous value is kept. This may slightly improve change detection performance and memory efficiency.

* The function passed to `new Computation` is now called with the computation instance as `this`. This can be convenient when subclassing `Computation` and defining the computation function as a method.

## 0.4.4

When possible, `deinitDiff` and `deinitDeep` now use `Set` instead of `[]` to keep track of visited objects. Performs much better when traversing large structures. In environments without `Set`, this falls back on `[]`.

## 0.4.3

Minor internal cosmetics.

## 0.4.2

Bugfixed `Agent.prototype.unown` after recent changes.

## 0.4.1

Added missing "constructor" to a few prototypes.

## 0.4.0

Improved minification. Breaking.

* Code is now written with ES5-style classes to avoid Babel garbage in the output. This significantly reduces the amount of transpiled code and makes it much nicer to read.

* In the transpiled version, classes don't have IIFEs anymore, which means they're not stripped away by dead code elimination due to side-effectful prototype mutations. This turns out to be a benefit, since it further reduces the size, while DCE, realistically, tends to not work in real-world application bundles.

* Mangle all properties in all classes, except `.state` and `.states`. This reduces the API surface and chances of confusion, and greatly reduces the minified size.

* Aliased `.deref()` as `.$` (a getter) in all classes that implement `isObservableRef`. In addition, aliased `.deref` as `.$` (same method) in `Reaction`. This works with ES2015 destructuring, saves a lot of typing, and minifies a lot better, at the cost of lower readability.

* Added `Que.prototype.has` (tentative).

TLDR: Espo went from ≈10 KiB to ≈8 KiB, while slimming down the API surface and providing the nice `$` shortcuts.

## 0.3.3

Better compatibility with minification.

  * in the transpiled version, annotate class IIFEs with `#__PURE__`

  * don't assign to prototypes outside the autogenerated IIFEs

  * in combination with tree shaking, this finally allows UglifyJS to remove unused classes
