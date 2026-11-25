import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.setOptions({ gfm: true, breaks: true })

const renderer = new marked.Renderer()

const macosDots = '<svg class="rp-code-dots" xmlns="http://www.w3.org/2000/svg" width="56" height="14" viewBox="0 0 56 14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="#ff5f57"/><circle cx="28" cy="7" r="5" fill="#febc2e"/><circle cx="49" cy="7" r="5" fill="#28c840"/></svg>'

renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = language === 'plaintext'
    ? escapeHtml(text)
    : hljs.highlight(text, { language }).value
  return `<div class="rp-code-window"><div class="rp-code-titlebar">${macosDots}<span class="rp-code-github-title">GitHub</span><span class="rp-code-vscode-title">&gt;_ VS Code</span></div><pre class="rp-code"><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre></div>`
}

renderer.image = ({ href, title, text }) => `<figure class="rp-image"><img src="${escapeAttribute(href || '')}" alt="${escapeAttribute(text || '')}"${title ? ` title="${escapeAttribute(title)}"` : ''}/>${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ''}</figure>`

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escapeAttribute(value: string) { return escapeHtml(value) }

const calloutMeta: Record<string, { title: string }> = {
  TIP: { title: '小提示' }, WARNING: { title: '注意事项' }, SUCCESS: { title: '成功' }, INFO: { title: '补充说明' }
}

/**
 * Marked's blockquote renderer receives already-rendered HTML, which made the
 * old [!TIP] matcher fragile. Extract callout blockquotes from source first,
 * then render their body as Markdown independently.
 */
function stripRootWhitespace(root: Element) {
  Array.from(root.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !(node.nodeValue || '').trim()) node.remove()
  })
}

function expandCallouts(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  const appendBlock = (html: string) => {
    while (output.length && output[output.length - 1].trim() === '') output.pop()
    if (output.length) output.push('')
    output.push(html, '')
  }

  for (let i = 0; i < lines.length;) {
    if (!/^\s*>/.test(lines[i])) {
      const line = lines[i++]
      if (line.trim() === '' && output.length && output[output.length - 1].trim() === '') continue
      output.push(line)
      continue
    }

    const quoteLines: string[] = []
    let j = i
    while (j < lines.length && /^\s*>/.test(lines[j])) {
      quoteLines.push(lines[j].replace(/^\s*>\s?/, ''))
      j++
    }
    const first = quoteLines[0]?.match(/^\[!(TIP|WARNING|SUCCESS|INFO)\]\s*(.*)$/i)
    if (!first) {
      output.push(...lines.slice(i, j))
      i = j
      continue
    }

    const kind = first[1].toUpperCase()
    const bodyLines = [first[2], ...quoteLines.slice(1)]
    while (bodyLines.length && bodyLines[0] === '') bodyLines.shift()
    while (bodyLines.length && bodyLines[bodyLines.length - 1] === '') bodyLines.pop()
    const body = (marked.parse(bodyLines.join('\n'), { renderer }) as string).trim()
    appendBlock(`<section class="rp-callout rp-callout-${kind.toLowerCase()}"><div class="rp-callout-title">${calloutMeta[kind].title}</div><div class="rp-callout-body">${body}</div></section>`)
    i = j
  }
  return output.join('\n')
}

export function renderMarkdown(source: string) {
  const prepared = expandCallouts(source)
  const raw = marked.parse(prepared, { renderer }) as string
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['class', 'target', 'rel', 'role'] })
  const container = document.createElement('div')
  container.innerHTML = clean
  stripRootWhitespace(container)
  return container.innerHTML
}
