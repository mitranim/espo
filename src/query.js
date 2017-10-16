import {getAt, pipe, every, isList, isPrimitive, isFunction, validate} from 'fpx'
import {Observable, isObservableRef} from './observable'
import {deref} from './ref'

export class Query extends Observable {
  constructor (observableRef, query, equal) {
    super()
    validate(isObservableRef, observableRef)
    validate(isFunction, query)
    validate(isFunction, equal)
    this.observableRef = observableRef
    this.query = query
    this.equal = equal
    this.value = undefined
    this.sub = null
  }

  deref () {
    if (this.state === this.states.IDLE) {
      this.value = this.query(this.observableRef.deref())
    }
    return this.value
  }

  onInit () {
    this.sub = this.observableRef.subscribe(onTrigger.bind(null, this))
    this.value = this.query(this.observableRef.deref())
  }

  onDeinit () {
    this.sub.deinit()
    this.sub = null
  }
}

function onTrigger (query, observableRef) {
  const prev = query.value
  const next = query.value = query.query(observableRef.deref())
  if (!query.equal(prev, next)) query.trigger(query)
}

export class PathQuery extends Query {
  constructor (observableRef, path, equal) {
    validate(isPath, path)
    super(observableRef, pipe(deref, getAt.bind(null, path)), equal)
  }
}

function isPath (value) {
  return isList(value) && every(isPrimitive, value)
}
