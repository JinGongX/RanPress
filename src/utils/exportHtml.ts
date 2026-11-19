import type { Theme } from '../types'

export interface ExportTypography {
  fontSize: number
  lineHeight: number
  paragraphGap: number
}

export type CodeBlockStyle = 'macos' | 'github' | 'vscode'

const safe = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const setStyle = (el: Element, style: string) => el.setAttribute('style', style)

const codePalettes: Record<CodeBlockStyle, { panel: string; header: string; border: string; text: string; label: string }> = {
  macos: { panel: '#111827', header: '#202938', border: '#344154', text: '#e5edf5', label: '#aab7c8' },
  github: { panel: '#0d1117', header: '#161b22', border: '#30363d', text: '#e6edf3', label: '#8b949e' },
  vscode: { panel: '#1e1e1e', header: '#252526', border: '#3c3c3c', text: '#d4d4d4', label: '#9da5b4' }
}

// WeChat may discard <pre> whitespace rules. Convert spaces to NBSP and newlines
// to <br> while retaining Highlight.js token spans and their inline colors.
function preserveCodeWhitespace(code: Element): string {
  const clone = code.cloneNode(true) as Element
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || ''
      const parts = value.split('\n')
      const fragment = document.createDocumentFragment()
      parts.forEach((part, index) => {
        if (index) fragment.appendChild(document.createElement('br'))
        if (part) fragment.appendChild(document.createTextNode(part.replace(/\t/g, '    ').replace(/ /g, '\u00a0')))
      })
      node.parentNode?.replaceChild(fragment, node)
      return
    }
    Array.from(node.childNodes).forEach(walk)
  }
  Array.from(clone.childNodes).forEach(walk)
  return clone.innerHTML
}

function styleCodeWindow(windowEl: Element, style: CodeBlockStyle) {
  const palette = codePalettes[style]
  const lang = windowEl.querySelector('.rp-code-language')?.textContent?.trim() || 'TEXT'
  const code = windowEl.querySelector('code')
  const codeHtml = code ? preserveCodeWhitespace(code) : safe(windowEl.querySelector('pre')?.textContent || '')
  const border = `1px solid ${palette.border}`
  const table = document.createElement('table')
  table.setAttribute('role', 'presentation')
  setStyle(table, `width:100%;border-collapse:collapse;border-spacing:0;margin:18px 0;background:${palette.panel};border:${border};table-layout:fixed;`)

  const header = document.createElement('tr')
  const headerCell = document.createElement('td')
  setStyle(headerCell, `padding:0;background:${palette.header};border-bottom:${border};height:38px;`)
  // A nested two-cell table is more stable than flex/float in WeChat's editor.
  headerCell.innerHTML = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:0;border-collapse:collapse;border-spacing:0;"><tbody><tr><td width="50%" style="padding:10px 12px;text-align:left;white-space:nowrap;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${palette.label};">${style === 'macos' ? '<span style="display:inline-block;color:#ff5f57;line-height:18px;">●</span>&nbsp;<span style="display:inline-block;color:#febc2e;line-height:18px;">●</span>&nbsp;<span style="display:inline-block;color:#28c840;line-height:18px;">●</span>' : style === 'vscode' ? '›' : '●'}</td><td width="50%" style="padding:10px 12px;text-align:right;white-space:nowrap;font-family:Menlo,Monaco,Consolas,monospace;font-size:10px;line-height:18px;letter-spacing:1px;color:${palette.label};">${safe(lang.toUpperCase())}</td></tr></tbody></table>`
  header.appendChild(headerCell)

  const bodyRow = document.createElement('tr')
  const bodyCell = document.createElement('td')
  setStyle(bodyCell, `padding:14px 15px;background:${palette.panel};color:${palette.text};font-family:Menlo,Monaco,Consolas,'Courier New',monospace;font-size:12px;line-height:1.75;word-break:break-all;overflow-wrap:anywhere;`)
  bodyCell.innerHTML = codeHtml || '&nbsp;'
  bodyRow.appendChild(bodyCell)
  table.append(header, bodyRow)
  windowEl.replaceWith(table)
}

function styleCallout(callout: Element, theme: Theme, kind: string, typography: ExportTypography) {
  const presets: Record<string, { title: string; bg: string; accent: string; text: string }> = {
    tip: { title: '小提示', bg: '#eff6ff', accent: '#2563eb', text: '#334155' },
    warning: { title: '注意事项', bg: '#fff7ed', accent: '#d97706', text: '#7c4a12' },
    success: { title: '成功', bg: '#f0fdf4', accent: '#16a34a', text: '#285b43' },
    info: { title: '补充说明', bg: '#f1f5f9', accent: theme.accent, text: '#475569' }
  }
  const preset = presets[kind] || presets.info
  const table = document.createElement('table')
  table.setAttribute('role', 'presentation')
  setStyle(table, `width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;margin:18px 0;background:${preset.bg};border-left:4px solid ${preset.accent};`)
  const title = safe(callout.querySelector('.rp-callout-title')?.textContent || preset.title)
  const body = callout.querySelector('.rp-callout-body')?.innerHTML || callout.innerHTML
  table.innerHTML = `<tbody><tr><td style="padding:11px 14px 3px;background:${preset.bg};color:${preset.accent};font-family:Arial,'PingFang SC',sans-serif;font-size:14px;line-height:1.5;font-weight:700;">${title}</td></tr><tr><td style="padding:2px 14px 12px;background:${preset.bg};color:${preset.text};font-size:${Math.max(14, typography.fontSize - 1)}px;line-height:${typography.lineHeight};">${body}</td></tr></tbody>`
  table.querySelectorAll('p').forEach(p => setStyle(p, `margin:0 0 6px;color:${preset.text};font-size:${Math.max(14, typography.fontSize - 1)}px;line-height:${typography.lineHeight};`))
  callout.replaceWith(table)
}

export function toWechatHtml(content: string, theme: Theme, typography: ExportTypography, codeStyle: CodeBlockStyle = 'macos') {
  const root = document.createElement('div')
  root.innerHTML = content
  const base = `color:${theme.text};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB',sans-serif;font-size:${typography.fontSize}px;line-height:${typography.lineHeight};letter-spacing:.2px;word-break:break-word;`

  root.querySelectorAll('.rp-code-window').forEach(el => styleCodeWindow(el, codeStyle))

  root.querySelectorAll('.rp-callout').forEach(el => {
    const callout = [...el.classList].find(name => name.startsWith('rp-callout-'))
    if (callout) styleCallout(el, theme, callout.replace('rp-callout-', ''), typography)
  })

  root.querySelectorAll('blockquote').forEach(el => {
    const table = document.createElement('table')
    table.setAttribute('role', 'presentation')
    setStyle(table, `width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;margin:18px 0;background:${theme.id === 'editorial' ? '#f8f0e9' : theme.id === 'japanese' ? '#f2f5ef' : theme.id === 'developer' ? '#eff8f6' : '#f4f7fb'};border-left:3px solid ${theme.accent};`)
    const td = document.createElement('td')
    setStyle(td, `padding:11px 14px;color:${theme.muted};font-size:${Math.max(14, typography.fontSize - 1)}px;line-height:${typography.lineHeight};`)
    td.innerHTML = el.innerHTML
    table.appendChild(td)
    el.replaceWith(table)
  })

  root.querySelectorAll('p').forEach(el => setStyle(el, `${base}margin:0 0 ${typography.paragraphGap}px;`))
  const h1Style = theme.id === 'editorial'
    ? `font-family:Georgia,serif;font-size:28px;font-weight:650;border-bottom:1px solid ${theme.accent};padding-bottom:18px;`
    : theme.id === 'developer'
      ? `font-family:Menlo,Monaco,monospace;font-size:22px;border-bottom:1px dashed ${theme.border};`
      : `font-size:25px;font-weight:750;border-bottom:${theme.id === 'minimal' ? '1px solid' : '2px solid'} ${theme.accent};padding-bottom:13px;`
  const h2Style = theme.id === 'editorial'
    ? `color:${theme.accent};border-bottom:1px solid ${theme.border};padding:0 0 9px;`
    : theme.id === 'minimal'
      ? `color:${theme.text};border-left:2px solid ${theme.accent};padding-left:13px;`
      : `color:${theme.accent};border-left:${theme.id === 'business' ? '3px' : '4px'} solid ${theme.accent};padding:4px 0 4px 12px;background:${theme.id === 'tech' ? '#eff6ff' : theme.id === 'japanese' ? '#f3f6f0' : theme.id === 'developer' ? '#eff8f6' : 'transparent'};`
  root.querySelectorAll('h1').forEach(el => setStyle(el, `color:${theme.text};line-height:1.45;margin:30px 0 22px;letter-spacing:-.3px;${h1Style}`))
  root.querySelectorAll('h2').forEach(el => setStyle(el, `font-size:20px;line-height:1.5;font-weight:700;margin:30px 0 15px;${h2Style}`))
  root.querySelectorAll('h3').forEach(el => setStyle(el, `color:${theme.text};font-size:17px;line-height:1.5;font-weight:700;margin:24px 0 11px;`))

  root.querySelectorAll('pre').forEach(el => { if (!el.closest('table[role="presentation"]')) setStyle(el, 'display:block;margin:0;padding:14px 15px;background:#111827;color:#e5edf5;font-family:Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;') })
  root.querySelectorAll('pre code').forEach(el => setStyle(el, 'display:block;background:transparent;color:#e5edf5;font-family:Menlo,Monaco,Consolas,monospace;font-size:12px;'))
  const tokenColors: Record<string, string> = { 'hljs-keyword':'#c792ea', 'hljs-selector-tag':'#c792ea', 'hljs-string':'#c3e88d', 'hljs-attr':'#c3e88d', 'hljs-number':'#f78c6c', 'hljs-literal':'#f78c6c', 'hljs-title':'#82aaff', 'hljs-function':'#82aaff', 'hljs-comment':'#8793a5', 'hljs-built_in':'#ffcb6b', 'hljs-type':'#ffcb6b' }
  Object.entries(tokenColors).forEach(([className, color]) => root.querySelectorAll(`.${className}`).forEach(el => setStyle(el, `color:${color};`)))
  root.querySelectorAll('code').forEach(el => { if (!el.closest('pre')) setStyle(el, `background:${theme.bg === '#ffffff' ? '#f1f3f5' : '#eef0eb'};color:${theme.accent};padding:2px 5px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace;font-size:.9em;`) })
  root.querySelectorAll('img').forEach(el => setStyle(el, 'max-width:100%;height:auto;display:block;margin:20px auto;'))
  root.querySelectorAll('figure').forEach(el => setStyle(el, 'margin:20px 0;text-align:center;'))
  root.querySelectorAll('ul,ol').forEach(el => setStyle(el, `${base}padding-left:1.5em;margin:0 0 ${typography.paragraphGap}px;`))
  root.querySelectorAll('li').forEach(el => setStyle(el, 'margin:6px 0;padding-left:3px;'))
  root.querySelectorAll('a').forEach(el => setStyle(el, `color:${theme.accent};text-decoration:underline;`))
  root.querySelectorAll('hr').forEach(el => setStyle(el, `border:0;border-top:1px solid ${theme.border};margin:28px 0;`))
  root.querySelectorAll('table:not([role="presentation"])').forEach(el => setStyle(el, 'width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;table-layout:fixed;'))
  root.querySelectorAll('th,td').forEach(el => { if (!el.closest('[role="presentation"]')) setStyle(el, `border:1px solid ${theme.border};padding:8px 7px;text-align:left;word-break:break-word;`) })
  root.querySelectorAll('th').forEach(el => setStyle(el, `background:${theme.bg === '#ffffff' ? '#f4f6f8' : theme.bg};font-weight:700;color:${theme.text};`))
  return `<div style="${base}display:block;width:100%;max-width:100%;">${root.innerHTML}</div>`
}
