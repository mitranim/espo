import {isFunction, validate} from 'fpx'
import {isDeinitable} from './lifetime'
import {isRef} from './ref'

/**
 * Interfaces
 */

export function isRc (value) {
  return (
    isDeinitable(value) &&
    isRef(value) &&
    isFunction(value.clone) &&
    isFunction(value.weak)
  )
}

export function isWeak (value) {
  return (
    isRef(value) &&
    isFunction(value.isEmpty) &&
    isFunction(value.clone) &&
    isFunction(value.rc)
  )
}

// TODO duck-typed interface (currently subset of isWeak, easy to mistake)
export function isLazyRc (value) {
  return value instanceof LazyRc
}

/**
 * Classes
 */

// Usage:
//   const rc1 = Rc.new(myDeinitable)  // refcount = 1
//   const rc2 = rc1.clone()           // refcount = 2
//   const weak = rc1.weak()
//   ...
//   const _ = rc1.deref()             // access underlying value
//   ...
//   rc1.deinit()                      // refcount = 1
//   rc2.deinit()                      // refcount = 0, myDeinitable is dropped and deinited
export class Rc {
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

Rc.prototype.states = {
  ALIVE: 'ALIVE',
  DEAD: 'DEAD',
}

export class Weak {
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

export class RcPtr {
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

RcPtr.prototype.states = {
  ALIVE: 'ALIVE',
  DEAD: 'DEAD',
}

export class LazyRc {
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
