import type { Theme } from '../types'
export const themes: Theme[] = [
  { id:'minimal', name:'极简白', en:'MINIMAL', description:'克制留白，清晰耐读', color:'#252525', bg:'#ffffff', text:'#333333', muted:'#888888', border:'#e8e8e8', accent:'#333333' },
  { id:'tech', name:'科技蓝', en:'TECH BLUE', description:'理性、清爽的技术感', color:'#2563eb', bg:'#ffffff', text:'#253247', muted:'#718096', border:'#dbeafe', accent:'#2563eb' },
  { id:'editorial', name:'杂志风', en:'EDITORIAL', description:'强调层次与阅读节奏', color:'#b45335', bg:'#fffdf9', text:'#292521', muted:'#8b8178', border:'#eadfd4', accent:'#b45335' },
  { id:'japanese', name:'日系简约', en:'JAPANESE', description:'柔和自然，安静舒展', color:'#647c68', bg:'#fbfcf8', text:'#39443b', muted:'#89958a', border:'#e3e9df', accent:'#647c68' },
  { id:'developer', name:'开发者', en:'DEVELOPER', description:'为代码与实战教程而设计', color:'#0f766e', bg:'#ffffff', text:'#253b3a', muted:'#718381', border:'#d5e8e5', accent:'#0f766e' },
  { id:'business', name:'商务灰', en:'BUSINESS', description:'稳重、规整、专业', color:'#475569', bg:'#ffffff', text:'#293342', muted:'#7b8794', border:'#e2e8f0', accent:'#475569' }
]
