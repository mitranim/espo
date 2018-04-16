import * as f from 'fpx'

/**
 * Init
 */

const scroller = throttle(updateLinksAndHash, {delay: 250})

window.addEventListener('scroll', scroller.call)

window.addEventListener('wheel', function preventSpill(event) {
  const node = findAncestor(event.target, shouldPreventSpill)
  if (node) preventScrollSpill(node, event)
})

function updateLinksAndHash() {
  const id = f.procure(document.querySelectorAll('#main [id]'), getVisibleId)
  if (id) {
    setHash(id)
    updateSidenavLinks(id)
  }
  else {
    unsetHash(id)
  }
}

function updateSidenavLinks(id) {
  f.slice(document.querySelectorAll('#sidenav a.active')).forEach(deactivate)
  const link = document.querySelector(`#sidenav a[href*="#${id}"]`)
  if (link) {
    activate(link)
    scrollIntoViewIfNeeded(link)
  }
}

function activate(elem) {
  elem.classList.add('active')
}

function deactivate(elem) {
  elem.classList.remove('active')
}

/**
 * Utils
 */

// Pixel measurements are inaccurate when the browser is zoomed in or out, so we
// have to use a small non-zero value in some geometry checks.
const PX_ERROR_MARGIN = 3

function throttle(fun, options) {
  f.validate(fun, f.isFunction)
  let timerId = null
  let tailPending = false
  const delay = options && options.delay

  function call() {
    if (timerId) tailPending = true
    else restartThrottle()
  }

  function deinit() {
    clearTimeout(timerId)
    timerId = null
  }

  function restartThrottle() {
    deinit()
    timerId = setTimeout(function onThrottledTimer() {
      timerId = null
      if (tailPending) restartThrottle()
      tailPending = false
      fun(...arguments)
    }, delay)
  }

  return {call, deinit}
}

function getVisibleId(elem) {
  return (elem && hasArea(elem) && isWithinViewport(elem)) ? elem.id : undefined
}

function findAncestor(node, test) {
  return !node
    ? null
    : test(node)
    ? node
    : findAncestor(node.parentNode, test)
}

function hasArea(elem) {
  const {height, width} = elem.getBoundingClientRect()
  return height > 0 && width > 0
}

function isWithinViewport(elem) {
  const {top, bottom} = elem.getBoundingClientRect()
  return (
    (bottom > -PX_ERROR_MARGIN && bottom < window.innerHeight) ||
    (top > PX_ERROR_MARGIN && top < (window.innerHeight + PX_ERROR_MARGIN))
  )
}

function setHash(id) {
  window.history.replaceState(null, '', `#${id}`)
}

function unsetHash() {
  window.history.replaceState(null, '', '')
}

function scrollIntoViewIfNeeded(elem) {
  if (!isWithinViewport(elem)) elem.scrollIntoView()
}

function shouldPreventSpill(elem) {
  return f.isInstance(elem, Element) && elem.hasAttribute('data-nospill')
}

function preventScrollSpill(elem, event) {
  event.preventDefault()
  elem.scrollLeft += event.deltaX
  elem.scrollTop += event.deltaY
}

/**
 * REPL
 */

/* eslint-disable no-duplicate-imports */

import * as fpx from 'fpx'
import * as espo from 'espo'
import * as emerge from 'emerge'

const exports = espo.assign({}, {fpx, emerge, espo, scroller}, fpx, emerge, espo)

delete exports.isNaN
delete exports.isFinite

espo.assign(window, exports)

if (window.DEV) {
  bind(console, 'log')
  bind(console, 'info')
  bind(console, 'warn')
  bind(console, 'info')
}

function bind(object, method) {
  if (!/bound/.test(object[method].name)) {
    object[method] = object[method].bind(object)
  }
}
