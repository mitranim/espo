// See `impl.md` for implementation notes.

/* Primary API */

export function isDe(val) {return isComplex(val) && 'deinit' in val}
export function isObs(val) {return isDe(val) && isTrig(val) && 'sub' in val && 'unsub' in val}
export function isTrig(val) {return isComplex(val) && 'trig' in val}
export function isSub(val) {return isFun(val) || isTrig(val)}
export function isSubber(val) {return isFun(val) || (isComplex(val) && 'subTo' in val)}
export function isRunTrig(val) {return isComplex(val) && 'run' in val && isTrig(val)}
export function deinit(val) {if (isDe(val)) val.deinit()}

export function ph(ref) {return ref ? ref[keyPh] : undefined}
export function self(ref) {return ref ? ref[keySelf] : undefined}

export function de(ref) {return new Proxy(ref, deinitPh)}
export function obs(ref) {return new Proxy(ref, new (getPh(ref) || ObsPh)())}
export function lazyComp(ref, fun) {return pro(ref, new (getPh(ref) || LazyCompPh)(fun))}
export function comp(ref, fun) {return pro(ref, new (getPh(ref) || CompPh)(fun))}

export class Deinit {constructor() {return de(this)}}
export class Obs {constructor() {return obs(this)}}
export class LazyComp {constructor(fun) {return lazyComp(this, fun)}}
export class Comp {constructor(fun) {return comp(this, fun)}}

/* Secondary API (lower level, semi-undocumented) */

export const ctx = {subber: undefined}
export const keyPh = Symbol.for('ph')
export const keySelf = Symbol.for('self')

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

  trig() {}

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

  trig(...args) {
    if (!this.act) this.ref.trig(...args)
  }
}

export class Loop extends Rec {
  constructor(ref) {
    valid(ref, isSub)
    super()
    this.ref = ref
  }

  onRun() {
    subTrig(this.ref)
  }

  trig() {
    if (!this.act) this.run()
  }
}

export class DeinitPh {
  has(tar, key) {
    return key in tar || key === keyPh || key === keySelf || key === 'deinit'
  }

  get(tar, key) {
    if (key === keyPh) return this
    if (key === keySelf) return tar
    if (key === 'deinit') return dePhDeinit
    return tar[key]
  }

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

// WTB better name. Undocumented.
export class ObsBase extends Set {
  onInit() {}
  onDeinit() {}

  sub(val) {
    valid(val, isSub)
    const {size} = this
    this.add(val)
    if (!size) this.onInit()
  }

  unsub(val) {
    const {size} = this
    this.delete(val)
    if (size && !this.size) this.onDeinit()
  }

  trig() {
    if (sch.paused) {
      sch.add(this)
      return
    }
    this.forEach(subTrig)
  }

  deinit() {
    this.forEach(this.unsub, this)
  }
}

export class ObsPh extends ObsBase {
  constructor() {
    super()
    this.pro = undefined
  }

  has() {
    return DeinitPh.prototype.has.apply(this, arguments)
  }

  get(tar, key) {
    if (key === keyPh) return this
    if (key === keySelf) return tar
    if (key === 'deinit') return phDeinit
    if (!hidden(tar, key)) ctxSub(this)
    return tar[key]
  }

  set(tar, key, val) {
    if (set(tar, key, val)) this.trig()
    return true
  }

  deleteProperty(tar, key) {
    if (del(tar, key)) this.trig()
    return true
  }

  onInit() {
    if (this.pro && 'onInit' in this.pro) this.pro.onInit()
  }

  onDeinit() {
    if (this.pro && 'onDeinit' in this.pro) this.pro.onDeinit()
  }
}

export class LazyCompPh extends ObsPh {
  constructor(fun) {
    valid(fun, isFun)
    super()
    this.fun = fun
    this.out = true // "outdated"
    this.cre = new CompRec(this)
  }

  get(tar, key) {
    if (key === keyPh) return this
    if (key === keySelf) return tar
    if (key === 'deinit') return phDeinit

    if (!hidden(tar, key) && !this.act()) {
      ctxSub(this)
      this.rec()
    }

    return tar[key]
  }

  rec() {
    if (!this.out || this.act()) return
    this.out = false
    this.cre.run()
  }

  // Invoked by `CompRec`.
  run() {return this.fun.call(this.pro, this.pro)}
  trig() {this.out = true}

  act() {return ctx.subber === this.cre}
  onInit() {this.cre.init()}
  onDeinit() {this.cre.deinit()}
}

export class CompPh extends LazyCompPh {
  trig() {
    super.trig()
    this.rec()
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
  try {
    for (const key in src) tar[key] = src[key]
    return tar
  }
  finally {sch.resume()}
}

export function priv(ref, key, val) {
  valid(key, isKey)
  Object.defineProperty(ref, key, {value: val, writable: true, configurable: true})
}

export function privs(ref, vals) {
  valid(vals, isStruct)
  for (const key in vals) priv(ref, key, vals[key])
}

export function bind(ref, ...names) {
  valid(ref, isComplex)
  names.forEach(bindMethod, ref)
}

export function paused(fun, ...args) {
  valid(fun, isFun)
  sch.pause()
  try {return fun.apply(this, args)}
  finally {sch.resume()}
}

/* Internal utils */

function getPh(ref) {return ref.constructor && ref.constructor.ph}

function pro(ref, ph) {
  const pro = new Proxy(ref, ph)
  ph.pro = pro
  return pro
}

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

function dePhDeinit() {
  deinitAll(this)
  deinit(self(this))
}

function phDeinit() {
  ph(this).deinit()
  const ref = self(this)
  deinitAll(ref)
  deinit(ref)
}

export function deinitAll(ref) {
  valid(ref, isComplex)
  for (const key in ref) if (ownEnum(ref, key)) deinit(ref[key])
}

function bindMethod(key) {
  const val = this[key]
  if (!isFun(val)) throw Error(`expected method at key ${key}, found ${val}`)
  priv(this, key, val.bind(this))
}

function subTrig(val) {
  if (isFun(val)) val()
  else val.trig()
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
  obs.trig()
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

function isFun(val) {return typeof val === 'function'}
function isComplex(val) {return isObj(val) || isFun(val) }
function isObj(val) {return val !== null && typeof val === 'object'}
function isStruct(val) {return isObj(val) && !Array.isArray(val) }
function isKey(val) {return isStr(val) || isSym(val) }
function isStr(val) {return typeof val === 'string'}
function isSym(val) {return typeof val === 'symbol'}

function valid(val, test) {
  if (!test(val)) throw Error(`expected ${show(val)} to satisfy test ${show(test)}`)
}

// Placeholder, might improve.
function show(val) {return String(val)}
