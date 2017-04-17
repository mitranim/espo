const {get, and, bind, truthy, isFunction, validate} = require('fpx')
const {global, global: {history}, bindAll} = require('espo')

export class Throttle {
  constructor (fun, options) {
    validate(isFunction, fun)
    if (this.constructor === Throttle) bindAll(this)
    this.fun = fun
    this.options = options
    this.timerId = null
    this.tailPending = false
  }

  run () {
    if (this.timerId) this.tailPending = true
    else restartThrottle.call(this)
  }

  isPending () {
    return Boolean(this.timerId)
  }

  stop () {
    clearTimeout(this.timerId)
    this.timerId = null
  }
}

function restartThrottle () {
  this.stop()
  this.timerId = setTimeout(() => {
    this.timerId = null
    if (this.tailPending) restartThrottle.call(this)
    this.tailPending = false
    this.fun(...arguments)
  }, get(this.options, 'delay'))
}

export const hasNoSpill = bind(hasAttr, 'data-nospill')

export const getVisibleId = and(truthy, hasArea, withinViewport, elem => elem.id)

export function reachedScrollEdge (elem, {deltaY}) {
  return (
    deltaY < 0 && reachedTop(elem) ||
    deltaY > 0 && reachedBottom(elem)
  )
}

function reachedTop ({scrollTop}) {
  return scrollTop < 3
}

function reachedBottom (elem) {
  return Math.abs(elem.scrollHeight - absBottom(elem)) < 3
}

function absBottom (elem) {
  return elem.getBoundingClientRect().height + elem.scrollTop
}

export function findParent (test, node) {
  return !node ? null : (test(node) ? node : findParent(test, node.parentNode))
}

function hasAttr (name, elem) {
  return elem && elem.hasAttribute && elem.hasAttribute(name)
}

function hasArea (elem) {
  const {height, width} = elem.getBoundingClientRect()
  return height > 0 && width > 0
}

function withinViewport (elem) {
  const {top, bottom} = elem.getBoundingClientRect()
  return (
    bottom > -3 && bottom < global.innerHeight ||
    top > 3 && top < (global.innerHeight + 3)
  )
}

export function setHash (id) {
  history.replaceState(null, '', `#${id}`)
}

export function unsetHash () {
  history.replaceState(null, '', '')
}

export function scrollIntoViewIfNeeded (elem) {
  if (!withinViewport(elem)) elem.scrollIntoView()
}
