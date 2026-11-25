<script setup lang="ts">
import { toRef } from 'vue'
import {
    Download,
    Settings2,
    Copy,
    FileUp,
    FileDown,
    RotateCcw,
    Check,
    ChevronDown,
    Smartphone,
    Monitor,
    Sparkles,
    PanelRightClose,
    ImagePlus, Save
} from 'lucide-vue-next'
const props = defineProps<{
    docId: string
    docTitle?: string
}>()

const emit = defineEmits<{
    (e: 'content-saved', payload: { docId: string; content: string }): void
}>()
import { useEditorPage } from '../../utils/useEditorPage'
import type { CodeBlockStyle } from '../../utils/exportHtml'
const {
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
    themes,
    isSaving,
    isLoading,
    saveSuccessTip,
    hasUnsavedChanges,
    handleSave,
    isEmptyPlaceholderVisible,
    insertSampleContent
} = useEditorPage({
    docId: toRef(props, 'docId'),
    onContentSaved: (payload) => emit('content-saved', payload)
})


</script>

<template>
    <div class="app-shell" :style="{ '--theme-accent': theme.accent }">
        <header class="topbar">
            <div class="top-actions">
                <button class="tool-button" type="button" @click="insertSampleContent">
                    <Sparkles :size="15" />
                    <span>示例</span>
                </button>
                <!-- <button class="tool-button" @click="fileInput?.click()">
                    <FileUp :size="16" />导入
                </button> 
                <input ref="fileInput" type="file" accept=".md,.markdown,.txt" hidden @change="importFile" />-->
                <button class="tool-button" type="button" @click="insertLocalImages()">
                    <ImagePlus :size="16" />插图
                </button>
                <input ref="imageInput" type="file" accept="image/*" multiple hidden @change="insertImageInput" />
                <!-- <button class="tool-button" @click="exportFile">
                    <FileDown :size="16" />导出 MD
                </button> -->
                <span class="top-divider"></span>
                <button class="tool-button" @click="resetContent">
                    <RotateCcw :size="15" />重置
                </button>
                <button class="primary-button wechat-button" @click="copyWechat">
                    <Check v-if="copied" :size="16" />
                    <Copy v-else :size="16" />{{ copied ? '已复制' : '复制到公众号' }}
                </button>
                <button type="button" class="primary-button" :disabled="!docId || isSaving || isLoading"
                    @click="handleSave">
                    <Save :size="16" />
                    <span>
                        {{ isSaving ? '保存中...' : saveSuccessTip ? '已保存' : hasUnsavedChanges ? '保存*' : '保存' }}
                    </span>
                </button>
            </div>
        </header>
        <main class="workspace" :class="{ 'settings-open': showSettings }">
            <section class="editor-panel">
                <div class="panel-heading">
                    <div><span class="panel-kicker">01 / WRITE</span>
                        <h2>Markdown 编辑</h2>
                    </div><span class="live-pill"><i></i> 自动保存</span>
                </div>
                <div class="editor-toolbar"><span>文章内容</span><span>Markdown</span></div>
                <!-- <div ref="editorHost" class="code-editor scrollbar-thin"></div> -->
                <div class="editor-wrapper relative">
                    <div ref="editorHost" class="editor-editor  scrollbar-thin"></div>
                    <div v-if="!isLoading && isEmptyPlaceholderVisible" class="editor-empty-hint">
                        <p class="hint-title">从这里开始写点什么吧…</p>
                        <p class="hint-sub">支持 Markdown 语法、代码块与 [!TIP] 提示框；也可在上方恢复示例文章。</p>
                    </div>
                </div>
                <div class="editor-footer"><span>支持标准 Markdown · GFM</span><span>{{ markdownText.length.toLocaleString()
                        }} 字符</span></div>
            </section>
            <section class="preview-panel">
                <div class="preview-top">
                    <div>
                        <span class="panel-kicker">02 / PREVIEW</span>
                        <h2>实时预览</h2>
                    </div>

                    <div class="preview-actions">
                        <!-- <button class="settings-toggle" :class="{ selected: showSettings }"
                            @click="showSettings = !showSettings">
                            <Settings2 :size="15" /> 
                        </button> -->
                        <div class="preview-switch">
                            <button :class="{ selected: mobilePreview }" @click="mobilePreview = true">
                                <Smartphone :size="15" />手机
                            </button>
                            <button :class="{ selected: !mobilePreview }" @click="mobilePreview = false">
                                <Monitor :size="15" />宽屏
                            </button>
                        </div>
                        <a-tooltip title="排版设置" v-model:open="tooltipOpen" :destroy-tooltip-on-hide="true"
                            @openChange="(val) => (tooltipOpen = val)">
                            <button ref="settingsBtnRef" class="settings-toggle" :class="{ selected: showSettings }"
                                aria-label="排版设置" @click="toggleSettings">
                                <Settings2 :size="15" />
                            </button>
                        </a-tooltip>
                    </div>
                </div>
                <div class="canvas-area   scrollbar-thin">
                    <div class="phone-frame" :class="{ wide: !mobilePreview }" :style="{ background: theme.bg }">
                        <div class="phone-status"><span>9:11</span><span>●●●</span></div>
                        <div class="wechat-bar"><span>‹</span><span>{{ props.docTitle || '未命名文档'
                        }}</span><span>···</span></div>
                        <article ref="previewHost" class="article-content"
                            :class="[`theme-${theme.id}`, `code-style-${codeStyle}`]" :style="articleStyle"
                            v-html="html"></article>
                        <div class="phone-bottom"><span>♡　赞</span><span>↗　分享</span><span>☆　收藏</span></div>
                    </div>
                </div>
                <div class="preview-caption"><span><i></i> 实时渲染</span><span>预览效果仅供参考，以公众号实际粘贴为准</span></div>
            </section>
            <Transition name="settings-drawer">
                <aside class="settings-panel  scrollbar-thin" v-if="showSettings">
                    <div class="settings-heading">
                        <div><span class="panel-kicker">03 / DESIGN</span>
                            <h2>排版设计</h2>
                        </div>
                        <Sparkles :size="18" class="sparkle" />
                    </div>
                    <div class="setting-section">
                        <div class="section-title"><span>主题风格</span><span class="section-count">{{ themes.length }}
                                STYLES</span></div>
                        <div class="theme-grid"><button v-for="item in themes" :key="item.id" class="theme-card"
                                :class="{ active: activeTheme === item.id }" @click="chooseTheme(item.id)">
                                <div class="theme-swatch" :style="{ background: item.bg, borderColor: item.border }">
                                    <span :style="{ background: item.accent }"></span><i
                                        :style="{ background: item.text, width: '68%' }"></i><i
                                        :style="{ background: item.border, width: '88%' }"></i><i
                                        :style="{ background: item.border, width: '54%' }"></i><b
                                        :style="{ color: item.accent }">Aa</b>
                                </div>
                                <div class="theme-meta"><span>{{ item.name }}</span><small>{{ item.en }}</small></div>
                                <span v-if="activeTheme === item.id" class="selected-dot">
                                    <Check :size="10" />
                                </span>
                            </button></div>
                        <p class="theme-description">{{ theme.description }}</p>
                    </div>
                    <div class="setting-section">
                        <div class="section-title"><span>正文排版</span><span class="section-count">TYPOGRAPHY</span></div>
                        <div class="range-setting">
                            <div><label>正文字号</label><strong>{{ fontSize }}px</strong></div>
                            <!-- <input v-model.number="fontSize"
                            type="range" min="14" max="20" step="1" /> -->
                            <a-slider v-model:value="fontSize" :min="14" :max="20" :step="1" />
                        </div>
                        <div class="range-setting">
                            <div><label>行间距</label><strong>{{ lineHeight.toFixed(1) }}</strong></div>
                            <!-- <input v-model.number="lineHeight" type="range" min="1.5" max="2.3" step="0.1" /> -->
                            <a-slider v-model:value="lineHeight" :min="1.5" :max="2.3" :step="0.1" />
                        </div>
                        <div class="range-setting">
                            <div><label>段落间距</label><strong>{{ paragraphGap }}px</strong></div>
                            <a-slider v-model:value="paragraphGap" :min="8" :max="32" :step="2" />
                        </div>
                    </div>
                    <div class="setting-section code-style-section">
                        <div class="section-title"><span>代码块样式</span><span class="section-count">CODE BLOCK</span></div>
                        <div class="code-style-options"><button
                                v-for="item in [{ id: 'macos', name: 'macOS', desc: '红黄绿窗口点' }, { id: 'github', name: 'GitHub', desc: '简洁深色标题' }, { id: 'vscode', name: 'VS Code', desc: '编辑器风格' }]"
                                :key="item.id" :class="{ active: codeStyle === item.id }"
                                @click="chooseCodeStyle(item.id as CodeBlockStyle)"><span class="code-style-preview"
                                    :class="`preview-${item.id}`"><template
                                        v-if="item.id === 'macos'"><i></i><i></i><i></i></template><b
                                        v-else-if="item.id === 'github'">GitHub</b><b v-else>&gt;_</b></span><strong>{{
                                            item.name }}</strong><small>{{
                                        item.desc }}</small></button></div>
                    </div>
                    <div class="settings-tip">
                        <div class="tip-icon">✳</div>
                        <div><strong>提示框与重点组件</strong>
                            <p>在引用首行使用 [!TIP]、[!WARNING]、[!SUCCESS] 或 [!INFO]，即可生成对应提示卡片。</p>
                        </div>
                    </div>
                    <div class="settings-bottom">
                        <PanelRightClose :size="14" /> 样式会自动保存在本地
                    </div>
                </aside>
            </Transition>
        </main>
        <footer class="app-footer"><span>RanPress <b>0.3.1</b></span><span>Beautiful WeChat Articles, Powered by
                Markdown.</span><span>CONTENT FIRST · DESIGN BETTER</span></footer>
    </div>
</template>
<style>
/* 全局样式（可放在 main.css 或 tailwind.css） */
.scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 4px;
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #555;
}

.scrollbar-thin::-webkit-scrollbar-track {
    background-color: transparent;
}
</style>
