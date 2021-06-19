/*
Optional React/Preact adapter that enables implicit reactivity. Any Espo
observables accessed during the `render` call are implicitly subscribed to.
Triggers in those observables cause a re-render. Unsubscription is automatic
via `componentWillUnmount`.

See examples in `readme.md`.
*/

import {Moebius} from './espo.mjs'

export function viewInit(view) {
  if (!view.render) return

  // Invoked by `view.rec`.
  view.run = view.render
  view.trig = view.forceUpdate

  // Invoked by React.
  view.render = espoViewRender

  view.componentWillUnmount = espoComponentWillUnmount

  // Invoked by `espoViewRender`.
  view.rec = new Moebius(view)
}

export function espoComponentWillUnmount() {
  if (this.rec) this.rec.deinit()
  const {componentWillUnmount} = Object.getPrototypeOf(this)
  if (componentWillUnmount) componentWillUnmount.call(this)
}

function espoViewRender() {return this.rec.run(this)}
