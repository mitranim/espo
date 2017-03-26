'use strict'

const {isFunction, validate} = require('fpx')
const {equal} = require('emerge')
const {bindAll} = require('./utils')
const {isReactiveSource} = require('./reactive')

class Subber {
  constructor () {
    bindAll(this)
    this.value = undefined
    this.staticContext = null
    this.runningContext = null
  }

  read (source, query) {
    validate(isReactiveSource, source)
    const value = source.read(query)
    if (this.runningContext) {
      subberAttune.call(this, this.runningContext, source, query, value)
    }
    return value
  }

  run (reader, updater) {
    validate(isFunction, reader)
    validate(isFunction, updater)

    if (this.runningContext) {
      throw Error(`Unexpected overlapping .run()`)
    }

    const {staticContext} = this
    this.runningContext = Context(updater)

    try {
      this.value = reader(this)
      this.staticContext = this.runningContext
      return this.value
    }
    finally {
      this.runningContext = null
      cleanupContext(staticContext)
    }
  }

  deconstructor () {
    if (this.runningContext) {
      throw Error(`Unexpected .deconstructor() call during .run()`)
    }
    const {staticContext} = this
    this.staticContext = null
    if (staticContext) cleanupContext(staticContext)
  }
}

exports.Subber = Subber

function subberAttune (context, source, query, value) {
  let sourceCursor = findSourceCursor(context, source)

  if (!sourceCursor) {
    // New function reference to avoid accidental deduplication
    sourceCursor = SourceCursor(source, source.addSubscriber(subberNotify.bind(this)))
    context.sourceCursors.push(sourceCursor)
  }

  sourceCursor.queryCursors.push(QueryCursor(source, query, value))
}

function subberNotify (source) {
  if (this.runningContext) {
    throw Error(`Unexpected notification during .run()`)
  }

  const {staticContext} = this

  if (!staticContext) return

  const sourceCursor = findSourceCursor(staticContext, source)

  if (!sourceCursor) {
    throw Error(`Unexpected notification from a source we're not subscribed to`)
  }

  if (sourceCursor.queryCursors.some(queryCursorChanged)) {
    staticContext.updater(this)
  }
}

function findSourceCursor ({sourceCursors}, source) {
  for (let i = -1; ++i < sourceCursors.length;) {
    if (sourceCursors[i].source === source) return sourceCursors[i]
  }
  return undefined
}

function queryCursorChanged ({source, query, value}) {
  return !equal(source.read(query), value)
}

function cleanupContext (context) {
  if (!context) return
  try {
    while (context.sourceCursors.length) {
      const sourceCursor = context.sourceCursors.shift()
      sourceCursor.removeSubscriber()
    }
  } catch (err) {
    cleanupContext(context)
    throw err
  }
}

function Context (updater) {
  return {updater, sourceCursors: []}
}

function SourceCursor (source, removeSubscriber) {
  validate(isFunction, removeSubscriber)
  return {source, queryCursors: [], removeSubscriber}
}

function QueryCursor (source, query, value) {
  validate(isReactiveSource, source)
  return {source, query, value}
}
