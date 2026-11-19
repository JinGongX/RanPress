import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.setOptions({ gfm: true, breaks: true })

const renderer = new marked.Renderer()

renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = language === 'plaintext'
    ? escapeHtml(text)
    : hljs.highlight(text, { language }).value
  return `<div class="rp-code-window"><div class="rp-code-titlebar"><span class="rp-code-dots"><i></i><i></i><i></i></span><span class="rp-code-language">${language === 'plaintext' ? 'TEXT' : escapeHtml(language.toUpperCase())}</span></div><pre class="rp-code"><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre></div>`
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
function expandCallouts(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  for (let i = 0; i < lines.length;) {
    if (!/^\s*>/.test(lines[i])) { output.push(lines[i++]); continue }
    const quoteLines: string[] = []
    let j = i
    while (j < lines.length && /^\s*>/.test(lines[j])) {
      quoteLines.push(lines[j].replace(/^\s*>\s?/, ''))
      j++
    }
    const first = quoteLines[0]?.match(/^\[!(TIP|WARNING|SUCCESS|INFO)\]\s*(.*)$/i)
    if (!first) { output.push(...lines.slice(i, j)); i = j; continue }
    const kind = first[1].toUpperCase()
    const bodyLines = [first[2], ...quoteLines.slice(1)]
    while (bodyLines.length && bodyLines[0] === '') bodyLines.shift()
    while (bodyLines.length && bodyLines[bodyLines.length - 1] === '') bodyLines.pop()
    const body = marked.parse(bodyLines.join('\n'), { renderer }) as string
    output.push('', `<div class="rp-callout rp-callout-${kind.toLowerCase()}"><div class="rp-callout-title">${calloutMeta[kind].title}</div><div class="rp-callout-body">${body}</div></div>`, '')
    i = j
  }
  return output.join('\n')
}

export function renderMarkdown(source: string) {
  const prepared = expandCallouts(source)
  const raw = marked.parse(prepared, { renderer }) as string
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['class', 'target', 'rel', 'role'] })
}
