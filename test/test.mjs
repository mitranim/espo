/*
This test is WILDLY incomplete. Just like the documentation. Everything is a
work in progress after the rework.
*/

import {is, eq, nop, Tracker} from './utils.mjs'
import * as es from '../espo.mjs'

/* eslint-disable no-empty-function, no-self-assign */

void function testUtilityFuns() {
  void function testIsDe() {
    is(es.isDe(),                                false)
    is(es.isDe({}),                              false)
    is(es.isDe(new Tracker()),                   true)
    is(es.isDe(Object.create(new Tracker())),    true)
    is(es.isDe(Object.assign(deinit, {deinit})), true)

    function deinit() {}
  }()

  void function testIsObs() {
    is(es.isObs(),              false)
    is(es.isObs({}),            false)
    is(es.isObs(new Tracker()), false)
    is(es.isObs({
      sub() {},
      unsub() {},
      trigger() {},
      deinit() {},
    }), true)
  }()

  void function testIsAtom() {
    is(es.isAtom(),                              false)
    is(es.isAtom({}),                            false)
    is(es.isAtom(new Tracker()),                 false)
    is(es.isAtom({$: undefined}),                true)
    is(es.isAtom(Object.create({$: undefined})), true)
  }()

  void function testIsTrig() {
    is(es.isTrig(),                              false)
    is(es.isTrig({}),                            false)
    is(es.isTrig({trigger() {}}),                true)
    is(es.isTrig(Object.create({trigger() {}})), true)
    is(es.isTrig(nop),                           false)
  }()

  void function testIsSub() {
    is(es.isSub(),                              false)
    is(es.isSub({}),                            false)
    is(es.isSub({trigger() {}}),                true)
    is(es.isSub(Object.create({trigger() {}})), true)
    is(es.isSub(nop),                           true)
  }()

  void function testHasHidden() {
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
      const ref = new class {get key() {}}()
      is(es.hasHidden(ref, 'key'), true)
    }
  }()

  void function testHasOwnEnum() {
    is(es.hasOwnEnum(undefined,                   'key'), false)
    is(es.hasOwnEnum({},                          'key'), false)
    is(es.hasOwnEnum({key: 'val'},                'key'), true)
    is(es.hasOwnEnum(Object.create({key: 'val'}), 'key'), false)

    const ref = {}
    Object.defineProperty(ref, 'key', {enumerable: false, value: 'val'})
    is(es.hasOwnEnum(ref, 'key'), false)
  }()

  void function testHasOwn() {
    is(es.hasOwn(undefined,                   'key'), false)
    is(es.hasOwn({},                          'key'), false)
    is(es.hasOwn({key: 'val'},                'key'), true)
    is(es.hasOwn(Object.create({key: 'val'}), 'key'), false)
  }()

  void function testHasOwnEnum() {
    is(es.hasOwnEnum(undefined,                   'key'), false)
    is(es.hasOwnEnum({},                          'key'), false)
    is(es.hasOwnEnum({key: 'val'},                'key'), true)
    is(es.hasOwnEnum(Object.create({key: 'val'}), 'key'), false)

    const ref = {}
    Object.defineProperty(ref, 'key', {enumerable: false, value: 'val'})
    is(es.hasOwnEnum(ref, 'key'), false)
  }()

  void function test$() {
    eq(es.$(),          undefined)
    eq(es.$(10),        10)
    eq(es.$({val: 10}), {val: 10})
    eq(es.$({$: 10}),   10)
  }()

  void function testDeinit() {
    es.deinit()
    es.deinit({})

    const counter = new Tracker()
    is(es.deinit(counter), undefined)
    is(counter.de, 1)
  }()

  void function testPriv() {
    const ref = {one: 10}
    es.priv(ref, 'two', 20)

    eq(ref, {one: 10, two: 20})
    eq(Object.keys(ref), ['one'])
    eq(Object.getOwnPropertyNames(ref), ['one', 'two'])
    is(ref.one, 10)
    is(ref.two, 20)
    is(es.hasOwn(ref, 'one'),     true)
    is(es.hasOwnEnum(ref, 'one'), true)
    is(es.hasOwn(ref, 'two'),     true)
    is(es.hasOwnEnum(ref, 'two'), false)
  }()

  void function testPriv() {
    const ref = {one: 10}
    es.privs(ref, {two: 20, three: 30})
    eq(ref, {one: 10, two: 20, three: 30})

    eq(ref, {one: 10, two: 20, three: 30})
    eq(Object.keys(ref), ['one'])
    eq(Object.getOwnPropertyNames(ref), ['one', 'two', 'three'])
    is(ref.one, 10)
    is(ref.two, 20)
    is(ref.three, 30)
    is(es.hasOwn(ref, 'one'),     true)
    is(es.hasOwnEnum(ref, 'one'), true)
    is(es.hasOwn(ref, 'two'),     true)
    is(es.hasOwnEnum(ref, 'two'), false)
    is(es.hasOwn(ref, 'three'),     true)
    is(es.hasOwnEnum(ref, 'three'), false)
  }()

  void function testBind() {
    const ref = new class {
      one() {return this}
      two() {return this}
    }()

    es.bind(ref, 'one', 'two')
    eq(Object.keys(ref), [])
    eq(Object.getOwnPropertyNames(ref), ['one', 'two'])

    const {one, two} = ref
    is(one(), ref)
    is(two(), ref)
  }()

  // TODO
  // es.mut
  // es.paused
  // es.deinitAll
}()

void function testClassDeinit() {
  const ref    = new es.Deinit()
  const first  = new Tracker()
  const second = new Tracker()
  const third  = new Tracker()

  Object.defineProperty(ref, 'hidden', {value: third, enumerable: false})

  ref.val = first
  is(ref.val, first)
  eq(ref, {val: {de: 0, tr: 0}})

  ref.val = ref.val
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
void function testClassObs() {
  void function testImperative() {
    const ref = new es.Obs()
    const first = new Tracker()
    const second = new Tracker()

    ref.sub(first.trigger)
    ref.sub(second.trigger)
    eq(first, {de: 0, tr: 0})
    eq(second, {de: 0, tr: 0})

    ref.trigger()
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

    ref.unsub(first.trigger)
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 2})

    ref.val = 20
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})

    ref.deinit()
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})

    ref.trigger()
    eq(first, {de: 0, tr: 2})
    eq(second, {de: 0, tr: 3})
  }()
}()

console.log('[test] ok')
