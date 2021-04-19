/*
Optional React/Preact adapter that enables implicit reactivity. Any Espo
observables accessed during the `render` call are implicitly subscribed to.
Triggers in those observables cause a re-render. Unsubscription is automatic
via `componentWillUnmount`.

This has NOT been tested after the 0.6.0 rework, due to a switch from React to
Prax and custom DOM elements.

See examples in `readme.md`.
*/

import {Moebius} from './espo.mjs'

export function viewInit(view) {
  if (!view.render) return

  // Invoked by `espoViewRender`.
  view.rec = new Moebius(view)

  // Invoked by `view.rec`.
  view.run = view.render
  view.trig = view.forceUpdate

  // Invoked by React.
  view.render = espoViewRender

  view.componentWillUnmount = espoComponentWillUnmount
}

export function espoComponentWillUnmount() {
  if (this.rec) this.rec.deinit()
  const {componentWillUnmount} = Object.getPrototypeOf(this)
  if (componentWillUnmount) componentWillUnmount.call(this)
}

function espoViewRender() {return this.rec.run(this)}
