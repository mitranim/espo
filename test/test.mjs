/*
TODO more tests:

  * e.mut
  * e.paused
  * e.deinitAll
  * all classes
*/

import 'https://cdn.jsdelivr.net/npm/@mitranim/test@0.1.1/emptty.mjs'
import * as t from 'https://cdn.jsdelivr.net/npm/@mitranim/test@0.1.1/test.mjs'
import * as e from '../espo.mjs'

const cli = t.Args.os()
t.conf.testFilterFrom(cli.get(`run`))
if (cli.bool(`v`)) t.conf.testRep = t.conf.benchRep

/* Utils */

function nop() {}
function id(val) {return val}

class Track {
  constructor(tr, de) {
    // Counts trigger calls.
    this.tr = t.onlyInt(tr) ?? 0

    // Counts deinit calls.
    this.de = t.onlyInt(de) ?? 0

    // Bind methods, keeping these properties non-enumerable.
    Object.defineProperty(this, `trig`, {value: this.trig.bind(this)})
    Object.defineProperty(this, `deinit`, {value: this.deinit.bind(this)})
  }

  trig() {this.tr++}
  deinit() {this.de++}
  toString() {return `new Track(${this.tr}, ${this.de})`}
  get [Symbol.toStringTag]() {return this.constructor.name}
}

/* Tests */

t.test(function test_isDe() {
  t.no(e.isDe())
  t.no(e.isDe({}))

  t.ok(e.isDe(new Track()))
  t.ok(e.isDe(Object.create(new Track())))
  t.ok(e.isDe(Object.assign(deinit, {deinit})))

  function deinit() {}
})

t.test(function test_isObs() {
  t.no(e.isObs())
  t.no(e.isObs({}))
  t.no(e.isObs(new Track()))

  t.ok(e.isObs({
    sub() {},
    unsub() {},
    trig() {},
    deinit() {},
  }))
})

t.test(function test_isTrig() {
  t.no(e.isTrig())
  t.no(e.isTrig({}))
  t.no(e.isTrig(nop))

  t.ok(e.isTrig({trig() {}}))
  t.ok(e.isTrig(Object.create({trig() {}})))
})

t.test(function test_isSub() {
  t.no(e.isSub())
  t.no(e.isSub({}))

  t.ok(e.isSub({trig() {}}))
  t.ok(e.isSub(Object.create({trig() {}})))
  t.ok(e.isSub(nop))
})

t.test(function test_hasHidden() {
  t.no(e.hasHidden(undefined,                   `key`))
  t.no(e.hasHidden({},                          `key`))
  t.no(e.hasHidden({key: `val`},                `key`))

  t.ok(e.hasHidden(Object.create({key: `val`}), `key`))

  {
    const ref = {}
    Object.defineProperty(ref, `key`, {enumerable: false, value: `val`})
    t.ok(e.hasHidden(ref, `key`))
  }

  {
    const ref = new class {get key() {return undefined}}()
    t.ok(e.hasHidden(ref, `key`))
  }
})

t.test(function test_hasOwnEnum() {
  t.no(e.hasOwnEnum(undefined,                   `key`))
  t.no(e.hasOwnEnum({},                          `key`))
  t.no(e.hasOwnEnum(Object.create({key: `val`}), `key`))

  t.ok(e.hasOwnEnum({key: `val`},                `key`))

  const ref = {}
  Object.defineProperty(ref, `key`, {enumerable: false, value: `val`})
  t.no(e.hasOwnEnum(ref, `key`))
})

t.test(function test_hasOwn() {
  t.no(e.hasOwn(undefined,                   `key`))
  t.no(e.hasOwn({},                          `key`))
  t.no(e.hasOwn(Object.create({key: `val`}), `key`))

  t.ok(e.hasOwn({key: `val`},                `key`))
})

t.test(function test_hasOwnEnum() {
  t.no(e.hasOwnEnum(undefined,                   `key`))
  t.no(e.hasOwnEnum({},                          `key`))
  t.no(e.hasOwnEnum(Object.create({key: `val`}), `key`))

  t.ok(e.hasOwnEnum({key: `val`},                `key`))

  const ref = {}
  Object.defineProperty(ref, `key`, {enumerable: false, value: `val`})
  t.no(e.hasOwnEnum(ref, `key`))
})

t.test(function test_deinit() {
  e.deinit()
  e.deinit({})

  const counter = new Track()
  t.is(e.deinit(counter), undefined)
  t.eq(counter, new Track(0, 1))
})

t.test(function test_priv() {
  t.test(function test_new_property() {
    const ref = {one: 10}
    e.priv(ref, `two`, 20)

    t.eq(Object.getOwnPropertyDescriptor(ref, `two`), {
      value: 20,
      enumerable: false,
      writable: true,
      configurable: true,
    })

    t.eq(ref, {one: 10})
    t.eq(Object.keys(ref), [`one`])
    t.eq(Object.getOwnPropertyNames(ref), [`one`, `two`])

    t.is(ref.one, 10)
    t.is(ref.two, 20)

    t.no(e.hasOwnEnum(ref, `two`))

    t.ok(e.hasOwn(ref, `one`))
    t.ok(e.hasOwnEnum(ref, `one`))
    t.ok(e.hasOwn(ref, `two`))
  })

  t.test(function test_redefine_property() {
    const ref = {one: 10}
    e.priv(ref, `one`, 20)

    t.eq(ref, {})
    t.eq(Object.keys(ref), [])
    t.eq(Object.getOwnPropertyNames(ref), [`one`])
    t.is(ref.one, 20)
  })
})

t.test(function test_privs() {
  const ref = {one: 10, get two() {return 40}}
  e.privs(ref, {two: 20, three: 30})

  t.eq(Object.getOwnPropertyDescriptors(ref), {
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

  t.eq(ref, {one: 10})
  t.eq(Object.keys(ref), [`one`])
  t.eq(Object.getOwnPropertyNames(ref), [`one`, `two`, `three`])
  t.is(ref.one, 10)
  t.is(ref.two, 20)
  t.is(ref.three, 30)

  t.no(e.hasOwnEnum(ref, `two`))
  t.no(e.hasOwnEnum(ref, `three`))

  t.ok(e.hasOwn(ref, `one`))
  t.ok(e.hasOwnEnum(ref, `one`))
  t.ok(e.hasOwn(ref, `two`))
  t.ok(e.hasOwn(ref, `three`))
})

t.test(function test_pub() {
  t.test(function test_new_property() {
    const ref = {one: 10}
    e.priv(ref, `three`, 30)
    e.pub(ref, `two`, 20)

    t.eq(Object.getOwnPropertyDescriptor(ref, `two`), {
      value: 20,
      enumerable: true,
      writable: true,
      configurable: true,
    })

    t.eq(ref, {one: 10, two: 20})
    t.eq(Object.keys(ref), [`one`, `two`])
    t.eq(Object.getOwnPropertyNames(ref), [`one`, `three`, `two`])

    t.is(ref.one, 10)
    t.is(ref.two, 20)
    t.is(ref.three, 30)

    t.no(e.hasOwnEnum(ref, `three`))

    t.ok(e.hasOwn(ref, `one`))
    t.ok(e.hasOwnEnum(ref, `one`))
    t.ok(e.hasOwn(ref, `two`))
    t.ok(e.hasOwnEnum(ref, `two`))
    t.ok(e.hasOwn(ref, `two`))
  })

  t.test(function test_redefine_property() {
    const ref = {one: 10}
    e.priv(ref, `two`, 20)
    e.pub(ref, `two`, 30)

    t.eq(Object.getOwnPropertyDescriptor(ref, `two`), {
      value: 30,
      enumerable: true,
      writable: true,
      configurable: true,
    })

    t.eq(ref, {one: 10, two: 30})
    t.eq(Object.keys(ref), [`one`, `two`])
    t.eq(Object.getOwnPropertyNames(ref), [`one`, `two`])
    t.is(ref.one, 10)
    t.is(ref.two, 30)
  })
})

t.test(function test_pubs() {
  const ref = {one: 10, get two() {return 40}}
  e.priv(ref, `three`, 50)
  e.pubs(ref, {two: 20, three: 30})

  t.eq(Object.getOwnPropertyDescriptors(ref), {
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

  t.eq(ref, {one: 10, two: 20, three: 30})
  t.is(ref.one, 10)
  t.is(ref.two, 20)
  t.is(ref.three, 30)

  t.ok(e.hasOwn(ref, `one`))
  t.ok(e.hasOwnEnum(ref, `one`))
  t.ok(e.hasOwn(ref, `two`))
  t.ok(e.hasOwnEnum(ref, `two`))
  t.ok(e.hasOwn(ref, `three`))
  t.ok(e.hasOwnEnum(ref, `three`))
})

t.test(function test_bind() {
  const ref = new class {
    one() {return this}
    two() {return this}
  }()

  e.bind(ref, ref.one, ref.two)
  t.eq(Object.keys(ref), [])
  t.eq(Object.getOwnPropertyNames(ref), [`one`, `two`])

  const {one, two} = ref
  t.is(one(), ref)
  t.is(two(), ref)
})

t.test(function test_bindAll() {
  class Inner {
    methInner() {return [this, `meth inner`]}
    methOverride() {return [this, `methOverride inner`]}
  }
  Inner.prototype.innerNonMethod = `inner non method`
  Inner.prototype.funOverride = function funInner() {return [this, `funOverride inner`]}

  class Outer extends Inner {
    methOverride() {return [this, `methOverride outer`]}
    methOuter() {return [this, `meth outer`]}
  }
  Outer.prototype.outerNonMethod = `outer non method`
  Outer.prototype.funOverride = function funOuter() {return [this, `funOverride outer`]}

  const ref = new Outer()
  e.bindAll(ref)

  t.eq(Object.keys(ref), [])

  t.eq(
    Object.getOwnPropertyNames(ref).sort(),
    [`methInner`, `methOverride`, `methOuter`, `funOverride`].sort(),
  )

  const {methInner, methOverride, methOuter, funOverride} = ref

  t.is(methInner()[0], ref)
  t.is(methInner()[1], `meth inner`)

  t.is(methOverride()[0], ref)
  t.is(methOverride()[1], `methOverride outer`)

  t.is(methOuter()[0], ref)
  t.is(methOuter()[1], `meth outer`)

  t.is(funOverride()[0], ref)
  t.is(funOverride()[1], `funOverride outer`)
})

t.test(function test_lazyGet() {
  t.test(function test_lazyGet_only_ancestor() {
    const [Anc, Mid, Des] = testInitLazy()
    e.lazyGet(Anc)

    const ref = new Des()
    t.eq(Object.keys(ref), [])

    t.is(ref.anc0, ref.anc0)
    t.eq(Object.keys(ref), [`anc0`])

    t.is(ref.anc1, ref.anc1)
    t.eq(Object.keys(ref), [`anc0`, `anc1`])

    t.isnt(ref.mid0, ref.mid0)
    t.isnt(ref.mid1, ref.mid1)

    t.isnt(ref.des0, ref.des0)
    t.isnt(ref.des1, ref.des1)

    testClearPrototype(Anc, Mid, Des)
  })

  t.test(function test_lazyGet_only_descendant() {
    const [Anc, Mid, Des] = testInitLazy()
    e.lazyGet(Des)

    const ref = new Des()
    t.eq(Object.keys(ref), [])

    t.isnt(ref.anc0, ref.anc0)
    t.isnt(ref.anc1, ref.anc1)

    t.isnt(ref.mid0, ref.mid0)
    t.isnt(ref.mid1, ref.mid1)

    t.is(ref.des0, ref.des0)
    t.eq(Object.keys(ref), [`des0`])

    t.is(ref.des1, ref.des1)
    t.eq(Object.keys(ref), [`des0`, `des1`])

    testClearPrototype(Anc, Mid, Des)
  })

  t.test(function test_lazyGet_all() {
    const [Anc, Mid, Des] = testInitLazy()
    e.lazyGet(Anc)
    e.lazyGet(Mid)
    e.lazyGet(Des)

    const ref = new Des()
    t.eq(Object.keys(ref), [])

    t.is(ref.anc0, ref.anc0)
    t.eq(Object.keys(ref), [`anc0`])

    t.is(ref.anc1, ref.anc1)
    t.eq(Object.keys(ref), [`anc0`, `anc1`])

    t.is(ref.mid0, ref.mid0)
    t.eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`])

    t.is(ref.mid1, ref.mid1)
    t.eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`])

    t.is(ref.des0, ref.des0)
    t.eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`, `des0`])

    t.is(ref.des1, ref.des1)
    t.eq(Object.keys(ref), [`anc0`, `anc1`, `mid0`, `mid1`, `des0`, `des1`])

    testClearPrototype(Anc, Mid, Des)
  })

  t.test(function test_lazyGet_set() {
    const [Anc, Mid, Des] = testInitLazy()
    e.lazyGet(Anc)

    const ref = new Des()
    const manual = Symbol(`manual`)

    ref.anc0 = manual
    t.is(ref.anc0, manual)
    t.eq(Object.keys(ref), [`anc0`])

    t.is(ref.anc1, ref.anc1)
    t.eq(Object.keys(ref), [`anc0`, `anc1`])

    testClearPrototype(Anc, Mid, Des)
  })
})

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

function testClearPrototype(...classes) {
  for (const cls of classes) {
    t.eq(Object.keys(cls.prototype), [])
  }
}

t.test(function test_de() {
  const ref    = e.de({})
  const first  = new Track()
  const second = new Track()
  const third  = new Track()

  Object.defineProperty(ref, `hidden`, {value: third, enumerable: false})

  ref.val = first
  t.is(ref.val, first)
  t.eq(ref, {val: new Track(0, 0)})

  // Hide self-assign from linters.
  ref.val = id(ref.val)
  t.is(ref.val, first)
  t.eq(ref, {val: new Track(0, 0)})

  ref.val = second
  t.is(ref.val, second)
  t.eq(ref, {val: new Track(0, 0)})
  t.eq(first, new Track(0, 1))

  ref.deinit()
  t.is(ref.val, second)
  t.eq(ref, {val: new Track(0, 1)})

  delete ref.val
  t.is(ref.val, undefined)
  t.is(e.hasOwn(ref, `val`), false)
  t.eq(second, new Track(0, 2))

  t.is(ref.hidden, third)
  t.eq(third, new Track(0, 0))
})

// The test is rudimentary, maybe about 5% complete.
t.test(function test_obs() {
  t.test(function test_imperative() {
    const ref = e.obs({})
    const obs = e.ph(ref)
    const first = new Track()
    const second = new Track()

    obs.sub(first.trig)
    obs.sub(second.trig)
    t.eq(first, new Track(0, 0))
    t.eq(second, new Track(0, 0))

    obs.trig()
    t.eq(first, new Track(1, 0))
    t.eq(second, new Track(1, 0))

    // Implicit trigger.
    ref.val = 10
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(2, 0))

    // Rudimentary change detection prevents another trigger.
    ref.val = 10
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(2, 0))

    obs.unsub(first.trig)
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(2, 0))

    ref.val = 20
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(3, 0))

    ref.deinit()
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(3, 0))

    obs.trig()
    t.eq(first, new Track(2, 0))
    t.eq(second, new Track(3, 0))
  })
})

console.log(`[test] ok`)
