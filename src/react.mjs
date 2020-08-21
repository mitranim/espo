import {Reaction} from './espo'
import {shouldComponentUpdate} from 'react-change'

export function initViewComponent(view) {
  const reaction = new Reaction()
  view.reaction_ = reaction

  if (view.render) {
    // Note: using bound functions creates fewer stack frames compared to
    // definining additional functions.
    view.render = reaction.run.bind(
      reaction,
      view.render.bind(view, view),
      view.forceUpdate.bind(view),
    )
  }

  view.shouldComponentUpdate = shouldComponentUpdate

  view.componentWillUnmount = componentWillUnmount
}

// Exported for some edge cases. TODO consider if this should be documented.
export function componentWillUnmount() {
  this.reaction_.deinit()
  const componentWillUnmount = Object.getPrototypeOf(this).componentWillUnmount
  if (componentWillUnmount) componentWillUnmount.call(this)
}
