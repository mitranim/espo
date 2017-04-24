'use strict'

const {testAnd, isFunction, validate} = require('fpx')
const {isDeinitable} = require('./deinit')
const {isRef} = require('./observable')

/**
 * Interfaces
 */

exports.isRc = isRc
function isRc (value) {
  return isRc_(value)
}

const isRc_ = testAnd(isDeinitable, isRef, {isFunction, clone: isFunction, weak: isFunction})

exports.isWeak = isWeak
function isWeak (value) {
  return isWeak_(value)
}

const isWeak_ = testAnd(isRef, {isEmpty: isFunction, clone: isFunction, rc: isFunction})

// TODO duck-typed interface (currently subset of isWeak, easy to mistake)
exports.isLazyRc = isLazyRc
function isLazyRc (value) {
  return value instanceof LazyRc
}

/**
 * Classes
 */

// Usage:
//   const rc = Rc.new(someDeinitableValue)
//   const more = rc.clone()  // increments refcount
//   const weak = rc.weak()   // ignored by refcount
//   ...
//   rc.deref()               // access underlying value
//   ...
//   rc.deinit()
//   more.deinit()            // someDeinitableValue is dropped and deinited
class Rc {
  constructor (ptr) {
    if (!(ptr instanceof RcPtr)) throw Error(`Expected an RcPtr`)
    if (ptr.isEmpty()) throw Error(`Expected non-empty RcPtr`)
    this.ptr = ptr
    this.ptr.inc()
    this.state = this.states.ALIVE
  }

  deref () {
    return this.ptr.deref()
  }

  clone () {
    return new Rc(this.ptr)
  }

  weak () {
    return new Weak(this.ptr)
  }

  deinit () {
    if (this.state !== this.states.ALIVE) return
    this.state = this.states.DEAD
    this.ptr.dec()
  }

  static new (value) {
    return new Rc(new RcPtr(value))
  }
}

exports.Rc = Rc

Rc.prototype.states = {
  ALIVE: 'ALIVE',
  DEAD: 'DEAD',
}

class Weak {
  constructor (ptr) {
    if (!(ptr instanceof RcPtr)) throw Error(`Expected an RcPtr`)
    if (ptr.isEmpty()) throw Error(`Expected non-empty RcPtr`)
    this.ptr = ptr
  }

  deref () {
    return this.isEmpty() ? undefined : this.ptr.deref()
  }

  isEmpty () {
    return this.ptr.isEmpty()
  }

  clone () {
    return new Weak(this.ptr)
  }

  rc () {
    return new Rc(this.ptr)
  }
}

exports.Weak = Weak

class RcPtr {
  constructor (value) {
    this.state = this.states.ALIVE
    this.value = value
    this.n = 0
  }

  deref () {
    if (this.isEmpty()) throw Error(`Can't deref when dead`)
    return this.value
  }

  isEmpty () {
    return this.state !== this.states.ALIVE
  }

  inc () {
    if (this.state !== this.states.ALIVE) {
      throw Error(`Can't increment refcount when dead`)
    }
    this.n += 1
  }

  dec () {
    if (this.state !== this.states.ALIVE) {
      throw Error(`Can't decrement refcount when dead`)
    }
    if (!(this.n > 0)) {
      throw Error(`Can't decrement refcount when there's no refs`)
    }

    this.n -= 1

    if (!this.n) {
      this.state = this.states.DEAD
      const {value} = this
      this.value = undefined
      if (isDeinitable(value)) value.deinit()
    }
  }

  // no deinit: value is shared-owned by Rcs
}

exports.RcPtr = RcPtr

RcPtr.prototype.states = {
  ALIVE: 'ALIVE',
  DEAD: 'DEAD',
}

class LazyRc {
  constructor (construct) {
    validate(isFunction, construct)
    this.construct = construct
    this.ptr = undefined
  }

  deref () {
    return this.isEmpty() ? undefined : this.ptr.deref()
  }

  isEmpty () {
    return !this.ptr || this.ptr.isEmpty()
  }

  rc () {
    if (this.isEmpty()) this.ptr = new RcPtr(this.construct())
    return new Rc(this.ptr)
  }

  // no deinit: doesn't own its value
}

exports.LazyRc = LazyRc
