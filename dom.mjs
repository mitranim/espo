/*
Optional adapter that enables implicit reactivity for custom DOM elements,
along with a scheduling system for async batching of updates.
Updates run hierarchically from ancestors to descendants.

See examples in `readme.md`.
*/

import * as e from './espo.mjs'

// Stubs to allow importing this module in non-browser environments.
const E = typeof HTMLElement === `function` ? HTMLElement : Object
const T = typeof Text === `function` ? Text : Object

// Short for "reactive element". Automatically watches observables.
export class RecElem extends E {
  constructor() {
    super()
    this.loop = new e.Moebius(this)
  }

  connectedCallback() {this.upd()}
  disconnectedCallback() {this.loop.deinit()}

  // Called by `Sched` and on initialization.
  upd() {this.loop.run()}

  // Called by `Moebius`.
  trig() {Sched.main.push(this)}

  // Called by `Moebius`. Override in subclass.
  run() {}
}

// Short for "reactive text". Automatically watches observables.
export class RecText extends T {
  constructor(val) {
    super(text(val))
    this.loop = new e.Moebius(this)
  }

  // Called by `Sched` and on initialization.
  upd() {this.loop.run()}

  // Called by `Moebius`.
  trig() {
    if (this.isConnected) Sched.main.push(this)
    else this.loop.deinit()
  }

  // Called by `Moebius`. Override in subclass.
  run() {}
}

export class FunText extends RecText {
  constructor(fun) {
    super()
    this.fun = fun
    this.upd()
  }

  run() {this.textContent = text(this.fun())}
}

/*
Node que used internally by `Sched`. Updates are scheduled by adding nodes to
the que, and flushed together as a batch by calling `.run()`. Nodes must
implement interface `isUpdNode` by providing method `.upd()`. Reentrant flush
is a nop.

TODO consider preventing exceptions from individual updates from interfering
with each other.
*/
export class Que extends Set {
  constructor() {
    super()
    this.running = false
  }

  add(val) {return super.add(e.req(val, isUpdNode))}

  run() {
    if (this.running) return this
    this.running = true

    try {
      for (const val of this) if (val.isConnected) val.upd()
    }
    finally {
      this.running = false
      this.clear()
    }
    return this
  }

  get [Symbol.toStringTag]() {return this.constructor.name}
}

// Fake/nop timer that always runs synchronously.
export class SyncTimer {
  constructor(ref) {this.ref = e.req(ref, isRunner)}
  schedule() {this.ref.run()}
  unschedule() {}
  get [Symbol.toStringTag]() {return this.constructor.name}
}

// Base implementation used by other timers. By itself it's a nop.
export class BaseTimer {
  constructor(ref) {
    this.id = undefined
    this.ref = e.req(ref, isRunner)
    this.run = this.run.bind(this)
  }

  // Override in subclass.
  timerInit() {}
  timerDeinit() {}

  run() {try {this.ref.run()} finally {this.unschedule()}}
  schedule() {if (!this.id) this.id = this.timerInit(this.run)}

  unschedule() {
    const {id} = this
    if (id) {
      this.id = undefined
      this.timerDeinit(id)
    }
  }

  deinit() {this.unschedule()}

  get [Symbol.toStringTag]() {return this.constructor.name}
}

// Default recommended timer.
export class RofTimer extends BaseTimer {
  timerInit(run) {return requestAnimationFrame(run)}
  timerDeinit(id) {cancelAnimationFrame(id)}
}

// Fallback alternative to `requestAnimationFrame`.
export class TimeoutTimer extends BaseTimer {
  timerInit(run) {return setTimeout(run)}
  timerDeinit(id) {clearTimeout(id)}
}

/*
Short for "scheduler". Tool for scheduling hierarchical updates of DOM nodes,
from ancestors to descendants. Nodes must implement interface `isUpdNode` by
providing method `.upd()`.
*/
export class Sched {
  constructor() {
    this.ques = []
    this.timer = new this.Timer(this)
  }

  // Main API for consumer code.
  push(val) {return this.add(val).schedule()}

  // Called by timer. Can also be flushed manually.
  run() {
    this.unschedule()
    for (const que of this.ques) if (que) que.run()
    return this
  }

  add(val) {
    if (val.isConnected) this.que(depth(val)).add(val)
    return this
  }

  que(depth) {
    e.req(depth, isNat)
    return this.ques[depth] || (this.ques[depth] = new this.Que())
  }

  schedule() {return this.timer.schedule(), this}
  unschedule() {return this.timer.unschedule(), this}
  deinit() {this.unschedule()}

  get Timer() {return RofTimer}
  get Que() {return Que}
  get [Symbol.toStringTag]() {return this.constructor.name}
}

// Default global instance. Should be used by all consumer code.
Sched.main = new Sched()

export function depth(node) {
  e.reqInst(node, Node)
  let out = 0
  while ((node = node.parentNode)) out++
  return out
}

// Used by timers.
export function isRunner(val) {return e.hasMeth(val, `run`)}

// Used by `Que`. Must be implemented by DOM nodes scheduled for updates.
export function isUpdNode(val) {
  return val instanceof Node && e.hasMeth(val, `upd`)
}

export function isTimer(val) {
  return e.hasMeth(val, `schedule`) && e.hasMeth(val, `unschedule`)
}

function isNat(val) {
  return typeof val === `number` && ((val % 1) === 0) && val >= 0
}

function text(val) {return val == null ? `` : val}
