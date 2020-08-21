import {Reaction} from './espo'

export function initViewComponent(view) {
  if (!view.render) return

  const reaction = new Reaction()
  view.reaction_ = reaction

  // Note: using bound functions creates fewer stack frames compared to
  // definining additional functions.
  view.render = reaction.run.bind(
    reaction,
    view.render.bind(view, view),
    view.forceUpdate.bind(view),
  )

  view.componentWillUnmount = componentWillUnmount
}

// Exported for some edge cases. TODO consider if this should be documented.
export function componentWillUnmount() {
  if (this.reaction_) this.reaction_.deinit()
  const componentWillUnmount = Object.getPrototypeOf(this).componentWillUnmount
  if (componentWillUnmount) componentWillUnmount.call(this)
}
