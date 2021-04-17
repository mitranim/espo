/*
Optional React/Preact adapter that enables implicit reactivity. Any Espo
observables accessed during the `render` call are implicitly subscribed to.
Triggers in those observables cause a re-render. Unsubscription is automatic
via `componentWillUnmount`.

This has NOT been tested after the 0.6.0 rework, due to a switch from React to
Prax.

Usage:

  import {viewInit} from 'espo/react.mjs'

  // Base class for all your views.
  class View extends Component {
    constructor() {
      super(...arguments)
      viewInit(this)
    }
  }

  class SomePage extends View {
    render() {
      // Implicit subscription, causes re-render on trigger.
      const {val} = someEspoObservable
    }
  }
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
