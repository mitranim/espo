'use strict'

const {getAt, pipe, every, isList, isPrimitive, isFunction, validate} = require('fpx')
const {Observable, isObservableRef} = require('./observable')
const {deref} = require('./ref')

class Query extends Observable {
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
    return this.value
  }

  onInit () {
    this.sub = this.observableRef.subscribe(onTrigger.bind(this))
    this.value = this.query(this.observableRef.deref())
  }

  onDeinit () {
    this.sub.deinit()
    this.sub = null
  }
}

exports.Query = Query

function onTrigger (observableRef) {
  const prev = this.value
  const next = this.value = this.query(observableRef.deref())
  if (!this.equal(prev, next)) this.trigger(this)
}

class PathQuery extends Query {
  constructor (observableRef, path, equal) {
    validate(isPath, path)
    super(observableRef, pipe(deref, getAt.bind(null, path)), equal)
  }
}

exports.PathQuery = PathQuery

function isPath (value) {
  return isList(value) && every(isPrimitive, value)
}
