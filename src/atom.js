import {slice, is, isFunction, validate} from 'fpx'
import {Observable, isObservableRef} from './observable'

/**
 * Interfaces
 */

export function isAtom (value) {
  return isObservableRef(value) && isFunction(value.swap) && isFunction(value.reset)
}

/**
 * Classes
 */

export class Atom extends Observable {
  constructor (value) {
    super()
    this.value = value
  }

  deref () {
    return this.value
  }

  swap (mod) {
    validate(isFunction, mod)
    this.reset(mod(this.value, ...slice(arguments, 1)))
  }

  reset (next) {
    const prev = this.value
    this.value = next
    if (!is(prev, next)) this.trigger(this)
  }
}
