import {AssertionError} from 'assert'

export function is(actual, expected) {
  if (!Object.is(actual, expected)) {
    throw new AssertionError({
      actual,
      expected,
      operator: `Object.is`,
      stackStartFunction: is,
    })
  }
}

export function eq(actual, expected) {
  if (!equiv(actual, expected)) {
    throw new AssertionError({
      actual,
      expected,
      operator: `equiv`,
      stackStartFunction: eq,
    })
  }
}

export function throws(fun, ...args) {
  if (typeof fun !== 'function') {
    throw Error(`Expected a function, got ${fun}`)
  }

  try {
    fun(...args)
  }
  catch (_err) {
    return
  }

  throw Error(`Expected function "${fun.name || fun}" to throw`)
}

function equiv(one, two) {
  if (typeof one !== typeof two) return false

  if (Object.is(one, two)) return true

  if (isArr(one) && isArr(two)) {
    return one.length === two.length && one.every(equivAt, two)
  }

  if (isObj(one) && isObj(two)) {
    for (const key in one) if (!equiv(one[key], two[key])) return false
    for (const key in two) if (!equiv(two[key], one[key])) return false
    return true
  }

  return false
}

function equivAt(val, key) {
  return equiv(this[key], val)
}

function isObj(val) {
  return val !== null && typeof val === 'object'
}

function isArr(val) {
  return Array.isArray(val)
}

export function nop() {}

export class Tracker {
  constructor() {
    this.tr = 0
    this.de = 0
    Object.defineProperty(this, 'trig', {value: this.trig.bind(this)})
    Object.defineProperty(this, 'deinit', {value: this.deinit.bind(this)})
  }

  trig() {this.tr++}

  deinit() {this.de++}
}
