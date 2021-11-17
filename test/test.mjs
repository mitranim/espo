/*
This test is WILDLY incomplete. Just like the documentation. Everything is a
work in progress after the rework.
*/

import {
  // assert as ok,
  assertStrictEquals as is,
  assertNotStrictEquals as isNot,
  assertEquals as eq,
  // assertThrows as throws,
} from 'https://deno.land/std@0.100.0/testing/asserts.ts'

import * as es from '../espo.mjs'

function nop() {}
function id(val) {return val}

class Tracker {
  constructor() {
    this.tr = 0
    this.de = 0
    Object.defineProperty(this, 'trig', {value: this.trig.bind(this)})
    Object.defineProperty(this, 'deinit', {value: this.deinit.bind(this)})
  }

  trig() {this.tr++}

  deinit() {this.de++}
}

// TODO:
// * es.mut
// * es.paused
// * es.deinitAll
// * all classes

void function test_isDe() {
  is(es.isDe(),                                false)
  is(es.isDe({}),                              false)
  is(es.isDe(new Tracker()),                   true)
  is(es.isDe(Object.create(new Tracker())),    true)
  is(es.isDe(Object.assign(deinit, {deinit})), true)

  function deinit() {}
}()

void function test_isObs() {
  is(es.isObs(),              false)
  is(es.isObs({}),            false)
  is(es.isObs(new Tracker()), false)
  is(es.isObs({
    sub() {},
    unsub() {},
    trig() {},
    deinit() {},
  }), true)
}()

void function test_isTrig() {
  is(es.isTrig(),                           false)
  is(es.isTrig({}),                         false)
  is(es.isTrig({trig() {}}),                true)
  is(es.isTrig(Object.create({trig() {}})), true)
  is(es.isTrig(nop),                        false)
}()

void function test_isSub() {
  is(es.isSub(),                           false)
  is(es.isSub({}),                         false)
  is(es.isSub({trig() {}}),                true)
  is(es.isSub(Object.create({trig() {}})), true)
  is(es.isSub(nop),                        true)
}()

void function test_hasHidden() {
  is(es.hasHidden(undefined,                   'key'), false)
  is(es.hasHidden({},                          'key'), false)
  is(es.hasHidden({key: 'val'},                'key'), false)
  is(es.hasHidden(Object.create({key: 'val'}), 'key'), true)

  {
    const ref = {}
    Object.defineProperty(ref, 'key', {enumerable: false, value: 'val'})
    is(es.hasHidden(ref, 'key'), true)
  }

  {
    const ref = new class {get key() {return undefined}}()
    is(es.hasHidden(ref, 'key'), true)
  }
}()

void function test_hasOwnEnum() {
  is(es.hasOwnEnum(undefined,                   'key'), false)
  is(es.hasOwnEnum({},                          'key'), false)
  is(es.hasOwnEnum({key: 'val'},                'key'), true)
  is(es.hasOwnEnum(Object.create({key: 'val'}), 'key'), false)

  const ref = {}
  Object.defineProperty(ref, 'key', {enumerable: false, value: 'val'})
  is(es.hasOwnEnum(ref, 'key'), false)
}()

void function test_hasOwn() {
  is(es.hasOwn(undefined,                   'key'), false)
  is(es.hasOwn({},                          'key'), false)
  is(es.hasOwn({key: 'val'},                'key'), true)
  is(es.hasOwn(Object.create({key: 'val'}), 'key'), false)
}()

void function test_hasOwnEnum() {
  is(es.hasOwnEnum(undefined,                   'key'), false)
  is(es.hasOwnEnum({},                          'key'), false)
  is(es.hasOwnEnum({key: 'val'},                'key'), true)
  is(es.hasOwnEnum(Object.create({key: 'val'}), 'key'), false)

  const ref = {}
  Object.defineProperty(ref, 'key', {enumerable: false, value: 'val'})
  is(es.hasOwnEnum(ref, 'key'), false)
}()

void function test_deinit() {
  es.deinit()
  es.deinit({})

  const counter = new Tracker()
  is(es.deinit(counter), undefined)
  is(counter.de, 1)
}()

void function test_priv() {
  void function test_new_property() {
    const ref = {one: 10}
    es.priv(ref, 'two', 20)

    eq(Object.getOwnPropertyDescriptor(ref, 'two'), {
      value: 20,
      enumerable: false,
      writable: true,
      configurable: true,
    })

    eq(ref, {one: 10})
    eq(Object.keys(ref), ['one'])
    eq(Object.getOwnPropertyNames(ref), ['one', 'two'])
    is(ref.one, 10)
    is(ref.two, 20)
    is(es.hasOwn(ref, 'one'),     true)
    is(es.hasOwnEnum(ref, 'one'), true)
    is(es.hasOwn(ref, 'two'),     true)
    is(es.hasOwnEnum(ref, 'two'), false)
  }()

  void function test_redefine_property() {
    const ref = {one: 10}
    es.priv(ref, 'one', 20)

    eq(ref, {})
    eq(Object.keys(ref), [])
    eq(Object.getOwnPropertyNames(ref), ['one'])
    is(ref.one, 20)
  }()
}()

void function test_privs() {
  const ref = {one: 10, get two() {return 40}}
  es.privs(ref, {two: 20, three: 30})

  eq(Object.getOwnPropertyDescriptors(ref), {
    one: {
      value: 10,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    two: {
      value: 20,
      enumerable: false,
      writable: true,
      configurable: true,
    },
    three: {
      value: 30,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  })

  eq(ref, {one: 10})
  eq(Object.keys(ref), ['one'])
  eq(Object.getOwnPropertyNames(ref), ['one', 'two', 'three'])
  is(ref.one, 10)
  is(ref.two, 20)
  is(ref.three, 30)
  is(es.hasOwn(ref, 'one'),       true)
  is(es.hasOwnEnum(ref, 'one'),   true)
  is(es.hasOwn(ref, 'two'),       true)
  is(es.hasOwnEnum(ref, 'two'),   false)
  is(es.hasOwn(ref, 'three'),     true)
  is(es.hasOwnEnum(ref, 'three'), false)
}()

void function test_pub() {
  void function test_new_property() {
    const ref = {one: 10}
    es.priv(ref, 'three', 30)
    es.pub(ref, 'two', 20)

    eq(Object.getOwnPropertyDescriptor(ref, 'two'), {
      value: 20,
      enumerable: true,
      writable: true,
      configurable: true,
    })

    eq(ref, {one: 10, two: 20})
    eq(Object.keys(ref), ['one', 'two'])
    eq(Object.getOwnPropertyNames(ref), ['one', 'three', 'two'])

    is(ref.one, 10)
    is(ref.two, 20)
    is(ref.three, 30)

    is(es.hasOwn(ref, 'one'),     true)
    is(es.hasOwnEnum(ref, 'one'), true)
    is(es.hasOwn(ref, 'two'),     true)
    is(es.hasOwnEnum(ref, 'two'), true)
    is(es.hasOwn(ref, 'two'),     true)
    is(es.hasOwnEnum(ref, 'three'), false)
  }()

  void function test_redefine_property() {
    const ref = {one: 10}
    es.priv(ref, 'two', 20)
    es.pub(ref, 'two', 30)

    eq(Object.getOwnPropertyDescriptor(ref, 'two'), {
      value: 30,
      enumerable: true,
      writable: true,
      configurable: true,
    })

    eq(ref, {one: 10, two: 30})
    eq(Object.keys(ref), ['one', 'two'])
    eq(Object.getOwnPropertyNames(ref), ['one', 'two'])
    is(ref.one, 10)
    is(ref.two, 30)
  }()
}()

void function test_pubs() {
  const ref = {one: 10, get two() {return 40}}
  es.priv(ref, 'three', 50)
  es.pubs(ref, {two: 20, three: 30})

  eq(Object.getOwnPropertyDescriptors(ref), {
    one: {
      value: 10,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    two: {
      value: 20,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    three: {
      value: 30,
      enumerable: true,
      writable: true,
      configurable: true,
    },
  })

  eq(ref, {one: 10, two: 20, three: 30})
  is(ref.one, 10)
  is(ref.two, 20)
  is(ref.three, 30)
  is(es.hasOwn(ref, 'one'),       true)
  is(es.hasOwnEnum(ref, 'one'),   true)
  is(es.hasOwn(ref, 'two'),       true)
  is(es.hasOwnEnum(ref, 'two'),   true)
  is(es.hasOwn(ref, 'three'),     true)
  is(es.hasOwnEnum(ref, 'three'), true)
}()

void function test_bind() {
  const ref = new class {
    one() {return this}
    two() {return this}
  }()

  es.bind(ref, ref.one, ref.two)
  eq(Object.keys(ref), [])
  eq(Object.getOwnPropertyNames(ref), ['one', 'two'])

  const {one, two} = ref
  is(one(), ref)
  is(two(), ref)
}()

void function test_bindAll() {
  class Inner {
    methInner() {return [this, 'meth inner']}
    methOverride() {return [this, 'methOverride inner']}
  }
  Inner.prototype.innerNonMethod = 'inner non method'
  Inner.prototype.funOverride = function funInner() {return [this, 'funOverride inner']}

  class Outer extends Inner {
    methOverride() {return [this, 'methOverride outer']}
    methOuter() {return [this, 'meth outer']}
  }
  Outer.prototype.outerNonMethod = 'outer non method'
  Outer.prototype.funOverride = function funOuter() {return [this, 'funOverride outer']}

  const ref = new Outer()
  es.bindAll(ref)

  eq(Object.keys(ref), [])

  eq(
    Object.getOwnPropertyNames(ref).sort(),
    ['methInner', 'methOverride', 'methOuter', 'funOverride'].sort(),
  )

  const {methInner, methOverride, methOuter, funOverride} = ref

  is(methInner()[0], ref)
  is(methInner()[1], 'meth inner')

  is(methOverride()[0], ref)
  is(methOverride()[1], 'methOverride outer')

  is(methOuter()[0], ref)
  is(methOuter()[1], 'meth outer')

  is(funOverride()[0], ref)
  is(funOverride()[1], 'funOverride outer')
}()

void function test_lazy() {
  void function test_lazy_only_ancestor() {
    const [Anc, Mid, Des] = testInitLazy()
    es.lazy(Anc)

    const ref = new Des()
    eq(Object.keys(ref), [])

    is(ref.anc0, ref.anc0)
    eq(Object.keys(ref), [`anc0`])

    is(ref.anc1, ref.anc1)
    eq(Object.keys(ref), [`anc0`, `anc1`])

    isNot(ref.mid0, ref.mid0)
    isNot(ref.mid1, ref.mid1)

    isNot(ref.des0, ref.des0)
    isNot(ref.des1, ref.des1)

    testLazyDoesNotAffectPrototype(Anc, Mid, Des)
  }()

  void function test_lazy_only_descendant() {
    const [Anc, Mid, Des] = testInitLazy()
    es.lazy(Des)

    const ref = new Des()
    eq(Object.keys(ref), [])

    isNot(ref.anc0, ref.anc0)
    isNot(ref.anc1, ref.anc1)

    isNot(ref.mid0, ref.mid0)
    isNot(ref.mid1, ref.mid1)

    is(ref.des0, ref.des0)
    eq(Object.keys(ref), [`des0`])

    is(ref.des1, ref.des1)
    eq(Object.keys(ref), [`des0`, `des1`])

    testLazyDoesNotAffectPrototype(Anc, Mid, Des)
  }()

  void function test_lazy_all() {
    const [Anc, Mid, Des] = testInitLazy()
    es.lazy(Anc)
    es.lazy(Mid)
    es.lazy(Des)

    const ref = new Des()
    eq(Object.keys(ref), [])

    is(ref.anc0, ref.anc0)
    eq(Object.keys(ref), [`anc0`])

    is(ref.anc1, ref.anc1)
    eq(Object.keys(ref), [`anc0`, `anc1`])

    is(ref.mid0, ref.mid0)
    eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`])

    is(ref.mid1, ref.mid1)
    eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`])

    is(ref.des0, ref.des0)
    eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`, `des0`])

    is(ref.des1, ref.des1)
    eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`, `des0`, `des1`])

    testLazyDoesNotAffectPrototype(Anc, Mid, Des)
  }()

  void function test_set() {
    const [Anc, Mid, Des] = testInitLazy()
    es.lazy(Anc)

    const ref = new Des()
    const manual = Symbol(`manual`)

    ref.anc0 = manual
    is(ref.anc0, manual)
    eq(Object.keys(ref), [`anc0`])

    is(ref.anc1, ref.anc1)
    eq(Object.keys(ref), [`anc0`, `anc1`])

    testLazyDoesNotAffectPrototype(Anc, Mid, Des)
  }()
}()

function testInitLazy() {
  class Anc {
    get anc0() {return Symbol(`anc0`)}
    get anc1() {return Symbol(`anc1`)}
  }

  class Mid extends Anc {
    get mid0() {return Symbol(`mid0`)}
    get mid1() {return Symbol(`mid1`)}
  }

  class Des extends Mid {
    get des0() {return Symbol(`des0`)}
    get des1() {return Symbol(`des1`)}
  }

  return [Anc, Mid, Des]
}

function testLazyDoesNotAffectPrototype(Anc, Mid, Des) {
  eq(Object.keys(Anc.prototype), [])
  eq(Object.keys(Mid.prototype), [])
  eq(Object.keys(Des.prototype), [])
}

void function test_de() {
  const ref    = es.de({})
  const first  = new Tracker()
  const second = new Tracker()
  const third  = new Tracker()

  Object.defineProperty(ref, 'hidden', {value: third, enumerable: false})

  ref.val = first
  is(ref.val, first)
  eq(ref, {val: {de: 0, tr: 0}})

  // Hide self-assign from linters.
  ref.val = id(ref.val)
  is(ref.val, first)
  eq(ref, {val: {de: 0, tr: 0}})

  ref.val = second
  is(ref.val, second)
  eq(ref, {val: {de: 0, tr: 0}})
  eq(first, {de: 1, tr: 0})

  ref.deinit()
  is(ref.val, second)
  eq(ref, {val: {de: 1, tr: 0}})

  delete ref.val
  is(ref.val, undefined)
  is(es.hasOwn(ref, 'val'), false)
  eq(second, {de: 2, tr: 0})

  is(ref.hidden, third)
  eq(third, {de: 0, tr: 0})
}()

// The test is rudimentary, maybe about 5% complete.
void function test_obs() {
  void function test_imperative() {
    const ref = es.obs({})
    const obs = es.ph(ref)
    const first = new Tracker()
    const second = new Tracker()

    obs.sub(first.trig)
    obs.sub(second.trig)
    eq(first, {de: 0, tr: 0})
    eq(second, {de: 0, tr: 0})

    obs.trig()
    eq(first, {de: 0, tr: 1})
    eq(second, {de: 0, tr: 1})

    // Implicit trigger.
    ref.val = 10
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 2})

    // Rudimentary change detection prevents another trigger.
    ref.val = 10
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 2})

    obs.unsub(first.trig)
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 2})

    ref.val = 20
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})

    ref.deinit()
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})

    obs.trig()
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})
  }()
}()

console.log('[test] ok')
