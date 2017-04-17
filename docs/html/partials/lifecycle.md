### `Lifecycler()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Utility for safe, reversible initialisation, reinitialisation and deinitialisation.

TODO examples.

#### `lifecycler.init()`

If idle, calls `.onInit()`. Otherwise a no-op. Automatically deduplicated, safe
to call multiple times, whether during an ongoing initialisation or afterwards.
If called during an ongoing deinitialisation, will reinit afterwards.

#### `lifecycler.reinit()`

If idle, calls `.init()`. Otherwise, calls `.deinit()` and then `.init()`.

#### `lifecycler.deinit()`

If active, flushes the pending functions registered with `.onDeinit()`, and
becomes idle. Otherwise a no-op. Automatically deduplicated, safe to call
multiple times, whether during an ongoing deinitialisation or afterwards. If
called during an ongoing initialisation, will deinit afterwards.

#### `lifecycler.onInit()`

No-op by default. Override in a subclass or on a plain `Lifecycler` instance.
Called when initialising.

#### `lifecycler.onDeinit(fun)`

where `fun: ƒ(lifecycler)`

Registers `fun` to be called on the next deinitialisation. May be called
multiple times, registering multiple funs in an internal [`Que`](#-que-deque-).
Resilient to exceptions: the functions registered by `.onDeinit()` won't
interfere with each other.

Should be used inside `.onInit()` when acquiring resources to defer their
release until the lifecycler's deinit.

---
