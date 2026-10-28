/**
 * 繁界（FanFrame）— client 半边。
 * Legacy DOM/effect labels remain stable for rollback; never enable fan-de-hai and fanframe together.
 *
 * 功能一：把 Codex 模型选择菜单恢复为不透明。
 * 成因：dsh-codex-subscription 接管了 `conversation.input.model`，
 * 它的 CodexModelSelect 菜单背景走了 `var(--dsw-specific-menu)`，
 * 在当前主题下呈半透明玻璃状，盖住了会话内容且文字发虚。
 * 修复：用更晚加载的 <style> 以更高优先级把菜单背景钉回
 * 下面小药丸背后的深色（跟随深浅色自动切换），并去掉 backdrop blur。
 * 只动 Codex 菜单三件套，不碰其他 UI；卸载本插件即恢复原状。
 *
 * 功能二：子智能体目录里，用每行子代理实际跑的模型代替标题下的摘要。
 * 官方渲染（@deepseek-ai/dsh-client-ui-subagent 的 subagent-catalog）：
 * 摘要 = [会话标题, 模式, 状态].join(" · ")，没有模型信息。
 * 本插件用 MutationObserver 等目录弹窗打开，按行读标题文本，
 * 到 sessions 快照的 subagentCatalog 里按标题找到 childSessionId
 * （标题重名则跳过、保留原摘要），再调导演桥
 * `/subagent-director` → `subagentModel` 查该子会话最后一次
 * request/header 事件里的 provider/model，写回摘要行，原摘要留 title。
 * 查不到就原样不动。纯 additive，不注册 slot，卸载即恢复。
 */
window.__ModuleLoader__.load({
  id: "fanframe",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var CSS = [
      "/* ====================================================================== */",
      "/* fan-de-hai: 1. 弹出菜单/浮层「背景不透明 + 出入动画」 */",
      "/* 只改这两件事：不加边框、不加阴影、不动任何布局容器（dockkit 的 */",
      "/* `_surface_`/`_material_` 是大容器，一旦上色就会变成关不掉的大面板）。 */",
      "/* ====================================================================== */",
      "/* 精确点名：Codex 模型菜单、通用菜单/列表浮层、使用统计信息面板、自建排序下拉 */",
      ".codexModelSelectMenu,",
      ".codexModelSelectSubmenu,",
      ".codexModelSelectGroupTitle,",
      "[role=\"menu\"],",
      "[role=\"listbox\"]:not(select):not(.fan-select-dropdown),",
      "[data-dsh-usage-glass=\"dialog\"],",
      "[data-dsh-usage-glass=\"tip\"],",
      "[data-fan-footer-panel],",
      ".fan-select-dropdown {",
      "  /* 把官方菜单材质令牌就地改成不透明实色（令牌只在浮层作用域内生效） */",
      "  --dsw-menu-surface-fill: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #22262c)) !important;",
      "  --dsw-specific-menu: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #22262c)) !important;",
      "  --dsw-menu-backdrop-filter: none !important;",
      "  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #22262c)) !important;",
      "  background-color: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #22262c)) !important;",
      "  backdrop-filter: none !important;",
      "  -webkit-backdrop-filter: none !important;",
      "  /* 出入动画：纯淡入淡出，零位移。分两条写，避免旧内核整条解析失败 */",
      "  transition: opacity 0.14s ease, display 0.14s allow-discrete;",
      "  transition-behavior: allow-discrete;",
      "}",
      "@starting-style {",
      "  .codexModelSelectMenu,",
      "  .codexModelSelectSubmenu,",
      "  [role=\"menu\"],",
      "  [role=\"listbox\"]:not(select):not(.fan-select-dropdown),",
      "  [data-dsh-usage-glass=\"dialog\"],",
      "  [data-dsh-usage-glass=\"tip\"],",
      "    .fan-never-match {",
      "    opacity: 0;",
      "  }",
      "}",
      ".codexModelSelectMenu .codexModelSelectGroups,",
      ".codexModelSelectSubmenu .codexModelSelectGroups {",
      "  background: transparent !important;",
      "}",
      "",
      "/* Footer popup surfaces only: no global dockkit material selectors. */",
      "[data-fan-footer-panel] { transition:none !important; }",
      "[data-fan-footer-panel][data-fan-footer-panel], [data-fan-footer-panel][data-fan-footer-panel]::before, [data-fan-footer-panel][data-fan-footer-panel]::after,",
      "[data-fan-footer-panel][data-fan-footer-panel] *, [data-fan-footer-panel][data-fan-footer-panel] *::before, [data-fan-footer-panel][data-fan-footer-panel] *::after {",
      "  backdrop-filter:none !important; -webkit-backdrop-filter:none !important;",
      "}",
      "[data-fan-footer-ghost], [data-fan-footer-ghost] * { pointer-events:none !important; }",
      "[data-composer-dock] button:focus, [data-fan-footer-panel]:focus, [data-fan-footer-panel] :focus { outline:none !important; }",
      "[data-composer-dock] button:focus-visible, [data-fan-footer-panel] :focus-visible { text-decoration:underline; text-underline-offset:3px; }",
      "",
      "/* Windows native sidebar: retain the React tree, reflow its existing seats. */",
      "[data-fan-sidebar-rail] { --fan-rail-width:52px; --fan-rail-gap:4px; --fan-rail-list-inset:-4px; --fan-rail-nav-offset:3px; display:grid !important; position:relative; min-width:0; grid-template-columns:var(--fan-rail-width) minmax(0,1fr); grid-template-rows:auto auto minmax(0,1fr); padding:6px 0 !important; animation:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-brand] { grid-column:2; grid-row:1; margin-left:var(--fan-rail-list-inset) !important; min-width:0; }",
      "[data-fan-rail-new] { grid-column:2; grid-row:2; margin-left:var(--fan-rail-list-inset) !important; margin-right:0 !important; min-width:0; }",
      "[data-fan-rail-browser] { grid-column:2; grid-row:3; margin-left:var(--fan-rail-list-inset) !important; margin-right:0 !important; padding-left:0 !important; min-width:0; min-height:0; }",
      "[data-fan-rail-workspaces] { --dsh-session-list-edge-inset:calc(var(--dsh-session-list-scrollbar-width,5px) + var(--dsh-session-list-scrollbar-offset,2px)) !important; }",
      "[data-fan-rail-nav], [data-fan-rail-actions], [data-fan-rail-settings] { grid-column:1; grid-row:1 / -1; box-sizing:border-box; display:flex !important; flex-direction:column; align-items:center; flex:none; gap:var(--fan-rail-gap) !important; width:var(--fan-rail-width) !important; margin:0 !important; min-width:0; min-height:0; animation:none !important; transition:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-nav] { align-self:start; padding:var(--fan-rail-nav-offset) 0 0 !important; max-height:var(--fan-rail-nav-limit,100%); overflow-y:auto; scrollbar-width:none; }",
      "[data-fan-rail-nav] > *, [data-fan-rail-actions] > * { flex-shrink:0; }",
      "[data-fan-rail-footer] { display:contents !important; animation:none !important; transition:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-actions] { align-self:start; margin-top:var(--fan-rail-actions-top,0px) !important; padding:0 !important; max-height:var(--fan-rail-actions-limit,100%); overflow-y:auto; scrollbar-width:none; }",
      "[data-fan-rail-settings] { align-self:end; padding:0 0 2px !important; }",
      "[data-fan-rail-actions] [data-fan-rail-popup] { left:var(--fan-rail-popup-left) !important; top:var(--fan-rail-popup-top) !important; bottom:auto !important; }",
      "[data-fan-rail-cluster] { display:flex !important; flex-direction:column; align-items:center; justify-content:center; gap:var(--fan-rail-gap) !important; width:var(--fan-rail-width) !important; height:auto !important; min-width:0; margin:0 !important; padding:0 !important; }",
      "[data-fan-rail-button] { position:relative; display:flex !important; align-items:center; justify-content:center; flex-shrink:0; width:36px !important; min-width:36px !important; max-width:36px !important; height:36px !important; min-height:36px !important; padding:0 !important; gap:0 !important; margin-left:auto !important; margin-right:auto !important; font-size:0 !important; white-space:nowrap; }",
      "[data-fan-rail-button] svg { width:18px; height:18px; flex-shrink:0; }",
      "[data-fan-rail-glyph] { display:inline-flex; justify-content:center; align-items:center; font-size:18px; }",
      "[data-fan-rail-label] { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip-path:inset(50%) !important; white-space:nowrap !important; }",
      "[data-fan-sidebar-rail] button:focus { outline:none !important; }",
      "[data-fan-sidebar-rail] button:focus-visible { text-decoration:underline; text-underline-offset:3px; }",
      "[data-fan-rail-button]:focus-visible::after { content:''; position:absolute; width:12px; height:2px; left:calc(50% - 6px); bottom:1px; background:currentColor; pointer-events:none; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] { grid-template-columns:52px var(--fan-rail-host-tail) !important; --dsh-windows-sidebar-width:52px !important; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] [data-fan-sidebar-rail] { width:52px !important; padding:6px 0 !important; grid-template-columns:52px 0; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] [data-fan-rail-new] { margin-left:0 !important; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] [data-fan-rail-browser] { display:none !important; }",
      "",
      "/* ====================================================================== */",
      "/* fan-de-hai: 2. 全局无圆角设计（Shadow 统一哥特直角） */",
      "/* ====================================================================== */",
      "*,",
      "*::before,",
      "*::after {",
      "  border-radius: 0 !important;",
      "}",
      ":root, :host, html, body {",
      "  --radius: 0px !important;",
      "  --border-radius: 0px !important;",
      "  --dsw-border-radius: 0px !important;",
      "  --dsw-border-radius-sm: 0px !important;",
      "  --dsw-border-radius-md: 0px !important;",
      "  --dsw-border-radius-lg: 0px !important;",
      "  --dsw-border-radius-xl: 0px !important;",
      "  --dsw-border-radius-full: 0px !important;",
      "  --dsw-alias-border-radius-pill: 0px !important;",
      "  --dsw-alias-border-radius-card: 0px !important;",
      "  --dsw-alias-border-radius-button: 0px !important;",
      "  --dsw-alias-border-radius-input: 0px !important;",
      "}",
      "::-webkit-scrollbar-thumb {",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* ====================================================================== */",
      "/* fan-de-hai: 3. 对话与 Markdown 非常规字符与结构低饱和染色 */",
      "/* ====================================================================== */",
      "/* 加粗文本：低饱和浅丁香紫 / 柔烟紫 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) strong,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) b,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"strong\"],",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"bold\"] {",
      "  color: #c3aee0 !important;",
      "  font-weight: 600 !important;",
      "}",
      "",
      "/* 总结与折叠摘要：低饱和雾霾冷蓝 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details > summary,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [data-disclosure-header],",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"summary\"] {",
      "  color: #9bb8d9 !important;",
      "  font-weight: 600 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary::marker,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary::-webkit-details-marker {",
      "  color: #92aedb !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary:hover,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details > summary:hover {",
      "  color: #abc5e3 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details {",
      "  border-left: 2px solid rgba(155, 184, 217, 0.4) !important;",
      "  padding-left: 0.75rem !important;",
      "  margin: 0.5rem 0 !important;",
      "}",
      "",
      "/* 列表样式与标记：低饱和暖杏黄 / 柔麦金 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) li::marker {",
      "  color: #d2b489 !important;",
      "  font-weight: 600 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) ul > li::marker {",
      "  color: #d2b489 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) ol > li::marker {",
      "  color: #d3bb92 !important;",
      "  font-weight: 600 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) li input[type=\"checkbox\"] {",
      "  accent-color: #916db0 !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 行内代码：【绿色换黄色】低饱和香槟麦黄文字 + 微暖衬底 + 直角边框 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) code:not(pre code),",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) :not(pre) > code {",
      "  color: #dfcd9a !important;",
      "  background: rgba(223, 205, 154, 0.1) !important;",
      "  border: 1px solid rgba(223, 205, 154, 0.28) !important;",
      "  padding: 0.12em 0.4em !important;",
      "  margin: 0 0.2em !important;",
      "  border-radius: 0 !important;",
      "  font-size: 0.88em !important;",
      "  font-family: Consolas, \"Fira Code\", Monaco, monospace !important;",
      "}",
      "",
      "/* 斜体文本：低饱和干枯玫瑰粉 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) em,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) i {",
      "  color: #dca8b9 !important;",
      "  font-style: italic !important;",
      "}",
      "",
      "/* 删除线文本：淡灰紫 + 低饱和灰暗红贯穿线 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) del,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) s,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) strike {",
      "  color: #8b949e !important;",
      "  text-decoration: line-through !important;",
      "  text-decoration-color: #cf8188 !important;",
      "}",
      "",
      "/* 块引用：低饱和暗紫边框 + 幽暗半透明背景 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) blockquote {",
      "  border-left: 3px solid #916db0 !important;",
      "  background: rgba(145, 109, 176, 0.08) !important;",
      "  padding: 0.6em 1em !important;",
      "  margin: 0.75em 0 !important;",
      "  color: #c3cbd8 !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 高亮文本：低饱和暖金光晕 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) mark {",
      "  background: rgba(217, 198, 140, 0.22) !important;",
      "  color: #d9c68c !important;",
      "  padding: 0.1em 0.3em !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 键盘键帽：方角机械按键风格 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) kbd {",
      "  color: #e0e4eb !important;",
      "  background: #21262d !important;",
      "  border: 1px solid #484f58 !important;",
      "  border-bottom: 2px solid #565f6c !important;",
      "  padding: 0.15em 0.45em !important;",
      "  font-size: 0.85em !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 标题层级：低饱和冷月蓝 / 灰薄荷青 / 淡紫烟灰 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h1 {",
      "  color: #b9c9df !important;",
      "  border-bottom: 1px solid rgba(185, 201, 223, 0.25) !important;",
      "  padding-bottom: 0.3em !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h2 {",
      "  color: #a4cccc !important;",
      "  border-bottom: 1px solid rgba(164, 204, 204, 0.2) !important;",
      "  padding-bottom: 0.25em !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h3 {",
      "  color: #cbb7e1 !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h4,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h5,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h6 {",
      "  color: #e0e4eb !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 水平分割线：低饱和暗紫细分界线 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) hr {",
      "  border: none !important;",
      "  border-top: 1px solid rgba(145, 109, 176, 0.3) !important;",
      "  margin: 1.5em 0 !important;",
      "}",
      "",
      "/* 表格直角与表头 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) table,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) th,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) td {",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) th {",
      "  background: rgba(145, 109, 176, 0.12) !important;",
      "  color: #cbb7e1 !important;",
      "}",
      "",
      "/* ====================================================================== */",
      "/* fan-de-hai: 4. 左侧会话列表标题明暗分层 */",
      "/* 正在执行与当前选中的对话保持正常高亮，其它对话标题变暗 */",
      "/* ====================================================================== */",
      "[class*=\"sessionRow\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])) [class*=\"title\"],",
      "[data-row-key^=\"session:\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])) [class*=\"title\"],",
      "[role=\"treeitem\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])) [class*=\"title\"] {",
      "  opacity: 0.75 !important;",
      "  transition: opacity 0.15s ease !important;",
      "}",
      "[class*=\"sessionRow\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])):hover [class*=\"title\"],",
      "[data-row-key^=\"session:\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])):hover [class*=\"title\"],",
      "[role=\"treeitem\"]:not([aria-selected=\"true\"]):not([class*=\"selected\"]):not(:has([data-state=\"ongoing\"])):not(:has([class*=\"spinner\"])):not(:has([data-running])):hover [class*=\"title\"] {",
      "  opacity: 1 !important;",
      "}",
      "[class*=\"sessionRow\"][aria-selected=\"true\"] [class*=\"title\"],",
      "[class*=\"sessionRow\"][class*=\"selected\"] [class*=\"title\"],",
      "[data-row-key^=\"session:\"][aria-selected=\"true\"] [class*=\"title\"],",
      "[data-row-key^=\"session:\"][class*=\"selected\"] [class*=\"title\"],",
      "[class*=\"sessionRow\"]:has([data-state=\"ongoing\"]) [class*=\"title\"],",
      "[class*=\"sessionRow\"]:has([class*=\"spinner\"]) [class*=\"title\"],",
      "[class*=\"sessionRow\"]:has([data-running]) [class*=\"title\"],",
      "[data-row-key^=\"session:\"]:has([data-state=\"ongoing\"]) [class*=\"title\"],",
      "[data-row-key^=\"session:\"]:has([class*=\"spinner\"]) [class*=\"title\"],",
      "[data-row-key^=\"session:\"]:has([data-running]) [class*=\"title\"] {",
      "  opacity: 1 !important;",
      "  color: var(--dsw-alias-label-primary, #ffffff) !important;",
      "}",
      "",
      "/* ====================================================================== */",
      "/* fan-de-hai: 5. 插件管理器工具条（按 KFL 法则：对齐/契约/矢量图标/无外框） */",
      "/* ====================================================================== */",
      ".fan-plugin-toolbar {",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  gap: 12px !important;",
      "  margin: 10px 0 16px 0 !important;",
      "  padding: 8px 12px !important;",
      "  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.04)) !important;",
      "  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12)) !important;",
      "  border-radius: 0 !important;",
      "  box-sizing: border-box !important;",
      "  flex-wrap: wrap !important;",
      "}",
      ".fan-search-wrap {",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  flex: 1 1 220px !important;",
      "  min-width: 0 !important;",
      "  position: relative !important;",
      "  background: var(--dsw-alias-bg-base, #1c1f24) !important;",
      "  border: 1px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.18)) !important;",
      "  border-radius: 0 !important;",
      "  padding: 0 8px !important;",
      "  height: 32px !important;",
      "  box-sizing: border-box !important;",
      "  transition: border-color 0.15s ease, background-color 0.15s ease !important;",
      "}",
      "/* KFL 禁令：严禁使用 box-shadow ring 伪造外框，聚焦通过结构边框色变与微对比提供反馈 */",
      ".fan-search-wrap:focus-within {",
      "  border-color: #916db0 !important;",
      "  background: rgba(255, 255, 255, 0.03) !important;",
      "}",
      ".fan-search-icon {",
      "  width: 14px !important;",
      "  height: 14px !important;",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "  margin-right: 8px !important;",
      "  flex: none !important;",
      "  display: block !important;",
      "}",
      ".fan-search-input {",
      "  flex: 1 !important;",
      "  min-width: 0 !important;",
      "  background: transparent !important;",
      "  border: none !important;",
      "  outline: none !important;",
      "  color: var(--dsw-alias-label-primary, #e6edf3) !important;",
      "  font-size: 13px !important;",
      "  line-height: 20px !important;",
      "  padding: 0 !important;",
      "  border-radius: 0 !important;",
      "}",
      ".fan-search-input::placeholder {",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "}",
      ".fan-search-clear {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "  cursor: pointer !important;",
      "  width: 22px !important;",
      "  height: 22px !important;",
      "  padding: 0 !important;",
      "  margin: 0 -2px 0 4px !important;",
      "  display: inline-flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  border-radius: 0 !important;",
      "  flex: none !important;",
      "  transition: color 0.12s ease !important;",
      "}",
      ".fan-search-clear:hover {",
      "  color: var(--dsw-alias-label-primary, #ffffff) !important;",
      "}",
      ".fan-search-clear svg {",
      "  width: 12px !important;",
      "  height: 12px !important;",
      "  display: block !important;",
      "}",
      ".fan-sort-wrap {",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  gap: 8px !important;",
      "  flex: 0 0 auto !important;",
      "}",
      ".fan-sort-label {",
      "  font-size: 12px !important;",
      "  color: var(--dsw-alias-label-tertiary, #a0a6b2) !important;",
      "  user-select: none !important;",
      "  white-space: nowrap !important;",
      "}",
      ".fan-custom-select {",
      "  position: relative !important;",
      "  display: inline-flex !important;",
      "  align-items: center !important;",
      "  user-select: none !important;",
      "}",
      ".fan-select-trigger {",
      "  height: 32px !important;",
      "  background: var(--dsw-alias-bg-base, #1c1f24) !important;",
      "  border: 1px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.18)) !important;",
      "  color: var(--dsw-alias-label-primary, #e6edf3) !important;",
      "  font-size: 12px !important;",
      "  padding: 0 10px !important;",
      "  border-radius: 0 !important;",
      "  outline: none !important;",
      "  cursor: pointer !important;",
      "  display: inline-flex !important;",
      "  align-items: center !important;",
      "  justify-content: space-between !important;",
      "  gap: 8px !important;",
      "  min-width: 140px !important;",
      "  transition: border-color 0.15s ease, background-color 0.15s ease !important;",
      "}",
      ".fan-select-trigger:hover {",
      "  border-color: rgba(255, 255, 255, 0.3) !important;",
      "}",
      ".fan-select-trigger:focus-visible,",
      ".fan-custom-select[data-open=\"true\"] .fan-select-trigger {",
      "  border-color: #916db0 !important;",
      "  background: rgba(255, 255, 255, 0.03) !important;",
      "}",
      ".fan-select-arrow {",
      "  width: 10px !important;",
      "  height: 10px !important;",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "  flex: none !important;",
      "  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;",
      "}",
      ".fan-custom-select[data-open=\"true\"] .fan-select-arrow {",
      "  transform: rotate(180deg) !important;",
      "}",
      ".fan-select-dropdown {",
      "  position: absolute !important;",
      "  top: calc(100% + 4px) !important;",
      "  right: 0 !important;",
      "  min-width: 160px !important;",
      "  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14)) !important;",
      "  border-radius: 0 !important;",
      "  z-index: 1000 !important;",
      "  padding: 4px 0 !important;",
      "  box-sizing: border-box !important;",
      "}",
      ".fan-select-option {",
      "  height: 30px !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: space-between !important;",
      "  padding: 0 12px !important;",
      "  font-size: 12px !important;",
      "  color: var(--dsw-alias-label-primary, #d8dee9) !important;",
      "  cursor: pointer !important;",
      "  border-radius: 0 !important;",
      "  transition: background-color 0.12s ease, color 0.12s ease !important;",
      "}",
      ".fan-select-option:hover {",
      "  background: rgba(255, 255, 255, 0.06) !important;",
      "  color: #ffffff !important;",
      "}",
      ".fan-select-option[data-selected=\"true\"] {",
      "  background: rgba(145, 109, 176, 0.18) !important;",
      "  color: #e6edf3 !important;",
      "  font-weight: 500 !important;",
      "}",
      ".fan-option-check {",
      "  width: 12px !important;",
      "  height: 12px !important;",
      "  color: #cbb7e1 !important;",
      "  flex: none !important;",
      "  transition: opacity 0.12s ease !important;",
      "}",
      ".fan-count-badge {",
      "  font-size: 12px !important;",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "  margin-left: auto !important;",
      "  user-select: none !important;",
      "  white-space: nowrap !important;",
      "  flex: 0 0 auto !important;",
      "}",
      ".fan-no-match-tip {",
      "  padding: 36px 0 !important;",
      "  text-align: center !important;",
      "  color: var(--dsw-alias-label-tertiary, #858d98) !important;",
      "  font-size: 13px !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "",
      "/* Owned controls: non-outline keyboard cues, no global transitions. */",
      ".fan-plugin-toolbar [hidden], .fan-no-match-tip[hidden] { display:none !important; }",
      ".fan-plugin-toolbar :focus { outline:none !important; }",
      ".fan-search-input:focus-visible { text-decoration:underline; text-underline-offset:4px; }",
      ".fan-select-trigger:focus-visible .fan-select-value { text-decoration:underline; text-underline-offset:4px; }",
      ".fan-search-clear:focus-visible { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2,#34313c) !important; }",
      ".fan-select-option[data-active=\"true\"] { text-decoration:underline; text-underline-offset:4px; background:var(--dsw-alias-bg-layer-2,#34313c) !important; }",
      ".fan-select-dropdown { transition:none; }",
      "[role=\"menu\"][hidden], [data-dsh-usage-glass][hidden] { opacity:0; }",
      "/* In-flow disclosure focus stays visible without an operation frame. */",
      " :is([data-slot^=\"conversation.chat\"], [data-chat-flow]) :is([data-disclosure-row], [data-json-expander], [data-sample=\"bash\"][role=\"button\"], button[aria-expanded], details > summary):focus { outline:none !important; }",
      " :is([data-slot^=\"conversation.chat\"], [data-chat-flow]) :is([data-disclosure-row], [data-json-expander], [data-sample=\"bash\"][role=\"button\"], button[aria-expanded], details > summary):focus-visible { text-decoration:underline; text-underline-offset:3px; }",
      "@media(prefers-reduced-motion:reduce) {",

      "  .fan-plugin-toolbar *, .codexModelSelectMenu, .codexModelSelectSubmenu,",
      "  [role=\"menu\"], [data-dsh-usage-glass=\"dialog\"], [data-dsh-usage-glass=\"tip\"] { transition:none !important; }",
      "}",
      ""
    ].join("\n");

    var SUBAGENT_CSS_PLUGIN = "@deepseek-ai/dsh-client-ui-subagent";
    var RPC_CHANNEL = "/subagent-director";
    var RPC_MODEL = "subagentModel";
    var STAMP = "fanDeHaiModel";

    var inject = [];

    function sessionsOf(ctx) {
      try {
        var sessions = (ctx.get && ctx.get("sessions")) || ctx.sessions;
        if (!sessions || !sessions.list) return null;
        return sessions;
      } catch (err) {
        return null;
      }
    }

    function snapshotOf(ctx) {
      try {
        var sessions = sessionsOf(ctx);
        if (!sessions) return null;
        return sessions.list.getSnapshot();
      } catch (err) {
        return null;
      }
    }

    // 从官方子智能体样式里反解出当前构建的 CSS-module 类名，
    // 避免把 C3WkYW_ 这类构建哈希写死（DSH 一升级哈希就变）。
    function discoverClasses() {
      var found = {};
      try {
        var tags = document.querySelectorAll('style[data-plugin="' + SUBAGENT_CSS_PLUGIN + '"]');
        for (var i = 0; i < tags.length; i++) {
          var text = tags[i].textContent || "";
          ["menu", "row", "label", "summary"].forEach(function (name) {
            if (found[name]) return;
            var m = text.match(new RegExp("\\.([A-Za-z0-9]+_" + name + ")(?![A-Za-z0-9_-])"));
            if (m) found[name] = m[1];
          });
        }
      } catch (err) {}
      return found.row && found.summary ? found : null;
    }

    // 把全部分类目录按标题摊平：标题文本 -> childSessionId 数组。
    function catalogByLabel(snap) {
      var map = {};
      try {
        var proj = (snap && snap.projectionsBySession) || {};
        Object.keys(proj).forEach(function (pid) {
          var values = proj[pid] && proj[pid].values;
          var cat = values && values.subagentCatalog;
          if (!Array.isArray(cat)) return;
          cat.forEach(function (entry) {
            if (!entry || entry.id === void 0) return;
            var label = entry.label !== void 0 && entry.label !== null ? entry.label : entry.id;
            if (!map[label]) map[label] = [];
            if (map[label].indexOf(entry.id) === -1) map[label].push(entry.id);
          });
        });
      } catch (err) {}
      return map;
    }

    function callModel(ctx, childId) {
      return Promise.resolve().then(function () {
        var connection = (ctx.get && ctx.get("connection")) || ctx.connection;
        if (!connection || !connection.rpc || typeof connection.rpc.call !== "function") {
          throw new Error("fan-de-hai: no connection rpc");
        }
        return connection.rpc.call(RPC_CHANNEL, RPC_MODEL, { sessionId: childId });
      });
    }

    function textOf(el) {
      return el ? (el.textContent || "").trim() : "";
    }

    // Observe only mounted feature roots. Body observation discovers roots, never
    // rescans/reorders feature data in response to unrelated streaming text.
    function watchRoots(selector, mount, discoverParent) {
      var roots = new Map();
      function add(node) {
        if (node.nodeType !== 1) return;
        function attach(el) {
          if (!roots.has(el)) { var dispose = mount(el); if (typeof dispose === 'function') roots.set(el, dispose); }
        }
        if (node.matches(selector)) attach(node);
        node.querySelectorAll(selector).forEach(attach);
      }
      add(document.body);
      var observer = new MutationObserver(function (records) {
        var removed = false;
        records.forEach(function (r) {
          r.addedNodes.forEach(add);
          // A :has(> header) shell can become eligible in a later React commit.
          // Check only the mutation's direct parent, never rescan mounted roots.
          if (discoverParent && r.target.nodeType === 1 && !roots.has(r.target) && r.target.matches(selector)) add(r.target);
          if (r.removedNodes.length) removed = true;
        });
        if (removed) roots.forEach(function (dispose, el) {
          if (!el.isConnected) { dispose(); roots.delete(el); }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return function () {
        observer.disconnect();
        roots.forEach(function (dispose) { dispose(); });
        roots.clear();
      };
    }

    // Restore only properties still bearing our last write; never overwrite a
    // later host update. Values and priorities (including !important) survive.
    function ownStyles(el) {
      var saved = new Map();
      return {
        set: function (key, value, priority) {
          priority = priority || "";
          var old = saved.get(key);
          if (!old) {
            old = { value: el.style.getPropertyValue(key), priority: el.style.getPropertyPriority(key) };
            saved.set(key, old);
          }
          if (el.style.getPropertyValue(key) !== value || el.style.getPropertyPriority(key) !== priority)
            el.style.setProperty(key, value, priority);
          old.last = el.style.getPropertyValue(key);
          old.lastPriority = el.style.getPropertyPriority(key);
        },
        restore: function () {
          saved.forEach(function (old, key) {
            if (el.style.getPropertyValue(key) === old.last && el.style.getPropertyPriority(key) === old.lastPriority) {
              if (old.value) el.style.setProperty(key, old.value, old.priority);
              else el.style.removeProperty(key);
            }
          });
          saved.clear();
        }
      };
    }

    function ownAttrs(el) {
      var saved = new Map();
      return {
        set: function (key, value) {
          var old = saved.get(key); if (!old) { old = {value:el.getAttribute(key)}; saved.set(key,old); }
          if (el.getAttribute(key) !== value) { if (value === null) el.removeAttribute(key); else el.setAttribute(key,value); }
          old.last = value;
        },
        restore: function () { saved.forEach(function (old,key) { if (el.getAttribute(key) === old.last) { if (old.value === null) el.removeAttribute(key); else el.setAttribute(key,old.value); } }); saved.clear(); }
      };
    }
    // A selected, installed CSS Module only; never match global dockkit hashes.
    function nativeClass(sheetId, local) {
      var sheet = document.querySelector('style[data-plugin-css="' + sheetId + '"]');
      var found = sheet && sheet.textContent.match(new RegExp('\\.([\\w-]+_' + local + ')(?![\\w-])'));
      return found ? found[1] : null;
    }

    function apply(ctx) {
      ctx.effect(function () {
        var style = document.createElement("style");
        style.dataset.plugin = "fan-de-hai";
        style.dataset.version = "1.10.0-beta.1";
        style.textContent = CSS;
        document.head.appendChild(style);
        return function () { style.remove(); };
      }, "fan-de-hai: opaque-model-select");

      // Selected information/navigation popups are removed on close. Never
      // delay that removal: only an inert, identity-free paint copy may fade out.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), disposed = false, serial = 0;
        var mounted = new Set(), ghosts = new Map();
        var marker = 'data-fan-footer-panel', ghostMarker = 'data-fan-footer-ghost', accountIntent = null;
        function ownedClass(root,sheet,local) { var name = nativeClass(sheet,local); return name && root.classList.contains(name); }
        function kind(root) {
          if (root.querySelector(':scope > [data-session-stats-details]')) return 'activity';
          if (root.querySelector(':scope > [data-session-stats-usage]')) return 'usage';
          if (root.matches('[data-dsh-usage-glass="dialog"]')) return 'usage-addon';
          if (root.matches('[data-team-panel][role="dialog"]')) return 'team';
          if (root.matches('[data-cordis-panel]')) return 'mcp';
          if (root.matches('[role="tooltip"]') && root.closest('[data-composer-dock]')) return 'tip';
          if (root.matches('[role="tooltip"]') && root.closest('[data-fan-rail-nav],[data-fan-rail-footer]')) return 'rail-tip';
          // Exact owned CSS Modules, never hash guesses or global material/panel
          // wildcards. The catalog's floating OUTER box, not its inner tree.
          if (ownedClass(root,'@deepseek-ai/dsh-client-ui-subagent/SubagentHeaderLineage.module.css','menu') && root.querySelector(':scope > [role="tree"]')) return 'catalog';
          if (root.matches('[role="menu"]')) {
            if (root.parentElement && root.parentElement.closest('['+marker+']')) return null;
            if (ownedClass(root,'@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css','moreMenu')) return 'sidebar-more';
            var item = nativeClass('@deepseek-ai/dsh-client-ui-agent-preset/AgentPresetSeat.module.css','item');
            if (item && root.getElementsByClassName(item).length) return 'preset-picker';
            if (ownedClass(root,'@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','signedOutMenu')) return 'account';
            // Signed-in AccountMenu supplies no unique list class/ARIA linkage.
            // Associate only a fresh native trigger intent + its true open state.
            // Observe, never prevent/replay input or change React's open state.
            if (root.matches('[data-menu-material="translucent"]') && accountIntent && (!accountIntent.menu || accountIntent.menu === root) && accountIntent.trigger.isConnected &&
              performance.now()-accountIntent.at < 1500 && accountIntent.trigger.getAttribute('aria-expanded') === 'true') { accountIntent.menu = root; return 'account'; }
          }
          return ownedClass(root,'@deepseek-ai/dsh-client-ui-conversation/ContextMeter.module.css','panel') ? 'context' : null;
        }
        function progress(animation) {
          var p = animation.effect.getComputedTiming().progress;
          return typeof p === 'number' ? p : animation.playState === 'finished' ? 1 : 0;
        }
        function stopEntry(state) { if (state.entry) { var a = state.entry; state.entry = null; a.cancel(); } }
        function removeGhost(key) {
          var job = ghosts.get(key); if (!job) return;
          ghosts.delete(key); job.animation.cancel(); job.node.remove();
        }
        function opacity(state) { return state.entry ? state.entryFrom + (state.opacity - state.entryFrom) * progress(state.entry) : state.opacity; }
        function snapshot(state) {
          var root = state.root, css = getComputedStyle(root), rect = root.getBoundingClientRect();
          if (root.hidden || css.display === 'none' || css.visibility === 'hidden' || !rect.width || !rect.height) return false;
          state.rect = {left:rect.left, top:rect.top, width:rect.width, height:rect.height};
          state.display = css.display; state.font = css.font; state.color = css.color; state.z = css.zIndex;
          if (!state.entry) state.opacity = Number.isFinite(parseFloat(css.opacity)) ? parseFloat(css.opacity) : 1;
          state.key = state.kind + ':' + Math.round(rect.left);
          return true;
        }
        function paintCopy(root) {
          var copy = root.cloneNode(true), nodes = [copy].concat(Array.from(copy.querySelectorAll('*'))), ids = new Map();
          var prefix = 'fan-footer-paint-' + (++serial) + '-';
          nodes.forEach(function (el, i) { if (el.id) { ids.set(el.id, prefix + i); el.id = prefix + i; } });
          nodes.forEach(function (el) {
            Array.from(el.attributes).forEach(function (attr) {
              var name = attr.name;
              // Retain only presentation data needed by tooltip alignment.
              if (/^(?:aria-|on)/.test(name) || /^(?:role|tabindex|autofocus|name|for|popover|hidden)$/.test(name) ||
                (name.indexOf('data-') === 0 && !/^(?:data-side|data-align|data-has-shortcut)$/.test(name))) el.removeAttribute(name);
              else if (attr.value.indexOf('#') !== -1) {
                var value = attr.value.replace(/url\(["']?#([^\s)"']+)["']?\)/g, function (all, id) { return ids.has(id) ? 'url(#' + ids.get(id) + ')' : all; });
                if ((name === 'href' || name === 'xlink:href') && value[0] === '#' && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
                if (value !== attr.value) el.setAttribute(name, value);
              }
            });
          });
          copy.querySelectorAll('script,style').forEach(function (el) { el.remove(); });
          copy.removeAttribute('id'); copy.setAttribute(marker, ''); copy.setAttribute(ghostMarker, '');
          copy.setAttribute('aria-hidden', 'true'); copy.inert = true;
          return copy;
        }
        function leave(state) {
          var from = opacity(state); stopEntry(state);
          if (disposed || media.matches || !state.rect || from < 0.01 || !state.root.animate) return;
          removeGhost(state.key);
          var copy = paintCopy(state.root), rect = state.rect, key = state.key;
          var values = {position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',
            'box-sizing':'border-box',margin:'0',transform:'none',translate:'none',rotate:'none',scale:'none',
            visibility:'visible',display:state.display,'z-index':state.z,font:state.font,color:state.color,'pointer-events':'none'};
          Object.keys(values).forEach(function (name) { if (values[name]) copy.style.setProperty(name, values[name], 'important'); });
          document.body.appendChild(copy);
          try {
            var a = copy.animate([{opacity:from},{opacity:0}], {duration:140,easing:'ease',fill:'both'});
            var job = {node:copy,animation:a,from:from}; ghosts.set(key,job);
            a.finished.then(function () { if (ghosts.get(key) === job) removeGhost(key); }, function () { if (ghosts.get(key) === job) removeGhost(key); });
          } catch (_) { copy.remove(); }
        }
        function refresh(state) {
          if (disposed || !state.root.isConnected) return;
          if (!snapshot(state)) { if (state.visible) { state.visible = false; leave(state); } return; }
          if (state.visible) return;
          state.visible = true;
          var prior = ghosts.get(state.key), from = prior ? prior.from * (1 - progress(prior.animation)) : 0;
          removeGhost(state.key);
          if (media.matches || !state.root.animate || Math.abs(state.opacity - from) < 0.01) return;
          try {
            var a = state.root.animate([{opacity:from},{opacity:state.opacity}], {duration:140,easing:'ease',fill:'both'});
            state.entryFrom = from; state.entry = a;
            a.finished.then(function () { if (state.entry === a) stopEntry(state); }, function () { if (state.entry === a) stopEntry(state); });
          } catch (_) {}
        }
        var unwatch = watchRoots('[role="dialog"], [role="menu"], [role="tooltip"], [data-dsh-usage-glass="dialog"], [data-cordis-panel], div:has(> [role="tree"])', function (root) {
          var type = kind(root); if (!type || root.closest('[' + ghostMarker + ']')) return null;
          var oldMarker = root.getAttribute(marker), styles = ownStyles(root);
          root.setAttribute(marker, '');
          // Inline important beats the optional glass registry's late styles.
          // Relative color also makes an alpha-valued theme token truly opaque.
          styles.set('background', 'var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#22262c))', 'important');
          if (window.CSS && window.CSS.supports('background', 'rgb(from #22262c r g b / 1)')) styles.set('background', 'rgb(from var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#22262c)) r g b / 1)', 'important');
          styles.set('backdrop-filter','none','important'); styles.set('-webkit-backdrop-filter','none','important');
          styles.set('--dsw-menu-backdrop-filter','none','important');
          var state = {root:root,kind:type,visible:false,entry:null,opacity:1}; mounted.add(state);
          var observer = new MutationObserver(function () { refresh(state); });
          observer.observe(root,{attributes:true,attributeFilter:['style','class','hidden'],childList:true,subtree:true});
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { refresh(state); }) : null;
          if (resize) resize.observe(root);
          refresh(state);
          return function () {
            observer.disconnect(); if (resize) resize.disconnect();
            if (state.visible) leave(state); else stopEntry(state);
            mounted.delete(state); styles.restore();
            if (root.getAttribute(marker) === '') { if (oldMarker === null) root.removeAttribute(marker); else root.setAttribute(marker,oldMarker); }
          };
        }, true);
        function capture(event) {
          if (event && (event.type === 'click' || event.type === 'pointerdown' || (event.type === 'keydown' && /^(Enter| |ArrowDown)$/.test(event.key)))) {
            var target = event.target && event.target.nodeType === 1 ? event.target : null;
            var trigger = target && target.closest('button[aria-haspopup="menu"]');
            var name = nativeClass('@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','trigger');
            if (trigger && name && trigger.classList.contains(name) && trigger.closest('[data-slot="sidebar.settings"]')) accountIntent = {trigger:trigger,at:performance.now()};
          }
          mounted.forEach(function (state) { if (state.root.isConnected && state.visible) snapshot(state); });
        }
        function settle() { mounted.forEach(stopEntry); Array.from(ghosts.keys()).forEach(removeGhost); }
        function reduced() { if (media.matches) settle(); }
        function visibility() { if (document.hidden) settle(); }
        // Passive observation only: no preventDefault, focus, replay or scroll writes.
        ['pointerdown','click','keydown','scroll'].forEach(function (event) { document.addEventListener(event,capture,true); });
        window.addEventListener('resize',capture); document.addEventListener('visibilitychange',visibility); media.addEventListener('change',reduced);
        return function () {
          disposed = true; accountIntent = null; unwatch(); settle();
          ['pointerdown','click','keydown','scroll'].forEach(function (event) { document.removeEventListener(event,capture,true); });
          window.removeEventListener('resize',capture); document.removeEventListener('visibilitychange',visibility); media.removeEventListener('change',reduced);
        };
      }, 'fan-de-hai: footer-popup-motion');

      // 0.2.1-rc.3 structural adapter, not a replacement sidebar registrant.
      // Native actions, locale, pins, slot ownership and React nodes stay put.
      ctx.effect(function () {
        var controllers = new Set(), disposed = false;
        var sidebarSheet = '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css';
        var frameSheet = '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css';
        var workspaceSheet = '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css';
        function columns(frame) {
          // Preserve the original right track verbatim. No root-store writes,
          // actual grid-template overwrite or feedback into the native resizer.
          return frame.style.gridTemplateColumns.match(/^([\d.]+)px\s+minmax\(([\d.]+)px,\s*1fr\)\s+(minmax\(0px,\s*[\d.]+px\))$/);
        }
        function mount(slot) {
          var root = null, frame = null, nav = null, foot = null, parts = null, localClosed = false;
          var required = ['logoRow','newSession','panelList','regionArea','footArea','footerActions','settingsArea'];
          function valid() {
            var rootClass = nativeClass(sidebarSheet,'root'), frameClass = nativeClass(frameSheet,'frame'), colClass = nativeClass(frameSheet,'sidebarCol');
            return root && root.isConnected && rootClass && frameClass && colClass && root.classList.contains(rootClass) &&
              frame.classList.contains(frameClass) && slot.parentElement && slot.parentElement.classList.contains(colClass) && slot.parentElement.parentElement === frame &&
              required.every(function (key) { var name = nativeClass(sidebarSheet,key), el = parts[key]; return name && el && root.contains(el) && el.classList.contains(name); }) &&
              nav.tagName === 'NAV' && parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]') && foot.contains(parts.settingsArea) && foot.contains(parts.footerActions) &&
              parts.settingsArea.querySelector('[data-slot="sidebar.settings"]') && parts.footerActions.querySelector('[data-slot="sidebar.footer.action"]');
          }
          var marks = new Map(), buttons = new Map(), labels = new Map(), popups = new Map(), frameStyles = null, frameObserver = null, rootStyles = null, railObserver = null;
          function mark(el, name) { if (!el) return; var owned = marks.get(el); if (!owned) { owned = ownAttrs(el); marks.set(el,owned); } owned.set(name,''); }
          function end() {
            if (railObserver) railObserver.disconnect(); railObserver = null;
            if (parts) parts.footerActions.removeEventListener('scroll',syncPopups);
            popups.forEach(function (v) { v.attrs.restore(); v.styles.restore(); });
            if (rootStyles) rootStyles.restore(); rootStyles = null;
            if (frameObserver) frameObserver.disconnect(); frameObserver = null;
            buttons.forEach(function (v) { v.attrs.restore(); }); buttons.clear();
            labels.forEach(function (v) { v.restore(); }); labels.clear();
            marks.forEach(function (v) { v.restore(); }); marks.clear();
            if (frameStyles) frameStyles.restore(); frameStyles = null;
            // Native Cordis samples its upward anchor only on open/resize.
            // After returning its owner to the native footer, restore that
            // geometry without closing it, changing React state or fake input.
            popups.forEach(function (v,panel) { if (panel.isConnected && v.layer.isConnected && v.layer.contains(panel)) {
              var rect = v.layer.getBoundingClientRect(); if (rect.width) { panel.style.left = rect.left+'px'; panel.style.bottom = (innerHeight-rect.top+8)+'px'; }
            } }); popups.clear();
            root = frame = nav = foot = parts = null;
          }
          function syncFrame() {
            if (!frame) return false;
            var tracks = columns(frame);
            if (!tracks || !document.documentElement.hasAttribute('data-windows-titlebar')) { end(); return false; }
            var delta = frame.hasAttribute('data-sidebar-collapsed') ? Math.max(0,52 - Number(tracks[1])) : 0;
            // When the formerly-zero track gains 52px, only the conversation
            // minimum gives up those 52px. Keep the right pane's native track.
            frameStyles.set('--fan-rail-host-tail', 'minmax(' + Math.max(0,Number(tracks[2])-delta) + 'px, 1fr) ' + tracks[3]);
            return true;
          }
          function syncPopups() {
            if (!root || !rootStyles) return;
            var sheet = '@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css', panelClass = nativeClass(sheet,'panel'), layerClass = nativeClass(sheet,'layer'), next = new Set();
            if (panelClass && layerClass) parts.footerActions.querySelectorAll('[data-cordis-panel]').forEach(function (panel) {
              var layer = panel.closest('.'+layerClass);
              if (!panel.classList.contains(panelClass) || !layer || !parts.footerActions.contains(layer) || !panel.getClientRects().length) return;
              next.add(panel); var state = popups.get(panel);
              if (!state) { state = {layer:layer,attrs:ownAttrs(panel),styles:ownStyles(panel)}; popups.set(panel,state); railObserver.observe(panel); }
              var anchor = layer.getBoundingClientRect(), box = panel.getBoundingClientRect();
              var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-chrome-top')) || 0, edge = chrome+8;
              state.styles.set('--fan-rail-popup-left',Math.max(12,Math.min(anchor.right+8,innerWidth-box.width-12))+'px');
              state.styles.set('--fan-rail-popup-top',Math.max(edge,Math.min(anchor.top,innerHeight-box.height-12))+'px');
              state.attrs.set('data-fan-rail-popup','');
            });
            popups.forEach(function (v,panel) { if (!next.has(panel)) { railObserver.unobserve(panel); v.attrs.restore(); v.styles.restore(); popups.delete(panel); } });
          }
          function syncRail() {
            // Independent first-column stacks: list rows and native wide/rail
            // animations cannot move global buttons. No React reparenting.
            var caption = document.querySelector('[data-windows-menu]');
            var menu = caption && caption.shadowRoot && caption.shadowRoot.querySelector('[role="menubar"] > button[role="menuitem"]');
            var style = getComputedStyle(root), gap = Number.parseFloat(style.getPropertyValue('--fan-rail-gap')) || 4;
            if (!frame.hasAttribute('data-sidebar-collapsed')) {
              if (menu && menu.getClientRects().length) {
                // Align to the hover box, not its inset text. The -4px inset
                // uses empty rail space; the 36px controls still end at x44.
                var box = menu.getBoundingClientRect(), inset = box.left - root.getBoundingClientRect().left - 52;
                if (box.width && Number.isFinite(inset) && inset >= -8 && inset <= 64) rootStyles.set('--fan-rail-list-inset',inset.toFixed(3)+'px');
              }
              var markClass = nativeClass(sidebarSheet,'brandMark'), logo = markClass && parts.logoRow.getElementsByClassName(markClass)[0], first = nav.querySelector('[data-fan-rail-button]');
              if (logo && first && logo.getClientRects().length) {
                var logoBox = logo.getBoundingClientRect(), offset = logoBox.top + logoBox.height/2 - root.getBoundingClientRect().top - parseFloat(style.paddingTop) - first.getBoundingClientRect().height/2;
                if (logoBox.height && Number.isFinite(offset) && offset >= 0 && offset <= 32) rootStyles.set('--fan-rail-nav-offset',offset.toFixed(3)+'px');
              }
            }
            var available = Math.max(0,root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parts.settingsArea.getBoundingClientRect().height - 8);
            var navNatural = nav.scrollHeight, actionsNatural = parts.footerActions.scrollHeight, between = actionsNatural ? gap : 0;
            var navLimit = navNatural + between + actionsNatural <= available ? navNatural : Math.min(navNatural,Math.max(42,available - Math.min(actionsNatural,available/2) - between));
            rootStyles.set('--fan-rail-nav-limit',navLimit+'px');
            rootStyles.set('--fan-rail-actions-top',(navLimit+between)+'px');
            rootStyles.set('--fan-rail-actions-limit',Math.max(0,available-navLimit-between)+'px');
            syncPopups();
          }
          function syncControls() {
            if (!root) return;
            if (!valid()) { end(); start(); return; }
            if (!syncFrame()) return;
            var next = new Set(), nextLabels = new Set(), expanded = !frame.hasAttribute('data-sidebar-collapsed');
            [nav,parts.footerActions,parts.settingsArea].forEach(function (area) {
              area.querySelectorAll('button').forEach(function (button) {
                if (button.closest('[role="menu"],[role="dialog"],[role="listbox"],[data-cordis-panel]')) return;
                next.add(button); var record = buttons.get(button);
                if (!record) { record = {attrs:ownAttrs(button),title:button.getAttribute('title')}; buttons.set(button,record); }
                record.attrs.set('data-fan-rail-button','');
                // wide=true disables the shipped nav Tooltip. A genuine native
                // title restores its help without manufacturing another menu.
                var accountTrigger = nativeClass('@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','trigger');
                var footerHelp = area === parts.footerActions || (accountTrigger && button.classList.contains(accountTrigger));
                var help = button.getAttribute('aria-label') || button.textContent.replace(/\s+/g,' ').trim();
                if (!record.title && help && (area === nav || footerHelp)) record.attrs.set('title',expanded || footerHelp ? help : record.title);
              });
            });
            buttons.forEach(function (record,button) { if (!next.has(button)) { record.attrs.restore(); buttons.delete(button); } });
            [['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','layer'],['@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css','triggerRow']].forEach(function (spec) {
              var name = nativeClass(spec[0],spec[1]); if (name) Array.from(foot.getElementsByClassName(name)).forEach(function (group) { mark(group,'data-fan-rail-cluster'); });
            });
            var labelSpecs = [[sidebarSheet,'panelTitle'],['@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','label'],['@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css','triggerLabel'],
              ['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','badgeLabel'],['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','badgeCount']];
            labelSpecs.forEach(function (spec) {
              var name = nativeClass(spec[0],spec[1]); if (!name) return;
              [nav,foot].forEach(function (area) { Array.from(area.getElementsByClassName(name)).forEach(function (label) {
                if (label.closest('[role="menu"],[role="dialog"],[role="listbox"],[data-cordis-panel]')) return;
                nextLabels.add(label); var attrs = labels.get(label); if (!attrs) { attrs = ownAttrs(label); labels.set(label,attrs); } attrs.set('data-fan-rail-label','');
              }); });
            });
            labels.forEach(function (attrs,label) { if (!nextLabels.has(label)) { attrs.restore(); labels.delete(label); } });
            var workspaceClass = nativeClass(workspaceSheet,'root'), workspaces = new Set();
            if (workspaceClass) Array.from(parts.regionArea.getElementsByClassName(workspaceClass)).forEach(function (el) {
              if (el.closest('[data-slot="sidebar.workspaces"]') === parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]')) { workspaces.add(el); mark(el,'data-fan-rail-workspaces'); }
            });
            marks.forEach(function (attrs,el) { if ((el !== frame && el !== root && !root.contains(el)) || (el.hasAttribute('data-fan-rail-workspaces') && !workspaces.has(el))) { attrs.restore(); marks.delete(el); } });
            syncRail();
          }
          function start() {
            if (disposed || localClosed || !slot.isConnected) return;
            if (root) { syncControls(); return; }
            if (!document.documentElement.hasAttribute('data-windows-titlebar')) return;
            var rootClass = nativeClass(sidebarSheet,'root'), frameClass = nativeClass(frameSheet,'frame'), colClass = nativeClass(frameSheet,'sidebarCol');
            if (!rootClass || !frameClass || !colClass) return;
            var candidate = Array.from(slot.getElementsByClassName(rootClass)).find(function (el) { return el.closest('[data-slot="sidebar"]') === slot; });
            if (!candidate || !slot.parentElement.classList.contains(colClass)) return;
            var owner = slot.parentElement.parentElement;
            if (!owner || !owner.classList.contains(frameClass) || !columns(owner)) return;
            parts = {};
            required.forEach(function (key) { var name = nativeClass(sidebarSheet,key); parts[key] = name && candidate.getElementsByClassName(name)[0]; });
            if (required.some(function (key) { return !parts[key]; })) return;
            if (parts.panelList.tagName !== 'NAV' || !parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]') ||
              !parts.footArea.contains(parts.settingsArea) || !parts.footArea.contains(parts.footerActions) ||
              !parts.settingsArea.querySelector('[data-slot="sidebar.settings"]') || !parts.footerActions.querySelector('[data-slot="sidebar.footer.action"]')) return;
            root = candidate; frame = owner; nav = parts.panelList; foot = parts.footArea; frameStyles = ownStyles(frame); rootStyles = ownStyles(root);
            if (!syncFrame()) return;
            mark(frame,'data-fan-rail-frame'); mark(root,'data-fan-sidebar-rail');
            [['logoRow','brand'],['newSession','new'],['panelList','nav'],['regionArea','browser'],['footArea','footer'],['footerActions','actions'],['settingsArea','settings']].forEach(function (row) { mark(parts[row[0]],'data-fan-rail-'+row[1]); });
            var glyph = nativeClass(sidebarSheet,'panelGlyph'); if (glyph) Array.from(nav.getElementsByClassName(glyph)).forEach(function (el) { mark(el,'data-fan-rail-glyph'); });
            frameObserver = new MutationObserver(function () { if (root) syncControls(); });
            frameObserver.observe(frame,{attributes:true,attributeFilter:['style','class','data-sidebar-collapsed']});
            railObserver = new ResizeObserver(function () { if (root) syncControls(); });
            [root,nav,parts.logoRow,parts.footerActions,parts.settingsArea].forEach(function (el) { railObserver.observe(el); });
            parts.footerActions.addEventListener('scroll',syncPopups,{passive:true});
            syncControls();
          }
          var observer = new MutationObserver(function (records) {
            if (root && (!root.isConnected || !slot.contains(root))) end();
            if (!root) { start(); return; }
            if (records.some(function (r) { var target = r.target.nodeType === 1 ? r.target : r.target.parentElement; return target === root || nav.contains(target) || foot.contains(target) || parts.logoRow.contains(target) || parts.regionArea.contains(target); })) syncControls();
          });
          observer.observe(slot,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','aria-label','data-collapsed']});
          var controller = {start:start}; controllers.add(controller); start();
          return function () { localClosed = true; observer.disconnect(); end(); controllers.delete(controller); };
        }
        var unwatch = watchRoots('[data-slot="sidebar"]',mount);
        var unwatchMenu = watchRoots('[data-windows-menu]',function (host) {
          var shadow = host.shadowRoot; if (!shadow) return function () {};
          // The preload's open shadow is otherwise outside the existing
          // square/no-ring policy. Do not change its handlers or roving tabs.
          var policy = document.createElement('style');
          policy.textContent = '[role="menubar"] > button{border-radius:0 !important}[role="menubar"] > button:focus{outline:none !important}[role="menubar"] > button:focus-visible{text-decoration:underline;text-underline-offset:3px}';
          shadow.append(policy);
          var refresh = function () { controllers.forEach(function (c) { c.start(); }); };
          var observer = new ResizeObserver(refresh); observer.observe(host); refresh();
          return function () { observer.disconnect(); policy.remove(); refresh(); };
        });
        var htmlObserver = new MutationObserver(function () { controllers.forEach(function (c) { c.start(); }); });
        htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-windows-titlebar']});
        var headObserver = new MutationObserver(function (records) {
          var relevant = records.some(function (r) {
            var node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
            var sheets = [sidebarSheet,frameSheet,workspaceSheet];
            if (r.type === 'attributes' && sheets.includes(r.oldValue)) return true;
            var style = node && node.closest && node.closest('style[data-plugin-css]'); if (style && sheets.includes(style.getAttribute('data-plugin-css'))) return true;
            return Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some(function (el) { return el.nodeType === 1 && sheets.includes(el.getAttribute('data-plugin-css')); });
          });
          if (relevant) controllers.forEach(function (c) { c.start(); });
        });
        headObserver.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-plugin-css'],attributeOldValue:true});
        return function () { disposed = true; htmlObserver.disconnect(); headObserver.disconnect(); unwatchMenu(); unwatch(); controllers.clear(); };
      }, 'fan-de-hai: sidebar-rail');

      // An opening catalog starts at its newest rows, not the page's bottom.
      // Stop after one settled render; later updates must not fight navigation.
      ctx.effect(function () {
        var sheet = '@deepseek-ai/dsh-client-ui-subagent/SubagentHeaderLineage.module.css';
        return watchRoots('[role="tree"]', function (tree) {
          function valid() {
            var body = nativeClass(sheet,'menuBody'), menu = nativeClass(sheet,'menu');
            return body && menu && tree.classList.contains(body) && tree.parentElement && tree.parentElement.classList.contains(menu);
          }
          if (!valid()) return function () {};
          var done = false, frame = 0;
          var events = ['wheel','pointerdown','touchstart','keydown'];
          function stop() {
            done = true; cancelAnimationFrame(frame); frame = 0;
            observer.disconnect(); if (resize) resize.disconnect();
            events.forEach(function (name) { tree.removeEventListener(name,stop,true); });
          }
          function scroll() {
            frame = 0;
            if (done || !tree.isConnected) return;
            if (!valid()) { stop(); return; }
            if (!tree.clientHeight || !tree.querySelector('[role="treeitem"]')) return;
            // Native keyboard opening chooses a focused row. Never hide that
            // focus or move it just to impose the pointer-opening default.
            var focused = document.activeElement;
            if (!(tree.contains(focused) && focused.matches(':focus-visible'))) tree.scrollTop = tree.scrollHeight;
            stop();
          }
          function schedule() { if (!done && !frame) frame = requestAnimationFrame(scroll); }
          var observer = new MutationObserver(schedule);
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
          observer.observe(tree,{childList:true,subtree:true}); if (resize) resize.observe(tree);
          events.forEach(function (name) { tree.addEventListener(name,stop,{capture:true,passive:true}); });
          schedule(); return stop;
        });
      }, 'fan-de-hai: subagent-catalog-scroll');

      ctx.effect(function () {
        var disposed = false;
        return watchRoots('[role="tree"][aria-label="子智能体会话"], [role="tree"][aria-label="Subagent sessions"]', function (menu) {
          var closed = false, frame = 0, timer = 0;
          var cache = new Map(), pending = new Map(), painted = new Map();
          var classes = discoverClasses();
          function restore(el, state) {
            if (el.textContent === state.last) el.textContent = state.text;
            if (el.getAttribute("title") === state.text) {
              if (state.title === null) el.removeAttribute("title");
              else el.setAttribute("title", state.title);
            }
          }
          function paint(el, text) {
            var state = painted.get(el);
            if (!state) { state = { text: el.textContent, title: el.getAttribute("title") }; painted.set(el, state); }
            else if (el.textContent !== state.last) state.text = el.textContent;
            if (el.getAttribute("title") !== state.text) el.setAttribute("title", state.text);
            if (el.textContent !== text) el.textContent = text;
            state.last = text;
          }
          function scan() {
            frame = 0;
            clearTimeout(timer);
            if (closed || disposed || !menu.isConnected) return;
            if (!classes) classes = discoverClasses();
            var byLabel = catalogByLabel(snapshotOf(ctx));
            var now = Date.now();
            painted.forEach(function (state, el) { if (!menu.contains(el)) { restore(el, state); painted.delete(el); } });
            menu.querySelectorAll('[role="treeitem"]').forEach(function (row) {
              if (!classes) return;
              var label = row.querySelector('.' + classes.label);
              var summary = row.querySelector('.' + classes.summary);
              if (!label || !summary) return;
              var ids = byLabel[textOf(label)] || [];
              if (ids.length !== 1) return;
              var id = ids[0], hit = cache.get(id);
              if (hit && hit.until > now) { if (hit.text) paint(summary, hit.text); return; }
              if (pending.has(id)) return;
              var token = {};
              pending.set(id, token);
              function finish(result) {
                if (closed || disposed || pending.get(id) !== token) return;
                pending.delete(id);
                var ref = result && result.ok && result.value && result.value.found ? result.value : null;
                var text = ref ? ref.provider + '/' + ref.model : null;
                cache.set(id, { text: text, until: Date.now() + (text ? 15000 : 5000) });
                schedule();
              }
              callModel(ctx, id).then(finish, function () { finish(null); });
            });
            // Poll only while this actual menu is mounted. Misses retry and
            // successful entries refresh after a model switch, with bounded TTL.
            timer = setTimeout(schedule, 5000);
          }
          function schedule() { if (!closed && !disposed && !frame) frame = requestAnimationFrame(scan); }
          var observer = new MutationObserver(function (records) {
            if (records.some(function (r) {
              var el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
              var state = painted.get(el);
              return !state || el.textContent !== state.last;
            })) schedule();
          });
          observer.observe(menu, { childList: true, subtree: true, characterData: true });
          schedule();
          return function () {
            closed = true; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer);
            pending.clear(); cache.clear(); painted.forEach(function (s, el) { restore(el, s); }); painted.clear();
          };
        });
      }, "fan-de-hai: subagent-model-instead-of-summary");

      ctx.effect(function () {
        var STORAGE = 'fan_plugin_sort_mode';
        var mode = 'default', query = '';
        try { var saved = localStorage.getItem(STORAGE); if (['default','name-asc','name-desc'].includes(saved)) mode = saved; } catch (_) {}
        var media = matchMedia('(prefers-reduced-motion: reduce)');
        var instances = new Set();
        function closeOthers(event) {
          instances.forEach(function (ui) { if (!ui.bar.contains(event.target)) ui.close(false); });
        }
        document.addEventListener('click', closeOthers);
        var unwatch = watchRoots('section[data-plugin-group="bundles"]', function (section) {
          if (!section.closest('[data-plugin-panel="true"]')) return function () {};
          var stopped = false, frame = 0, filterDirty = true, sortDirty = true;
          var records = new Map(), cards = [], items = [], popupAnimation = null, opened = false;
          var activeIndex = 0;
          var abort = new AbortController();
          function on(el, event, handler) { el.addEventListener(event, handler, { signal: abort.signal }); }
          function element(tag, cls, text) {
            var el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el;
          }
          function icon(path, cls) {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', cls); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('aria-hidden', 'true');
            var p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', path); svg.appendChild(p); return svg;
          }
          var bar = element('div','fan-plugin-toolbar');
          bar.id = 'fan-de-hai-plugin-toolbar';
          var search = element('div','fan-search-wrap');
          search.appendChild(icon('M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 3 4 4','fan-search-icon'));
          var input = element('input','fan-search-input'); input.type='text';input.value=query;input.placeholder='搜索插件名称、描述或包名...';
          input.setAttribute('aria-label','搜索插件名称、描述或包名'); input.autocomplete='off';
          var clear = element('button','fan-search-clear'); clear.type='button';clear.setAttribute('aria-label','清空搜索内容');
          clear.appendChild(icon('M4 4l8 8M12 4l-8 8','')); clear.hidden=!query;
          search.append(input,clear);
          var sort = element('div','fan-sort-wrap');sort.appendChild(element('span','fan-sort-label','排序:'));
          var select = element('div','fan-custom-select');
          var trigger = element('button','fan-select-trigger');trigger.type='button';
          trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
          trigger.title='当前数据不提供安装时间，按默认顺序或名称排序';
          var value = element('span','fan-select-value');trigger.append(value,icon('M3 6l5 5 5-5','fan-select-arrow'));
          var dropdown = element('div','fan-select-dropdown');dropdown.id='fan-plugin-sort-options';dropdown.setAttribute('role','listbox');
          dropdown.setAttribute('aria-label','插件排序方式');dropdown.tabIndex=-1;dropdown.hidden=true;
          trigger.setAttribute('aria-controls',dropdown.id);
          var options=[{value:'default',text:'默认顺序'},{value:'name-asc',text:'首字母 (A → Z)'},{value:'name-desc',text:'首字母 (Z → A)'}];
          function refreshSelection() {
            options.forEach(function (opt,i) { var selected=mode===opt.value;items[i].setAttribute('aria-selected',String(selected));items[i].dataset.selected=String(selected);items[i].querySelector('svg').style.opacity=selected?'1':'0';if(selected)value.textContent=opt.text; });
            trigger.setAttribute('aria-label','插件排序方式：'+value.textContent);
          }
          function cancelPopup() { if(popupAnimation){popupAnimation.onfinish=null;popupAnimation.cancel();popupAnimation=null;} }
          function close(focus) {
            if(!opened) return;
            var from=Number(getComputedStyle(dropdown).opacity);opened=false;cancelPopup();
            trigger.setAttribute('aria-expanded','false');select.removeAttribute('data-open');dropdown.inert=true;
            if(focus)trigger.focus({preventScroll:true});
            if(media.matches||!dropdown.animate){dropdown.hidden=true;return;}
            popupAnimation=dropdown.animate([{opacity:from},{opacity:0}],{duration:140,easing:'ease',fill:'forwards'});
            var closing=popupAnimation;
            closing.finished.then(function(){if(popupAnimation===closing&&!opened){dropdown.hidden=true;cancelPopup();}},function(){});
          }
          function open(index) {
            cancelPopup();opened=true;dropdown.hidden=false;dropdown.inert=false;select.dataset.open='true';trigger.setAttribute('aria-expanded','true');
            activeIndex=index===undefined?options.findIndex(function(o){return o.value===mode;}):index;
            if(activeIndex<0)activeIndex=0;setActive();dropdown.focus({preventScroll:true});
            if(!media.matches && dropdown.animate){popupAnimation=dropdown.animate([{opacity:0},{opacity:1}],{duration:140,easing:'ease'});var entering=popupAnimation;entering.finished.then(function(){if(popupAnimation===entering)cancelPopup();},function(){});}
          }
          function setActive(){items.forEach(function(el,i){el.dataset.active=String(i===activeIndex);});dropdown.setAttribute('aria-activedescendant',items[activeIndex].id);}
          function choose(index) {
            mode=options[index].value;try{localStorage.setItem(STORAGE,mode);}catch(_){}
            refreshSelection();sortDirty=true;schedule();close(true);
          }
          options.forEach(function(opt,i){var el=element('div','fan-select-option');el.id='fan-sort-option-'+i;el.setAttribute('role','option');el.dataset.value=opt.value;el.append(element('span','',opt.text),icon('M3 8l4 4 6-8','fan-option-check'));on(el,'click',function(){choose(i);});items.push(el);dropdown.appendChild(el);});
          refreshSelection();select.append(trigger,dropdown);sort.appendChild(select);
          var badge=element('span','fan-count-badge');badge.setAttribute('role','status');
          var empty=element('div','fan-no-match-tip');empty.hidden=true;empty.setAttribute('role','status');
          bar.append(search,sort,badge);
          var list=section.querySelector('ul[class*="cards"]');
          if(list)section.insertBefore(bar,list);else section.appendChild(bar);
          section.appendChild(empty);
          var ui={bar:bar,close:close};instances.add(ui);
          on(trigger,'click',function(){if(opened)close(true);else open();});
          on(trigger,'keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open(e.key==='ArrowUp'?options.length-1:0);}});
          on(dropdown,'keydown',function(e){
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
            if(e.key==='Tab'){close(false);return;}
            if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(activeIndex);return;}
            if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();activeIndex=e.key==='Home'?0:e.key==='End'?options.length-1:(activeIndex+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;setActive();}
          });
          on(bar,'focusout',function(e){if(e.relatedTarget && !select.contains(e.relatedTarget))close(false);});
          function searchChanged(){query=input.value.trim();clear.hidden=!query;filterDirty=true;schedule();}
          on(input,'input',searchChanged);
          on(input,'keydown',function(e){if(e.key==='Escape'){e.preventDefault();input.value='';searchChanged();}});
          on(clear,'click',function(){input.value='';searchChanged();input.focus({preventScroll:true});});
          on(media,'change',function(){cancelPopup();dropdown.hidden=!opened;});
          function describe(card){return {title:textOf(card.querySelector('[class*="cardTitle"]'))||card.getAttribute('data-plugin-package')||'',desc:textOf(card.querySelector('[class*="cardDesc"]')),pkg:card.getAttribute('data-plugin-package')||''};}
          function scan(){
            frame=0;if(stopped)return;
            var next=Array.from(section.querySelectorAll('ul[class*="cards"] > li'));
            var changed=next.length!==cards.length||next.some(function(c,i){return c!==cards[i];});cards=next;
            records.forEach(function(r,el){if(!section.contains(el)){if(r.filterStyle)r.filterStyle.restore();r.styles.restore();records.delete(el);}});
            cards.forEach(function(c){var info=describe(c),r=records.get(c);if(!r){r={styles:ownStyles(c),info:info,hidden:false};records.set(c,r);changed=true;}else if(JSON.stringify(r.info)!==JSON.stringify(info)){r.info=info;changed=true;}});
            if(!changed&&!filterDirty&&!sortDirty)return;
            if(changed||sortDirty){
              section.querySelectorAll('ul[class*="cards"]').forEach(function(ul){
                var group=cards.filter(function(c){return c.parentElement===ul;});
                if(mode!=='default')group.sort(function(a,b){var cmp=records.get(a).info.title.localeCompare(records.get(b).info.title,'zh-Hans-CN',{sensitivity:'base',numeric:true});return mode==='name-desc'?-cmp:cmp;});
                group.forEach(function(c,i){var owned=records.get(c).styles;if(mode==='default')owned.restore();else owned.set('order',String(i));});
              });
            }
            var words=query.toLowerCase().split(/\s+/).filter(Boolean),visible=0;
            if(changed||filterDirty){cards.forEach(function(c){var r=records.get(c);var hay=(r.info.title+' '+r.info.desc+' '+r.info.pkg).toLowerCase();var hide=!words.every(function(w){return hay.includes(w);});
              if(hide&&!r.hidden){r.filterStyle=ownStyles(c);r.filterStyle.set('display','none','important');}
              else if(!hide&&r.hidden){r.filterStyle.restore();r.filterStyle=null;}
              r.hidden=hide;
            });}
            cards.forEach(function(c){if(!records.get(c).hidden)visible++;});
            var message=query?'显示 '+visible+' / '+cards.length+' 个插件':'共 '+cards.length+' 个插件';if(badge.textContent!==message)badge.textContent=message;
            var noMatch=!!query&&cards.length>0&&visible===0;empty.hidden=!noMatch;
            if(noMatch){var text='未找到与 "'+query+'" 匹配的插件';if(empty.textContent!==text)empty.textContent=text;}
            filterDirty=sortDirty=false;
          }
          function schedule(){if(!stopped&&!frame)frame=requestAnimationFrame(scan);}
          var observer=new MutationObserver(function(changes){
            if(changes.some(function(r){var el=r.target.nodeType===1?r.target:r.target.parentElement;return !bar.contains(el)&&!empty.contains(el);}))schedule();
          });
          observer.observe(section,{childList:true,subtree:true,characterData:true});schedule();
          return function(){stopped=true;observer.disconnect();cancelAnimationFrame(frame);abort.abort();cancelPopup();instances.delete(ui);records.forEach(function(r){if(r.filterStyle)r.filterStyle.restore();r.styles.restore();});records.clear();bar.remove();empty.remove();};
        });
        return function(){unwatch();document.removeEventListener('click',closeOthers);};
      }, "fan-de-hai: plugin-manager-search-sort");

      // Conditional-body cards do not use hidden: React removes the body on close.
      // Animate only the surviving shell's geometry; never retain/reinsert its body.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)');
        var active = new Set();
        var flow = ':is([data-slot^="conversation.chat"], [data-chat-flow])';
        var targets = 'section[data-turn-trigger], div[data-tool="todo_write"], div[data-tool="create_goal"], div[data-tool="update_goal"], div[data-tool="get_goal"], div[data-tool="subagent"], div[data-tool^="subagent_"], [data-goal-bar] > div, section[data-testid="todo-panel"], ' + flow + ' div[data-variant="think"]:not([data-tool]), [data-question-key] > section, ' + flow + ' div[data-tool], ' + flow + ' div:has(> [data-disclosure-header]), ' + flow + ' div:has(> [data-sample="bash"]), ' + flow + ' div:has(> button [data-compaction-disclosure]), ' + flow + ' [data-question-reply] > div:first-child, ' + flow + ' :is([data-terminal], [data-read], [data-search], [data-diff]), ' + flow + ' [role="treeitem"]:is(:has(> [data-json-expander]), :has(> [data-expanded]))';
        var unwatch = watchRoots(targets, function (root) {
          var isGoalEditor = root.parentElement && root.parentElement.hasAttribute('data-goal-bar');
          var isReasoning = root.matches('[data-variant="think"]:not([data-tool])');
          var isQuestion = root.parentElement && root.parentElement.hasAttribute('data-question-key');
          var isTool = root.hasAttribute('data-tool');
          var contentTargets = '[data-terminal], [data-read], [data-search], [data-diff]';
          var isContent = root.matches(contentTargets), isJson = root.matches('[role="treeitem"]');
          function contentControls() { return Array.from(root.querySelectorAll('button[aria-expanded]')).filter(function (button) { return button.closest(contentTargets) === root; }); }
          var isPrimitive = !!root.querySelector(':scope > [data-disclosure-header]');
          var bashHeader = root.querySelector(':scope > [data-sample="bash"]');
          // Tool/Reasoning wrappers own their direct DisclosureRow. A nested
          // independent DisclosureRow still owns its own toggle, never the menu.
          if (isPrimitive && root.parentElement.matches('div[data-tool], div[data-variant="think"]')) return function () {};
          if (root.closest('[role="menu"], [role="listbox"], [role="dialog"], [popover]')) return function () {};
          var hold = null, holdFrame = 0;
          function findHeader() {
            if (isGoalEditor) return root;
            if (isContent) return contentControls()[0];
            if (isJson) return root.querySelector(':scope > [data-json-expander], :scope > [data-expanded] button[aria-expanded]');
            if (isQuestion) return root.querySelector(':scope > header button[aria-expanded]');
            if (isReasoning) return Array.from(root.querySelectorAll('[data-disclosure-header]')).find(function (row) { return row.closest('[data-variant="think"]') === root; });
            if (root.matches('section[data-testid="todo-panel"]')) return root.querySelector(':scope > div > button[aria-expanded]');
            if (root.hasAttribute('data-turn-trigger')) return root.querySelector(':scope > button[aria-controls]');
            if (bashHeader) return bashHeader;
            if (root.parentElement.hasAttribute('data-question-reply') || root.querySelector(':scope > button [data-compaction-disclosure]')) return root.querySelector(':scope > button[aria-expanded]');
            if (isPrimitive) return root.querySelector(':scope > [data-disclosure-header] [aria-expanded]');
            return Array.from(root.querySelectorAll('[data-disclosure-row][aria-expanded], [data-disclosure-row] button[aria-expanded]')).find(function (row) { return row.closest('[data-tool]') === root; });
          }
          var header = findHeader();
          var closed = false, job = null;
          function readExpanded() {
            // GoalBar reuses this styled bar, replacing its label with InlineEditor.
            if (isGoalEditor) return Array.from(root.classList).some(function (name) { return name.endsWith('_editBar'); });
            if (isReasoning) return root.hasAttribute('data-expanded');
            if (isContent) return contentControls().map(function (button) { return button.getAttribute('aria-expanded'); }).join('|');
            return !!header && header.getAttribute('aria-expanded') === 'true';
          }
          var expanded = readExpanded();
          var box = root.getBoundingClientRect();
          var lastHeight = box.height, lastWidth = box.width;
          function insets() {
            var style = getComputedStyle(root);
            var outer = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) +
              (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
            return { style: style, outer: outer, inset: style.boxSizing === 'border-box' ? 0 : outer };
          }
          function childrenHeight() {
            // Keep the shell locked, including on the very first collapse. The
            // real in-flow children supply the natural height, not scrollHeight
            // (which is at least the lock) or a visually-hidden first status span.
            var box = insets(), children = [], owned = [];
            var column = box.style.display.includes('flex') && box.style.flexDirection === 'column';
            Array.from(root.children).forEach(function (child) {
              var style = getComputedStyle(child);
              if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') return;
              children.push(child);
              if (column) { var styles = ownStyles(child); styles.set('flex-shrink', '0'); styles.set('flex-grow', '0'); owned.push(styles); }
            });
            try {
              var top = root.getBoundingClientRect().top;
              var bottom = top + (parseFloat(box.style.borderTopWidth) || 0) + (parseFloat(box.style.paddingTop) || 0);
              children.forEach(function (child) { bottom = Math.max(bottom, child.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(child).marginBottom) || 0)); });
              var height = bottom - top + (parseFloat(box.style.paddingBottom) || 0) + (parseFloat(box.style.borderBottomWidth) || 0);
              var min = parseFloat(box.style.minHeight), max = parseFloat(box.style.maxHeight);
              if (Number.isFinite(min)) height = Math.max(height, min + box.inset);
              if (Number.isFinite(max)) height = Math.min(height, max + box.inset);
              return height;
            } finally { owned.forEach(function (styles) { styles.restore(); }); }
          }
          var lastInset = insets().inset;
          function measure() {
            var rect = root.getBoundingClientRect();
            lastHeight = rect.height; lastWidth = rect.width; lastInset = insets().inset;
          }
          function cancel() {
            if (!job) return;
            var current = job; job = null;
            current.animation.cancel(); current.styles.restore();
          }
          function releaseHold() {
            cancelAnimationFrame(holdFrame); holdFrame = 0;
            if (hold) { hold.styles.restore(); hold = null; }
          }
          function freezeShell(height, cssHeight) {
            // Read visible geometry before calling this. No layout reads between
            // releasing the old animation and locking its replacement height.
            cancel(); releaseHold();
            var originalHeight = root.style.getPropertyValue('height'), priority = root.style.getPropertyPriority('height');
            var styles = ownStyles(root); styles.set('height', cssHeight);
            hold = { height: height, styles: styles, originalHeight: originalHeight, priority: priority };
          }
          function settle() { cancel(); releaseHold(); if (!closed) measure(); }
          function beforeToggle(event) {
            if (isContent) header = contentControls().find(function (button) { return button.contains(event.target); });
            else if (!header || !root.contains(header)) header = findHeader();
            var ownJsonTarget = isJson && event.target.closest('[role="treeitem"]') === root;
            if (closed || media.matches || !header || !(ownJsonTarget || header.contains(event.target))) return;
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ' && !(isJson && (event.key === 'ArrowLeft' || event.key === 'ArrowRight'))) return;
            var height = root.getBoundingClientRect().height;
            var cssHeight = getComputedStyle(root).height;
            freezeShell(height, cssHeight);
            // Capture observes only; React still receives the original click.
            // Release even if a disabled/prevented toggle makes no state change.
            holdFrame = requestAnimationFrame(function () { holdFrame = 0; if (hold && readExpanded() === expanded) settle(); });
          }
          function changed(records) {
            if (closed || !root.isConnected) return;
            if (!header || !root.contains(header)) header = findHeader();
            if (!header) { settle(); return; }
            var next = readExpanded();
            if (next === expanded) {
              if (!records.some(function (r) { return r.type === 'childList'; })) return;
              // Lazy content arriving during the first opening must retarget
              // from the visible height, not cancel straight to its final size.
              if (!isQuestion && !job && !(isContent && hold)) { if (!hold) measure(); return; }
            }
            var from = hold ? hold.height : job ? root.getBoundingClientRect().height : lastHeight;
            expanded = next;
            // The observer may be handling a programmatic close. Even reading
            // computed padding first would flush the already-shrunken layout.
            if (!hold) freezeShell(from, Math.max(0, from - lastInset) + 'px');
            var to, box = insets(); lastInset = box.inset;
            if (isQuestion || isGoalEditor || isJson) {
              // Dock cards have capped states; JSON also mixes inline line boxes.
              // Read their exact natural size inside a retained parent frame.
              // Their retained frame protects the scroll extent while reading
              // the host's real natural geometry, including its fixed close size.
              var frame = root.parentElement, frameStyles = ownStyles(frame), rootSizing = ownStyles(root);
              frameStyles.set('height', getComputedStyle(frame).height);
              if (isQuestion) frameStyles.set('align-items', 'flex-start');
              frameStyles.set('overflow-x', 'hidden'); frameStyles.set('overflow-y', 'hidden');
              rootSizing.set('flex-shrink', '0');
              try {
                hold.styles.set('height', hold.originalHeight, hold.priority);
                to = root.getBoundingClientRect().height;
              } finally {
                hold.styles.set('height', Math.max(0, from - box.inset) + 'px');
                rootSizing.restore(); frameStyles.restore();
              }
            } else to = childrenHeight();
            lastHeight = to; lastWidth = root.getBoundingClientRect().width;
            if (media.matches || !root.animate || from <= 0 || to <= 0 || Math.abs(from - to) < 0.5 || root.closest('[hidden]')) { settle(); return; }
            // Do not double-drive a shell if a future host version animates it.
            if (root.getAnimations().some(function (a) {
              return a.effect && a.effect.getKeyframes().some(function (k) { return 'height' in k || 'maxHeight' in k; });
            })) { settle(); return; }
            var computed = getComputedStyle(root);
            var inset = computed.boxSizing === 'border-box' ? 0 :
              (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0) +
              (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0);
            var styles = hold ? hold.styles : ownStyles(root);
            hold = null; cancelAnimationFrame(holdFrame); holdFrame = 0;
            styles.set('overflow-x', 'hidden'); styles.set('overflow-y', 'hidden');
            try {
              var animation = root.animate([{ height: Math.max(0, from - inset) + 'px' }, { height: Math.max(0, to - inset) + 'px' }], { duration: 180, easing: 'ease', fill: 'both' });
              var current = { animation: animation, styles: styles }; job = current;
              animation.finished.then(function () { if (job === current) settle(); }, function () { if (job === current) settle(); });
            } catch (_) { styles.restore(); measure(); }
          }
          var observer = new MutationObserver(changed);
          observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: isGoalEditor ? ['class'] : isReasoning ? ['data-expanded', 'aria-expanded'] : ['aria-expanded'] });
          // Refresh idle geometry after wrapping/font changes, not on every animation frame.
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () {
            if (closed) return;
            if (job) {
              if (Math.abs(root.getBoundingClientRect().width - lastWidth) > 0.5) settle();
            } else measure();
          }) : null;
          if (resize) resize.observe(root);
          root.addEventListener('click', beforeToggle, true); root.addEventListener('keydown', beforeToggle, true);
          active.add(settle);
          return function () { closed = true; observer.disconnect(); if (resize) resize.disconnect(); root.removeEventListener('click', beforeToggle, true); root.removeEventListener('keydown', beforeToggle, true); active.delete(settle); cancel(); releaseHold(); };
        }, true);
        function reduced() { if (media.matches) active.forEach(function (settle) { settle(); }); }
        media.addEventListener('change', reduced);
        return function () { unwatch(); media.removeEventListener('change', reduced); active.clear(); };
      }, 'fan-de-hai: card-disclosure-motion');

      // Native details update UA shadow content asynchronously. Unlike React
      // cards, measure on toggle; never set open/hidden or replay summary input.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), active = new Set();
        var unwatch = watchRoots(':is([data-slot^="conversation.chat"], [data-chat-flow]) details', function (root) {
          if (root.closest('[role="menu"], [role="listbox"], [role="dialog"], [popover]')) return function () {};
          var closed = false, expanded = root.open, lastHeight = root.getBoundingClientRect().height;
          var hold = null, job = null, frame = 0;
          function readInset() {
            var style = getComputedStyle(root);
            return style.boxSizing === 'border-box' ? 0 : (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
          }
          var inset = readInset();
          function release() { if (hold) { hold.styles.restore(); hold = null; } cancelAnimationFrame(frame); frame = 0; }
          function cancel() { if (job) { var current = job; job = null; current.animation.cancel(); current.styles.restore(); } }
          function settle() { cancel(); release(); if (!closed) lastHeight = root.getBoundingClientRect().height; }
          function lock(height) {
            // No layout reads after releasing a previous animation or after the
            // UA changes open: restore the cached extent before any measurement.
            cancel(); release();
            var styles = ownStyles(root); styles.set('height', Math.max(0, height - inset) + 'px');
            hold = {height: height, inset: inset, styles: styles};
          }
          function before(event) {
            var summary = root.querySelector(':scope > summary');
            if (closed || media.matches || !summary || !summary.contains(event.target)) return;
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
            var height = root.getBoundingClientRect().height; inset = readInset();
            lock(height);
            frame = requestAnimationFrame(function () { frame = 0; if (hold && root.open === expanded) settle(); });
          }
          function changed() {
            if (closed || !root.isConnected || root.open === expanded) return;
            var next = root.open, from = hold ? hold.height : job ? root.getBoundingClientRect().height : lastHeight;
            expanded = next;
            if (media.matches || !root.animate) { settle(); return; }
            if (!hold) lock(from);
            var style = getComputedStyle(root), top = root.getBoundingClientRect().top;
            var bottom = top + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
            Array.from(root.children).forEach(function (child) {
              if (!next && child.tagName !== 'SUMMARY') return;
              var css = getComputedStyle(child);
              if (css.display === 'none' || css.position === 'absolute' || css.position === 'fixed') return;
              bottom = Math.max(bottom, child.getBoundingClientRect().bottom + (parseFloat(css.marginBottom) || 0));
            });
            var to = bottom - top + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
            if (Math.abs(from - to) < 0.5) { settle(); return; }
            var styles = hold.styles, inset = hold.inset; hold = null; cancelAnimationFrame(frame); frame = 0;
            styles.set('overflow-x', 'hidden'); styles.set('overflow-y', 'hidden');
            try {
              var animation = root.animate([{height:Math.max(0,from-inset)+'px'}, {height:Math.max(0,to-inset)+'px'}], {duration:180,easing:'ease',fill:'both'});
              var current = {animation:animation,styles:styles}; job = current;
              animation.finished.then(function () { if(job===current)settle(); }, function () { if(job===current)settle(); });
            } catch (_) { styles.restore(); settle(); }
          }
          var observer = new MutationObserver(function () {
            if (!closed && root.open !== expanded && !media.matches && !hold) lock(job ? root.getBoundingClientRect().height : lastHeight);
          });
          observer.observe(root, {attributes:true,attributeFilter:['open']});
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { if(!closed&&!job&&!hold){lastHeight=root.getBoundingClientRect().height;inset=readInset();} }) : null;
          if(resize)resize.observe(root);
          root.addEventListener('click',before,true); root.addEventListener('keydown',before,true); root.addEventListener('toggle',changed);
          active.add(settle);
          return function () { closed=true;observer.disconnect();if(resize)resize.disconnect();root.removeEventListener('click',before,true);root.removeEventListener('keydown',before,true);root.removeEventListener('toggle',changed);active.delete(settle);cancel();release(); };
        });
        function reduced() { if(media.matches)active.forEach(function(settle){settle();}); }
        media.addEventListener('change',reduced);
        return function () {unwatch();media.removeEventListener('change',reduced);active.clear();};
      }, 'fan-de-hai: native-details-motion');

      // Question takeover is an overlay; do not animate the shared seat's height
      // when it changes between absolute and sticky positioning. Fade the real
      // incoming surface only, never resurrect a dismissed question or its inputs.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), jobs = new Map();
        function cancel(el) { var animation = jobs.get(el); if (animation) { jobs.delete(el); animation.cancel(); } }
        function reveal(el) {
          if (!el || media.matches || !el.animate || !el.isConnected) return;
          cancel(el);
          if (el.getAnimations().some(function (a) { return a.effect && a.effect.getKeyframes().some(function (k) { return 'opacity' in k; }); })) return;
          var opacity = getComputedStyle(el).opacity;
          var animation = el.animate([{ opacity: 0 }, { opacity: opacity }], { duration: 180, easing: 'ease' });
          jobs.set(el, animation);
          animation.finished.then(function () { if (jobs.get(el) === animation) cancel(el); }, function () { if (jobs.get(el) === animation) cancel(el); });
        }
        var unwatch = watchRoots('[data-composer-seat]', function (seat) {
          var question = seat.querySelector('[data-question-key]');
          if (question) reveal(question.querySelector(':scope > section'));
          var observer = new MutationObserver(function () {
            jobs.forEach(function (_, el) { if (!el.isConnected) cancel(el); });
            var next = seat.querySelector('[data-question-key]');
            if (next === question) return;
            var previous = question; question = next;
            if (next) reveal(next.querySelector(':scope > section'));
            else if (previous) reveal(seat);
          });
          observer.observe(seat, { subtree: true, childList: true });
          return function () { observer.disconnect(); jobs.forEach(function (_, el) { if (el === seat || seat.contains(el) || !el.isConnected) cancel(el); }); };
        });
        function reduced() { if (media.matches) Array.from(jobs.keys()).forEach(cancel); }
        media.addEventListener('change', reduced);
        return function () { unwatch(); media.removeEventListener('change', reduced); Array.from(jobs.keys()).forEach(cancel); };
      }, 'fan-de-hai: question-presence-motion');

      // Presentation only: React owns hidden forever. Never remove/replay hidden,
      // synthesize clicks, or commit state when an animation finishes.
      ctx.effect(function () {
        var media=matchMedia('(prefers-reduced-motion: reduce)');
        var jobs=new Map(), disposed=false;
        var TARGET='[data-step-process-body], [data-step-process], [data-turn-process-member], [data-turn-process-inline]';
        // Inline ProcessReasoning removes its identifying attribute on reveal.
        // Keep identity in memory, never add a marker to application DOM.
        var inlineOwners=new WeakSet(), skipReveal=new WeakSet();
        function cancel(el){var job=jobs.get(el);if(!job)return; jobs.delete(el);job.animation.onfinish=null;job.animation.cancel();job.styles.restore();}
        function eligible(el){
          if(!(el.matches(TARGET)||inlineOwners.has(el))||!el.closest('[data-slot="conversation.chat.flow"], [data-chat-flow]'))return false;
          if(el.hasAttribute('data-step-process-body')){
            var owner=el.closest('[data-step-process]');
            var control=owner&&owner.querySelector('button[aria-controls]');
            if(!control||control.getAttribute('aria-controls')!==el.id)return false;
          }
          return true;
        }
        function animateBatch(records){
          var first=new Map();records.forEach(function(r){if(eligible(r.target)&&!first.has(r.target))first.set(r.target,r.oldValue);});
          // Coalesce changes to the final application state. Ignore nested boxes
          // when their closing parent already owns the visible transition.
          var targets=Array.from(first.keys()).filter(function(el){return !Array.from(first.keys()).some(function(parent){return parent!==el&&parent.contains(el)&&parent.hasAttribute('hidden');});});
          var work=[];
          targets.forEach(function(el){
            var closing=el.hasAttribute('hidden');
            if((first.get(el)!==null)===closing)return;
            var previous=jobs.get(el),from=previous?{height:el.getBoundingClientRect().height,opacity:getComputedStyle(el).opacity}:null;
            cancel(el);
            if(skipReveal.has(el)){skipReveal.delete(el);return;}
            if(disposed||media.matches||!el.isConnected||!el.animate||el.closest('[data-chat-motion]'))return;
            if(closing&&el.getAttribute('hidden')!=='until-found')return;
            if(!closing&&first.get(el)!=='until-found')return;
            if(el.parentElement.closest('[hidden]'))return;
            var styles=ownStyles(el);
            // All read/write preparation is grouped before the natural-size pass.
            // until-found remains searchable and application ownership is intact.
            if(closing){styles.set('content-visibility','visible','important');}
            styles.set('overflow-x','hidden');styles.set('overflow-y','hidden');
            work.push({el:el,closing:closing,styles:styles,from:from});
          });
          work.forEach(function(w){
            var computed=getComputedStyle(w.el);
            // Chat searchable containers use hidden=until-found, not display:none.
            // Never guess a display type for an unknown plain-hidden element.
            if(computed.display==='none'){w.styles.restore();return;}
            var height=w.el.getBoundingClientRect().height;
            var padding=parseFloat(computed.paddingTop)+parseFloat(computed.paddingBottom)+parseFloat(computed.borderTopWidth)+parseFloat(computed.borderBottomWidth);
            var cssHeight=computed.boxSizing==='border-box'?height:Math.max(0,height-padding);
            var start=w.from?Math.max(0,w.from.height-(computed.boxSizing==='border-box'?0:padding)):(w.closing?cssHeight:0);
            var opacity=w.from?w.from.opacity:(w.closing?computed.opacity:'0');
            var end=w.closing?0:cssHeight;
            var animation=w.el.animate([{height:start+'px',opacity:opacity},{height:end+'px',opacity:w.closing?0:computed.opacity}],{duration:180,easing:'ease',fill:'both'});
            var job={animation:animation,styles:w.styles};jobs.set(w.el,job);
            animation.finished.then(function(){if(jobs.get(w.el)===job)cancel(w.el);},function(){if(jobs.get(w.el)===job)cancel(w.el);});
          });
        }
        var unwatch=watchRoots('[data-slot="conversation.chat.flow"], [data-chat-flow]',function(root){
          // Nested content roots belong to the outer flow observer, not a second one.
          if(root.parentElement.closest('[data-slot="conversation.chat.flow"], [data-chat-flow]'))return function(){};
          root.querySelectorAll('[data-turn-process-inline]').forEach(function(el){inlineOwners.add(el);});
          var observer=new MutationObserver(function(records){
            records.forEach(function(r){if(r.type==='attributes'&&r.attributeName==='data-turn-process-inline')inlineOwners.add(r.target);});
            jobs.forEach(function(_,el){if(!el.isConnected)cancel(el);});
            animateBatch(records.filter(function(r){return r.type==='attributes'&&r.attributeName==='hidden';}));
          });
          observer.observe(root,{attributes:true,attributeFilter:['hidden','data-turn-process-inline'],attributeOldValue:true,childList:true,subtree:true});
          function immediateReveal(event){
            var el=event.target;
            if(el.nodeType!==1)return;
            while(el&&root.contains(el)){if(el.matches(TARGET)||inlineOwners.has(el)){cancel(el);if(el.hasAttribute('hidden'))skipReveal.add(el);}el=el.parentElement;}
          }
          root.addEventListener('beforematch',immediateReveal,true);
          root.addEventListener('focusin',immediateReveal,true);
          return function(){observer.disconnect();root.removeEventListener('beforematch',immediateReveal,true);root.removeEventListener('focusin',immediateReveal,true);jobs.forEach(function(_,el){if(root.contains(el)||!el.isConnected)cancel(el);});};
        });
        function reduceChanged(){if(media.matches)Array.from(jobs.keys()).forEach(cancel);}
        media.addEventListener('change',reduceChanged);
        var nativeObserver=new MutationObserver(function(){jobs.forEach(function(_,el){if(el.closest('[data-chat-motion]'))cancel(el);});});
        nativeObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-chat-motion']});
        return function(){disposed=true;unwatch();nativeObserver.disconnect();media.removeEventListener('change',reduceChanged);Array.from(jobs.keys()).forEach(cancel);};
      }, "fan-de-hai: disclosure-motion");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
