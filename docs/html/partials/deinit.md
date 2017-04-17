### `DeinitDict()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Aggregator of other [`deinitables`](#-isdeinitable-value-) that you assign
directly onto it. When deinited, it will deinit each of its enumerable
properties, deleting it from self. Ignores other properties.

Resilient to exceptions. If a deinitable throws an exception, it doesn't
prevent the deinitialisation of its siblings. Exceptions are delayed until the
end.

```js
const dd = new DeinitDict()

dd.danger = {
  deinit () {
    console.info('blowing up')
    throw Error('fail')
  }
}

dd.one = new DeinitDict()

dd.one.other = {
  deinit () {
    console.info('deiniting other')
  }
}

dd.deinit()

// all three DeinitDict instances have now been deinitialised and emptied
// exception has been thrown afterwards
```

---
