'use strict'

const hljs = require('highlight.js')
const marked = require('marked')
const pt = require('path')
const {ifonly, not, test, testOr} = require('fpx')
const {version} = require('./package.json')
const prod = process.env.NODE_ENV === 'production'

marked.setOptions({
  smartypants: true,
  highlight (code, lang) {
    return (lang ? hljs.highlight(lang, code) : hljs.highlightAuto(code)).value
  }
})

marked.Renderer.prototype.heading = function (text, level, raw) {
  const id = this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-')
  return (
`<h${level}>
  <span>${text}</span>
  <a class="heading-anchor fa fa-link" href="#${id}" id="${id}"></a>
</h${level}>
`
  )
}

module.exports = {
  imports: {
    version,
    prod,
    url (path) {
      return pt.join(pt.dirname(path), pt.parse(path).name)
    },
    md (content) {
      return marked(content)
        .replace(/<pre><code class="(.*)">|<pre><code>/g, '<pre><code class="hljs $1">')
        .replace(/<!--\s*:((?:[^:]|:(?!\s*-->))*):\s*-->/g, '$1')
    },
  },
  ignorePath: test(/^partials/),
  renamePath: ifonly(
    not(testOr('index.html', '404.html')),
    (path, {dir, name}) => pt.join(dir, name, 'index.html')
  ),
}
