const {procure} = require('fpx')
const {global, assign, each} = require('espo')
const {Throttle, hasNoSpill, getVisibleId, reachedScrollEdge, findParent,
  setHash, unsetHash, scrollIntoViewIfNeeded} = require('./utils')

const scroller = new Throttle(updateLinksAndHash, {delay: 250})

global.addEventListener('scroll', scroller.run)

global.addEventListener('wheel', function preventSpill (event) {
  const node = findParent(hasNoSpill, event.target)
  if (node && reachedScrollEdge(node, event)) event.preventDefault()
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

const fpx = require('fpx')
const espo = require('espo')
const emerge = require('emerge')

assign(exports, {fpx, emerge, espo, scroller}, fpx, emerge, espo)

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
