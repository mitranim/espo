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
    this.reaction = new Reaction()
    this.value = undefined
  }

  deref () {
    if (this.state === this.states.IDLE) this.value = this.def(this.reaction)
    return this.value
  }

  onInit () {
    this.reaction.loop(computationUpdate.bind(null, this))
  }

  onDeinit () {
    this.reaction.deinit()
  }
}

function computationUpdate (computation, reaction) {
  const prev = computation.value
  const next = computation.value = computation.def(reaction)
  if (!computation.equal(prev, next)) computation.trigger(computation)
}
