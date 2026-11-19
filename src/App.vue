<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Download, Copy, FileUp, FileDown, RotateCcw, Check, ChevronDown, Smartphone, Monitor, Sparkles, PanelRightClose } from 'lucide-vue-next'
import { themes } from './utils/themes'
import { renderMarkdown } from './utils/markdown'
import { toWechatHtml, type CodeBlockStyle } from './utils/exportHtml'
import type { ThemeId } from './types'

const starter = `# 从零开始，打造更好的技术内容体验

> 好的技术文章，不仅要讲清楚问题，也应该让阅读过程更加舒服。

今天我们来聊聊，如何把一篇普通的 Markdown 文章，整理成适合微信公众号阅读的排版。

## 一、为什么需要专门的排版？

写技术文章时，我们经常会遇到这些问题：

- 标题层级不够清晰，读者很难快速定位内容。
- 代码块太过普通，长代码阅读体验不好。
- 引用、提示和重点内容缺少视觉区分。
- 从 Markdown 复制到公众号后，样式经常发生变化。

**排版不是装饰，而是帮助读者更轻松地理解内容。**

## 二、让内容结构更清晰

### 1. 标题与段落

合理使用标题层级，控制段落长度。一个段落尽量只表达一个核心观点。

### 2. 代码示例

例如，一个简单的 Go HTTP 服务：

\`\`\`go
func main() {
    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte("ok"))
    })

    log.Fatal(http.ListenAndServe(":8080", nil))
}
\`\`\`

行内代码也可以这样写：\`go run main.go\`。

## 三、重点内容展示

> [!TIP]
> 微信公众号对 HTML 和 CSS 的支持存在限制，最终效果一定要以公众号后台实际粘贴结果为准。

| 排版元素 | 推荐做法 |
| --- | --- |
| 正文 | 控制字号与行距 |
| 代码 | 使用高对比度背景 |
| 图片 | 居中展示，避免超出正文宽度 |

---

**让 Markdown 专注于内容，让 RanPress 负责呈现。**
`
const markdownText = ref(starter)
const activeTheme = ref<ThemeId>('tech')
const fontSize = ref(16)
const lineHeight = ref(1.9)
const paragraphGap = ref(18)
const codeStyle = ref<CodeBlockStyle>('macos')
const mobilePreview = ref(true)
const editorHost = ref<HTMLElement>()
const previewHost = ref<HTMLElement>()
const copied = ref(false)
const fileInput = ref<HTMLInputElement>()
let editor: EditorView | undefined
const theme = computed(() => themes.find(t => t.id === activeTheme.value) ?? themes[1])
const html = computed(() => renderMarkdown(markdownText.value))
const articleStyle = computed(() => ({ '--article-font': `${fontSize.value}px`, '--article-line': lineHeight.value, '--paragraph-gap': `${paragraphGap.value}px` }))

onMounted(() => {
  const saved = localStorage.getItem('ranpress-content')
  if (saved) markdownText.value = saved
  const savedCodeStyle = localStorage.getItem('ranpress-code-style') as CodeBlockStyle | null
  if (savedCodeStyle && ['macos', 'github', 'vscode'].includes(savedCodeStyle)) codeStyle.value = savedCodeStyle
  const savedTheme = localStorage.getItem('ranpress-theme') as ThemeId | null
  if (savedTheme && themes.some(t => t.id === savedTheme)) activeTheme.value = savedTheme
  if (!editorHost.value) return
  editor = new EditorView({
    state: EditorState.create({ doc: markdownText.value, extensions: [lineNumbers(), history(), markdown(), oneDark, keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping, EditorView.updateListener.of(update => { if (update.docChanged) markdownText.value = update.state.doc.toString() }), EditorView.theme({ '&': { height: '100%', fontSize: '14px' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', lineHeight: '1.8' }, '.cm-gutters': { background: '#171d27', border: 'none', color: '#657084' } })] }), parent: editorHost.value
  })
})
watch(markdownText, value => localStorage.setItem('ranpress-content', value))
watch(activeTheme, value => localStorage.setItem('ranpress-theme', value))
watch(codeStyle, value => localStorage.setItem('ranpress-code-style', value))
function chooseTheme(id: ThemeId) { activeTheme.value = id }
function chooseCodeStyle(id: CodeBlockStyle) { codeStyle.value = id }
function htmlToPlainText(htmlContent: string) {
  const container = document.createElement('div')
  container.innerHTML = htmlContent
  container.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')))
  container.querySelectorAll('tr').forEach((tr, index) => { if (index > 0) tr.appendChild(document.createTextNode('\n')) })
  // Use rendered HTML as the plain-text clipboard flavor. Never place raw
  // Markdown in text/plain, otherwise WeChat may detect it as Markdown source.
  return (container.innerText || container.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
async function copyWechat() {
  const content = toWechatHtml(html.value, theme.value, { fontSize: fontSize.value, lineHeight: lineHeight.value, paragraphGap: paragraphGap.value }, codeStyle.value)
  const plainText = htmlToPlainText(content)
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Rich clipboard unavailable')
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([content], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    })])
    copied.value = true; window.setTimeout(() => copied.value = false, 1800)
  } catch {
    await navigator.clipboard.writeText(plainText)
    alert('当前环境不支持富文本复制，已复制排版后的纯文本。请使用 HTTPS 或 localhost，并优先使用 Chrome / Edge 复制富文本。')
  }
}
function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader(); reader.onload = () => { markdownText.value = String(reader.result ?? ''); editor?.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: markdownText.value } }) }; reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}
function exportFile() {
  const blob = new Blob([markdownText.value], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ranpress-article.md'; a.click(); URL.revokeObjectURL(url)
}
function resetContent() { if (!confirm('确定恢复示例文章吗？当前内容会被替换。')) return; markdownText.value = starter; editor?.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: starter } }) }
</script>

<template>
  <div class="app-shell" :style="{ '--theme-accent': theme.accent }">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">R</div><div><div class="brand-name">RanPress</div><div class="brand-sub">MARKDOWN TO WECHAT</div></div></div>
      <div class="top-actions">
        <button class="tool-button" @click="fileInput?.click()"><FileUp :size="16"/>导入</button>
        <input ref="fileInput" type="file" accept=".md,.markdown,.txt" hidden @change="importFile" />
        <button class="tool-button" @click="exportFile"><FileDown :size="16"/>导出 MD</button>
        <span class="top-divider"></span>
        <button class="tool-button" @click="resetContent"><RotateCcw :size="15"/>重置</button>
        <button class="primary-button" @click="copyWechat"><Check v-if="copied" :size="16"/><Copy v-else :size="16"/>{{ copied ? '已复制' : '复制到公众号' }}</button>
      </div>
    </header>
    <main class="workspace">
      <section class="editor-panel">
        <div class="panel-heading"><div><span class="panel-kicker">01 / WRITE</span><h2>Markdown 编辑</h2></div><span class="live-pill"><i></i> 自动保存</span></div>
        <div class="editor-toolbar"><span>文章内容</span><span>Markdown</span></div>
        <div ref="editorHost" class="code-editor"></div>
        <div class="editor-footer"><span>支持标准 Markdown · GFM</span><span>{{ markdownText.length.toLocaleString() }} 字符</span></div>
      </section>
      <section class="preview-panel">
        <div class="preview-top"><div><span class="panel-kicker">02 / PREVIEW</span><h2>实时预览</h2></div><div class="preview-switch"><button :class="{ selected: mobilePreview }" @click="mobilePreview = true"><Smartphone :size="15"/>手机</button><button :class="{ selected: !mobilePreview }" @click="mobilePreview = false"><Monitor :size="15"/>宽屏</button></div></div>
        <div class="canvas-area"><div class="phone-frame" :class="{ wide: !mobilePreview }" :style="{ background: theme.bg }"><div class="phone-status"><span>9:41</span><span>●●●　◖　▰</span></div><div class="wechat-bar"><span>‹</span><span>公众号文章</span><span>···</span></div><article ref="previewHost" class="article-content" :class="[`theme-${theme.id}`, `code-style-${codeStyle}`]" :style="articleStyle" v-html="html"></article><div class="phone-bottom"><span>♡　赞</span><span>↗　分享</span><span>☆　收藏</span></div></div></div>
        <div class="preview-caption"><span><i></i> 实时渲染</span><span>预览效果仅供参考，以公众号实际粘贴为准</span></div>
      </section>
      <aside class="settings-panel">
        <div class="settings-heading"><div><span class="panel-kicker">03 / DESIGN</span><h2>排版设计</h2></div><Sparkles :size="18" class="sparkle"/></div>
        <div class="setting-section"><div class="section-title"><span>主题风格</span><span class="section-count">{{ themes.length }} STYLES</span></div><div class="theme-grid"><button v-for="item in themes" :key="item.id" class="theme-card" :class="{ active: activeTheme === item.id }" @click="chooseTheme(item.id)"><div class="theme-swatch" :style="{ background: item.bg, borderColor: item.border }"><span :style="{ background: item.accent }"></span><i :style="{ background: item.text, width: '68%' }"></i><i :style="{ background: item.border, width: '88%' }"></i><i :style="{ background: item.border, width: '54%' }"></i><b :style="{ color: item.accent }">Aa</b></div><div class="theme-meta"><span>{{ item.name }}</span><small>{{ item.en }}</small></div><span v-if="activeTheme === item.id" class="selected-dot"><Check :size="10"/></span></button></div><p class="theme-description">{{ theme.description }}</p></div>
        <div class="setting-section"><div class="section-title"><span>正文排版</span><span class="section-count">TYPOGRAPHY</span></div><div class="range-setting"><div><label>正文字号</label><strong>{{ fontSize }}px</strong></div><input v-model.number="fontSize" type="range" min="14" max="20" step="1" /></div><div class="range-setting"><div><label>行间距</label><strong>{{ lineHeight.toFixed(1) }}</strong></div><input v-model.number="lineHeight" type="range" min="1.5" max="2.3" step="0.1" /></div><div class="range-setting"><div><label>段落间距</label><strong>{{ paragraphGap }}px</strong></div><input v-model.number="paragraphGap" type="range" min="8" max="32" step="2" /></div></div>
        <div class="setting-section code-style-section"><div class="section-title"><span>代码块样式</span><span class="section-count">CODE BLOCK</span></div><div class="code-style-options"><button v-for="item in [{id:'macos',name:'macOS',desc:'红黄绿窗口点'},{id:'github',name:'GitHub',desc:'简洁深色标题'},{id:'vscode',name:'VS Code',desc:'编辑器风格'}]" :key="item.id" :class="{ active: codeStyle === item.id }" @click="chooseCodeStyle(item.id as CodeBlockStyle)"><span class="code-style-preview" :class="`preview-${item.id}`"><i v-if="item.id === 'macos'"></i><i v-if="item.id === 'macos'"></i><i v-if="item.id === 'macos'"></i><b>{{ item.id === 'vscode' ? '›' : '···' }}</b></span><strong>{{ item.name }}</strong><small>{{ item.desc }}</small></button></div></div>
        <div class="settings-tip"><div class="tip-icon">✳</div><div><strong>提示框与重点组件</strong><p>在引用首行使用 [!TIP]、[!WARNING]、[!SUCCESS] 或 [!INFO]，即可生成对应提示卡片。</p></div></div>
        <div class="settings-bottom"><PanelRightClose :size="14"/> 样式会自动保存在本地</div>
      </aside>
    </main>
    <footer class="app-footer"><span>RanPress <b>0.3.1</b></span><span>Beautiful WeChat Articles, Powered by Markdown.</span><span>CONTENT FIRST · DESIGN BETTER</span></footer>
  </div>
</template>
