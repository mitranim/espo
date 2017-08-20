import {bind, procure} from 'fpx'
import {global, assign, each} from 'espo'
import {Throttle, getVisibleId, hasAttr, preventScrollSpill, findParent,
  setHash, unsetHash, scrollIntoViewIfNeeded} from './utils'

const scroller = new Throttle(updateLinksAndHash, {delay: 250})

global.addEventListener('scroll', scroller.run.bind(scroller))

const shouldPreventSpill = bind(hasAttr, 'data-nospill')

global.addEventListener('wheel', function preventSpill (event) {
  const node = findParent(shouldPreventSpill, event.target)
  if (node) preventScrollSpill(node, event)
})

// global.addEventListener('popstate', function toHash () {
//   scroller.stop()
//   const hash = window.location.hash.replace(/^#/, '')
//   if (hash) updateSidenavLinks(hash)
// })

function updateLinksAndHash () {
  const id = procure(getVisibleId, document.querySelectorAll('#main [id]'))
  if (id) {
    setHash(id)
    updateSidenavLinks(id)
  }
  else {
    unsetHash(id)
  }
}

function updateSidenavLinks (id) {
  each(document.querySelectorAll('#sidenav a.active'), deactivate)
  const link = document.querySelector(`#sidenav a[href*="#${id}"]`)
  if (link) {
    activate(link)
    scrollIntoViewIfNeeded(link)
  }
}

function activate (elem) {
  elem.classList.add('active')
}

function deactivate (elem) {
  elem.classList.remove('active')
}

// REPL

/* eslint-disable no-duplicate-imports */

import * as fpx from 'fpx'
import * as espo from 'espo'
import * as emerge from 'emerge'

const exports = assign({}, {fpx, emerge, espo, scroller}, fpx, emerge, espo)

delete exports.isNaN
delete exports.isFinite

assign(global, exports)

if (global.devMode) {
  ['log', 'info', 'warn', 'error', 'clear'].forEach(key => {
    if (!/bound/.test(console[key].name)) {
      global[key] = console[key] = console[key].bind(console)
    }
  })
}
