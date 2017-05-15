const {get, and, truthy, isFunction, validate} = require('fpx')
const {global, global: {history}} = require('espo')

// Pixel measurements are inaccurate when the browser is zoomed in or out, so we
// have to use a small non-zero value in some geometry checks.
const PX_ERROR_MARGIN = 3

export class Throttle {
  constructor (fun, options) {
    validate(isFunction, fun)
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

export const getVisibleId = and(truthy, hasArea, withinViewport, elem => elem.id)

export function findParent (test, node) {
  return !node ? null : (test(node) ? node : findParent(test, node.parentNode))
}

export function hasAttr (name, elem) {
  return elem && elem.hasAttribute && elem.hasAttribute(name)
}

function hasArea (elem) {
  const {height, width} = elem.getBoundingClientRect()
  return height > 0 && width > 0
}

function withinViewport (elem) {
  const {top, bottom} = elem.getBoundingClientRect()
  return (
    bottom > -PX_ERROR_MARGIN && bottom < global.innerHeight ||
    top > PX_ERROR_MARGIN && top < (global.innerHeight + PX_ERROR_MARGIN)
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

export function preventScrollSpill (elem, event) {
  event.preventDefault()
  elem.scrollLeft += event.deltaX
  elem.scrollTop += event.deltaY
}
