'use strict'

const hljs = require('highlight.js')
const marked = require('marked')
const pt = require('path')

const {version: VERSION} = require('./package.json')
const PROD = process.env.NODE_ENV === 'production'

/**
 * Markdown
 */

marked.setOptions({
  smartypants: true,
  highlight (code, lang) {
    return (lang ? hljs.highlight(lang, code) : hljs.highlightAuto(code)).value
  },
})

marked.Renderer.prototype.heading = function heading(text, level, raw) {
  const id = this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-')
  return (
    `<h${level}>` +
      `<span>${text}</span>` +
      `<a class="heading-anchor" href="#${id}" id="${id}">🔗</a>` +
    `</h${level}>\n`
  )
}

// Adds target="_blank" to external links.
marked.Renderer.prototype.link = function link (href, title, text) {
  if (this.options.sanitize) {
    try {
      const protocol = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase()
      if (/javascript:|vbscript:/i.test(protocol)) return ''
    }
    catch (err) {
      console.error(err)
      return ''
    }
  }

  // The site is mounted on a base href. Links starting with / are usually
  // typos. Links starting with // are a stupid idea anyway and need a protocol
  // prepended.
  if (/^\//.test(href)) {
    throw Error(`unexpected domain-relative href: ${href}`)
  }

  const attrs = [
    href                      && `href="${href}"`,
    title                     && `title="${title}"`,
    /^[a-z]+:\/\//.test(href) && `target="_blank"`,
  ].filter(Boolean)

  return `<a ${attrs.join(' ')}>${text || ''}</a>`
}

/**
 * Statil
 */

module.exports = {
  imports: {
    VERSION,
    PROD,
    md (content) {
      return marked(content)
        .replace(/<pre><code class="(.*)">|<pre><code>/g, '<pre><code class="hljs $1">')
        .replace(/<!--\s*:((?:[^:]|:(?!\s*-->))*):\s*-->/g, '$1')
    },
    url (path) {
      return pt.join(pt.dirname(path), pt.parse(path).name)
    },
  },
  ignorePath: path => /^partials/.test(path),
  renamePath: (path, {dir, name}) => (
    path === 'index.html' || path === '404.html'
    ? path
    : pt.join(dir, name, 'index.html')
  ),
}
