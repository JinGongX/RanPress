# RanPress

Beautiful WeChat Articles, Powered by Markdown.

RanPress is a browser-based Markdown editor focused on polished WeChat Official Account article formatting.

## Features

- Vue 3 + TypeScript + Vite
- Live Markdown preview and six article themes
- WeChat-friendly HTML export with inline styles
- Independent macOS / GitHub / VS Code code block styles
- Callout blocks: TIP, WARNING, SUCCESS, INFO
- Local draft persistence and Markdown import/export

## Callout syntax

```markdown
> [!TIP] 微信公众号对 HTML 和 CSS 的支持存在限制，最终效果以公众号后台实际粘贴结果为准。

> [!WARNING]
> 发布前请检查图片和代码块在手机端的显示效果。
```

Both a same-line message after the marker and a following quoted paragraph are supported.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Notes

The WeChat editor may normalize pasted HTML differently across editor versions and clients. Always verify the final pasted result in the Official Account backend before publishing.


## v0.4.0 修复说明

- 提示框在 Markdown 源码预处理阶段识别，不再依赖 Marked blockquote renderer 的 HTML 字符串格式。
- 预览区使用独立的 `.rp-callout` 组件样式。
- 微信导出时将提示框转换为表格 + 内联样式。
- 剪贴板 `text/plain` 改为渲染后的纯文本，不再写入原始 Markdown，降低公众号提示检测到 Markdown 语法的概率。
- macOS 代码栏改为固定双列结构，圆点和语言标签分开布局。

注意：当前执行环境无法完成 npm 依赖安装，因此未能运行 `npm run build`，也无法替代真实公众号后台的粘贴验证。
