'use strict'

const {every, isList, isPrimitive, isFunction, validate} = require('fpx')
const {Observable, isObservableRef, derefIn} = require('./observable')

// Awfully special-cased and convoluted, must generalise and simplify.
// Generally speaking, this is a _derived observable_, _mapped_ to `path`,
// _distinct_ by `equal`.
class PathQuery extends Observable {
  constructor (observableRef, path, equal) {
    super()
    validate(isObservableRef, observableRef)
    validate(isPath, path)
    validate(isFunction, equal)
    this.observableRef = observableRef
    this.path = path
    this.equal = equal
    this.value = undefined
    this.sub = null
  }

  deref () {
    return this.value
  }

  onInit () {
    this.value = derefIn(this.observableRef, this.path)
    this.sub = this.observableRef.subscribe(onTrigger.bind(this))
  }

  onDeinit () {
    this.sub.deinit()
    this.sub = null
  }
}

exports.PathQuery = PathQuery

function onTrigger (observableRef) {
  const prev = this.value
  const next = this.value = derefIn(observableRef, this.path)
  if (!this.equal(prev, next)) this.trigger(this)
}

function isPath (value) {
  return isList(value) && every.call(value, isPrimitive)
}
