<template>
  <div
    class="flex no-drag h-screen overflow-hidden font-sans text-slate-900 bg-white dark:bg-gray-950 dark:text-slate-100 select-none">
    <!-- 左侧目录栏（支持平滑折叠） -->
    <aside :class="[
      'flex flex-col border-r border-slate-200/80 bg-[#FBFBFC] dark:bg-gray-900 dark:border-slate-800 transition-all duration-300 ease-in-out overflow-hidden shrink-0',
      isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 border-r-0'
    ]">
      <!-- 固定内部宽度防止收起时文字换行挤压 -->
      <div class="w-64 flex flex-col h-full">
        <!-- 顶部拖拽区域（适配 macOS 红绿灯留白） -->
        <div :class="['drag-region shrink-0', ismacos ? 'h-10' : 'h-4']"></div>

        <!-- Workspace / 知识库头部（参考图左上角风格） -->
        <div class="px-3.5 pb-3 ">
          <div
            class="flex  items-center justify-between p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-8 h-8 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <!-- <FolderOpenOutlined class="text-base" /> -->
                <div class="brand-mark"><img src="/assets/icon.ico" alt="RanPress Logo" /></div>
              </div>
              <div class="truncate">
                <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">
                  RanPress
                </div>
                <div class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 text-left truncate">
                  {{ totalDocsCount }} 篇文档
                </div>
              </div>
            </div>
            <SwapOutlined class="rotate-90 text-xs text-slate-400 shrink-0" />
          </div>
        </div>

        <!-- 分组栏标题 + 新建分组 -->
        <div
          class="px-4 pt-1 pb-1.5 flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500">
          <span>目录分组</span>
          <button @click="addNewGroup" title="新建分组"
            class="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <PlusOutlined class="text-xs" />
          </button>
        </div>

        <!-- 树形分组与虚线连接列表 -->
        <nav class="flex-1 overflow-y-auto px-3 space-y-1.5 scrollbar-thin">
          <div v-for="group in docGroups" :key="group.id" class="space-y-0.5">
            <!-- 分组父节点 -->
            <div @click="toggleGroup(group.id)" @dblclick.stop="startEditGroup(group)"
              class="group relative overflow-hidden flex items-center justify-between px-2 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 cursor-pointer transition-colors">
              <div class="flex items-center gap-1.5 min-w-0 flex-1">
                <RightOutlined :class="[
                  'text-[10px] text-slate-400 transition-transform duration-200 shrink-0',
                  group.expanded ? 'rotate-90' : ''
                ]" />
                <FolderOutlined class="text-slate-400 dark:text-slate-500 text-sm shrink-0" />

                <!-- 编辑分组名输入框 -->
                <input v-if="editingGroupId === group.id" v-model="editingText" v-focus @click.stop
                  @keydown.enter.stop="commitEditGroup(group)" @keydown.esc.stop="cancelEdit"
                  @blur="commitEditGroup(group)"
                  class="w-full px-1.5 py-0.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-indigo-500 rounded outline-none" />
                <span v-else class="truncate">{{ group.name }}</span>
              </div>

              <!-- 浮动操作栏（渐变透明背景） -->
              <div v-if="editingGroupId !== group.id"
                class="pointer-events-none opacity-0 translate-x-1 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 absolute inset-y-0 right-0 flex items-center pl-7 pr-1.5 bg-gradient-to-l from-slate-200 via-slate-200/95 to-transparent dark:from-slate-800 dark:via-slate-800/95 dark:to-transparent">
                <div class="flex items-center gap-0.5">
                  <button type="button" @click.stop="startEditGroup(group)" title="重命名分组"
                    class="w-8 p-1 rounded hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                    <EditOutlined class="text-[11px]" />
                  </button>
                  <button type="button" @click.stop="addNewDoc(group.id)" title="在此分组新建文档"
                    class="w-8 p-1 rounded hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                    <PlusOutlined class="text-[11px]" />
                  </button>
                  <button type="button" @click.stop="confirmRemoveGroup(group)" title="删除分组"
                    class="w-8 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/70 text-slate-600 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400">
                    <DeleteOutlined class="text-[11px]" />
                  </button>
                </div>
              </div>
            </div>

            <!-- 子文章列表（带左侧纵向虚线 + 节点横向虚线） -->
            <div v-show="group.expanded"
              class="ml-3.5 pl-3 border-l border-dashed border-slate-300 dark:border-slate-700 space-y-0.5 py-0.5">
              <div v-for="doc in group.items" :key="doc.id" @click="selectDoc(doc)" @dblclick.stop="startEditDoc(doc)"
                :class="[
                  'doc-item group/doc relative overflow-visible flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer transition-all',
                  'before:content-[\'\'] before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:border-t before:border-dashed before:border-slate-300 dark:before:border-slate-700',
                  selectedDocId === doc.id
                    ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                ]">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <FileMarkdownOutlined :class="[
                    'text-sm shrink-0',
                    selectedDocId === doc.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                  ]" />

                  <!-- 编辑文章名输入框 -->
                  <input v-if="editingDocId === doc.id" v-model="editingText" v-focus @click.stop
                    @keydown.enter.stop="commitEditDoc(doc)" @keydown.esc.stop="cancelEdit" @blur="commitEditDoc(doc)"
                    class="w-full px-1.5 py-0.5 text-[13px] font-normal bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-indigo-500 rounded outline-none" />
                  <span v-else class="truncate">{{ doc.title }}</span>
                </div>

                <!-- 浮动操作栏：悬停或当前选中时显示 -->
                <div v-if="editingDocId !== doc.id" :class="[
                  'pointer-events-none opacity-0 translate-x-1 group-hover/doc:pointer-events-auto group-hover/doc:opacity-100 group-hover/doc:translate-x-0 transition-all duration-150 absolute inset-y-0 right-0 flex items-center pl-7 pr-1.5 rounded-r-lg',
                  selectedDocId === doc.id
                    ? 'opacity-100 translate-x-0 pointer-events-auto bg-gradient-to-l from-slate-200 via-slate-200/95 to-transparent dark:from-slate-800 dark:via-slate-800/95 dark:to-transparent'
                    : 'bg-gradient-to-l from-slate-200 via-slate-200/95 to-transparent dark:from-slate-800 dark:via-slate-800/95 dark:to-transparent'
                ]">
                  <div class="flex items-center gap-0.5">
                    <button type="button" @click.stop="startEditDoc(doc)" title="重命名文章"
                      class="w-8 p-1 rounded hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                      <EditOutlined class="text-[11px]" />
                    </button>
                    <button type="button" @click.stop="confirmRemoveDoc(group, doc)" title="删除文章"
                      class="w-8 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/70 text-slate-600 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400">
                      <DeleteOutlined class="text-[11px]" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- 空分组占位提示 -->
              <div v-if="group.items.length === 0" @click="addNewDoc(group.id)"
                class="relative text-left pl-2.5 py-1 text-xs text-slate-400 hover:text-indigo-500 cursor-pointer before:content-[''] before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:border-t before:border-dashed before:border-slate-300 dark:before:border-slate-700">
                + 点击添加文档
              </div>
            </div>
          </div>
        </nav>


        <!-- 底部设置栏（替换原有个人信息栏） -->
        <!-- <div class="p-3 border-t border-slate-200/70 dark:border-slate-800 shrink-0">
          <button type="button" @click="openSettings" :class="[
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
            isSettingsActive
              ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200'
          ]">
            <SettingOutlined class="text-sm text-slate-500 dark:text-slate-400 shrink-0" />
            <span class="truncate">设置</span>
          </button>
        </div> -->
        <div class="p-3 border-t border-slate-200/70 dark:border-slate-800 shrink-0">
          <button type="button" @click="checkForUpdates" :disabled="checkingUpdate"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200">
            <CloudDownloadOutlined class="text-sm text-slate-500 dark:text-slate-400 shrink-0" />
            <span class="truncate">{{ checkingUpdate ? '正在检查...' : '检查更新' }}</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- 右侧主工作区 -->
    <div class=" flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">
      <!-- 顶部导航与窗口控制栏（参考图右侧顶部布局） -->
      <header
        class=" h-10 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 drag-region shrink-0">
        <!-- 左侧：收起/展开侧边栏按钮 + 当前文档面包屑 -->
        <div class="flex items-center gap-1 no-drag " :class="[!isSidebarOpen && ismacos ? 'pl-14' : '']">
          <button @click="isSidebarOpen = !isSidebarOpen" :title="isSidebarOpen ? '收起侧边栏' : '展开侧边栏'"
            class="w-8 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors">
            <!-- 自定义侧边栏开关 SVG，与参考图左上角图标一致 -->
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <!-- 当前选中文档路径提示 -->
          <div v-if="currentDoc" class="flex items-center gap-1.5 text-xs text-slate-400">
            <span>{{ currentGroupName }}</span>
            <span>/</span>
            <span class="text-slate-700 dark:text-slate-200 font-medium">{{ currentDoc.title }}</span>
          </div>
        </div>

        <!-- 右侧：标题及 Windows 窗口控制按钮 -->
        <div class="flex items-center gap-4 no-drag">
          <span class="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
            <!-- Editor -->
          </span>

          <div v-if="iswindows" class="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
            <!-- <button @click="Window.Minimise()" class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
              <LineOutlined class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-300" />
            </button> -->
            <button @click="toggleMaximize()" class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
              <BorderOutlined v-if="!isMaximized"
                class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-300" />
              <SwitcherOutlined v-else class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-300" />
            </button>
            <!-- <button @click="Window.Hide()" class="p-1.5 rounded hover:bg-red-500/10 group">
              <CloseOutlined class="text-xs text-gray-400 group-hover:text-red-500 dark:text-gray-300" />
            </button> -->
          </div>
        </div>
      </header>

      <!-- 主内容区域 -->
      <main class="flex-1 overflow-hidden  max-h-screen  text-left">
        <!-- <component :is="getComponent" :doc="currentDoc" /> -->
        <component v-if="currentDoc" :is="getComponent" :doc-id="currentDoc.id" :doc-title="currentDoc.title"
          @content-saved="onDocContentSaved" />
        <div v-else class="h-full flex items-center justify-center text-sm text-slate-400">
          请在左侧选择或新建一篇 Markdown 文档
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, createVNode } from 'vue'
import {
  FolderOpenOutlined,
  FolderOutlined,
  FileMarkdownOutlined,
  PlusOutlined,
  RightOutlined,
  SwapOutlined,
  SettingOutlined,
  LineOutlined,
  BorderOutlined,
  SwitcherOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,CloudDownloadOutlined
} from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'

// 替换为你的 Wails 实际绑定路径
import {
  ListDocNodes,
  GetDocContent,
  CreateDocNode,
  UpdateDocNode,
  RenameDocNode,
  SaveDocContent,
  DeleteDocNode
} from '../../../bindings/changeme/internal/services/docservice'

import General from '../General/Index.vue'
import Markdown from '../../pages/Markdown/Index.vue'
import { CheckForUpdates } from '../../../bindings/changeme/internal/services/appservice'

const checkingUpdate = ref(false)
const checkForUpdates = async () => {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    await CheckForUpdates()
  } catch (error) {
    console.error('检查更新失败:', error)
  } finally {
    checkingUpdate.value = false
  }
}


// 若有 History 组件，按原路径补充导入：import History from '...'

interface DocNodeDTO {
  id: string
  parentId?: string | null
  nodeType: 'group' | 'doc'
  title: string
  expanded: boolean
  sortOrder: number
}

interface MarkdownDoc {
  id: string
  parentId: string
  title: string
  sortOrder: number
  content: string
  loaded?: boolean
}

interface DocGroup {
  id: string
  name: string
  expanded: boolean
  sortOrder: number
  items: MarkdownDoc[]
}

// 侧边栏与文档状态
const isSidebarOpen = ref(true)
const selectedDocId = ref('')
const docGroups = ref<DocGroup[]>([])
const isSettingsActive = ref(false)

// 将后端扁平 doc_nodes 组装为分组 -> 文档结构
const buildDocTree = (nodes: DocNodeDTO[]): DocGroup[] => {
  const groupMap = new Map<string, DocGroup>()
  const groups: DocGroup[] = []

  for (const n of nodes) {
    if (n.nodeType === 'group') {
      const g: DocGroup = {
        id: n.id,
        name: n.title,
        expanded: n.expanded,
        sortOrder: n.sortOrder,
        items: []
      }
      groupMap.set(n.id, g)
      groups.push(g)
    }
  }

  for (const n of nodes) {
    if (n.nodeType === 'doc' && n.parentId) {
      const parent = groupMap.get(n.parentId)
      if (parent) {
        parent.items.push({
          id: n.id,
          parentId: n.parentId,
          title: n.title,
          sortOrder: n.sortOrder,
          content: '',
          loaded: false
        })
      }
    }
  }

  groups.sort((a, b) => a.sortOrder - b.sortOrder)
  groups.forEach(g => g.items.sort((a, b) => a.sortOrder - b.sortOrder))
  return groups
}

// 首次进入加载数据库目录，为空时自动建默认分组
const loadWorkspace = async () => {
  const nodes = (await ListDocNodes()) || []
  let groups = buildDocTree(nodes as DocNodeDTO[])

  if (groups.length === 0) {
    const defaultGroupId = `group-${Date.now()}`
    await CreateDocNode(defaultGroupId, null, 'group', '默认分组', 0)
    groups = [
      {
        id: defaultGroupId,
        name: '默认分组',
        expanded: true,
        sortOrder: 0,
        items: []
      }
    ]
  }

  docGroups.value = groups

  const firstDoc = groups.flatMap(g => g.items)[0]
  if (firstDoc && !isSettingsActive.value) {
    await selectDoc(firstDoc)
  }
}

onMounted(() => {
  loadWorkspace()
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

const totalDocsCount = computed(() =>
  docGroups.value.reduce((acc, g) => acc + g.items.length, 0)
)

const currentDoc = computed(() => {
  for (const g of docGroups.value) {
    const found = g.items.find(d => d.id === selectedDocId.value)
    if (found) return found
  }
  return null
})

const currentGroupName = computed(() => {
  for (const g of docGroups.value) {
    if (g.items.some(d => d.id === selectedDocId.value)) return g.name
  }
  return ''
})

// 折叠/展开分组并同步到 SQLite
const toggleGroup = async (groupId: string) => {
  const target = docGroups.value.find(g => g.id === groupId)
  if (!target) return
  target.expanded = !target.expanded
  await UpdateDocNode(target.id, null, target.name, target.expanded, target.sortOrder)
}

// 新增分组
const addNewGroup = async () => {
  const id = `group-${Date.now()}`
  const name = `新建分组 ${docGroups.value.length + 1}`
  const sortOrder = docGroups.value.length

  await CreateDocNode(id, null, 'group', name, sortOrder)
  docGroups.value.push({
    id,
    name,
    expanded: true,
    sortOrder,
    items: []
  })
}

// 在分组下新增文档
const addNewDoc = async (groupId: string) => {
  const group = docGroups.value.find(g => g.id === groupId)
  if (!group) return

  if (!group.expanded) {
    group.expanded = true
    await UpdateDocNode(group.id, null, group.name, true, group.sortOrder)
  }

  const newId = `doc-${Date.now()}`
  const title = `未命名文档 ${group.items.length + 1}` //.md
  const sortOrder = group.items.length

  await CreateDocNode(newId, groupId, 'doc', title, sortOrder)
  const newDoc: MarkdownDoc = {
    id: newId,
    parentId: groupId,
    title,
    sortOrder,
    content: '',
    loaded: true
  }
  group.items.push(newDoc)
  isSettingsActive.value = false
  selectedDocId.value = newId
}

// 删除分组或文档（后端外键级联清理子项和正文）
const removeGroup = async (group: DocGroup) => {
  await DeleteDocNode(group.id)
  const hasSelected = group.items.some(d => d.id === selectedDocId.value)
  docGroups.value = docGroups.value.filter(g => g.id !== group.id)
  if (hasSelected) {
    const nextDoc = docGroups.value.flatMap(g => g.items)[0]
    selectedDocId.value = ''
    if (nextDoc && !isSettingsActive.value) await selectDoc(nextDoc)
  }
}

const removeDoc = async (group: DocGroup, doc: MarkdownDoc) => {
  await DeleteDocNode(doc.id)
  group.items = group.items.filter(d => d.id !== doc.id)
  if (selectedDocId.value === doc.id) {
    const nextDoc = group.items[0] || docGroups.value.flatMap(g => g.items)[0]
    selectedDocId.value = ''
    if (nextDoc && !isSettingsActive.value) await selectDoc(nextDoc)
  }
}

// 保留原有平台与视图状态逻辑
const ismacos = ref(true)
const iswindows = ref(false)
const isMaximized = ref(false)
const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value
}

const selected = ref<string>('markdown')

const components: Record<string, any> = {
  // history: History,
  general: General,
  markdown: Markdown
}

const getComponent = computed(() => components[selected.value] || Markdown)

watch(selected, () => {
  nextTick(() => {
    const el = document.querySelector('.scroll-container')
    if (el) el.scrollTop = 0
  })
})

const selectDoc = async (doc: MarkdownDoc) => {
  isSettingsActive.value = false
  selected.value = 'markdown'
  selectedDocId.value = doc.id
  if (!doc.loaded) {
    const res = await GetDocContent(doc.id)
    doc.content = res?.content ?? ''
    doc.loaded = true
  }
}

const openSettings = () => {
  isSettingsActive.value = true
  selected.value = 'general'
  selectedDocId.value = ''
}

// 自动聚焦并选中输入框文本
const vFocus = {
  mounted(el: HTMLInputElement) {
    nextTick(() => {
      el.focus()
      el.select()
    })
  }
}

const editingGroupId = ref<string | null>(null)
const editingDocId = ref<string | null>(null)
const editingText = ref('')
let isCancelling = false

const cancelEdit = () => {
  isCancelling = true
  editingGroupId.value = null
  editingDocId.value = null
  editingText.value = ''
  nextTick(() => {
    isCancelling = false
  })
}

// 开始编辑分组名称
const startEditGroup = (group: DocGroup) => {
  editingDocId.value = null
  editingGroupId.value = group.id
  editingText.value = group.name
}

// 提交分组名称并同步到 SQLite
const commitEditGroup = async (group: DocGroup) => {
  if (isCancelling || editingGroupId.value !== group.id) return
  const trimmed = editingText.value.trim()
  if (trimmed && trimmed !== group.name) {
    group.name = trimmed
    await RenameDocNode(group.id, trimmed)
  }
  editingGroupId.value = null
  editingText.value = ''
}

// 开始编辑文章名称
const startEditDoc = (doc: MarkdownDoc) => {
  editingGroupId.value = null
  editingDocId.value = doc.id
  editingText.value = doc.title
}

// 提交文章名称并同步到 SQLite
const commitEditDoc = async (doc: MarkdownDoc) => {
  if (isCancelling || editingDocId.value !== doc.id) return
  const trimmed = editingText.value.trim()
  if (trimmed && trimmed !== doc.title) {
    doc.title = trimmed
    await RenameDocNode(doc.id, trimmed)
  }
  editingDocId.value = null
  editingText.value = ''
}

// 当前文章正文防抖保存到 doc_contents
let saveTimer: ReturnType<typeof setTimeout> | null = null
const saveDocContentDebounced = (docId: string, content: string) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await SaveDocContent(docId, content)
  }, 600)
}

// 若编辑器直接修改 currentDoc.value.content，监听内容变化自动保存
watch(
  () => currentDoc.value?.content,
  (newVal, oldVal) => {
    const doc = currentDoc.value
    if (!doc || !doc.loaded || newVal === undefined || newVal === oldVal) return
    saveDocContentDebounced(doc.id, newVal)
  }
)

// 同步子组件保存后的最新正文到本地目录状态（可选）
const onDocContentSaved = ({ docId, content }: { docId: string; content: string }) => {
  for (const g of docGroups.value) {
    const target = g.items.find(d => d.id === docId)
    if (target) {
      target.content = content
      target.loaded = true
      break
    }
  }
}

//
const confirmRemoveGroup = (group: DocGroup) => {
  const content = group.items.length > 0
    ? `确定删除分组「${group.name}」及其下的 ${group.items.length} 篇文档吗？此操作不可恢复。`
    : `确定删除空分组「${group.name}」吗？此操作不可恢复。`

  Modal.confirm({
    title: '确定删除分组吗？',
    icon: createVNode(ExclamationCircleOutlined),
    content,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      if (saveTimer && group.items.some(d => d.id === selectedDocId.value)) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await removeGroup(group)
    }
  })
}

const confirmRemoveDoc = (group: DocGroup, doc: MarkdownDoc) => {
  Modal.confirm({
    title: '确定删除文档吗？',
    icon: createVNode(ExclamationCircleOutlined),
    content: `删除后，「${doc.title}」及其内容将无法恢复。`,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      if (saveTimer && selectedDocId.value === doc.id) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await removeDoc(group, doc)
    }
  })
}


</script>

<style scoped>
html,
body {
  margin: 0;
  overflow-x: hidden;
  /* 禁止横向滚动 */
  overflow-y: hidden;
}

.drag-region {
  -webkit-app-region: drag;
  --wails-draggable: drag;
}

.no-drag {
  --wails-draggable: no-drag;
}

.titlebar {
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  user-select: none;
}

.drag-area {
  flex: 1;
  padding-left: 12px;
  /* 👇 关键：允许拖动窗口 */
  -webkit-app-region: drag;
  --wails-draggable: drag;
}

.window-controls {
  display: flex;
  /* 👇 按钮不能拖动 */
  -webkit-app-region: no-drag;
  --wails-draggable: no-drag;
}

.window-controls button {
  margin-right: 8px;
  width: 20px;
  height: 20px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

}

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