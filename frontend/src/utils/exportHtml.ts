import type { Theme } from '../types'

export interface ExportTypography {
  fontSize: number
  lineHeight: number
  paragraphGap: number
}

export type CodeBlockStyle = 'macos' | 'github' | 'vscode'

const safe = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const setStyle = (el: Element, style: string) => el.setAttribute('style', style)


function stripRootWhitespace(root: Element) {
  Array.from(root.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !(node.nodeValue || '').trim()) node.remove()
  })
}

const codePalettes: Record<
  CodeBlockStyle,
  { panel: string; header: string; border: string; text: string; label: string }
> = {
  macos: {
    panel: '#222222',
    header: '#2b2b2b',
    border: '#383838',
    text: '#f3f4f6',
    label: '#a3a3a3'
  },
  github: {
    panel: '#0d1117',
    header: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    label: '#8b949e'
  },
  vscode: {
    panel: '#1e1e1e',
    header: '#252526',
    border: '#3c3c3c',
    text: '#d4d4d4',
    label: '#9da5b4'
  }
}

// 将高亮后的 HTML 按换行拆成逐行 <div>，避免公众号吞掉 <br> 或合并空格
// 1. 去掉末尾多余换行，避免代码块最后多出一行
function renderCodeLinesHtml(code: Element, defaultTextColor: string): string {
  const clone = code.cloneNode(true) as Element

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, '    ')
        .replace(/ /g, '\u00a0')
      node.parentNode?.replaceChild(document.createTextNode(text), node)
    } else {
      Array.from(node.childNodes).forEach(walk)
    }
  }
  walk(clone)

  // 去掉整体末尾多余的 \n
  const rawHtml = clone.innerHTML.replace(/\n+$/, '')
  const lines = rawHtml.split('\n')

  return lines
    .map((line) => {
      const content = line === '' ? '<br/>' : line
      return `<div style="min-height:20px;line-height:1.72;color:${defaultTextColor};white-space:pre;">${content}</div>`
    })
    .join('')
}



function flattenBlockContent(source: Element): string {
  const clone = source.cloneNode(true) as Element

  clone.querySelectorAll('ul,ol').forEach((list) => {
    const fragment = document.createDocumentFragment()
    const items = Array.from(list.children)
    items.forEach((item, index) => {
      const marker = document.createElement('span')
      marker.textContent = list.tagName === 'OL' ? `${index + 1}. ` : '• '
      fragment.append(marker, ...Array.from(item.childNodes))
      if (index < items.length - 1) fragment.append(document.createElement('br'))
    })
    list.replaceWith(fragment)
  })

  const paragraphs = Array.from(clone.querySelectorAll('p'))
  paragraphs.forEach((paragraph, index) => {
    const fragment = document.createDocumentFragment()
    fragment.append(...Array.from(paragraph.childNodes))
    if (index < paragraphs.length - 1) fragment.append(document.createElement('br'), document.createElement('br'))
    paragraph.replaceWith(fragment)
  })

  clone.querySelectorAll('div,section,blockquote,article').forEach((element) => {
    const fragment = document.createDocumentFragment()
    fragment.append(...Array.from(element.childNodes))
    element.replaceWith(fragment)
  })

  return clone.innerHTML.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
}

function styleCallout(callout: Element, theme: Theme, kind: string, typography: ExportTypography) {
  const presets: Record<string, { title: string; bg: string; accent: string; text: string }> = {
    tip: { title: '小提示', bg: '#eff6ff', accent: '#2563eb', text: '#1e3a8a' },
    warning: { title: '注意事项', bg: '#fff7ed', accent: '#d97706', text: '#7c2d12' },
    success: { title: '成功', bg: '#f0fdf4', accent: '#16a34a', text: '#14532d' },
    info: { title: '补充说明', bg: '#f1f5f9', accent: '#64748b', text: '#334155' }
  }
  const preset = presets[kind] || presets.info
  const block = document.createElement('p')
  block.className = 'rp-export-callout'
  setStyle(
    block,
    `display:block;margin:18px 0;padding:12px 14px;background:${preset.bg};border-left:4px solid ${preset.accent};border-radius:8px;color:${preset.text};font-size:${Math.max(14, typography.fontSize - 1)}px;line-height:1.72;word-break:break-word;`
  )

  const titleText = safe(callout.querySelector('.rp-callout-title')?.textContent?.trim() || preset.title)
  const bodyElement = callout.querySelector('.rp-callout-body')
  const bodyHtml = bodyElement ? flattenBlockContent(bodyElement) : flattenBlockContent(callout)
  block.innerHTML =
    `<span style="display:inline-block;margin-bottom:6px;color:${preset.accent};font-weight:700;font-size:14px;line-height:1.4;">${titleText}</span>` +
    (bodyHtml ? `<br>${bodyHtml}` : '')

  callout.replaceWith(block)
}

export function toWechatHtml(
  content: string,
  theme: Theme,
  typography: ExportTypography,
  codeStyle: CodeBlockStyle = 'macos'
) {
  const root = document.createElement('div')
  root.innerHTML = content
  stripRootWhitespace(root)

  const base = `color:${theme.text};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB',sans-serif;font-size:${typography.fontSize}px;line-height:${typography.lineHeight};letter-spacing:.2px;word-break:break-word;`

  root.querySelectorAll('figure').forEach((figure) => {
    const image = figure.querySelector('img')
    if (!image) return
    image.setAttribute('alt', '')
    image.classList.add('rp-export-image-element')
    setStyle(image, 'max-width:100%;height:auto;display:block;margin:0 auto;')

    const anchor = () => '<span style="display:inline-block;width:0;height:0;font-size:0;line-height:0;overflow:hidden;color:transparent;">&#8203;</span>'
    const textStyle = `font-size:${typography.fontSize}px;line-height:${typography.lineHeight};color:${theme.text};`
    const prepareHost = (paragraph: HTMLParagraphElement) => {
      const wrapper = document.createElement('span')
      wrapper.setAttribute('style', textStyle)
      while (paragraph.firstChild) wrapper.appendChild(paragraph.firstChild)
      paragraph.className = [paragraph.className, 'rp-export-image-host'].filter(Boolean).join(' ')
      setStyle(paragraph, `display:block;margin:-30px 0 ${typography.paragraphGap}px;padding:0;font-size:0;line-height:0;`)
      paragraph.innerHTML = anchor()
      return wrapper
    }

    const previous = figure.previousElementSibling
    const next = figure.nextElementSibling
    const isPlainParagraph = (element: Element | null): element is HTMLParagraphElement =>
      Boolean(element && element.tagName === 'P' && !element.className)

    if (isPlainParagraph(next)) {
      const wrapper = prepareHost(next)
      next.appendChild(image)
      next.appendChild(wrapper)
      figure.remove()
      return
    }
    if (isPlainParagraph(previous)) {
      const wrapper = prepareHost(previous)
      previous.appendChild(wrapper)
      previous.insertAdjacentHTML('beforeend', anchor())
      previous.appendChild(image)
      figure.remove()
      return
    }

    const block = document.createElement('p')
    block.className = 'rp-export-image rp-export-image-host'
    setStyle(block, `display:block;margin:-30px 0 ${typography.paragraphGap}px;padding:0;font-size:0;line-height:0;`)
    block.innerHTML = anchor()
    block.appendChild(image)
    block.insertAdjacentHTML('beforeend', anchor())
    figure.replaceWith(block)
  })

  root.querySelectorAll('.rp-code-window').forEach((el) => styleCodeWindow(el, codeStyle))

  root.querySelectorAll('.rp-callout').forEach((el) => {
    const calloutClass = Array.from(el.classList).find((name) =>
      name.startsWith('rp-callout-')
    )

    if (calloutClass) {
      styleCallout(el, theme, calloutClass.replace('rp-callout-', ''), typography)
    }
  })

  root.querySelectorAll('blockquote').forEach((el) => {
    const block = document.createElement('p')
    block.className = 'rp-export-quote'
    const quoteStyles: Record<Theme['id'], { bg: string; border: string; color: string; radius?: string }> = {
      minimal: { bg: '#f7f7f7', border: '2px solid #b8b8b8', color: '#777777' },
      tech: { bg: '#f2f6fe', border: '3px solid #2563eb', color: '#697586' },
      editorial: { bg: '#f8f0e9', border: '0', color: '#79685e', radius: '2px' },
      japanese: { bg: '#f2f5ef', border: '2px solid #91a58e', color: '#687b68' },
      developer: { bg: '#eff8f6', border: '4px solid #0f766e', color: '#53736e' },
      business: { bg: '#f5f7fa', border: '3px solid #94a3b8', color: '#64748b' }
    }
    const quoteStyle = quoteStyles[theme.id]
    setStyle(
      block,
      `display:block;margin:20px 0;padding:12px 15px;background:${quoteStyle.bg};border-left:${quoteStyle.border};border-radius:8px;color:${quoteStyle.color};font-size:${Math.max(14, typography.fontSize - 1)}px;line-height:${typography.lineHeight};word-break:break-word;`
    )
    block.innerHTML = flattenBlockContent(el)
    el.replaceWith(block)
  })

  root.querySelectorAll('p').forEach((el) => {
    if (!el.closest('.rp-export-callout') && !el.closest('.rp-export-quote') && !el.closest('.rp-export-code') && !el.closest('.rp-export-code-header') && !el.closest('.rp-export-image') && !el.closest('.rp-export-image-host')) {
      setStyle(el, `${base}margin:0 0 ${typography.paragraphGap}px;`)
    }
  })

  const h1Overrides: Record<Theme['id'], string> = {
    minimal: "border-bottom:1px solid #d8d8d8;font-family:Georgia,'Noto Serif SC',serif;font-weight:600;letter-spacing:0;",
    tech: 'border-bottom:2px solid #2563eb;background:linear-gradient(90deg,#eff6ff 0%,transparent 78%);padding:12px 12px 15px;',
    editorial: "font-family:Georgia,'Noto Serif SC',serif;font-size:28px;line-height:1.35;border-bottom:1px solid #c58a70;padding-bottom:18px;",
    japanese: "font-family:'Noto Serif SC',serif;font-weight:600;border-bottom:1px solid #dce5d8;padding-bottom:17px;",
    developer: 'font-family:ui-monospace,Menlo,monospace;font-size:22px;border-bottom:1px dashed #b9d9d4;',
    business: 'border-bottom:1px solid #cbd5e1;font-weight:700;letter-spacing:.2px;'
  }
  const h2Overrides: Record<Theme['id'], string> = {
    minimal: 'border-left:2px solid #555;padding-left:13px;color:#292929;',
    tech: 'background:linear-gradient(90deg,#eff6ff,transparent);border-left:4px solid #2563eb;padding:5px 10px;',
    editorial: 'color:#9d4b32;border-left:0;border-bottom:1px solid #ead6cb;padding:0 0 9px;',
    japanese: 'border-left:2px solid #829783;color:#526b56;background:transparent;padding:5px 10px;',
    // developer: 'background:transparent;border-left:4px solid #0f766e;padding:5px 10px;color:#0f625b;',
    developer: 'background:transparent;border:0;padding:0;color:#202938;',
    business: 'border-left:3px solid #64748b;color:#334155;background:transparent;padding:5px 10px;'
  }
  const h3Override = theme.id === 'tech' ? 'color:#2563eb;' : ''

  root.querySelectorAll('h1').forEach((el) => {
    setStyle(el, `color:${theme.text};font-size:25px;line-height:1.45;margin:5px 0 22px;font-weight:800;letter-spacing:-.6px;padding-bottom:14px;border-bottom:2px solid ${theme.accent};${h1Overrides[theme.id]}`)
    if (theme.id === 'developer') el.insertAdjacentHTML('afterbegin', `<span style="color:${theme.accent};">#&nbsp;</span>`)
  })
  // root.querySelectorAll('h2').forEach((el) => {
  //   setStyle(el, `color:${theme.text};font-size:20px;line-height:1.5;margin:29px 0 14px;padding-left:11px;border-left:4px solid ${theme.accent};font-weight:750;${h2Overrides[theme.id]}`)
  //   if (theme.id === 'editorial') el.insertAdjacentHTML('afterbegin', '<span style="color:#b45335;margin-right:8px;">✳</span>')
  // })
  root.querySelectorAll('h2').forEach((el, index) => {
    setStyle(
      el,
      `color:${theme.text};font-size:20px;line-height:1.5;margin:29px 0 14px;padding-left:11px;border-left:4px solid ${theme.accent};font-weight:750;${h2Overrides[theme.id]}`
    )

    if (theme.id === 'editorial') {
      el.insertAdjacentHTML(
        'afterbegin',
        '<span style="color:#b45335;margin-right:8px;">✳</span>'
      )
    }

    if (theme.id === 'developer') {
      const number = String(index + 1).padStart(2, '0')

      const numberHtml = `
            <span style="
                display:inline-block;
                color:#0f766e;
                background:#e8f4f1;
                font-family:Menlo,Monaco,monospace;
                font-size:0.85em;
                font-weight:700;
                padding:2px 7px;
                border-radius:3px;
                margin-right:9px;
            ">${number}</span>
            <span style="
                display:inline-block;
                width:2px;
                height:1em;
                background:#0f766e;
                vertical-align:-2px;
                margin-right:10px;
            "></span>
        `

      el.insertAdjacentHTML('afterbegin', numberHtml)
    }
  })

  root.querySelectorAll('h3').forEach((el) =>
    setStyle(el, `color:${theme.text};font-size:17px;line-height:1.5;margin:23px 0 11px;font-weight:700;${h3Override}`)
  )
  // root.querySelectorAll('strong,b').forEach((el) => {
  //   if (!el.closest('.rp-export-callout') && !el.closest('.rp-export-quote') && !el.closest('.rp-export-code')) {
  //     setStyle(el, `color:${theme.color};font-weight:700;`)
  //   }
  // })
  root.querySelectorAll('strong,b').forEach((el) => {
    if (
      !el.closest('.rp-export-callout') &&
      !el.closest('.rp-export-quote') &&
      !el.closest('.rp-export-code') &&
      !el.closest('h1,h2,h3')
    ) {
      if (theme.id === 'developer') {
        setStyle(
          el,
          'color:inherit;font-weight:750;' +
          'background:linear-gradient(to bottom,transparent 62%,#f8e58a 62%);' +
          'padding:0 2px;'
        )
      } else {
        setStyle(el, `color:${theme.color};font-weight:700;`)
      }
    }
  })

  const tokenColors: Record<string, string> = {
    'hljs-keyword': '#c792ea',
    'hljs-selector-tag': '#c792ea',
    'hljs-built_in': '#ffcb6b',
    'hljs-type': '#ffcb6b',
    'hljs-literal': '#f78c6c',
    'hljs-number': '#f78c6c',
    'hljs-string': '#c3e88d',
    'hljs-regexp': '#c3e88d',
    'hljs-symbol': '#c3e88d',
    'hljs-attr': '#c3e88d',
    'hljs-attribute': '#c3e88d',
    'hljs-title': '#82aaff',
    'hljs-function': '#82aaff',
    'hljs-section': '#82aaff',
    'hljs-params': '#e5edf5',
    'hljs-variable': '#e5edf5',
    'hljs-property': '#80cbc4',
    'hljs-punctuation': '#89ddff',
    'hljs-operator': '#89ddff',
    'hljs-meta': '#ffcb6b',
    'hljs-comment': '#8793a5',
    'hljs-doctag': '#8793a5'
  }
  Object.entries(tokenColors).forEach(([className, color]) => {
    root.querySelectorAll(`.${className}`).forEach((el) => setStyle(el, `color:${color};`))
  })



  root.querySelectorAll('code').forEach((el) => {
    if (!el.closest('.rp-export-code') && !el.closest('.rp-export-callout') && !el.closest('.rp-export-quote') && !el.closest('pre')) {
      setStyle(
        el,
        `background:${theme.bg === '#ffffff' ? '#f1f3f5' : '#eef0eb'};color:${theme.accent};padding:2px 5px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace;font-size:.9em;`
      )
    }
  })

  root.querySelectorAll('img').forEach((el) => {
    if (!el.classList.contains('rp-export-image-element') && !el.closest('.rp-export-image')) setStyle(el, 'max-width:100%;height:auto;display:block;margin:20px auto;')
  })
  root.querySelectorAll('figure').forEach((el) => setStyle(el, 'margin:20px 0;text-align:center;'))

  root.querySelectorAll('ul').forEach((el) => {
    setStyle(
      el,
      `${base}display:block;list-style-type:disc;list-style-position:outside;padding-left:1.5em;margin:0 0 ${typography.paragraphGap}px;`
    )
  })

  root.querySelectorAll('ol').forEach((el) => {
    setStyle(
      el,
      `${base}display:block;list-style-type:decimal;list-style-position:outside;padding-left:1.5em;margin:0 0 ${typography.paragraphGap}px;`
    )
  })

  root.querySelectorAll('li').forEach((el) => {
    setStyle(
      el,
      `display:list-item;margin:8px 0;padding:0;line-height:${typography.lineHeight};color:${theme.text};`
    )
  })

  // 列表中的段落不额外增加间距
  root.querySelectorAll('li>p').forEach((el) => {
    setStyle(el, 'margin:0;')
  })

  // 嵌套列表
  root.querySelectorAll('li>ul,li>ol').forEach((el) => {
    setStyle(el, 'padding-left:1.5em;margin-top:6px;margin-bottom:0;')
  })


  // root.querySelectorAll('ul,ol').forEach((el) =>
  //   setStyle(el, `${base}padding-left:1.5em;margin:0 0 ${typography.paragraphGap}px;`)
  // )
  // root.querySelectorAll('li').forEach((el) => setStyle(el, 'margin:6px 0;padding-left:3px;'))
  root.querySelectorAll('a').forEach((el) => setStyle(el, `color:${theme.accent};text-decoration:underline;`))
  root.querySelectorAll('hr').forEach((el) =>
    setStyle(el, `border:0;border-top:1px solid ${theme.border};margin:28px 0;`)
  )
  root.querySelectorAll('table').forEach((el) =>
    setStyle(el, 'width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;table-layout:fixed;')
  )
  root.querySelectorAll('th,td').forEach((el) =>
    setStyle(el, `border:1px solid ${theme.border};padding:8px 7px;text-align:left;word-break:break-word;`)
  )
  root.querySelectorAll('th').forEach((el) =>
    setStyle(
      el,
      `background:${theme.bg === '#ffffff' ? '#f4f6f8' : theme.bg};font-weight:700;color:${theme.text};`
    )
  )

  return `<div style="${base}display:block;width:100%;max-width:100%;">${root.innerHTML}</div>`
}

const tokenColors: Record<string, string> = {
  'hljs-keyword': '#c792ea',
  'hljs-selector-tag': '#c792ea',
  'hljs-built_in': '#ffcb6b',
  'hljs-type': '#ffcb6b',
  'hljs-literal': '#f78c6c',
  'hljs-number': '#f78c6c',
  'hljs-string': '#c3e88d',
  'hljs-regexp': '#c3e88d',
  'hljs-symbol': '#c3e88d',
  'hljs-attr': '#c3e88d',
  'hljs-attribute': '#c3e88d',
  'hljs-title': '#82aaff',
  'hljs-function': '#82aaff',
  'hljs-section': '#82aaff',
  'hljs-params': '#e5edf5',
  'hljs-variable': '#e5edf5',
  'hljs-property': '#80cbc4',
  'hljs-punctuation': '#89ddff',
  'hljs-operator': '#89ddff',
  'hljs-meta': '#ffcb6b',
  'hljs-comment': '#8793a5',
  'hljs-doctag': '#8793a5'
}
function inlineCodeTokens(codeEl: Element, defaultColor: string): string {
  const clone = codeEl.cloneNode(true) as Element

  // 给所有带 hljs-* 类名的 span 写入内联颜色，未匹配的继承 defaultColor
  clone.querySelectorAll('span').forEach((span) => {
    const classes = Array.from(span.classList)
    let matchedColor = ''
    for (const cls of classes) {
      if (tokenColors[cls]) {
        matchedColor = tokenColors[cls]
        break
      }
    }
    const existing = span.getAttribute('style') || ''
    span.setAttribute(
      'style',
      `${existing}color:${matchedColor || defaultColor};font-family:Menlo,Monaco,Consolas,'Courier New',monospace;`
    )
    span.removeAttribute('class')
  })

  // 将空格转为 \u00a0，制表符转为 4 个 \u00a0，换行转为 <br/>
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, '    ')
      const parts = text.split('\n')
      const frag = document.createDocumentFragment()
      parts.forEach((part, idx) => {
        if (idx > 0) frag.appendChild(document.createElement('br'))
        if (part.length > 0) {
          frag.appendChild(document.createTextNode(part.replace(/ /g, '\u00a0')))
        }
      })
      node.parentNode?.replaceChild(frag, node)
    } else {
      Array.from(node.childNodes).forEach(walk)
    }
  }
  Array.from(clone.childNodes).forEach(walk)

  // 去掉末尾多余的 <br>
  return clone.innerHTML.replace(/(?:<br\s*\/?>)+$/i, '')
}

function styleCodeWindow(windowEl: Element, style: CodeBlockStyle) {
  const palette = codePalettes[style]
  const code = windowEl.querySelector('code')
  const rawCodeHtml = code
    ? inlineCodeTokens(code, palette.text)
    : safe(windowEl.querySelector('pre')?.textContent || '').replace(/\n/g, '<br/>')
  const codeHtml = rawCodeHtml.replace(/^(?:<br\s*\/?>|&nbsp;|\u00a0|\s)+/i, '')

  const circle = (color: string) => `<span contenteditable="false" style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${color};font-size:0;line-height:0;overflow:hidden;vertical-align:middle;margin-right:7px;">&nbsp;</span>`
  const icon = style === 'macos'
    ? circle('#ff5f57') + circle('#febc2e') + circle('#28c840')
    : style === 'vscode'
      ? `<span style="color:#3794ff;font-family:Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:20px;">&gt;_</span><span style="color:${palette.label};font-family:Menlo,Monaco,Consolas,monospace;font-size:10px;line-height:20px;margin-left:6px;letter-spacing:.4px;">VS Code</span>`
      : `<span style="color:${palette.label};font-family:Menlo,Monaco,Consolas,monospace;font-size:10px;line-height:20px;letter-spacing:.4px;">GitHub</span>`

  const header = document.createElement('p')
  header.className = 'rp-export-code-header'
  header.setAttribute('contenteditable', 'false')
  const headerBackground = style === 'macos' ? palette.panel : palette.header
  const headerAccent = style === 'vscode' ? 'border-top:3px solid #3794ff;' : ''
  setStyle(
    header,
    `display:block;margin:18px 0 0;padding:8px 16px 4px;background:${headerBackground};${headerAccent}border-radius:10px 10px 0 0;line-height:14px;white-space:nowrap;user-select:none;-webkit-user-select:none;`
  )
  header.innerHTML = `<span contenteditable="false" aria-hidden="true" style="display:inline-block;line-height:14px;white-space:nowrap;">${icon}</span>`

  const body = document.createElement('p')
  body.className = 'rp-export-code'
  setStyle(
    body,
    `display:block;margin:0 0 18px;padding:4px 16px 16px;background:${palette.panel};border-radius:0 0 10px 10px;color:${palette.text};font-family:Menlo,Monaco,Consolas,'Courier New',monospace;font-size:13px;line-height:1.7;white-space:pre-wrap;word-wrap:normal;word-break:normal;overflow-wrap:normal;`
  )
  body.innerHTML = codeHtml || '&nbsp;'

  windowEl.replaceWith(header, body)
}
