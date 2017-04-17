'use strict'

const {getIn, bind, bindApply, and, or, not, id,
  slice, indexOf, includes, mapVals,
  is, isComplex, isString, isFunction, isPrimitive, isArray, isList,
  validate, validateEach} = require('fpx')
const {isFrozen, defineProperty, getOwnPropertyDescriptors, create, setPrototypeOf} = Object
const pub = exports

pub.global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

pub.isMutable = isMutable
function isMutable (value) {
  return isMutable_(value)
}

const isMutable_ = and(isComplex, not(isFrozen))

// [DEPRECATED] Prefer explicit interfaces. TODO remove.
// Duck-typed version of `instanceof`.
pub.isImplementation = isImplementation
function isImplementation (iface, value) {
  if (value == null) return false
  for (const key in iface) {
    if (typeof value[key] !== typeof iface[key]) return false
  }
  return true
}

// Binds enumerables, therefore doesn't work with spec-compliant classes.
// TODO support spec-compliant classes.
pub.bindAll = bindAll
function bindAll (object) {
  for (const key in object) {
    const value = object[key]
    if (isFunction(value)) object[key] = value.bind(object)
  }
  return object
}

// TODO document or remove.
// Like `const`, but for object properties.
pub.final = final
function final (object, key, value) {
  return defineProperty(object, key, {value, enumerable: true, writable: false})
}

// TODO document or remove.
pub.priv = priv
function priv (object, key, value) {
  return defineProperty(object, key, {value, enumerable: false, writable: true})
}

pub.assign = assign
function assign (object) {
  validate(isMutable, object)
  return slice(arguments, 1).reduce(assignOne, object)
}

function assignOne (object, src) {
  if (src) for (const key in src) object[key] = src[key]
  return object
}

// TODO remove
pub.push = push
function push (list, value) {
  list.push(value)
  return list
}

pub.pull = pull
function pull (array, value) {
  validate(isArray, array)
  const index = indexOf(array, value)
  if (~index) array.splice(index, 1)
  return array
}

// TODO remove
pub.setIn = setIn
function setIn (object, maybePath, value) {
  validate(isMutable, object)
  validateEach(isString, maybePath)
  return maybePath.reduce(bind(setNext, value), object)
}

function setNext (value, target, key, index, path) {
  return target[key] = (
    index === path.length - 1 ? value :
    isMutable(target[key])    ? target[key] :
    {}
  )
}

// TODO remove
pub.redef = redef
function redef (storage, path, fun) {
  validate(isFunction, fun)
  return setIn(storage, path, fun(getIn(storage, path)))
}

// TODO remove
pub.defonce = defonce
function defonce (storage, path, fun) {
  validate(isFunction, fun)
  return redef(storage, path, or(id, bindApply(fun, slice(arguments, 3))))
}

// WTB better name
// TODO consider documenting
pub.validateState = validateState
function validateState (allowedState, state) {
  validate(isPrimitive, allowedState)
  validate(isPrimitive, state)
  if (!is(allowedState, state)) {
    throw Error(`Unexpected state ${state}, must be ${allowedState}`)
  }
}

// WTB better name
// TODO consider documenting
pub.validateStates = validateStates
function validateStates (allowedStates, state) {
  validateEach(isPrimitive, allowedStates)
  validate(isPrimitive, state)

  if (!includes(allowedStates, state)) {
    throw Error(
      `Unexpected state ${state}, must be one of: ${allowedStates.join(', ')}`
    )
  }
}

// WTB better name
// TODO remove
pub.valueDescriptor = valueDescriptor
function valueDescriptor (value) {
  return {value, enumerable: true, writable: true, configurable: true}
}

// TODO remove
const valueDescriptors = pub.valueDescriptors = bind(mapVals, valueDescriptor)

// WTB better name
// TODO remove
pub.hiddenDescriptor = hiddenDescriptor
function hiddenDescriptor (value) {
  return {value, enumerable: false, writable: true, configurable: true}
}

// TODO remove
pub.hiddenDescriptors = bind(mapVals, hiddenDescriptor)

// TODO remove
pub.subclassOf = subclassOf
function subclassOf (Superclass, Subclass) {
  validate(isFunction, Subclass)
  validate(isFunction, Superclass)
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = create(Superclass.prototype, hiddenDescriptor({constructor: Subclass}))
}

// TODO remove
pub.subclassStatics = subclassStatics
function subclassStatics (Subclass, Superclass) {
  if (setPrototypeOf) setPrototypeOf(Subclass, Superclass)
  else {
    const descriptors = getOwnPropertyDescriptors(Superclass)
    for (const key in descriptors) {
      if (!includes(functionProperties, key)) {
        defineProperty(Subclass, key, descriptors[key])
      }
    }
  }
}

const functionProperties = ['length', 'name', 'arguments', 'caller', 'prototype']

// TODO remove
pub.subclassWithProps = subclassWithProps
function subclassWithProps (Superclass, props) {
  function Subclass () {
    if (!(this instanceof Subclass)) return new Subclass(...arguments)
    Superclass.apply(this, arguments)
  }
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = create(
    Superclass.prototype,
    assign({}, valueDescriptors(props), {constructor: hiddenDescriptor(Subclass)})
  )
  return Subclass
}

// TODO remove
pub.subclassBy = subclassBy
function subclassBy (getProps) {
  validate(isFunction, getProps)
  return function subclassBy_ (Superclass) {
    return subclassWithProps(Superclass, getProps(Superclass))
  }
}

// TODO remove
pub.hackClassBy = hackClassBy
function hackClassBy (getProps) {
  validate(isFunction, getProps)
  return function hackClassBy_ (Class) {
    assign(Class.prototype, getProps(Class))
    return Class
  }
}

// TODO finalise the API, then document
pub.each = each
function each (values, fun) {
  validate(isFunction, fun)
  if (isList(values)) {
    const list = slice(values)
    while (list.length) fun(list.shift())
  }
}

// TODO finalise the API, then document
pub.forceEach = forceEach
function forceEach (values, fun, a, b, c) {
  validate(isFunction, fun)
  if (isList(values)) {
    flushBy.call(this, slice(values), fun, a, b, c)
  }
}

// TODO finalise the API, then document
pub.flushBy = flushBy
function flushBy (values, fun, a, b, c) {
  validate(isFunction, fun)
  validate(isArray, values)
  validate(isMutable, values)
  try {
    while (values.length) {
      fun.call(this, values.shift(), a, b, c)
    }
  }
  catch (err) {
    flushBy.call(this, values, fun, a, b, c)
    throw err
  }
}

// Dangerous
// TODO consider documenting
pub.retryBy = retryBy
function retryBy (fun, a, b, c) {
  if (!isFunction(fun)) {
    throw Error(`Expected a function, got ${fun}`)
  }
  try {
    return fun(a, b, c)
  }
  catch (err) {
    retryBy(fun, a, b, c)
    throw err
  }
}
