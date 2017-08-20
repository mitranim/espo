import {isFunction, validate} from 'fpx'
import {Observable} from './observable'
import {Reaction} from './reaction'

export class Computation extends Observable {
  constructor (def, equal) {
    validate(isFunction, def)
    validate(isFunction, equal)
    super()
    this.def = def
    this.equal = equal
    this.reaction = null
    this.value = undefined
  }

  deref () {
    return this.value
  }

  onInit () {
    this.reaction = Reaction.loop(computationUpdate.bind(null, this))
  }

  onDeinit () {
    this.reaction.deinit()
    this.reaction = null
  }
}

function computationUpdate (computation, reaction) {
  const prev = computation.value
  const next = computation.value = computation.def(reaction)
  if (!computation.equal(prev, next)) computation.trigger(computation)
}
