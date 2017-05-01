'use strict'

const {Atom} = require('./atom')
const {deinitDiff} = require('./lifetime')

// WTB better name
class Agent extends Atom {
  reset (next) {
    const prev = this.value
    try {super.reset(next)}
    finally {deinitDiff(prev, next)}
  }

  unwrap () {
    const {value} = this
    this.value = undefined
    try {
      this.trigger(this)
      return value
    }
    catch (err) {
      deinitDiff(value)
      throw err
    }
  }

  deinit () {
    try {super.deinit()}
    finally {this.reset(undefined)}
  }
}

exports.Agent = Agent
