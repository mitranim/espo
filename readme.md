## Overview

## TOC

* [Why](#why)
* [Usage](#usage)
* [API](#api)
* [Changelog](#changelog)
* [Misc](#misc)

## Why

## Usage

Manual sub-unsub:

```js
import * as es from 'espo'

const obs = es.obs({one: 10, two: 20})

const key = obs.sub(function onUpdate(key) {
  const obs = this
  console.log('current state:', obs)
})

// Prints "current state: Obs {one: 30, two: 20}".
obs.one = 30

// Drop one subscription:
obs.unsub(key)

// Drop all subscriptions:
obs.deinit()
```

Automatic sub-resub:

```js
const one = es.obs({one: 10})
const two = es.obs({two: 20})

const rec = new es.Rec(onUpdate)

function onUpdate() {
  rec.run(onRun)
}

function onRun() {
  console.log(one.one + two.two)
}

// Prints "30".
onUpdate()

// Prints "50".
one.one = 30

// Prints "70".
two.two = 40

// Stops further reruns.
rec.deinit()
```

Subclassing:

```js
class Dat extends es.Obs {
  constructor() {
    super()
    this.fut = undefined
    this.val = undefined
    this.err = undefined
  }

  onInit() {
    if (!this.fut) {
      this.fut = fetch((err, val) => {
        this.fut = undefined
        this.err = err
        this.val = val
      })
    }
  }

  onDeinit() {
    this.fut = undefined
  }
}

function fetch(fun) {
  const timer = setTimeout(fun, 0, 'val', Error('err'))
  return {deinit: clearTimeout.bind(undefined, timer)}
}
```

## API

## Changelog
