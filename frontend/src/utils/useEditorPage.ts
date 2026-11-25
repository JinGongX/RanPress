// 页面逻辑 composable：状态、生命周期、编辑器、导入导出、图片处理与滚动联动
// 建议放在原页面 .vue 文件同级目录，以保持原有相对导入路径。
import { computed, onMounted, ref, watch, createVNode, onBeforeUnmount, nextTick, type Ref } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { themes } from './themes'
import { renderMarkdown } from './markdown'
import { marked } from 'marked'
import { toWechatHtml, type CodeBlockStyle } from './exportHtml'
import type { ThemeId } from '../types'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { SaveImage, SelectAndUploadImages } from '../../bindings/changeme/internal/services/appservice'
import { GetDocContent, SaveDocContent } from '../../bindings/changeme/internal/services/docservice'

interface UseEditorPageOptions {
    docId?: Ref<string>
    onContentSaved?: (payload: { docId: string; content: string }) => void
}

export function useEditorPage(options?: UseEditorPageOptions) {

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
    const showSettings = ref(false)
    const tooltipOpen = ref(false)
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
    const imageInput = ref<HTMLInputElement>()
    let editor: EditorView | undefined
    let storageWarningShown = false
    const theme = computed(() => themes.find(t => t.id === activeTheme.value) ?? themes[1])
    const html = computed(() => renderMarkdown(markdownText.value))
    const articleStyle = computed(() => ({ '--article-font': `${fontSize.value}px`, '--article-line': lineHeight.value, '--paragraph-gap': `${paragraphGap.value}px` }))
    let previewScrollEl: HTMLElement | null = null
    //  联动
    interface AnchorPair {
        line: number
        el: HTMLElement
    }
    let anchorPairs: AnchorPair[] = []
    function normalizeText(text: string): string {
        return text
            .replace(/^#{1,6}\s+/, '')
            .replace(/[*_`~>[\]()!]/g, '')
            .replace(/\s+/g, '')
            .trim()
            .toLowerCase()
    }

    function extractHeadingLines(md: string): Array<{ line: number; norm: string }> {
        const lines = md.split(/\r?\n/)
        const headings: Array<{ line: number; norm: string }> = []
        let inFence = false

        lines.forEach((raw, idx) => {
            const trimmed = raw.trim()
            if (/^(```|~~~)/.test(trimmed)) {
                inFence = !inFence
                return
            }
            if (inFence) return

            const match = trimmed.match(/^(#{1,6})\s+(.+)$/)
            if (match) {
                const norm = normalizeText(match[2])
                if (norm) {
                    headings.push({ line: idx + 1, norm })
                }
            }
        })

        return headings
    }

    function isMatchingPreviewElement(el: HTMLElement, anchor: MarkdownBlockAnchor): boolean {
        const tag = el.tagName.toLowerCase()
        const elNorm = normalizeBlockText(el.textContent ?? '')

        if (anchor.kind === 'heading') {
            if (!/^h[1-6]$/.test(tag)) return false
            return Boolean(elNorm && anchor.norm && (elNorm.includes(anchor.norm) || anchor.norm.includes(elNorm)))
        }

        if (anchor.kind === 'blockquote') {
            if (tag !== 'blockquote') return false
            if (!elNorm || !anchor.norm) return true
            const prefix = anchor.norm.slice(0, 12)
            return elNorm.includes(prefix) || anchor.norm.includes(elNorm.slice(0, 12))
        }

        if (anchor.kind === 'code') {
            if (tag !== 'pre') return false
            if (!elNorm || !anchor.norm) return true
            const prefix = anchor.norm.slice(0, 14)
            return elNorm.includes(prefix) || anchor.norm.includes(elNorm.slice(0, 14))
        }

        // paragraph
        if (tag !== 'p') return false
        if (!elNorm || !anchor.norm) return false
        const aSlice = anchor.norm.slice(0, 10)
        const eSlice = elNorm.slice(0, 10)
        return (aSlice.length >= 4 && elNorm.includes(aSlice)) || (eSlice.length >= 4 && anchor.norm.includes(eSlice))
    }

    /**
     * 基于 marked 词法分析生成锚点：预览区每个顶层块 ↔ Markdown 源码起始行，
     * 列表项、表格行也单独作为锚点。不依赖文本匹配，引用懒续行、图片、表格都能准确对上。
     * 顶层块数量对不上时返回 null，走文本匹配兜底。
     */
    function buildTokenAnchors(md: string, root: HTMLElement): AnchorPair[] | null {
        let tokens: any[]
        try {
            tokens = marked.lexer(md.replace(/\r\n?/g, '\n')) as any[]
        } catch {
            return null
        }
        const countLines = (s: string) => (s.match(/\n/g) || []).length

        const blocks: Array<{ token: any; line: number }> = []
        let line = 1
        for (const t of tokens) {
            if (t.type !== 'space' && t.type !== 'def') {
                // raw 前面可能带空行，起始行跳过前导换行
                const leading = (t.raw.match(/^\n*/)?.[0].length) ?? 0
                blocks.push({ token: t, line: line + leading })
            }
            line += countLines(t.raw ?? '')
        }

        const children = Array.from(root.children) as HTMLElement[]
        if (blocks.length === 0 || children.length === 0) return null

        // token 类型 → 预览元素判定（兼容 renderMarkdown 给标题/代码块/图片额外包了一层）
        const tagOf = (el: HTMLElement) => el.tagName.toLowerCase()
        const has = (el: HTMLElement, sel: string) => el.matches(sel) || !!el.querySelector(sel)
        const textOf = (el: HTMLElement) => normalizeBlockText(el.textContent ?? '')
        const tokenText = (t: any) => normalizeBlockText(String(t.text ?? '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
        const textClose = (a: string, b: string, n = 8) => {
            if (!a || !b) return false
            const sa = a.slice(0, n), sb = b.slice(0, n)
            return b.includes(sa) || a.includes(sb)
        }
        const hasImage = (t: any) => Array.isArray(t.tokens) && t.tokens.some((x: any) => x.type === 'image')
        const matches = (t: any, el: HTMLElement): boolean => {
            switch (t.type) {
                case 'heading': {
                    const h = el.matches(`h${t.depth}`) ? el : el.querySelector<HTMLElement>(`h${t.depth}`)
                    // 标题必须文字也对上，作为最可靠的锚点
                    return !!h && textClose(tokenText(t), textOf(h), 6)
                }
                case 'code': return has(el, 'pre, code')
                case 'blockquote': return has(el, 'blockquote') || /callout|alert|tip|warning|note|info/i.test(el.className)
                case 'list': return has(el, 'ul, ol')
                case 'table': return has(el, 'table')
                case 'hr': return has(el, 'hr')
                case 'paragraph': {
                    if (!['p', 'figure', 'div', 'section', 'img'].includes(tagOf(el))) return false
                    const txt = tokenText(t)
                    // 纯图片段落：预览元素里要有图片
                    if (hasImage(t) && txt.length < 2) return has(el, 'img')
                    return textClose(txt, textOf(el))
                }
                default: return true
            }
        }

        const pairs: AnchorPair[] = []
        let ci = 0
        for (const { token, line } of blocks) {
            // 在后面最多 8 个元素内找匹配的，找不到就跳过这个 token，不让错位往后传
            let found = -1
            for (let k = ci; k < Math.min(children.length, ci + 8); k++) {
                if (matches(token, children[k])) { found = k; break }
            }
            if (found < 0) continue
            ci = found + 1
            const el = children[found]
            pairs.push({ line, el })

            // 列表：每个 li 一个锚点
            if (token.type === 'list' && Array.isArray(token.items)) {
                const lis = Array.from(el.querySelectorAll(':scope > li')) as HTMLElement[]
                if (lis.length === token.items.length) {
                    let l = line
                    token.items.forEach((item: any, i: number) => {
                        if (i > 0) pairs.push({ line: l, el: lis[i] })
                        l += countLines(item.raw ?? '')
                    })
                }
            }

            // 表格：表头 + 分隔行 + 每一行数据
            if (token.type === 'table' && Array.isArray(token.rows)) {
                const trs = Array.from(el.querySelectorAll('tbody > tr')) as HTMLElement[]
                if (trs.length === token.rows.length) {
                    trs.forEach((tr, i) => pairs.push({ line: line + 2 + i, el: tr }))
                }
            }
        }
        return pairs.length >= 2 ? pairs : null
    }

    function rebuildAnchors(): void {
        const previewRoot = previewHost.value
        const totalLines = editor ? editor.state.doc.lines : markdownText.value.split(/\r?\n/).length

        if (!previewRoot) {
            anchorPairs = []
            return
        }

        const tokenPairs = buildTokenAnchors(markdownText.value, previewRoot)
        if (tokenPairs) {
            const deduped: AnchorPair[] = []
            for (const p of tokenPairs) {
                if (p.line <= totalLines && (deduped.length === 0 || p.line > deduped[deduped.length - 1].line)) {
                    deduped.push(p)
                }
            }
            anchorPairs = deduped
            return
        }

        const mdAnchors = extractMarkdownBlockAnchors(markdownText.value)

        // 只收集顶层或关键块级节点，避免 blockquote / li 内部的 p 造成重复或错位
        const previewNodes = Array.from(
            previewRoot.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, blockquote, pre, p')
        ).filter(el => {
            const tag = el.tagName.toLowerCase()
            if (tag === 'p' && el.closest('blockquote, li, td, th')) {
                return false
            }
            return true
        })

        const pairs: AnchorPair[] = []
        let searchFrom = 0

        for (const anchor of mdAnchors) {
            for (let i = searchFrom; i < previewNodes.length; i++) {
                if (isMatchingPreviewElement(previewNodes[i], anchor)) {
                    pairs.push({ line: anchor.line, el: previewNodes[i] })
                    searchFrom = i + 1
                    break
                }
            }
        }

        const firstEl = previewRoot.firstElementChild as HTMLElement | null
        if (firstEl && (pairs.length === 0 || pairs[0].line > 1)) {
            pairs.unshift({ line: 1, el: firstEl })
        }


        const deduped: AnchorPair[] = []
        for (const p of pairs) {
            if (deduped.length === 0 || p.line > deduped[deduped.length - 1].line) {
                deduped.push(p)
            }
        }
        anchorPairs = deduped


    }

    function getElementTopInContainer(el: HTMLElement, container: HTMLElement): number {
        return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    }

    // 滚动相关状态
    let scrollSource: 'editor' | 'preview' | null = null
    let releaseLockTimer: number | null = null
    let rafId: number | null = null
    let previewRafId: number | null = null
    let editorScrollEl: HTMLElement | null = null
    // 程序设置 scrollTop 时记录目标值，对侧对应的那次 scroll 事件忽略，避免回弹
    let ignoreEditorUntil = -1
    let ignorePreviewUntil = -1

    /** 取实际在滚动的编辑器容器：.cm-scroller 或外层 editorHost */
    function getEditorScroller(): HTMLElement | null {
        const cm = editor?.scrollDOM ?? null
        if (cm && cm.scrollHeight - cm.clientHeight > 1) return cm
        const host = editorHost.value ?? null
        if (host && host.scrollHeight - host.clientHeight > 1) return host
        return cm ?? host
    }
    const getActiveEditorScrollEl = getEditorScroller

    /** 某一行顶部在 scroller 内容坐标中的位置（按屏幕坐标换算，兼容任意滚动容器与自动换行） */
    function getEditorLineTop(view: EditorView, line: number, scroller: HTMLElement): number {
        const doc = view.state.doc
        const l = doc.line(Math.max(1, Math.min(doc.lines, line)))
        const block = view.lineBlockAt(l.from)
        return view.documentTop + block.top - scroller.getBoundingClientRect().top + scroller.scrollTop
    }

    /** 像素映射表：e[i] 编辑器 scrollTop ↔ p[i] 预览 scrollTop，首尾固定对齐。
     *  用最长递增子序列挑选锚点：个别锚点配错（如编辑器很靠前、预览却很靠后）会被整体剔除，
     *  不会再出现"左边轻轻一动右边直接跳到后面章节"的情况。 */
    function buildScrollMap(eEl: HTMLElement, pEl: HTMLElement): { e: number[]; p: number[] } | null {
        if (!editor) return null
        const eMax = Math.max(0, eEl.scrollHeight - eEl.clientHeight)
        const pMax = Math.max(0, pEl.scrollHeight - pEl.clientHeight)
        if (eMax <= 0 || pMax <= 0) return null
        if (anchorPairs.length === 0) rebuildAnchors()

        // 1. 计算所有候选点（锚点对齐到视口顶部）
        const pts: Array<{ e: number; p: number }> = []
        for (const pair of anchorPairs) {
            if (!pair.el.isConnected) continue
            const et = getEditorLineTop(editor, pair.line, eEl)
            const pt = getElementTopInContainer(pair.el, pEl)
            if (et > 0 && pt > 0 && et < eMax && pt < pMax) pts.push({ e: et, p: pt })
        }
        pts.sort((x, y) => x.e - y.e)

        // 2. 最长递增子序列（e、p 同时严格递增），剔除错配锚点
        const n = pts.length
        const len = new Array(n).fill(1)
        const prev = new Array(n).fill(-1)
        let best = -1
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < i; j++) {
                if (pts[j].e < pts[i].e && pts[j].p < pts[i].p && len[j] + 1 > len[i]) {
                    len[i] = len[j] + 1
                    prev[i] = j
                }
            }
            if (best < 0 || len[i] > len[best]) best = i
        }
        const chosen: Array<{ e: number; p: number }> = []
        for (let k = best; k >= 0; k = prev[k]) chosen.unshift(pts[k])

        const e = [0, ...chosen.map(c => c.e), eMax]
        const p = [0, ...chosen.map(c => c.p), pMax]
        lastScrollMap = { e, p, total: anchorPairs.length, used: chosen.length }
        return { e, p }
    }

    // 调试用：控制台执行 window.__ranpressScrollDebug() 查看锚点与映射
    let lastScrollMap: { e: number[]; p: number[]; total: number; used: number } | null = null
    ;(window as any).__ranpressScrollDebug = () => {
        const eEl = getEditorScroller()
        console.log('editorScroller:', eEl?.className, 'previewScroller:', previewScrollEl?.className)
        console.log('previewChildren:', previewHost.value?.children.length, 'anchors:', anchorPairs.length)
        console.table(anchorPairs.map(a => ({ line: a.line, tag: a.el.tagName, text: (a.el.textContent ?? '').trim().slice(0, 16) })))
        console.log('map:', lastScrollMap)
    }

    function mapScroll(v: number, from: number[], to: number[]): number {
        const last = from.length - 1
        if (v <= from[0]) return to[0]
        if (v >= from[last]) return to[last]
        for (let i = 0; i < last; i++) {
            if (v <= from[i + 1]) {
                const t = (v - from[i]) / Math.max(1, from[i + 1] - from[i])
                return to[i] + (to[i + 1] - to[i]) * t
            }
        }
        return to[last]
    }

    function syncEditorToPreview() {
        const eEl = getEditorScroller()
        if (!eEl || !previewScrollEl) return
        const map = buildScrollMap(eEl, previewScrollEl)
        if (!map) return
        const target = Math.round(mapScroll(eEl.scrollTop, map.e, map.p))
        if (Math.abs(previewScrollEl.scrollTop - target) > 1) {
            ignorePreviewUntil = target
            previewScrollEl.scrollTop = target
        }
    }

    function syncPreviewToEditor() {
        const eEl = getEditorScroller()
        if (!eEl || !previewScrollEl) return
        const map = buildScrollMap(eEl, previewScrollEl)
        if (!map) return
        const target = Math.round(mapScroll(previewScrollEl.scrollTop, map.p, map.e))
        if (Math.abs(eEl.scrollTop - target) > 1) {
            ignoreEditorUntil = target
            eEl.scrollTop = target
        }
    }

    function handleEditorScroll(e: Event) {
        const el = e.currentTarget as HTMLElement
        if (el !== getEditorScroller()) return
        if (ignoreEditorUntil >= 0 && Math.abs(el.scrollTop - ignoreEditorUntil) <= 2) {
            ignoreEditorUntil = -1
            return
        }
        ignoreEditorUntil = -1
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(syncEditorToPreview)
    }

    function handlePreviewScroll() {
        if (!previewScrollEl) return
        if (ignorePreviewUntil >= 0 && Math.abs(previewScrollEl.scrollTop - ignorePreviewUntil) <= 2) {
            ignorePreviewUntil = -1
            return
        }
        ignorePreviewUntil = -1
        if (previewRafId) cancelAnimationFrame(previewRafId)
        previewRafId = requestAnimationFrame(syncPreviewToEditor)
    }

    function handlePreviewLoad() {
        rebuildAnchors()
        syncEditorToPreview()
    }
    //end联动

    onMounted(() => {
        window.addEventListener('keydown', onKeyDown)

        const saved = localStorage.getItem('ranpress-content')
        if (saved) markdownText.value = saved
        const savedCodeStyle = localStorage.getItem('ranpress-code-style') as CodeBlockStyle | null
        if (savedCodeStyle && ['macos', 'github', 'vscode'].includes(savedCodeStyle)) codeStyle.value = savedCodeStyle
        const savedTheme = localStorage.getItem('ranpress-theme') as ThemeId | null
        if (savedTheme && themes.some(t => t.id === savedTheme)) activeTheme.value = savedTheme
        if (!editorHost.value) return
        editor = new EditorView({
            state: EditorState.create({ doc: markdownText.value, extensions: [lineNumbers(), history(), markdown(), EditorView.domEventHandlers({ paste: handleEditorPaste, drop: handleEditorDrop }), oneDark, keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping, EditorView.updateListener.of(update => { if (update.docChanged) markdownText.value = update.state.doc.toString() }), EditorView.theme({ '&': { height: '100%', fontSize: '14px' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', lineHeight: '1.8' }, '.cm-gutters': { background: '#171d27', border: 'none', color: '#657084' } })] }), parent: editorHost.value
        })

        previewScrollEl = previewHost.value?.closest<HTMLElement>('.canvas-area') ?? null
        editorScrollEl = editor.scrollDOM

        rebuildAnchors()
        editor.scrollDOM.addEventListener('scroll', handleEditorScroll, { passive: true })
        editorHost.value.addEventListener('scroll', handleEditorScroll, { passive: true })
        previewScrollEl?.addEventListener('scroll', handlePreviewScroll, { passive: true })
        previewHost.value?.addEventListener('load', handlePreviewLoad, true)
    })
    onBeforeUnmount(() => {
        editor?.scrollDOM.removeEventListener('scroll', handleEditorScroll)
        editorHost.value?.removeEventListener('scroll', handleEditorScroll)
        previewScrollEl?.removeEventListener('scroll', handlePreviewScroll)
        previewHost.value?.removeEventListener('load', handlePreviewLoad, true)
        if (rafId) cancelAnimationFrame(rafId)
        if (previewRafId) cancelAnimationFrame(previewRafId)
        if (releaseLockTimer) window.clearTimeout(releaseLockTimer)
        window.removeEventListener('keydown', onKeyDown)
    })
    watch([html, mobilePreview, fontSize, lineHeight, paragraphGap, showSettings], () => {
        rebuildAnchors()
    }, { flush: 'post' })

    // watch(markdownText, value => {
    //     try {
    //         localStorage.setItem('ranpress-content', value)
    //     } catch {
    //         if (!storageWarningShown) {
    //             storageWarningShown = true
    //             alert('图片过大，草稿自动保存失败。请减少图片数量或尺寸后再继续编辑。')
    //         }
    //     }
    // })
    watch(activeTheme, value => localStorage.setItem('ranpress-theme', value))
    watch(codeStyle, value => localStorage.setItem('ranpress-code-style', value))
    function chooseTheme(id: ThemeId) { activeTheme.value = id }
    function chooseCodeStyle(id: CodeBlockStyle) { codeStyle.value = id }
    function blobToDataUrl(blob: Blob) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
            reader.readAsDataURL(blob)
        })
    }

    async function inlineLocalImagesForClipboard(htmlContent: string) {
        const documentNode = new DOMParser().parseFromString(htmlContent, 'text/html')
        const images = Array.from(documentNode.images)
        await Promise.all(images.map(async (image) => {
            const src = image.getAttribute('src')
            if (!src || src.startsWith('data:')) return
            try {
                const url = new URL(src, window.location.href)
                if (url.origin !== window.location.origin) return
                const response = await fetch(url.href)
                if (!response.ok) return
                image.setAttribute('src', await blobToDataUrl(await response.blob()))
            } catch {
                // Keep the original URL when the browser cannot read the image bytes.
            }
        }))
        return documentNode.body.innerHTML
    }

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
        const exported = toWechatHtml(
            html.value,
            theme.value,
            {
                fontSize: fontSize.value,
                lineHeight: lineHeight.value,
                paragraphGap: paragraphGap.value
            },
            codeStyle.value
        )
        const plainText = htmlToPlainText(exported)
        try {
            if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
                throw new Error('Rich clipboard unavailable')
            }

            // 先启动图片处理，但不等待
            const htmlBlobPromise = inlineLocalImagesForClipboard(exported)
                .then(content => new Blob([content], { type: 'text/html' }))

            // 在用户点击事件的同步调用链中发起剪贴板写入
            const item = new ClipboardItem({
                'text/html': htmlBlobPromise,
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            })

            await navigator.clipboard.write([item])

            copied.value = true
            window.setTimeout(() => copied.value = false, 1800)
        } catch (err) {
            console.error('[富文本复制失败]', err)

            await navigator.clipboard.writeText(plainText)
            alert('当前环境不支持富文本复制，已复制纯文本。')
        }
    }
    //const MAX_IMAGE_FILE_BYTES = 12 * 1024 * 1024
    //const IMAGE_UPLOAD_URL = import.meta.env.VITE_IMAGE_UPLOAD_URL || '/api/upload-image'
    // async function uploadImageFile(file: File) {
    //     if (!file.type.startsWith('image/')) throw new Error('不是图片文件')
    //     if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('图片超过 12MB')
    //     if (file.type === 'image/svg+xml') throw new Error('暂不支持 SVG 图片')

    //     const response = await fetch(IMAGE_UPLOAD_URL, {
    //         method: 'POST',
    //         headers: { 'Content-Type': file.type },
    //         body: file
    //     })
    //     if (!response.ok) throw new Error(`图片上传失败 (${response.status})`)
    //     const payload = await response.json() as { url?: string; data?: { url?: string } }
    //     const url = payload.url || payload.data?.url
    //     if (!url) throw new Error('上传接口没有返回图片 URL')
    //     return url
    // }
    async function insertLocalImages(view: EditorView | undefined = editor) {
        if (!view) return
        try {
            const urls = await SelectAndUploadImages()
            if (!urls?.length) return
            const markdown = urls.map(url => {
                const filename = url.split('/').pop() || '图片'
                const rawName = filename.replace(/\.[^.]+$/, '')
                return `![${rawName}](${url})`
            }).join('\n\n')

            const { from, to } = view.state.selection.main
            const doc = view.state.doc.toString()
            const before = doc.slice(0, from)
            const after = doc.slice(to)
            const leading =
                from === 0 || before.endsWith('\n\n')
                    ? ''
                    : before.endsWith('\n') ? '\n' : '\n\n'
            const trailing =
                to === doc.length || after.startsWith('\n\n')
                    ? ''
                    : after.startsWith('\n') ? '\n' : '\n\n'

            const insertion = leading + markdown + trailing
            view.dispatch({
                changes: { from, to, insert: insertion },
                selection: { anchor: from + insertion.length },
                scrollIntoView: true
            })
            view.focus()
        } catch (error) {
            alert(error instanceof Error ? error.message : '图片插入失败')
        }
    }

    function imageFilesFromClipboard(data: DataTransfer | null) {
        if (!data) return []
        const files = Array.from(data.items)
            .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((file): file is File => Boolean(file))
        if (files.length) return files
        return Array.from(data.files).filter(file => file.type.startsWith('image/'))
    }

    async function insertImageFiles(files: File[], view?: EditorView) {
        if (!files.length || !view) return
        try {
            const urls = await Promise.all(files.map(uploadImageFile))
            //const urls = await SelectAndUploadImages()
            const markdown = urls.map((url, index) => {
                const rawName = files[index].name.replace(/\.[^.]+$/, '').replace(/[\[\]\\]/g, '').trim()
                return `![${rawName || '图片'}](${url})`
                //return `![${rawName || `图片${index + 1}`} ](${url})`
            }).join('\n\n')
            const { from, to } = view.state.selection.main
            const doc = view.state.doc.toString()
            const before = doc.slice(0, from)
            const after = doc.slice(to)
            const leading = from === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
            const trailing = to === doc.length || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
            const insertion = leading + markdown + trailing
            view.dispatch({
                changes: { from, to, insert: insertion },
                selection: { anchor: from + insertion.length },
                scrollIntoView: true
            })
            view.focus()
        } catch (error) {
            alert(error instanceof Error ? error.message : '图片插入失败')
        }
    }

    function handleEditorPaste(event: ClipboardEvent, view: EditorView) {
        const files = imageFilesFromClipboard(event.clipboardData)
        if (!files.length) return false
        event.preventDefault()
        void insertImageFiles(files, view)
        return true
    }

    function handleEditorDrop(event: DragEvent, view: EditorView) {
        const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        void insertImageFiles(files, view)
        return true
    }

    function insertImageInput(event: Event) {
        const input = event.target as HTMLInputElement
        const files = Array.from(input.files || []).filter(file => file.type.startsWith('image/'))
        void insertImageFiles(files, editor)
        input.value = ''
    }

    function importFile(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader(); reader.onload = () => { markdownText.value = String(reader.result ?? ''); editor?.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: markdownText.value } }) }; reader.readAsText(file)
            ; (event.target as HTMLInputElement).value = ''
    }
    function exportFile() {
        const blob = new Blob([markdownText.value], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ranpress-article.md'; a.click(); URL.revokeObjectURL(url)
    }
    // function resetContent() { if (!confirm('确定恢复示例文章吗？当前内容会被替换。')) return; markdownText.value = starter; editor?.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: starter } }) }

    // function resetContent() {
    //     Modal.confirm({
    //         title: '确定恢复示例文章吗？',
    //         icon: createVNode(ExclamationCircleOutlined),
    //         content: '恢复后，当前编辑器中的文章内容将被示例文章替换。',
    //         okText: '确认',
    //         okType: 'danger',
    //         cancelText: '取消',
    //         async onOk() {
    //             // 1. 清理挂起的滚动帧和锁，避免重置期间的滚动事件干扰
    //             if (rafId) cancelAnimationFrame(rafId)
    //             if (previewRafId) cancelAnimationFrame(previewRafId)
    //             if (releaseLockTimer) window.clearTimeout(releaseLockTimer)
    //             scrollSource = null

    //             // 2. 更新内容与编辑器文档
    //             setEditorContent(starter)
    //             hasUnsavedChanges.value = true
    //             // markdownText.value = starter
    //             // editor?.dispatch({
    //             //     changes: { from: 0, to: editor.state.doc.length, insert: starter },
    //             // })

    //             // 3. 等待 DOM 与预览渲染完成后，归位滚动条并重建锚点
    //             await nextTick()
    //             const activeEditorEl = getActiveEditorScrollEl?.() ?? editorScrollEl
    //             if (activeEditorEl) activeEditorEl.scrollTop = 0
    //             if (previewScrollEl) previewScrollEl.scrollTop = 0

    //             rebuildAnchors()
    //             message.success('已恢复示例文章')
    //         },
    //     })
    // }

    // async function uploadImageFile(file: File): Promise<string> {
    //     const buffer = await file.arrayBuffer()
    //     const data = Array.from(new Uint8Array(buffer))

    //     return await SaveImage(file.name, data)
    // }
    async function uploadImageFile(file: File): Promise<string> {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)

        let binary = ''
        const chunkSize = 0x8000

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + chunkSize)
            )
        }

        const base64 = btoa(binary)

        return await SaveImage(file.name, base64)
    }


    const settingsBtnRef = ref<HTMLButtonElement | null>(null)
    function toggleSettings() {
        showSettings.value = !showSettings.value
        // 点击后立刻收起提示
        tooltipOpen.value = false
        // 可选：移除焦点，避免部分浏览器/组件状态下残留 hover/focus 态
        settingsBtnRef.value?.blur()
    }


    //提取 Markdown 块级锚点
    interface MarkdownBlockAnchor {
        line: number
        kind: 'heading' | 'blockquote' | 'code' | 'paragraph'
        norm: string
    }
    function normalizeBlockText(text: string): string {
        return text
            .replace(/^#{1,6}\s+/, '')
            .replace(/^>\s*\[!(TIP|WARNING|SUCCESS|INFO|NOTE)\]\s*/i, '')
            .replace(/^>+\s*/gm, '')
            .replace(/[*_`~>[\]()!|]/g, '')
            .replace(/\s+/g, '')
            .trim()
            .toLowerCase()
    }

    function extractMarkdownBlockAnchors(md: string): MarkdownBlockAnchor[] {
        const lines = md.split(/\r?\n/)
        const anchors: MarkdownBlockAnchor[] = []

        let i = 0
        while (i < lines.length) {
            const raw = lines[i]
            const trimmed = raw.trim()

            if (!trimmed) {
                i++
                continue
            }

            // 1. 代码块（``` 或 ~~~）
            if (/^(```|~~~)/.test(trimmed)) {
                const startLine = i + 1
                const fence = trimmed.slice(0, 3)
                const codeLines: string[] = []
                i++
                while (i < lines.length && !lines[i].trim().startsWith(fence)) {
                    codeLines.push(lines[i])
                    i++
                }
                if (i < lines.length) i++ // 跳过闭合围栏

                const norm = normalizeBlockText(codeLines.join(''))
                anchors.push({ line: startLine, kind: 'code', norm })
                continue
            }

            // 2. 标题（# ~ ######）
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
            if (headingMatch) {
                const norm = normalizeBlockText(headingMatch[2])
                if (norm) {
                    anchors.push({ line: i + 1, kind: 'heading', norm })
                }
                i++
                continue
            }

            // 3. 引用块（连续以 > 开头的行）
            if (/^>\s?/.test(trimmed)) {
                const startLine = i + 1
                const quoteLines: string[] = []
                while (i < lines.length) {
                    const cur = lines[i].trim()
                    if (/^>\s?/.test(cur)) {
                        quoteLines.push(cur)
                        i++
                        continue
                    }
                    // 懒续行：引用后紧跟的非空普通行，Markdown 规范里仍属于引用块
                    const isBlockStart =
                        !cur ||
                        /^(```|~~~)/.test(cur) ||
                        /^#{1,6}\s+/.test(cur) ||
                        /^([-*_])\1{2,}\s*$/.test(cur) ||
                        cur.startsWith('|') ||
                        /^([-*+]|\d+\.)\s+/.test(cur)
                    if (isBlockStart) break
                    quoteLines.push(cur)
                    i++
                }
                const norm = normalizeBlockText(quoteLines.join(''))
                if (norm) {
                    anchors.push({ line: startLine, kind: 'blockquote', norm })
                }
                continue
            }

            // 4. 普通段落（跳过表格/分隔线/列表，收集连续非空段落行）
            if (/^([-*_])\1{2,}\s*$/.test(trimmed) || trimmed.startsWith('|') || /^([-*+]|\d+\.)\s+/.test(trimmed)) {
                i++
                continue
            }

            const startLine = i + 1
            const paraLines: string[] = []
            while (i < lines.length) {
                const cur = lines[i].trim()
                if (
                    !cur ||
                    /^(```|~~~)/.test(cur) ||
                    /^#{1,6}\s+/.test(cur) ||
                    /^>\s?/.test(cur) ||
                    /^([-*_])\1{2,}\s*$/.test(cur) ||
                    cur.startsWith('|') ||
                    /^([-*+]|\d+\.)\s+/.test(cur)
                ) {
                    break
                }
                paraLines.push(cur)
                i++
            }

            const norm = normalizeBlockText(paraLines.join(''))
            if (norm) {
                anchors.push({ line: startLine, kind: 'paragraph', norm })
            }
        }

        return anchors
    }
    //提取 Markdown 块级锚点 END

    // 读取内容和保存内容


    const docId = options?.docId
    const isLoading = ref(false)
    const isSaving = ref(false)
    const hasUnsavedChanges = ref(false)
    const saveSuccessTip = ref(false)

    // 根据 id 从 SQLite 加载正文并同步到编辑器
    const loadDocById = async (id: string) => {
        if (!id) {
            setEditorContent('')
            hasUnsavedChanges.value = false
            return
        }

        isLoading.value = true
        try {
            const res = await GetDocContent(id)
            // 数据库无记录或内容为空时，保持为空，交由空态提示引导输入
            const content = res?.content ?? ''
            setEditorContent(content)
            hasUnsavedChanges.value = false
        } finally {
            isLoading.value = false
        }
        await resetScrollAndAnchors()
    }

    // 右上角“保存”按钮调用
    const handleSave = async () => {
        const currentId = docId?.value
        if (!currentId || isSaving.value) return

        isSaving.value = true
        try {
            await SaveDocContent(currentId, markdownText.value)
            hasUnsavedChanges.value = false
            saveSuccessTip.value = true
            options?.onContentSaved?.({
                docId: currentId,
                content: markdownText.value
            })
            window.setTimeout(() => {
                saveSuccessTip.value = false
            }, 1500)
        } finally {
            isSaving.value = false
        }
    }

    // 监听 docId 变化：切换文章前若还有未保存修改，先保存旧文章再加载新文章
    if (docId) {
        watch(
            docId,
            async (newId, oldId) => {
                if (oldId && hasUnsavedChanges.value) {
                    await SaveDocContent(oldId, markdownText.value)
                    hasUnsavedChanges.value = false
                }
                await loadDocById(newId)
            },
            { immediate: true }
        )
    }
    // 支持 Ctrl+S / Cmd+S 保存
    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            handleSave()
        }
    }

    //区分加载数据--编辑栏
    // 用于区分“程序同步内容”和“用户手动输入”，避免触发不必要的变更/保存逻辑
    let isApplyingExternalContent = false

    function setEditorContent(nextContent: string) {
        markdownText.value = nextContent

        if (!editor) return
        const currentDocText = editor.state.doc.toString()
        if (currentDocText === nextContent) return

        isApplyingExternalContent = true
        try {
            editor.dispatch({
                changes: {
                    from: 0,
                    to: editor.state.doc.length,
                    insert: nextContent
                }
            })
        } finally {
            // 下一帧释放标记，确保当前 transaction 回调执行完毕
            queueMicrotask(() => {
                isApplyingExternalContent = false
            })
        }
    }
    // 是否显示“空内容提示”（没有文档或数据库正文为空时为 true）
    const isEmptyPlaceholderVisible = computed(() => {
        return !markdownText.value || markdownText.value.trim().length === 0
    })

    //重置滚动条
    // 1. 重置编辑器与预览区滚动条 + 重建锚点（只留这一套即可）
    async function resetScrollAndAnchors() {
        if (rafId) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
        if (previewRafId) {
            cancelAnimationFrame(previewRafId)
            previewRafId = null
        }
        if (releaseLockTimer) {
            window.clearTimeout(releaseLockTimer)
            releaseLockTimer = null
        }
        scrollSource = null

        await nextTick()

        // CodeMirror 6 实际滚动容器通常是 .cm-scroller，editorHost 作为兜底
        const editorScroller =
            editorHost.value?.querySelector<HTMLElement>('.cm-scroller') ??
            editorHost.value ??
            null
        const previewScroller =
            previewScrollEl ??
            (previewHost.value?.closest<HTMLElement>('.canvas-area') ?? null)

        if (editorScroller) editorScroller.scrollTop = 0
        if (previewScroller) previewScroller.scrollTop = 0

        // 补一帧防止内容替换后 DOM 高度还在变化导致未完全置顶
        requestAnimationFrame(() => {
            if (editorScroller) editorScroller.scrollTop = 0
            if (previewScroller) previewScroller.scrollTop = 0
            rebuildAnchors()
        })
    }

    async function applyContentAndResetView(nextContent: string, successText: string) {
        // 1. 清理挂起的滚动帧和锁，避免切换/清空瞬间干扰滚动联动
        if (rafId) cancelAnimationFrame(rafId)
        if (previewRafId) cancelAnimationFrame(previewRafId)
        if (releaseLockTimer) window.clearTimeout(releaseLockTimer)
        scrollSource = null

        // 2. 同步内容并标记为有未保存变更
        setEditorContent(nextContent)
        hasUnsavedChanges.value = true

        // 3. 等待 DOM 与预览渲染完成后，滚动条置顶并重建锚点
        await nextTick()
        const activeEditorEl = getActiveEditorScrollEl?.() ?? editorScrollEl
        if (activeEditorEl) activeEditorEl.scrollTop = 0
        if (previewScrollEl) previewScrollEl.scrollTop = 0

        rebuildAnchors()
        message.success(successText)
    }

    // 重置：清空当前文章内容
    function resetContent() {
        Modal.confirm({
            title: '确定清空当前内容吗？',
            icon: createVNode(ExclamationCircleOutlined),
            content: '清空后当前编辑器中的文章内容将被移除，保存前仍可撤销或切换文档放弃修改。',
            okText: '确认',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
                await applyContentAndResetView('', '已清空当前内容')
            },
        })
    }

    // 示例：用示例文章替换当前内容
    function insertSampleContent() {
        Modal.confirm({
            title: '确定填入示例文章吗？',
            icon: createVNode(ExclamationCircleOutlined),
            content: '填入后，当前编辑器中的文章内容将被示例文章替换。',
            okText: '确认',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
                await applyContentAndResetView(starter, '已填入示例文章')
            },
        })
    }

    return {
        showSettings,
        tooltipOpen,
        markdownText,
        activeTheme,
        fontSize,
        lineHeight,
        paragraphGap,
        codeStyle,
        mobilePreview,
        editorHost,
        previewHost,
        copied,
        fileInput,
        imageInput,
        theme,
        themes,
        html,
        articleStyle,
        chooseTheme,
        chooseCodeStyle,
        copyWechat,
        insertLocalImages,
        insertImageInput,
        importFile,
        exportFile,
        resetContent,
        settingsBtnRef,
        toggleSettings,
        docId,
        isSaving,
        isLoading,
        saveSuccessTip,
        hasUnsavedChanges,
        handleSave,
        isEmptyPlaceholderVisible,
        insertSampleContent
    }

}
