import {Moebius, hasOwn, deinit} from './espo.mjs'

export function initViewComponent(view) {
  const {render} = view
  if (!render) return

  // const rec = view.rec = new Rec(view.forceUpdate.bind(view))
  // view.render = rec.run.bind(rec, render.bind(view, view))

  // Invoked by `view.rec`.
  view.run = view.render
  view.trigger = view.forceUpdate

  // Invoked by `render`.
  view.rec = new Moebius(view)

  // Invoked by React.
  view.render = espoViewRender

  view.componentWillUnmount = espoComponentWillUnmount
}

export function espoComponentWillUnmount() {
  for (const key in this) {
    if (hasOwn(this, key)) deinit(this[key])
  }

  const {componentWillUnmount} = Object.getPrototypeOf(this)
  if (componentWillUnmount) componentWillUnmount.call(this)
}

function espoViewRender() {
  return this.rec.run(this)
}
