## Overview

`Espo`: **e**xtensions for **s**tateful **p**r**o**gramming in JavaScript. Source: <a href="https://github.com/Mitranim/espo" target="_blank">https://github.com/Mitranim/espo</a>

Library for reactive and stateful programming: observables, implicit reactivity, automatic resource cleanup.

Relatively small: 10 KB minified. Dependency-free. Written with ES2015 exports. Transpiled with annotations that allow UglifyJS to drop unused classes. When building a browser bundle, Webpack 4+ or Rollup, in combination with UglifyJS, should strip out the unused code, leaving only what you actually use. Node.js uses the CommonJS version.

See sibling libraries:

  * Emerge: <a href="https://github.com/Mitranim/emerge" target="_blank">https://github.com/Mitranim/emerge</a>. Efficient patching and merging of plain JS data.
  * fpx: <a href="https://mitranim.com/fpx/" target="_blank">https://mitranim.com/fpx/</a>. Utils for functional programming.

Install with `npm`. Current version: `{{VERSION}}`.

```sh
npm i --save espo
```

All examples imply an import:

```js
const {someFunction} = require('espo')
```

On this page, all Espo words are exported into global scope. You can run the examples in the browser console.
