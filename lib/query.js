'use strict'

const {equal} = require('emerge')
const {every, isList, isPrimitive, validate} = require('fpx')
const {Observable, isObservableRef, derefIn} = require('./observable')

// Awfully convoluted and special-cased, must improve.
// General: this is a derived observable, mapped to `path`, distinct by `equal`.
class PathQuery extends Observable {
  constructor (observableRef, path) {
    super()
    validate(isObservableRef, observableRef)
    validate(isPath, path)
    this.observableRef = observableRef
    this.path = path
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
  if (!equal(prev, next)) this.trigger()
}

function isPath (value) {
  return isList(value) && every(isPrimitive, value)
}
