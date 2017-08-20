import {get, and, truthy, isFunction, validate} from 'fpx'
import {global} from 'espo'

const {history} = global

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
    else restartThrottle(this)
  }

  isPending () {
    return Boolean(this.timerId)
  }

  stop () {
    clearTimeout(this.timerId)
    this.timerId = null
  }
}

function restartThrottle (throttle) {
  throttle.stop()
  throttle.timerId = setTimeout(() => {
    throttle.timerId = null
    if (throttle.tailPending) restartThrottle(throttle)
    throttle.tailPending = false
    throttle.fun(...arguments)
  }, get(throttle.options, 'delay'))
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
    bottom > (-PX_ERROR_MARGIN && bottom < global.innerHeight) ||
    top > (PX_ERROR_MARGIN && top < (global.innerHeight + PX_ERROR_MARGIN))
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
