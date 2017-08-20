import {Atom, isAtom} from './atom'
import {deinitDiff, isOwner} from './lifetime'

/**
 * Interfaces
 */

export function isAgent (value) {
  return isAtom(value) && isOwner(value)
}

/**
 * Classes
 */

// WTB better name
export class Agent extends Atom {
  reset (next) {
    const prev = this.value
    try {super.reset(next)}
    finally {deinitDiff(prev, next)}
  }

  unwrap () {
    const {value} = this
    this.value = undefined
    try {
      this.trigger(this)
      return value
    }
    catch (err) {
      deinitDiff(value)
      throw err
    }
  }

  deinit () {
    try {super.deinit()}
    finally {this.reset(undefined)}
  }
}
