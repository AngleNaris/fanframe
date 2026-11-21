# 繁界 · FanFrame

繁界为 DeepSeek Harness 的聊天、侧栏和控件提供更清晰的阅读层次与统一的直角外观。保留原生操作入口。

![繁界界面示例](https://raw.githubusercontent.com/AngleNaris/fanframe/main/assets/user-screenshot.png)

## 安装与升级

在 DSH 插件管理器中安装并启用 `fanframe@latest`；也可以指定 `fanframe@1.11.1`。

- 已安装独立 `dsh-chat-preview`：**先停用独立插件，再升级繁界**，避免两套预览同时注册；不用卸载，历史引用不需要迁移。
- 从 `fan-de-hai` 迁移：先停用旧包，再启用繁界，不要同时开启。
- 繁界的宿主兼容声明为 `>=0.2.1-rc.1 <0.4.0-0`；本版文件预览与正文亮度的 Web 验收基于 DSH `0.2.2-rc.3`，不代表逐版验证。

### 1.11.0 更新

- **内置聊天文件预览**：视频在正文中左对齐，等比显示，最大 640×360，不自动播放，支持原生全屏；音频和文档使用单行入口。附件预览支持 PDF、文本、Markdown、CSV／TSV 等已支持格式。原文件卡、下载和系统打开不变。
- **增强正文亮度层次**：保持按标点分段和现有三档，浅色下更易区分，深色适度拉开。链接、代码、数字、括号、排版和选择文本不变。强制色模式沿用系统文字色。
- **正文可视化**：支持轻量交互图卡、主题配色、内置图标和表单控件，保留旧版图卡回放。

繁界仍保留直角外观、侧栏与插件列表整理、子智能体目录显示及尊重「减少动态效果」的短时过渡。

## 在正文中引用交付文件

先让助手调用 `present`。如果要把图片显示在正文中，直接使用 DSH 原生的 Markdown 图片语法 `![图片说明](<图片路径>)`，不要将图片写进 `dsh-media`。

仅对音频、视频和繁界支持预览的文档使用 `dsh-media` 围栏。`path` 填本会话交付记录中的完整绝对路径，并遵循 JSON 转义规则。例如：

````markdown
```dsh-media
{"path":"C:/example/demo.mp4","title":"演示视频"}
```
````

从 1.11.1 起，误写进 `dsh-media` 的 PNG、JPEG、WebP、GIF 也能兜底显示：路径必须与本会话交付记录完全匹配，按正文图片的尺寸左对齐显示，不读取未交付路径。常规 Markdown 图片仍由 DSH 原生展示。预览不放宽读取权限，也不执行文档内的 HTML。

该行为已在 DSH `0.2.2-rc.3` 的 Web 客户端验证：历史消息中的两张已交付 PNG 原位显示；未交付样例只显示提示；小图与原生 Markdown 图片左沿一致，不放大。

## 开发

运行 `npm ci --ignore-scripts`、`npm run build` 和 `npm test`。客户端从 `src/client.js` 构建为 `lib/client.js`；PDF.js 和 Markdown 解析器的第三方许可随包分发。

[更新日志](./CHANGELOG.md) · [问题反馈](https://github.com/AngleNaris/fanframe/issues)
