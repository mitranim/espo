// Optional adapter for implicit reactivity in custom DOM elements.

import {Loop, priv} from './espo.mjs'

/*
Short for "reactive". Takes a custom DOM element class and patches its prototype
to support implicit reactivity with Espo observables. Usage:

  import * as es from 'espo'
  import * as ese from 'espo/elem.mjs'

  const obs = es.obs({val: 10})

  class Elem extends HTMLElement {
    init() {void obs.val}
    reinit() {this.textContent = obs.val}
  }

Accessing any observables in `.init` and `.reinit` automatically subscribes the
element to them. Observables call the element's `.trig` (standard Espo
interface, patched into the prototype by `rec`), which calls `.reinit`.
Meanwhile, `.init` should be used to establish initial subscriptions WITHOUT an
initial DOM update.
*/
export function rec(cls) {
  const {prototype: proto} = cls
  const {init, reinit} = proto

  if (!isFun(init)) throw Error(`class provided to "rec" must have an "init" method`)
  if (!isFun(reinit)) throw Error(`class provided to "rec" must have a "reinit" method`)

  mixin(proto, 'connectedCallback', espoConnectedCallback)
  mixin(proto, 'disconnectedCallback', espoDisconnectedCallback)
  mixin(proto, 'trig', espoTrig)
}

function espoConnectedCallback() {
  if (!this.loop) this.loop = new Loop(this)
  this.loop.trig()
}

function espoDisconnectedCallback() {
  if (this.loop) this.loop.deinit()
}

const inited = new WeakSet()

function espoTrig() {
  if (!inited.has(this)) {
    inited.add(this)
    this.init()
  }
  else {
    this.reinit()
  }
}

function mixin(proto, key, fun) {
  const prev = proto[key]

  if (!isFun(prev)) {
    priv(proto, key, fun)
    return
  }

  priv(proto, key, function multiMethod() {
    fun.apply(this, arguments)
    return prev.apply(this, arguments)
  })
}

function isFun(val) {return typeof val === 'function'}
