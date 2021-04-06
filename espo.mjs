// See `impl.md` for implementation notes.

export const ctx = {subber: undefined}

export function isDe(val) {
  return isComplex(val) && 'deinit' in val
}

export function isObs(val) {
  return isDe(val) && isTrig(val) && 'sub' in val && 'unsub' in val
}

export function isAtom(val) {
  return isComplex(val) && '$' in val
}

export function isTrig(val) {
  return isComplex(val) && 'trigger' in val
}

export function isSub(val) {
  return isFun(val) || isTrig(val)
}

export function isSubber(val) {
  return isFun(val) || (isComplex(val) && 'subTo' in val)
}

export function isRunTrig(val) {
  return isComplex(val) && 'run' in val && isTrig(val)
}

export function $(val) {
  return isAtom(val) ? val.$ : val
}

export function deinit(val) {
  if (isDe(val)) val.deinit()
}

export function deinitAll(ref) {
  valid(ref, isComplex)
  for (const key in ref) {
    if (ownEnum(ref, key)) deinit(ref[key])
  }
}

export function de(src) {
  return mut(new Deinit(), src)
}

export class Deinit {
  constructor() {
    return new Proxy(this, new.target.ph())
  }

  get self() {return this}

  deinit() {deinitAll(this)}

  static ph() {return deinitPh}
}

export function obs(src) {
  return mut(new Obs(), src)
}

export class Obs extends Deinit {
  onInit() {}

  onDeinit() {}

  sub(val) {
    valid(val, isSub)
    const state = stateGoc(this, ObsState)
    if (state.has(val)) return

    const {size} = state
    state.add(val)
    if (!size) this.onInit()
  }

  unsub(val) {
    const state = stateGet(this)
    if (!state) return

    const {size} = state
    state.delete(val)
    if (size && !state.size) this.onDeinit()
  }

  trigger() {
    if (sch.paused) {
      sch.add(this)
      return
    }

    const state = stateGet(this)
    if (state) state.forEach(subTrigger, this)
  }

  deinit() {
    const state = stateGet(this)
    if (state) state.forEach(this.unsub, this)
    super.deinit()
  }

  // Provided for debugging.
  get state() {return stateGet(this)}

  static ph() {return obsPh}
}

export class ObsState extends Set {}

export class Rec extends Set {
  constructor() {
    super()
    this.new = new Set()
    this.act = false
  }

  onRun() {}

  run(...args) {
    if (this.act) throw Error(`unexpected overlapping rec.run`)

    const {subber} = ctx
    ctx.subber = this
    this.act = true

    this.new.clear()
    sch.pause()

    try {
      return this.onRun(...args)
    }
    finally {
      ctx.subber = subber
      this.forEach(recDelOld, this)
      try {sch.resume()}
      finally {this.act = false}
    }
  }

  trigger() {}

  subTo(obs) {
    valid(obs, isObs)
    if (this.new.has(obs)) return
    this.new.add(obs)
    this.add(obs)
    obs.sub(this)
  }

  deinit() {
    this.forEach(recDel, this)
  }
}

export class Moebius extends Rec {
  constructor(ref) {
    valid(ref, isRunTrig)
    super()
    this.ref = ref
  }

  onRun(...args) {
    return this.ref.run(...args)
  }

  trigger(obs) {
    if (this.act) return
    this.ref.trigger(obs)
  }
}

export class Loop extends Rec {
  constructor(ref) {
    valid(ref, isSub)
    super()
    this.ref = ref
  }

  onRun() {
    const {ref} = this
    if (isFun(ref)) ref()
    else ref.trigger()
  }

  trigger() {
    if (this.act) return
    this.run()
  }
}

export function comp(fun) {return new Comp(fun)}

export class Comp extends Obs {
  constructor(fun) {
    valid(fun, isFun)
    super()
    stateSet(this, new CompState(this, fun))
  }

  onInit() {
    stateGet(this).init()
  }

  onDeinit() {
    stateGet(this).deinit()
  }

  // Provided for debugging.
  get state() {return stateGet(this)}

  static ph() {return compPh}
}

export class CompState extends ObsState {
  constructor(obs, fun) {
    super()
    this.cre = new CompRec(this)
    this.obs = obs
    this.fun = fun
    this.out = true // "outdated"
  }

  // Invoked by proxy.
  rec() {
    if (!this.out || this.act()) return
    this.out = false
    this.cre.run()
  }

  // Invoked by `CompRec`.
  run() {
    const {fun} = this
    return fun(this.obs)
  }

  // Invoked by `CompRec`.
  trigger() {
    this.out = true
  }

  act() {
    return ctx.subber === this.cre
  }

  init() {
    this.cre.init()
  }

  deinit() {
    this.cre.deinit()
  }
}

export class CompRec extends Moebius {
  subTo(obs) {
    valid(obs, isObs)
    this.new.add(obs)
    if (this.ref.size) {
      this.add(obs)
      obs.sub(this.ref)
    }
  }

  init() {
    this.new.forEach(compRecSub, this)
  }
}

export function atom(val) {return new Atom(val)}

export class Atom extends Obs {
  constructor(val) {
    super()
    this.$ = val
  }
}

export function atoc(fun) {return new AtomComp(fun)}

export class AtomComp extends Comp {
  constructor(fun) {
    super(atomRec)
    priv(this, 'f', fun)
  }
}

function atomRec(self) {
  self.$ = self.f(self)
}

export class Sub {
  constructor(obs, key) {
    valid(obs, isObs)
    this.obs = obs
    this.key = key
  }

  deinit() {
    const {obs, key} = this
    if (obs) {
      this.obs = undefined
      this.key = undefined
      obs.unsub(key)
    }
  }
}

export class Scheduler extends Set {
  constructor() {
    super()
    this.p = 0
  }

  get paused() {return this.p > 0}

  pause() {this.p++}

  resume() {
    if (!this.p) return
    this.p--
    if (!this.p) this.forEach(schFlush, this)
  }
}

export const sch = new Scheduler()

export const states = new WeakMap()

export function stateGoc(obs, cls) {
  valid(cls, isFun)
  return stateGet(obs) || stateSet(obs, new cls())
}

export function stateGet(obs) {
  return states.get(obs.self)
}

export function stateSet(obs, state) {
  states.set(obs.self, state)
  return state
}

export class DeinitPh {
  set(tar, key, val) {
    set(tar, key, val)
    return true
  }

  deleteProperty(tar, key) {
    del(tar, key)
    return true
  }
}

export const deinitPh = new DeinitPh()

export class ObsPh {
  get(tar, key, proxy) {
    if (key === 'self') return tar
    if (!hidden(tar, key)) ctxSub(proxy)
    return tar[key]
  }

  set(tar, key, val, proxy) {
    if (set(tar, key, val)) proxy.trigger()
    return true
  }

  deleteProperty(tar, key) {
    if (del(tar, key)) tar.trigger()
    return true
  }
}

export const obsPh = new ObsPh()

export class CompPh extends ObsPh {
  get(tar, key, proxy) {
    if (key === 'self') return tar

    if (!hidden(tar, key)) {
      const state = stateGet(tar)
      if (!state.act()) {
        ctxSub(proxy)
        state.rec()
      }
    }

    return tar[key]
  }
}

export const compPh = new CompPh()

function set(ref, key, next) {
  const de = ownEnum(ref, key)
  const prev = ref[key]
  ref[key] = next
  if (Object.is(prev, next)) return false
  if (de) deinit(prev)
  return true
}

function del(ref, key) {
  if (!own(ref, key)) return false
  const de = ownEnum(ref, key)
  const val = ref[key]
  delete ref[key]
  if (de) deinit(val)
  return true
}

export function ctxSub(obs) {
  const {subber} = ctx
  if (isFun(subber)) subber(obs)
  else if (isSubber(subber)) subber.subTo(obs)
}

export function mut(tar, src) {
  valid(tar, isStruct)
  if (!src) return tar
  valid(src, isStruct)

  sch.pause()
  try {return Object.assign(tar, src)}
  finally {sch.resume()}
}

export function priv(ref, key, val) {
  valid(key, isKey)
  Object.defineProperty(ref, key, {value: val, writable: true})
}

export function privs(ref, vals) {
  valid(vals, isStruct)
  for (const key in vals) priv(ref, key, vals[key])
}

export function bind(ref, ...names) {
  valid(ref, isComplex)
  names.forEach(bindMethodAt, ref)
}

function bindMethodAt(key, _i) {
  const val = this[key]
  if (!isFun(val)) throw Error(`expected method at key ${key}, found ${val}`)
  priv(this, key, val.bind(this))
}

export function paused(fun, ...args) {
  valid(fun, isFun)
  sch.pause()
  try {return fun.apply(this, args)}
  finally {sch.resume()}
}

function subTrigger(val) {
  if (isFun(val)) val(this)
  else val.trigger(this)
}

function recDelOld(obs) {
  if (!this.new.has(obs)) recDel.call(this, obs)
}

function recDel(obs) {
  this.delete(obs)
  obs.unsub(this)
}

function compRecSub(obs) {
  this.add(obs)
  obs.sub(this.ref)
}

function schFlush(obs) {
  this.delete(obs)
  obs.trigger()
}

export function hasHidden(val, key) {
  valid(key, isKey)
  return isComplex(val) && hidden(val, key)
}

function hidden(val, key) {
  return !ownEnum(val, key) && key in val
}

export function hasOwn(val, key) {
  valid(key, isKey)
  return isComplex(val) && own(val, key)
}

function own(val, key) {
  return Object.prototype.hasOwnProperty.call(val, key)
}

export function hasOwnEnum(val, key) {
  valid(key, isKey)
  return isComplex(val) && ownEnum(val, key)
}

export function ownEnum(val, key) {
  return Object.prototype.propertyIsEnumerable.call(val, key)
}

function isFun(val) {
  return typeof val === 'function'
}

function isComplex(val) {
  return isObj(val) || isFun(val)
}

function isObj(val) {
  return val !== null && typeof val === 'object'
}

function isStruct(val) {
  return isObj(val) && !Array.isArray(val)
}

function isKey(val) {
  return isStr(val) || isSym(val)
}

function isStr(val) {
  return typeof val === 'string'
}

function isSym(val) {
  return typeof val === 'symbol'
}

function valid(val, test) {
  if (!test(val)) throw Error(`expected ${val} to satisfy test ${test}`)
}
