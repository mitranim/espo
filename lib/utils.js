'use strict'

const {getIn, bind, bindApply, and, or, not, id,
  slice, indexOf, includes, mapVals,
  isComplex, isString, isFunction, isPrimitive, validate, validateEach} = require('fpx')
const {isFrozen, defineProperty, getOwnPropertyDescriptors, create, setPrototypeOf} = Object
const pub = exports

pub.global = typeof self !== 'undefined' && self || Function('return this')()  // eslint-disable-line

const isMutable = pub.isMutable = and(isComplex, not(isFrozen))

// Duck-typed version of `instanceof`.
pub.isImplementation = isImplementation
function isImplementation (iface, value) {
  if (value == null) return false
  for (const key in iface) {
    if (typeof value[key] !== typeof iface[key]) return false
  }
  return true
}

pub.bindAll = bindAll
function bindAll (object) {
  for (const key in object) {
    const value = object[key]
    if (isFunction(value)) object[key] = value.bind(object)
  }
  return object
}

// Same as `const`, but for object properties.
pub.final = final
function final (object, key, value) {
  return defineProperty(object, key, {value, enumerable: true, writable: false})
}

pub.assign = assign
function assign (object) {
  return slice(arguments, 1).reduce(assignOne, isMutable(object) ? object : {})
}

function assignOne (object, src) {
  if (src) for (const key in src) object[key] = src[key]
  return object
}

pub.push = push
function push (list, value) {
  list.push(value)
  return list
}

pub.pull = pull
function pull (list, value) {
  const index = indexOf(list, value)
  if (~index) list.splice(index, 1)
  return list
}

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

pub.redef = redef
function redef (storage, path, fun) {
  validate(isFunction, fun)
  return setIn(storage, path, fun(getIn(storage, path)))
}

pub.defonce = defonce
function defonce (storage, path, fun) {
  validate(isFunction, fun)
  return redef(storage, path, or(id, bindApply(fun, slice(arguments, 3))))
}

// TODO consider documenting
pub.validateState = validateState
function validateState (allowedStates, state) {
  validate(isPrimitive, state)
  validateEach(isPrimitive, allowedStates)

  if (!includes(allowedStates, state)) {
    throw Error(
      `Unexpected state ${state}, must be one of: ${allowedStates.join(', ')}`
    )
  }
}

// TODO consider documenting
pub.valueDescriptor = valueDescriptor
function valueDescriptor (value) {
  return {value, enumerable: true, writable: true, configurable: true}
}

const valueDescriptors = pub.valueDescriptors = bind(mapVals, valueDescriptor)

// TODO consider documenting
pub.hiddenDescriptor = hiddenDescriptor
function hiddenDescriptor (value) {
  return {value, enumerable: false, writable: true, configurable: true}
}

pub.hiddenDescriptors = bind(mapVals, hiddenDescriptor)

pub.subclassOf = subclassOf
function subclassOf (Superclass, Subclass) {
  validate(isFunction, Subclass)
  validate(isFunction, Superclass)
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = create(Superclass.prototype, hiddenDescriptor({constructor: Subclass}))
}

// TODO consider documenting
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

pub.subclassWithProps = subclassWithProps
function subclassWithProps (Superclass, props) {
  function Subclass () {
    if (!(this instanceof Subclass)) return new Subclass(...arguments)
    Superclass.apply(this, arguments)
  }
  subclassStatics(Subclass, Superclass)
  Subclass.prototype = Object.create(
    Superclass.prototype,
    assign({}, valueDescriptors(props), {constructor: hiddenDescriptor(Subclass)})
  )
  return Subclass
}

pub.subclassBy = subclassBy
function subclassBy (getProps) {
  validate(isFunction, getProps)
  return function subclassBy_ (Superclass) {
    return subclassWithProps(Superclass, getProps(Superclass))
  }
}

pub.hackClassBy = hackClassBy
function hackClassBy (getProps) {
  validate(isFunction, getProps)
  return function hackClassBy_ (Class) {
    assign(Class.prototype, getProps(Class))
    return Class
  }
}
