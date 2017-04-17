### `DeinitDict()`

`implements` [`isDeinitable`](#-isdeinitable-value-)

Aggregator of other [`deinitables`](#-isdeinitable-value-). When deinited,
will scan its enumerable properties; any deinitables found on the dict will be
deleted from it and deinited. Ignores other properties.

Resilient to exceptions. If a deinitable throws an exception, it doesn't
prevent the deinitialisation of its siblings. Exceptions are delayed until the
end.

```js
const dd = new DeinitDict()

// call .own() to replace any previously owned deinitables
dd.own({
  danger: {
    deinit () {
      console.info('blowing up')
      throw Error('fail')
    }
  },
  // or pass deinitables to the constructor
  one: new DeinitDict({
    other: {
      deinit () {
        console.info('deiniting other')
      }
    },
  }),
})

dd.deinit()

// both DeinitDict instances have now been deinitialised and emptied
// exception has been thrown afterwards
```

---
