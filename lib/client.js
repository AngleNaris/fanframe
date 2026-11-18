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

    // One source for the Markdown h2 and the iframe's contextual emphasis.
    var markdownH2Dark = '#a4cccc', markdownH2Light = 'hsl(180.000000, 28.169014%, 32%)';
    var inkAmberDark = '#ddbc86', inkAmberLight = '#815817';
    var inkBlueDark = '#9cb8dc', inkBlueLight = '#42658e';

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
      "[data-composer-dock] button:focus-visible, [data-fan-footer-panel] :focus-visible { color:var(--dsw-alias-brand-primary) !important; }",
      "",
      "/* Windows native sidebar: retain the React tree, reflow its existing seats. */",
      "[data-fan-sidebar-rail] { --fan-rail-width:52px; --fan-rail-gap:4px; --fan-rail-list-inset:-4px; --fan-rail-nav-offset:3px; display:grid !important; position:relative; min-width:0; grid-template-columns:var(--fan-rail-width) minmax(0,1fr); grid-template-rows:auto auto minmax(0,1fr); padding:6px 0 !important; animation:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-brand] { grid-column:2; grid-row:1; margin-left:var(--fan-rail-list-inset) !important; min-width:0; }",
      "[data-fan-rail-new] { grid-column:2; grid-row:2; margin-left:var(--fan-rail-list-inset) !important; margin-right:var(--fan-rail-new-end-inset,0px) !important; min-width:0; }",
      "[data-fan-sidebar-rail]:has(> [data-fan-rail-scroll-region]) > [data-fan-rail-brand] { margin-left:0 !important; }",
      "[data-fan-rail-new-row] { grid-column:2; grid-row:2; margin-left:0 !important; margin-right:var(--fan-rail-new-end-inset,0px) !important; min-width:0; }",
      "[data-fan-rail-new-row] [data-fan-rail-new] { margin-left:0 !important; margin-right:0 !important; }",
      "[data-fan-rail-browser] { grid-column:2; grid-row:3; margin-left:var(--fan-rail-list-inset) !important; margin-right:0 !important; padding-left:0 !important; min-width:0; min-height:0; }",
      "[data-fan-sidebar-rail] > [data-fan-rail-scroll-region] { grid-column:1 / -1; grid-row:1 / -1; margin:0 !important; min-width:0; min-height:0; pointer-events:none; }",
      "[data-fan-rail-scroll-region] > [data-fan-rail-scroll-area] { display:grid !important; overflow-x:hidden !important; overflow-y:auto !important; grid-template-columns:var(--fan-rail-width) minmax(0,1fr); grid-template-rows:var(--fan-rail-list-y,0px) minmax(0,1fr); margin:0 !important; min-width:0; min-height:0; pointer-events:none; }",
      "[data-fan-rail-scroll-area]::before, [data-fan-rail-scroll-area]::after { content:none !important; }",
      "[data-fan-rail-scroll-area] > [data-fan-rail-nav] { grid-column:1; grid-row:1 / -1; pointer-events:auto; }",
      "[data-fan-rail-scroll-area] > [data-fan-rail-browser] { grid-column:2; grid-row:2; margin-left:0 !important; height:100%; pointer-events:auto; }",
      "[data-fan-rail-scroll-area] [data-fan-rail-workspaces] { max-height:100% !important; }",
      "[data-fan-rail-scroll-fade] { left:var(--fan-rail-width) !important; right:0 !important; width:auto !important; }",
      "[data-fan-rail-entry] { box-sizing:border-box; display:flex !important; flex-direction:column; align-items:center; gap:var(--fan-rail-gap) !important; width:var(--fan-rail-width) !important; min-height:68px; margin:0 !important; padding:0 !important; }",
      "[data-fan-rail-unpin] { position:static !important; display:flex !important; align-items:center; justify-content:center; flex:none; align-self:center; width:28px !important; min-width:28px !important; max-width:28px !important; height:28px !important; min-height:28px !important; padding:0 !important; margin:0 !important; }",
      "[data-fan-rail-entry][data-fan-rail-context-menu] { min-height:36px; gap:0 !important; }",
      "[data-fan-rail-entry][data-fan-rail-context-menu] [data-fan-rail-unpin] { display:none !important; }",
      "[data-fan-rail-workspaces] { --dsh-session-list-edge-inset:calc(var(--dsh-session-list-scrollbar-width,5px) + var(--dsh-session-list-scrollbar-offset,2px)) !important; }",
      "[data-fan-rail-nav], [data-fan-rail-actions], [data-fan-rail-settings] { grid-column:1; grid-row:1 / -1; box-sizing:border-box; display:flex !important; flex-direction:column; align-items:center; flex:none; gap:var(--fan-rail-gap) !important; width:var(--fan-rail-width) !important; margin:0 !important; min-width:0; min-height:0; animation:none !important; transition:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-nav] { align-self:start; padding:var(--fan-rail-nav-offset) 0 0 !important; max-height:var(--fan-rail-nav-limit,100%); overflow-y:auto; overscroll-behavior-y:contain; scrollbar-width:none; }",
      "[data-fan-rail-nav] > *, [data-fan-rail-actions] > * { flex-shrink:0; }",
      "[data-fan-rail-footer] { display:contents !important; animation:none !important; transition:none !important; transform:none !important; opacity:1 !important; }",
      "[data-fan-rail-actions] { align-self:start; margin-top:var(--fan-rail-actions-top,0px) !important; padding:0 !important; max-height:var(--fan-rail-actions-limit,100%); overflow-y:auto; scrollbar-width:none; }",
      "[data-fan-rail-settings] { align-self:end; padding:0 0 2px !important; }",
      "[data-fan-rail-actions] [data-fan-rail-popup] { left:var(--fan-rail-popup-left) !important; top:var(--fan-rail-popup-top) !important; bottom:auto !important; }",
      "[data-fan-rail-cluster] { display:flex !important; flex-direction:column; align-items:center; justify-content:center; gap:var(--fan-rail-gap) !important; width:var(--fan-rail-width) !important; height:auto !important; min-width:0; margin:0 !important; padding:0 !important; }",
      "[data-fan-rail-button] { position:relative; display:flex !important; align-items:center; justify-content:center; flex-shrink:0; width:36px !important; min-width:36px !important; max-width:36px !important; height:36px !important; min-height:36px !important; padding:0 !important; gap:0 !important; margin-left:auto !important; margin-right:auto !important; font-size:0 !important; white-space:nowrap; }",
      "[data-fan-rail-drawer] [data-fan-rail-button] { width:44px !important; min-width:44px !important; max-width:44px !important; height:44px !important; min-height:44px !important; }",
      "[data-fan-rail-drawer] [data-fan-rail-actions] [data-mobile-nav='drawer-actions'] { display:contents !important; }",
      "[data-fan-rail-drawer] [data-fan-rail-actions] [data-mobile-nav='drawer-actions'] > button[data-mobile-nav='session-log'] { display:none !important; }",
      "[data-fan-rail-button] svg, [data-fan-rail-unpin] svg { width:18px; height:18px; flex-shrink:0; }",
      "[data-fan-rail-glyph] { display:inline-flex; justify-content:center; align-items:center; font-size:18px; }",
      "[data-fan-rail-label] { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip-path:inset(50%) !important; white-space:nowrap !important; }",
      "[data-fan-sidebar-rail] button:focus { outline:none !important; }",
      "[data-fan-sidebar-rail] button:focus-visible { color:var(--dsw-alias-brand-primary) !important; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] { grid-template-columns:52px var(--fan-rail-host-tail) !important; --dsh-windows-sidebar-width:52px !important; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] [data-fan-sidebar-rail] { width:52px !important; padding:6px 0 !important; grid-template-columns:52px 0; }",
      "[data-fan-rail-frame][data-sidebar-collapsed] [data-fan-rail-new] { margin-left:0 !important; margin-right:0 !important; }",
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
      "/* Keep the approved dark palette; only the host light theme lowers HSL lightness. */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) {",
      "  --fan-md-bold:#c3aee0;",
      "  --fan-md-summary:#9bb8d9;",
      "  --fan-md-summary-marker:#92aedb;",
      "  --fan-md-summary-hover:#abc5e3;",
      "  --fan-md-ul-marker:#d2b489;",
      "  --fan-md-ol-marker:#d3bb92;",
      "  --fan-md-code:#dfcd9a;",
      "  --fan-md-italic:#dca8b9;",
      "  --fan-md-deleted:#8b949e;",
      "  --fan-md-deleted-line:#cf8188;",
      "  --fan-md-quote:#c3cbd8;",
      "  --fan-md-mark:#d9c68c;",
      "  --fan-md-h1:#b9c9df;",
      "  --fan-md-h2:" + markdownH2Dark + ";",
      "  --fan-md-h3:#cbb7e1;",
      "  --fan-md-minor-heading:#e0e4eb;",
      "}",
      "body:not([data-ds-dark-theme]) :where([data-slot^=\"conversation.chat\"], [data-step-process]) {",
      "  --fan-md-bold:hsl(265.200000, 44.642857%, 32%);",
      "  --fan-md-summary:hsl(211.935484, 44.927536%, 32%);",
      "  --fan-md-summary-marker:hsl(216.986301, 50.344828%, 32%);",
      "  --fan-md-summary-hover:hsl(212.142857, 50.000000%, 36%);",
      "  --fan-md-ul-marker:hsl(35.342466, 44.785276%, 32%);",
      "  --fan-md-ol-marker:hsl(37.846154, 42.483660%, 32%);",
      "  --fan-md-code:hsl(44.347826, 51.879699%, 30%);",
      "  --fan-md-italic:hsl(340.384615, 42.622951%, 32%);",
      "  --fan-md-deleted:hsl(211.578947, 8.920188%, 38%);",
      "  --fan-md-deleted-line:hsl(354.615385, 44.827586%, 32%);",
      "  --fan-md-quote:hsl(217.142857, 21.212121%, 34%);",
      "  --fan-md-mark:hsl(45.194805, 50.326797%, 30%);", 
      "  --fan-md-h1:hsl(214.736842, 37.254902%, 32%);",
      "  --fan-md-h2:" + markdownH2Light + ";",
      "  --fan-md-h3:hsl(268.571429, 41.176471%, 32%);",
      "  --fan-md-minor-heading:hsl(218.181818, 21.568627%, 28%);",
      "}",
      "",
      "/* 加粗文本：低饱和浅丁香紫 / 柔烟紫 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) strong,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) b,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"strong\"],",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"bold\"] {",
      "  color: var(--fan-md-bold) !important;",
      "  font-weight: 600 !important;",
      "}",
      "",
      "/* 总结与折叠摘要：低饱和雾霾冷蓝 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details > summary,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [data-disclosure-header],",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) [class*=\"summary\"] {",
      "  color: var(--fan-md-summary) !important;",
      "  font-weight: 600 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary::marker,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary::-webkit-details-marker {",
      "  color: var(--fan-md-summary-marker) !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) summary:hover,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details > summary:hover {",
      "  color: var(--fan-md-summary-hover) !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) details {",
      "  border-left: 2px solid rgba(155, 184, 217, 0.4) !important;",
      "  padding-left: 0.75rem !important;",
      "  margin: 0.5rem 0 !important;",
      "}",
      "",
      "/* 列表样式与标记：低饱和暖杏黄 / 柔麦金 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) li::marker {",
      "  color: var(--fan-md-ul-marker) !important;",
      "  font-weight: 600 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) ul > li::marker {",
      "  color: var(--fan-md-ul-marker) !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) ol > li::marker {",
      "  color: var(--fan-md-ol-marker) !important;",
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
      "  color: var(--fan-md-code) !important;",
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
      "  color: var(--fan-md-italic) !important;",
      "  font-style: italic !important;",
      "}",
      "",
      "/* 删除线文本：淡灰紫 + 低饱和灰暗红贯穿线 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) del,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) s,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) strike {",
      "  color: var(--fan-md-deleted) !important;",
      "  text-decoration: line-through !important;",
      "  text-decoration-color: var(--fan-md-deleted-line) !important;",
      "}",
      "",
      "/* 块引用：低饱和暗紫边框 + 幽暗半透明背景 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) blockquote {",
      "  border-left: 3px solid #916db0 !important;",
      "  background: rgba(145, 109, 176, 0.08) !important;",
      "  padding: 0.6em 1em !important;",
      "  margin: 0.75em 0 !important;",
      "  color: var(--fan-md-quote) !important;",
      "  border-radius: 0 !important;",
      "}",
      "",
      "/* 高亮文本：低饱和暖金光晕 */",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) mark {",
      "  background: rgba(217, 198, 140, 0.22) !important;",
      "  color: var(--fan-md-mark) !important;",
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
      "  color: var(--fan-md-h1) !important;",
      "  border-bottom: 1px solid rgba(185, 201, 223, 0.25) !important;",
      "  padding-bottom: 0.3em !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h2 {",
      "  color: var(--fan-md-h2) !important;",
      "  border-bottom: 1px solid rgba(164, 204, 204, 0.2) !important;",
      "  padding-bottom: 0.25em !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h3 {",
      "  color: var(--fan-md-h3) !important;",
      "  border-radius: 0 !important;",
      "}",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h4,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h5,",
      ":where([data-slot^=\"conversation.chat\"], [data-step-process]) h6 {",
      "  color: var(--fan-md-minor-heading) !important;",
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
      "  color: var(--fan-md-h3) !important;",
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
      "/* Compact model rows: host theme, diamond thumb, no extra panels/copy. */",
      "[data-fan-model-menu]:has(> .fan-model-sliders:not([hidden])) { box-sizing:border-box !important; width:340px !important; min-width:0 !important; max-width:calc(100vw - 24px) !important; padding:4px !important; }",
      "[data-fan-model-menu]:has(> .fan-model-sliders:not([hidden])) > [data-fan-model-cell], [data-fan-model-menu]:has(> .fan-model-sliders:not([hidden])) > [data-slot='conversation.input.model.options'] > button[data-codex-model-option][data-fan-model-cell] { display:none !important; }",
      ".fan-model-sliders[hidden], .fan-model-error[hidden] { display:none !important; }",
      ".fan-model-row { display:grid; grid-template-columns:6em minmax(72px,1fr) 4em; align-items:center; gap:8px; min-height:36px; padding:0 8px; font-size:12px; line-height:18px; color:var(--dsw-alias-label-primary); }",
      ".fan-model-row label { min-width:0; color:var(--dsw-alias-label-secondary); }",
      ".fan-model-value { color:var(--dsw-alias-label-tertiary); text-align:end; overflow-wrap:anywhere; }",
      ".fan-model-control { --fan-model-rail:var(--dsw-alias-label-tertiary); --fan-model-fill:var(--dsw-alias-label-tertiary); --fan-model-tick:color-mix(in srgb,var(--dsw-alias-label-secondary) 75%,var(--dsw-alias-bg-base)); --fan-model-thumb-hover:color-mix(in srgb,#a17bcc 85%,var(--dsw-alias-label-primary)); display:block; position:relative; min-width:0; height:32px; }",
      ".fan-model-track { position:absolute; inset:15.5px 5px auto; height:1px; background:var(--fan-model-rail); pointer-events:none; }",
      ".fan-model-fill { display:block; height:100%; background:var(--fan-model-fill); transition:width 140ms cubic-bezier(.2,.8,.2,1); }",
      ".fan-model-thumb { position:absolute; top:-4.5px; left:0; width:10px; height:10px; z-index:2; border:0; border-radius:0; background:var(--dsw-alias-label-primary); transform:translateX(-50%) rotate(45deg); pointer-events:none; transition:left 140ms cubic-bezier(.2,.8,.2,1),background-color 100ms ease; }",
      ".fan-model-control[data-thumb-hover] .fan-model-thumb { background:var(--fan-model-thumb-hover); }",
      ".fan-model-row[data-editing=pointer] .fan-model-thumb { transition-duration:100ms,100ms; }",
      ".fan-model-row[data-editing=pointer] .fan-model-fill { transition-duration:100ms; }",
      ".fan-model-ticks { position:absolute; inset:13px 5px auto; pointer-events:none; }",
      ".fan-model-ticks i { position:absolute; width:1px; height:6px; background:var(--fan-model-tick); transform:translateX(-.5px); }",
      ".fan-model-ticks i:first-child { transform:none; }",
      ".fan-model-ticks i:last-child:not(:first-child) { transform:translateX(-100%); }",
      ".fan-model-sliders:not([aria-busy=true]) .fan-model-control:has(input:disabled) :is(.fan-model-track,.fan-model-ticks) { opacity:.5; }",
      "@media (prefers-reduced-motion:reduce) { .fan-model-thumb,.fan-model-fill { transition:none !important; } }", 
      ".fan-model-row input[type=range] { appearance:none !important; display:block; width:100%; height:32px; margin:0; padding:0; border:0 !important; border-radius:0 !important; background:transparent !important; outline:none !important; box-shadow:none !important; cursor:pointer; position:relative; }",
      ".fan-model-row input[type=range]::-webkit-slider-runnable-track { height:2px; border:0; border-radius:0; background:transparent; }",
      ".fan-model-row input[type=range]::-webkit-slider-thumb { appearance:none; width:10px; height:10px; margin-top:-4px; border:0; border-radius:0; background:transparent; opacity:0; box-shadow:none; }",
      ".fan-model-row input[type=range]:disabled { cursor:default; opacity:.5; }",
      ".fan-model-row:has(input:focus-visible) .fan-model-value { color:var(--dsw-alias-brand-primary) !important; }",
      ".fan-model-error { padding:4px 8px; font-size:12px; color:var(--dsw-alias-state-error-primary); }",
      ".codexModelSelectMenu:has(> .fan-model-sliders) > .codexModelSelectCell:focus { outline:none !important; box-shadow:none !important; }",
      ".codexModelSelectMenu:has(> .fan-model-sliders) > .codexModelSelectCell:focus-visible .codexModelSelectCellLabel { color:var(--dsw-alias-brand-primary) !important; }",
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
      " :is([data-slot^=\"conversation.chat\"], [data-chat-flow]) :is([data-disclosure-row], [data-json-expander], [data-sample=\"bash\"][role=\"button\"], button[aria-expanded], details > summary):focus-visible { color:var(--dsw-alias-brand-primary) !important; }",
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
      var sheet = SUBAGENT_CSS_PLUGIN + '/SubagentHeaderLineage.module.css';
      var native = { row: nativeClass(sheet,'row'), label: nativeClass(sheet,'label'),
        content: nativeClass(sheet,'content'), secondary: nativeClass(sheet,'secondaryLabel'), mode: 'native' };
      if (native.row && native.label && native.content && native.secondary) return native;
      var found = { mode: 'legacy' };
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
      return found.row && found.label && found.summary ? found : null;
    }

    // 把全部分类目录按标题摊平：标题文本 -> childSessionId 数组。
    function catalogByLabel(snap) {
      var map = Object.create(null);
      try {
        var proj = (snap && snap.projectionsBySession) || {}, summaries = (snap && snap.byId) || {};
        Object.keys(proj).forEach(function (pid) {
          var values = proj[pid] && proj[pid].values;
          var cat = values && values.subagentCatalog;
          if (!Array.isArray(cat)) return;
          cat.forEach(function (entry) {
            if (!entry || entry.id === void 0) return;
            var name = (entry.mode === 'continuable' || entry.mode === 'external') && entry.name != null ? entry.name : entry.id;
            var label = String(entry.label || (summaries[entry.id] && summaries[entry.id].title) || name).trim();
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

    // A synchronous consumer and the queued CSS refresh share one parse per
    // invalidation generation. Sheet identity/metadata also catch changes before
    // observer delivery; direct CSSOM edits still need an explicit signal.
    function sameMotionSources(a, b) {
      return !!a && (a === b || (a.length === b.length && a.every(function (source, i) {
        var next = b[i];
        return source.sheet === next.sheet && source.owner === next.owner && source.disabled === next.disabled &&
          source.media === next.media && source.plugin === next.plugin && source.href === next.href;
      })));
    }
    function snapshotMotionSources(sheets, owned, previous) {
      var next = null, count = 0;
      sheets.forEach(function (sheet) {
        var node = sheet.ownerNode;
        if (!node || owned.has(node)) return;
        var disabled = sheet.disabled, media = sheet.media.mediaText;
        var plugin = node.getAttribute('data-plugin-css') || '', href = node.getAttribute('href') || '';
        var before = previous && previous[count];
        if (before && before.sheet === sheet && before.owner === node && before.disabled === disabled && before.media === media && before.plugin === plugin && before.href === href) {
          if (next) next.push(before);
        } else {
          if (!next) next = previous ? previous.slice(0, count) : [];
          next.push({sheet:sheet,owner:node,disabled:disabled,media:media,plugin:plugin,href:href});
        }
        count++;
      });
      // Revalidate every field, but allocate new snapshots only after a change.
      return next || (previous ? (count === previous.length ? previous : previous.slice(0, count)) : []);
    }
    function motionIndexCache(build) {
      var generation = 0, parsed = -1, sources = null, value = null;
      return {
        invalidate: function () { generation++; },
        current: function () { return parsed === generation ? value : null; },
        snapshot: function () { return sources; },
        clear: function () { generation++; parsed = -1; sources = null; value = null; },
        read: function (next) {
          if (!sameMotionSources(sources, next)) { sources = next; generation++; }
          if (parsed !== generation) { var revision = generation, result = build(next); value = result; parsed = revision; }
          return value;
        }
      };
    }
    function hasExternalMotionMutation(records, owned) {
      return records.some(function (record) {
        if (owned(record.target)) return false;
        return record.type !== 'childList' || Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) { return !owned(node); });
      });
    }
    // Keep the first occurrence of each outer candidate. Discovery can then scan
    // an added subtree once even when the same commit also records its children.
    function outerCandidates(nodes, parentOf) {
      var candidates = new Set(nodes);
      return Array.from(candidates).filter(function (node) {
        for (var parent = parentOf(node); parent; parent = parentOf(parent)) if (candidates.has(parent)) return false;
        return true;
      });
    }

    // Observe only mounted feature roots. Body observation discovers roots, never
    // rescans/reorders feature data in response to unrelated streaming text.
    function mayDetachRoots(nodes) {
      for (var i = 0; i < nodes.length; i++) if (nodes[i].nodeType === 1 || nodes[i].nodeType === 11) return true;
      return false;
    }
    function isEchoTransfer(removedHistory, added, removed, durable, readUsers) {
      if (removedHistory || added || removed !== 1 || durable.length !== 1) return false;
      var allUsers = readUsers();
      return allUsers[allUsers.length - 1] === durable[0];
    }
    function menuDiscoveryChanged(records, picker, owned, anchor) {
      if (owned && (!owned.menu.isConnected || owned.container.parentNode !== owned.menu || (owned.trigger && (!owned.trigger.isConnected || !anchor || !anchor.isConnected || anchor.closest(picker.trigger) !== owned.trigger)))) return true;
      var identities = null;
      for (var i = 0; i < records.length; i++) {
        var record = records[i], target = record.target, menu;
        if (record.type === 'attributes') {
          if (record.attributeName === 'class') {
            if (!identities) identities = [picker.menu,picker.cell,picker.label,picker.trigger].filter(Boolean).map(function (selector) { return selector.slice(1); });
            if (!identities.some(function (name) { return target.classList.contains(name) || (record.oldValue || '').indexOf(name) >= 0; })) continue;
          } else if (record.attributeName === 'id') {
            if (!target.matches(picker.menu) && (!owned || target !== owned.menu)) continue;
          } else if (!anchor || !target.contains(anchor) || !target.matches(picker.trigger)) continue;
          menu = target.closest(picker.menu);
          var before = record.attributeName === 'class' ? (record.oldValue || '').split(/\s+/) : [];
          if ((menu && (!owned || menu !== owned.menu)) || (owned && target === owned.menu) || before.indexOf(picker.menu.slice(1)) >= 0) return true;
          if (anchor && target.contains(anchor) && (target.matches(picker.trigger) || before.indexOf(picker.trigger.slice(1)) >= 0)) return true;
          continue;
        }
        if (!record.addedNodes.length) continue;
        for (var j = 0; j < record.addedNodes.length; j++) {
          var node = record.addedNodes[j];
          if (node.nodeType !== 1) continue;
          if (node.matches(picker.menu) || node.querySelector(picker.menu)) return true;
          if (anchor && node.contains(anchor) && anchor.closest(picker.trigger)) return true;
        }
        // Retry a menu whose native cells arrive in a later commit. Changes to
        // our mounted panel are handled locally, not by a full document scan.
        menu = target && target.nodeType === 1 ? target.closest(picker.menu) : null;
        if (menu && (!owned || menu !== owned.menu)) return true;
      }
      return false;
    }
    function watchRoots(selector, mount, discoverParent, batchDiscovery) {
      var roots = new Map();
      function attach(el) {
        if (!roots.has(el)) { var dispose = mount(el); if (typeof dispose === 'function') roots.set(el, dispose); }
      }
      function add(node, discovered) {
        if (node.nodeType !== 1) return;
        function found(el) { if (discovered) discovered.add(el); else attach(el); }
        if (node.matches(selector)) found(node);
        node.querySelectorAll(selector).forEach(found);
      }
      add(document.body);
      var observer = new MutationObserver(function (records) {
        var removed = false, candidates = batchDiscovery ? [] : null;
        records.forEach(function (r) {
          r.addedNodes.forEach(function (node) { if (candidates) { if (node.nodeType === 1 && node.isConnected) candidates.push(node); } else add(node); });
          // A :has(> header) shell can become eligible in a later React commit.
          // Check only the mutation's direct parent, never rescan mounted roots.
          if (discoverParent && r.target.nodeType === 1 && !roots.has(r.target) && r.target.matches(selector)) {
            if (candidates) { if (r.target.isConnected) candidates.push(r.target); } else add(r.target);
          }
          // Text/comment replacement cannot detach an Element root.
          if (!removed && mayDetachRoots(r.removedNodes)) removed = true;
        });
        if (candidates) {
          var discovered = new Set();
          outerCandidates(candidates, function (node) { return node.parentElement; }).forEach(function (node) { add(node, discovered); });
          // Stay in this observer callback: the next microtask can already close
          // a card, before ResizeObserver supplies any replacement baseline.
          discovered.forEach(attach);
        }
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

    function sidebarPaintEdgeCss() {
      var sheet = '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css', root = nativeClass(sheet,'root');
      if (!root) return '';
      var selectors = ['panelEntry','panelRow'].map(function (local) {
        var name = nativeClass(sheet,local);
        return name ? '[data-fan-sidebar-rail].' + window.CSS.escape(root) + ' .' + window.CSS.escape(name) : '';
      }).filter(Boolean);
      // border-inline:0 resets color to currentColor. Keep spacer endpoints equal.
      return selectors.length ? selectors.join(',') + '{border-inline-color:transparent!important;}' : '';
    }

    // Paint-only defaults live in a low-priority layer. Native transition owners
    // (including partial longhands and late CSS Modules) always keep their contract.
    // Only head stylesheets are inspected; no chat text, form values or body rescan.
    function defaultMotionIndex(sources) {
      var nativeClasses = new Set(), protectedClasses = new Set(), protectedSelectors = new Set(), paintClasses = new Set();
      var controlProtectedClasses = new Set(), keyframes = new Map(), mediaQueries = new Set(), sheets = [], borderHoverSelectors = [];
      function split(text, compounds) {
        var parts = [], start = 0, depth = 0, bracket = 0, quote = '', escaped = false;
        for (var i = 0; i < text.length; i++) {
          var c = text[i];
          if (escaped) { escaped = false; continue; }
          if (c === '\\') { escaped = true; continue; }
          if (quote) { if (c === quote) quote = ''; continue; }
          if (c === '"' || c === "'") { quote = c; continue; }
          if (c === '(') depth++; else if (c === ')') depth--;
          else if (c === '[') bracket++; else if (c === ']') bracket--;
          if (!depth && !bracket && (compounds ? /[\s>+~]/.test(c) : c === ',')) { if (text.slice(start,i).trim()) parts.push(text.slice(start,i).trim()); start = i + 1; }
        }
        if (text.slice(start).trim()) parts.push(text.slice(start).trim());
        return parts;
      }
      function classes(selector) {
        var clean = '', depth = 0, bracket = 0, quote = '', escaped = false;
        for (var i = 0; i < selector.length; i++) {
          var c = selector[i];
          if (escaped) { escaped = false; continue; }
          if (c === '\\') { escaped = true; continue; }
          if (quote) { if (c === quote) quote = ''; continue; }
          if (c === '"' || c === "'") { quote = c; continue; }
          if (c === '(') depth++; else if (c === ')') depth--;
          else if (c === '[') bracket++; else if (c === ']') bracket--;
          if (!depth && !bracket) clean += c;
        }
        return Array.from(clean.matchAll(/\.([\w-]+)/g), function (m) { return m[1]; });
      }
      function mediaActive(text, active) {
        if (!text || text === 'all') return active;
        mediaQueries.add(text);
        return active && window.matchMedia(text).matches;
      }
      function groupActive(rule, active) {
        if (rule.media) return mediaActive(rule.media.mediaText, active);
        if (rule.type === 12) return active && window.CSS.supports(rule.conditionText);
        // Container/scope conditions cannot be resolved globally: stay conservative.
        return active;
      }
      function collectKeyframes(rules, active) {
        Array.from(rules || []).forEach(function (rule) {
          if (rule.type === 7) {
            if (!active) return;
            var paint = Array.from(rule.cssRules).some(function (frame) {
              return Array.from(frame.style).some(function (key) {
                return /^(?:all|color|background(?:-|$)|border(?:-|$)|fill$|stroke$|text-decoration(?:-|$)|--)/.test(key);
              });
            });
            // Ambiguous duplicate names remain protected if any active definition paints.
            keyframes.set(rule.name, paint || keyframes.get(rule.name) === true);
          } else if (rule.cssRules) collectKeyframes(rule.cssRules, groupActive(rule, active));
        });
      }
      function animationOwnsPaint(style, keys, native) {
        if (!keys.some(function (key) { return /^animation(?:-|$)/.test(key); })) return false;
        var names = style.getPropertyValue('animation-name').trim();
        if (!names && native) {
          // A shorthand containing var() leaves ALL CSSOM longhands unresolved.
          // This pinned host token is a timing function, not a dynamic animation
          // name. Parse a detached declaration with a neutral timing function;
          // never rewrite the real declaration or resolve arbitrary variables.
          var shorthand = style.getPropertyValue('animation').replace(/var\(\s*--ds-ease-in-out\s*\)/g,'linear');
          if (shorthand && !/\b(?:var|env)\s*\(/.test(shorthand)) {
            var probe = document.createElement('span').style;
            probe.setProperty('animation',shorthand);
            names = probe.getPropertyValue('animation-name').trim();
          }
        }
        // Partial longhands, dynamic names and unknown definitions stay protected.
        if (!names) return true;
        return split(names, false).some(function (name) {
          if (name === 'none') return false;
          if ((name[0] === '"' || name[0] === "'") && name[name.length - 1] === name[0]) name = name.slice(1,-1);
          return !keyframes.has(name) || keyframes.get(name);
        });
      }
      function walk(rules, native, active) {
        Array.from(rules || []).forEach(function (rule) {
          if (rule.selectorText && rule.style) {
            var keys = Array.from(rule.style);
            var motion = keys.some(function (key) { return /^(?:transition|animation)(?:-|$)/.test(key); });
            // Even explicit none/partial longhands retain native control, including
            // declarations in a lower cascade layer. Only inactive conditions yield.
            var transition = keys.some(function (key) { return /^transition(?:-|$)/.test(key); });
            var controlMotion = active && (transition || animationOwnsPaint(rule.style, keys, native));
            var paint = keys.some(function (key) { return /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|fill|stroke)$/.test(key) || /^--.*(?:color|fill|background|\bbg\b)/i.test(key); });
            split(rule.selectorText, false).forEach(function (selector) {
              var segments = split(selector, true), terminal = segments[segments.length - 1] || '';
              var own = classes(terminal);
              if (active && /:hover\b/.test(selector) && keys.some(function (key) { return /^border(?:-|$)|^box-shadow$|^--.*stroke.*color/.test(key); })) {
                var neutral = selector.replace(/:hover\b/g, '');
                try { document.createDocumentFragment().querySelector(neutral); borderHoverSelectors.push(neutral); } catch (_) {}
              }
              if (native) classes(selector).forEach(function (name) { nativeClasses.add(name); });
              if (!/::/.test(terminal)) {
                // Surface opacity keeps its original guard. Paint-only controls may
                // coexist with a known opacity/transform entrance, never replace it.
                if (motion) own.forEach(function (name) { protectedClasses.add(name); });
                if (controlMotion) {
                  if (own.length) own.forEach(function (name) { controlProtectedClasses.add(name); });
                  else if (/^(?:button|input|select|textarea|summary|a|\[role=)/.test(terminal)) protectedSelectors.add(selector.replace(/:(?:hover|active|focus-visible|focus-within|focus|checked|disabled|enabled|invalid|valid)\b/g,''));
                }
              }
              if (native && paint && !/::/.test(terminal) && (/:hover|:focus|:active|:checked|:disabled|\[(?:aria-|data-(?:state|open|selected|checked|active))/.test(selector) || own.some(function (name) { return /_(?:\w*(?:button|trigger|item|input|field|tab|option|row|link|control|checkbox|radio|switch|themeCube|card|chip|pill|action))$/i.test(name); }))) own.forEach(function (name) { paintClasses.add(name); });
            });
          }
          if (rule.cssRules && rule.type !== 7) walk(rule.cssRules, native, groupActive(rule, active));
        });
      }
      sources.forEach(function (source) {
        var sheet = source.sheet, node = source.owner;
        if (source.disabled) return;
        var id = source.plugin, native = /^@deepseek-ai\/dsh-client-ui(?:-|\/)/.test(id);
        // Exact installed 0.2.1-rc.3 shell asset (SHA-256 47c890e8b3898eb4
        // e5a53933bd318e58d4cf168cd7ccef46789d48a070bba591). An arbitrary same-
        // origin /assets/*.css is not ownership proof and is never enrolled.
        if (node.tagName === 'LINK') {
          try { var url = new URL(sheet.href,location.href); if (url.origin === location.origin && url.pathname.endsWith('/assets/index-BNyAYEM7.css')) native = true; } catch (_) {}
        }
        try { sheets.push({rules:sheet.cssRules,native:native,active:mediaActive(sheet.media.mediaText,true)}); } catch (_) { /* Cross-origin sheets stay untouched. */ }
      });
      sheets.forEach(function (sheet) { collectKeyframes(sheet.rules,sheet.active); });
      sheets.forEach(function (sheet) { walk(sheet.rules,sheet.native,sheet.active); });
      var base = ['button','a[href]','input:not([type="hidden"])','textarea','select','summary','[role="button"]','[role="tab"]','[role="checkbox"]','[role="radio"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="menuitemcheckbox"]','[role="menuitemradio"]','[role="treeitem"]'];
      paintClasses.forEach(function (name) { if (!controlProtectedClasses.has(name)) base.push('.' + window.CSS.escape(name)); });
      var controls = ':where(' + base.join(',') + '):not(:where(.xterm,.xterm *,[data-fan-footer-ghost],[data-fan-footer-ghost] *))';
      var exclude = '[style*="transition" i],[style*="animation" i],[data-dragging],[data-fan-footer-panel],[data-fan-default-surface]';
      controlProtectedClasses.forEach(function (name) { exclude += ',.' + window.CSS.escape(name); });
      var protect = Array.from(protectedSelectors).filter(function (selector) { try { document.createDocumentFragment().querySelector(selector); return true; } catch (_) { return false; } });
      // Editors keep paint transitions, their native caret and authored text marks.
      // Only existing control colors change for non-editable focus.
      var editors = ':read-write,textarea,[role="textbox"],[role="searchbox"],[contenteditable]:not([contenteditable="false" i]),input:not(:where([type="button" i],[type="submit" i],[type="reset" i],[type="checkbox" i],[type="radio" i],[type="range" i],[type="color" i],[type="file" i],[type="image" i]))';
      var focusControls = controls + ':not(:where(' + editors + '))';
      var css = '@layer fanframe-default-motion{@media(prefers-reduced-motion:no-preference){' + controls + ':not(:where(' + exclude + ')){transition-property:background-color,color,border-color,fill,stroke,text-decoration-color;transition-duration:var(--ds-transition-duration-fast,.1s);transition-timing-function:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));transition-delay:0s;}' +
        (protect.length ? ':where(' + protect.join(',') + '){transition:revert-layer;}' : '') + '}}\n' +
        controls + ':is(:focus,:focus-within){outline:none!important;box-shadow:none!important;}\n' +
        focusControls + ':focus-visible{color:var(--dsw-alias-brand-primary)!important;}';
      return { css:css, nativeClasses:nativeClasses, protectedClasses:protectedClasses, mediaQueries:mediaQueries, borderHoverSelectors:borderHoverSelectors };
    }

    // Share the host menu; keep the native button as the sole unpin action owner.
    function railUnpinMenu(menus) {
      var records=new Map(), listeners=new Set(), revision=0, sequence=0, closed=false;
      var kind='fanframe-sidebar-unpin';
      var source={getSnapshot:function(){return revision;},subscribe:function(fn){listeners.add(fn);return function(){listeners.delete(fn);};}};
      function changed(){revision++;Array.from(listeners).forEach(function(fn){fn();});}
      function live(record){return !closed&&record&&record.primary.isConnected&&record.unpin.isConnected&&
        record.entry.parentElement===record.nav&&record.entry.contains(record.primary)&&record.entry.contains(record.unpin)&&
        !record.primary.disabled&&!record.unpin.disabled&&record.primary.getAttribute('aria-disabled')!=='true'&&
        record.unpin.getAttribute('aria-disabled')!=='true'&&record.unpin.getAttribute('aria-label')&&record.nav.querySelector('button[aria-haspopup="menu"]');}
      function closeOwn(id){var active=menus.active.getSnapshot();if(active&&active.kind===kind&&active.value.id===id)menus.close();}
      var unregister=menus.register({id:'fanframe.sidebar-unpin',target:kind,order:0,observe:function(){return [source];},resolve:function(value){
        var record=records.get(value.id);if(!live(record))return [];
        return [{id:'unpin',label:record.unpin.getAttribute('aria-label'),run:function(){
          var current=records.get(value.id);if(live(current))current.unpin.click();
        }}];
      }});
      function bind(primary,unpin,entry,nav){
        var id=String(++sequence), attrs=ownAttrs(entry), record={primary:primary,unpin:unpin,entry:entry,nav:nav};
        var label=unpin.getAttribute('aria-label'), available=!!live(record), disposed=false;
        if(!label||!available)return null;
        records.set(id,record);
        function show(event,keyboard){
          if(disposed||event.defaultPrevented||!live(record))return;
          var rect=keyboard||(!event.clientX&&!event.clientY)?primary.getBoundingClientRect():null;
          event.preventDefault();event.stopPropagation();primary.focus({preventScroll:true});
          menus.open({kind:kind,value:{id:id}},{x:rect?rect.left:event.clientX,y:rect?rect.bottom:event.clientY});
        }
        function context(event){show(event,false);}
        function key(event){
          if(event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||
            !(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey))return;
          show(event,true);
        }
        primary.addEventListener('contextmenu',context);primary.addEventListener('keydown',key);
        attrs.set('data-fan-rail-context-menu','');changed();
        var binding={refresh:function(){
          if(disposed)return false;
          var next=unpin.getAttribute('aria-label'), enabled=!!live(record);
          if(next!==label||enabled!==available){label=next;available=enabled;if(!enabled)closeOwn(id);changed();}
          return enabled;
        },dispose:function(){
          if(disposed)return;disposed=true;closeOwn(id);records.delete(id);
          primary.removeEventListener('contextmenu',context);primary.removeEventListener('keydown',key);attrs.restore();changed();
        }};
        record.binding=binding;return binding;
      }
      return {bind:bind,dispose:function(){
        if(closed)return;closed=true;Array.from(records.values()).forEach(function(record){record.binding.dispose();});
        unregister();listeners.clear();
      }};
    }

    // Independent tool-result renderer. No argument-stream execution or transcript scans.
    function visualizeMeta(value) {
      if (!value || value.kind !== 'fanframe.visualize' || (value.version !== 1 && value.version !== 2) ||
          typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160 ||
          typeof value.html !== 'string' || !value.html.trim() || value.html.length > 262144) return null;
      return new TextEncoder().encode(value.html).length <= 262144 ? value : null;
    }

    // First-party stroke symbols, private to each modern card. No network or script loader.
    function visualizeIcons() {
      var icons = {
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
        cloud: '<path d="M7 18a4 4 0 0 1-.4-8A5.6 5.6 0 0 1 17 8.6a4.8 4.8 0 0 1 .5 9.4Z"/>',
        'cloud-sun': '<path d="M3.5 10a3.8 3.8 0 0 1 6.8-3.2M7 2v1.5M2.4 4.4l1 1M11.6 4.4l-1 1M2 9h1.5M8 19a3.4 3.4 0 0 1-.4-6.8 4.8 4.8 0 0 1 8.9-1.2 4 4 0 0 1 .5 8Z"/>',
        rain: '<path d="M6.5 14a3.2 3.2 0 0 1-.3-6.4 5.3 5.3 0 0 1 9.7-1.4 4 4 0 0 1 1.6 7.8ZM8 17l-1 3m6-3-1 3m6-3-1 3"/>',
        storm: '<path d="M7 14a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 9.2-1.3 4.2 4.2 0 0 1 1.7 8.3H16m-4-2-2.5 5h4l-2.5 5"/>',
        snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 3 3-3m-6 17 3-3 3 3M3.5 10.4l4.1-1.1-1.1-4.1m11 13.6-1.1-4.1 4.1-1.1m-17 0 4.1 1.1-1.1 4.1m11-13.6-1.1 4.1 4.1 1.1"/>',
        wind: '<path d="M3 8h12a2.5 2.5 0 1 0-2.4-3M2 12h17a2 2 0 1 0-1.8-2.8M4 16h10a2.5 2.5 0 1 1-2.4 3"/>',
        thermometer: '<path d="M10 14.1V5a2 2 0 1 1 4 0v9.1a4 4 0 1 1-4 0ZM12 10v7"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
        'trend-up': '<path d="m3 17 6-6 4 4 7-8m-5 0h5v5"/>',
        'trend-down': '<path d="m3 7 6 6 4-4 7 8m-5 0h5v-5"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        'chevron-right': '<path d="m9 5 7 7-7 7"/>'
      };
      return '<svg xmlns="http://www.w3.org/2000/svg" id="fanframe-viz-symbols" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden" fill="none"><defs>' +
        Object.keys(icons).map(function (name) {
          return '<symbol id="fanframe-icon-' + name + '" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</g></symbol>';
        }).join('') + '</defs></svg>';
    }

    function visualizeEscape(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function visualizeJSON(value) {
      return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    }

    // This function is serialized into the opaque iframe; it has no outer dependencies.
    function visualizeRuntime(channel, initialPalette, modern) {
      var root = null, resize = null, mutations = null, frame = 0, stopped = false, errorNode = null, pendingError = '';
      var labels = { error: 'JavaScript error', resource: 'Resource could not be loaded', policy: 'Blocked by visualization policy' };
      function measure() {
        frame = 0;
        if (stopped || !root) return;
        var height = Math.max(root.scrollHeight, root.getBoundingClientRect().height);
        // Classic horizontal scrollbars consume part of the iframe's height.
        if (modern) height += Math.max(0, window.innerHeight - document.documentElement.clientHeight);
        parent.postMessage({ type: 'fanframe:visualize:height', channel: channel, height: height }, '*');
      }
      function schedule() { if (!stopped && !frame) frame = requestAnimationFrame(measure); }
      function showError(value) {
        pendingError = String(value || labels.error).slice(0, 1000);
        if (!root) return;
        if (!errorNode) {
          errorNode = document.createElement('pre'); errorNode.setAttribute('role', 'alert');
          errorNode.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:var(--fanframe-viz-foreground);border:1px solid var(--fanframe-viz-border);padding:12px';
          root.appendChild(errorNode);
        }
        errorNode.textContent = pendingError; schedule();
      }
      function palette(values) {
        if (!values || typeof values !== 'object') return;
        var keys = ['background', 'foreground', 'muted', 'border', 'accent', 'focus'];
        if (modern) keys.push('highlight', 'series-1', 'series-2');
        keys.forEach(function (key) {
          if (typeof values[key] === 'string' && values[key].length <= 256 && CSS.supports('color', values[key]))
            document.documentElement.style.setProperty('--fanframe-viz-' + key, values[key]);
        });
        if (typeof values.font === 'string' && values.font.length <= 256 && CSS.supports('font-family', values.font))
          document.documentElement.style.setProperty('--fanframe-viz-font', values.font);
        if (values.scheme === 'light' || values.scheme === 'dark') document.documentElement.style.colorScheme = values.scheme;
        if (values.labels && typeof values.labels === 'object') ['error', 'resource', 'policy'].forEach(function (key) {
          if (typeof values.labels[key] === 'string' && values.labels[key].length <= 160) labels[key] = values.labels[key];
        });
        schedule();
      }
      function onMessage(event) {
        if (event.source !== parent || !event.data || event.data.type !== 'fanframe:visualize:theme' || event.data.channel !== channel) return;
        palette(event.data.palette);
      }
      function onError(event) { showError(event.message || labels.resource); }
      function onRejection(event) { showError(event.reason); }
      function onPolicy(event) { showError(labels.policy + ': ' + String(event.effectiveDirective || 'CSP')); }
      function start() {
        if (stopped) return;
        root = document.getElementById('fanframe-visualize-content');
        if (!root) return;
        if (pendingError) showError(pendingError);
        resize = new ResizeObserver(schedule); resize.observe(root);
        mutations = new MutationObserver(schedule); mutations.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
        schedule();
      }
      function stop() {
        stopped = true; cancelAnimationFrame(frame);
        if (resize) resize.disconnect(); if (mutations) mutations.disconnect();
        document.removeEventListener('DOMContentLoaded', start);
        window.removeEventListener('message', onMessage); window.removeEventListener('error', onError, true);
        window.removeEventListener('securitypolicyviolation', onPolicy);
        window.removeEventListener('unhandledrejection', onRejection); window.removeEventListener('resize', schedule);
        window.removeEventListener('load', schedule); window.removeEventListener('pagehide', stop);
      }
      window.addEventListener('message', onMessage); window.addEventListener('error', onError, true);
      window.addEventListener('securitypolicyviolation', onPolicy);
      window.addEventListener('unhandledrejection', onRejection); window.addEventListener('resize', schedule);
      window.addEventListener('load', schedule); window.addEventListener('pagehide', stop);
      document.addEventListener('DOMContentLoaded', start, { once: true }); palette(initialPalette);
    }

    // The caption and iframe use the same neutral surface without an extra content wrapper.
    function visualizeSurface(background, foreground) {
      return 'color-mix(in srgb,' + background + ' 96%,' + foreground + ')';
    }

    // V2 styles the surface and controls, not the card's content or data.
    function visualizeControlStyles() {
      return `<style id="fanframe-visualize-controls">
/* Match the base :root selector so the later card surface wins the cascade. */
:root { overflow:auto;background:${visualizeSurface('var(--fanframe-viz-background,Canvas)', 'var(--fanframe-viz-foreground,CanvasText)')};scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--fanframe-viz-muted,CanvasText) 34%,transparent) transparent; }
html body { overflow:visible; }
#fanframe-visualize-content {
  padding:8px 14px 12px;
  --fan-viz-control-border:color-mix(in srgb,var(--fanframe-viz-muted,CanvasText) 21%,var(--fanframe-viz-background,Canvas));
  --fan-viz-control-hover:color-mix(in srgb,var(--fanframe-viz-foreground,CanvasText) 8%,var(--fanframe-viz-background,Canvas));
  --fan-viz-control-ink:var(--fanframe-viz-foreground,CanvasText);
  --fan-viz-control-focus:var(--fanframe-viz-focus,LinkText);
}
:where(#fanframe-visualize-content) :is(button,input[type=button],input[type=reset],input[type=submit],select:not([multiple]):not([size]),select:not([multiple])[size="1"]) {
  color:var(--fan-viz-control-ink);background:var(--fanframe-viz-background,Canvas);border:1px solid var(--fan-viz-control-border);
  border-radius:0;min-block-size:30px;padding:3px 9px;font:inherit;line-height:1.4;max-inline-size:100%;cursor:pointer;
}
:where(#fanframe-visualize-content) :is(button,input[type=button],input[type=reset],input[type=submit]) { appearance:none; }
:where(#fanframe-visualize-content) button[data-fan-viz-variant="quiet"] { border-color:transparent;color:var(--fanframe-viz-muted,CanvasText); }
:where(#fanframe-visualize-content) button[data-fan-viz-variant="quiet"]:is(:focus-visible,:active) { border-color:transparent; }
:where(#fanframe-visualize-content) :is(button,input[type=button],input[type=reset],input[type=submit],select:not([multiple]):is(:not([size]),[size="1"])):enabled:is(:hover,:open) { background:var(--fan-viz-control-hover); }
:where(#fanframe-visualize-content) :is(button,input[type=button],input[type=reset],input[type=submit]):enabled:active { border-color:var(--fan-viz-control-ink); }
:where(#fanframe-visualize-content) :is(button,input:is([type=button],[type=reset],[type=submit],[type=checkbox]),select:not([multiple]):is(:not([size]),[size="1"])):focus-visible { border-color:var(--fan-viz-control-focus); }
:where(#fanframe-visualize-content) input[type=range] {
  appearance:none;display:inline-block;inline-size:10em;max-inline-size:100%;block-size:26px;
  vertical-align:middle;margin:0;padding:0;border:0;border-radius:0;background:none;cursor:pointer;
}
:where(#fanframe-visualize-content) input[type=range]::-webkit-slider-runnable-track { height:1px;background:var(--fan-viz-control-border); }
:where(#fanframe-visualize-content) input[type=range]::-webkit-slider-thumb {
  appearance:none;width:10px;height:10px;margin-top:-4.5px;border:0;border-radius:0;transform:rotate(45deg);background:var(--fan-viz-control-ink);
}
:where(#fanframe-visualize-content) input[type=range]:enabled:is(:hover,:focus-visible,:active)::-webkit-slider-thumb { background:var(--fan-viz-control-focus); }
:where(#fanframe-visualize-content) input[type=range]::-moz-range-track { height:1px;background:var(--fan-viz-control-border); }
:where(#fanframe-visualize-content) input[type=range]::-moz-range-thumb { width:10px;height:10px;border:0;border-radius:0;transform:rotate(45deg);background:var(--fan-viz-control-ink); }
:where(#fanframe-visualize-content) input[type=range]:enabled:is(:hover,:focus-visible,:active)::-moz-range-thumb { background:var(--fan-viz-control-focus); }
:where(#fanframe-visualize-content) input[type=checkbox] {
  appearance:none;display:inline-grid;place-items:center;inline-size:14px;block-size:14px;vertical-align:-2px;margin:0 .35em 0 0;
  border:1px solid var(--fan-viz-control-border);border-radius:0;color:var(--fan-viz-control-ink);background:var(--fanframe-viz-background,Canvas);cursor:pointer;
}
:where(#fanframe-visualize-content) input[type=checkbox]:enabled:hover { border-color:var(--fan-viz-control-focus); }
:where(#fanframe-visualize-content) input[type=checkbox]:checked::before {
  content:'';inline-size:10px;block-size:10px;background:currentColor;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='m1 5 2.5 2.5L9 2' fill='none' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") center / contain no-repeat;
}
:where(#fanframe-visualize-content) input[type=checkbox]:indeterminate::before { content:'';inline-size:8px;block-size:1px;background:currentColor;mask:none; }
:where(#fanframe-visualize-content) :is(button,input:is([type=button],[type=reset],[type=submit],[type=range],[type=checkbox]),select:not([multiple]):is(:not([size]),[size="1"])):disabled { opacity:.48;cursor:default; }
:where(#fanframe-visualize-content) input:is([type=range],[type=checkbox])[hidden] { display:none; }
@supports (appearance:base-select) and selector(::picker(select)) {
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"]),
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"])::picker(select) { appearance:base-select; }
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"])::picker(select) {
    background:var(--fanframe-viz-background,Canvas);color:var(--fan-viz-control-ink);border:1px solid var(--fan-viz-control-border);
    border-radius:0;padding:2px;max-inline-size:calc(100vw - 24px);max-block-size:min(15em,48dvh);overflow:auto;
  }
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"]) option {
    display:flex;gap:8px;min-block-size:28px;padding:4px 7px;border-radius:0;white-space:normal;overflow-wrap:anywhere;
  }
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"]) option:checked { font-weight:600; }
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"]) option:enabled:is(:hover,:focus) { background:var(--fan-viz-control-hover);color:var(--fan-viz-control-focus); }
  :where(#fanframe-visualize-content) :is(select:not([multiple]):not([size]),select:not([multiple])[size="1"]) option:disabled { opacity:.48; }
}
@media (forced-colors:active) {
  #fanframe-visualize-content { --fan-viz-control-border:ButtonText;--fan-viz-control-ink:ButtonText;--fan-viz-control-focus:LinkText;--fan-viz-control-hover:Canvas; }
  :where(#fanframe-visualize-content) input[type=range]::-webkit-slider-runnable-track,
  :where(#fanframe-visualize-content) input[type=range]::-webkit-slider-thumb,
  :where(#fanframe-visualize-content) input[type=checkbox]::before { forced-color-adjust:none; }
}
</style>`;
    }

    function visualizeDocument(meta, channel, palette) {
      var csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
      return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
        '<title>' + visualizeEscape(meta.title) + '</title>' +
        '<style>:root{color-scheme:light dark;font-family:var(--fanframe-viz-font,system-ui);font-size:14px;line-height:1.6;color:var(--fanframe-viz-foreground,CanvasText);background:var(--fanframe-viz-background,Canvas)}' +
        'html,body{margin:0;padding:0}body{overflow:auto}*,*::before,*::after{box-sizing:border-box}' +
        '#fanframe-visualize-content{display:flow-root;padding:12px;overflow-wrap:anywhere}button,input,select,textarea{font:inherit}' +
        ':focus,:focus-visible{outline:none!important;box-shadow:none!important}' +
        ':focus-visible{color:var(--fanframe-viz-focus,LinkText)!important;accent-color:var(--fanframe-viz-focus,LinkText)!important}</style>' +
        (meta.version === 2 ? visualizeControlStyles() : '') +
        '<script>(' + visualizeRuntime.toString() + ')(' + visualizeJSON(channel) + ',' + visualizeJSON(palette) + (meta.version === 2 ? ',true' : '') + ');</script></head>' +
        '<body><div id="fanframe-visualize-content">' + meta.html + '</div>' +
        (meta.version === 2 && meta.html.includes('#fanframe-icon-') ? visualizeIcons() : '') + '</body></html>';
    }

    function visualizePalette(snapshot, modern) {
      var css = getComputedStyle(document.body || document.documentElement), result = { scheme: snapshot.active.colorScheme, font: css.fontFamily };
      var tokens = { background: '--dsw-alias-bg-base', foreground: '--dsw-alias-label-primary', muted: '--dsw-alias-label-secondary',
        border: '--dsw-alias-border-l1', accent: '--dsw-alias-brand-primary' };
      Object.keys(tokens).forEach(function (key) { result[key] = css.getPropertyValue(tokens[key]).trim(); });
      if (modern) {
        result.highlight = result.scheme === 'dark' ? markdownH2Dark : markdownH2Light;
        result.focus = result.highlight;
        result['series-1'] = result.scheme === 'dark' ? inkAmberDark : inkAmberLight;
        result['series-2'] = result.scheme === 'dark' ? inkBlueDark : inkBlueLight;
      } else result.focus = css.getPropertyValue('--dsw-alias-link').trim() || 'LinkText';
      return result;
    }

    function visualizeListen(frame, channel, update) {
      var queued = 0, height = 120, closed = false;
      function receive(event) {
        var data = event.data;
        if (event.source !== frame.contentWindow || !data || data.type !== 'fanframe:visualize:height' || data.channel !== channel ||
            typeof data.height !== 'number' || !Number.isFinite(data.height) || data.height < 0) return;
        height = Math.max(120, Math.min(960, Math.ceil(data.height)));
        if (!queued) queued = requestAnimationFrame(function () { queued = 0; if (!closed) update(height); });
      }
      window.addEventListener('message', receive);
      return function () { closed = true; window.removeEventListener('message', receive); cancelAnimationFrame(queued); };
    }

    function visualizeEvent(event) {
      if (!event || !event.data) return null;
      var data = event.data, id;
      if (event.type === 'tool/result') {
        if (event.surfaceOp !== 'append' || !data.message || data.message.isError) return null;
        id = data.message.source && data.message.source.callId;
      } else if (event.type === 'tool/ptc-dispatch') {
        if (data.isError || data.name !== 'fanframe_visualize') return null;
        id = data.subCallId;
      } else return null;
      var meta = visualizeMeta(data.meta);
      return meta && typeof id === 'string' && id ? { id: id, meta: meta } : null;
    }

    function visualizeDefinition() {
      var kind = 'fanframe-visualization';
      function match(event) {
        var value = visualizeEvent(event);
        return value ? { id: value.id, role: 'start' } : null;
      }
      return { kind: kind, target: 'chat', match: { 'tool/result': match, 'tool/ptc-dispatch': match },
        start: function (_context, value) { return visualizeMeta(value.event.data.meta); },
        update: function (context, value) { return visualizeMeta(value.event.data.meta) || context.state; },
        buildViewNode: function (context) {
          var value = context.matches[context.matches.length - 1];
          if (!context.state || !value) return null;
          return { key: context.key, id: context.id, kind: kind, target: 'chat', anchorSeq: value.event.seq,
            location: value.location, visibility: 'visible', groupTree: 'turn', data: context.state };
        } };
    }

    function installVisualize(ctx) {
      ctx.inject(['slots', 'locale', 'theme', 'uiConversation'], function (scope) {
        var ns = 'fanframe.visualize', React = require('react');
        scope.locale.register(ns, 'en', { pending: 'Preparing visualization…', failed: 'Visualization failed', invalid: 'This visualization result is unavailable or unsupported.',
          inBody: 'Visualization displayed in the reply.', runtimeError: 'JavaScript error', resourceError: 'Resource could not be loaded', policyError: 'Blocked by visualization policy' });
        scope.locale.register(ns, 'zh', { pending: '正在准备可视化…', failed: '可视化失败', invalid: '此可视化结果不可用或版本不受支持。',
          inBody: '可视化已显示在正文中。', runtimeError: '脚本运行出错', resourceError: '资源无法加载', policyError: '可视化策略已阻止此操作' });
        var t = scope.locale.bind(ns);
        function localeSubscribe(fn) { return scope.locale.subscribe(fn); }
        function localeSnapshot() { return scope.locale.getSnapshot(); }
        function themeSubscribe(fn) { return scope.on('theme/change', fn); }
        function themeSnapshot() { return scope.theme.getTheme(); }
        function Card(props) {
          var meta = props.meta, ref = React.useRef(null), channel = 'fanframe:' + React.useId();
          var modern = meta.version === 2;
          var size = React.useState(120), snapshot = React.useSyncExternalStore(themeSubscribe, themeSnapshot);
          var colors = React.useMemo(function () {
            var palette = visualizePalette(snapshot, modern);
            palette.labels = { error: t('runtimeError'), resource: t('resourceError'), policy: t('policyError') };
            return palette;
          }, [snapshot, props.locale, modern]);
          // Theme updates use a message, not a new document, so scripts/controls do not restart.
          var doc = React.useMemo(function () { return visualizeDocument(meta, channel, colors); }, [meta.version, meta.html, meta.title, channel]);
          function sendTheme() { if (ref.current) ref.current.contentWindow.postMessage({ type: 'fanframe:visualize:theme', channel: channel, palette: colors }, '*'); }
          React.useEffect(function () { return visualizeListen(ref.current, channel, size[1]); }, [channel]);
          React.useEffect(sendTheme, [colors, doc]);
          var style = { margin: 0, minWidth: 0, borderRadius: 0 };
          var caption = { fontWeight: 600, overflowWrap: 'anywhere', color: 'var(--dsw-alias-label-primary)' };
          if (modern) {
            style.background = visualizeSurface('var(--dsw-alias-bg-base,Canvas)', 'var(--dsw-alias-label-primary,CanvasText)');
            style.border = '1px solid color-mix(in srgb,var(--dsw-alias-bg-base,Canvas) 82%,var(--dsw-alias-label-primary,CanvasText))';
            caption.padding = '10px 14px 0';
          } else {
            style.border = '1px solid var(--dsw-alias-border-l1)';
            style.background = 'var(--dsw-alias-bg-base)';
            caption.padding = '8px 12px';
            caption.borderBottom = '1px solid var(--dsw-alias-border-l1)';
          }
          return React.createElement('figure', { 'data-fan-visualize': '', style: style },
            React.createElement('figcaption', { style: caption }, meta.title),
            React.createElement('iframe', { ref: ref, title: meta.title, sandbox: 'allow-scripts', referrerPolicy: 'no-referrer', loading: 'lazy',
              allow: "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; payment 'none'; usb 'none'; serial 'none'; fullscreen 'none'",
              srcDoc: doc, onLoad: sendTheme, style: { display: 'block', width: '100%', height: size[0], border: 0, outline: 'none', boxShadow: 'none', colorScheme: colors.scheme } }));
        }
        function Body(props) {
          var locale = React.useSyncExternalStore(localeSubscribe, localeSnapshot), meta = visualizeMeta(props.node.data);
          return meta ? React.createElement(Card, { meta: meta, key: props.node.key, locale: locale }) : React.createElement('div', { role: 'alert' }, t('invalid'));
        }
        function View(props) {
          React.useSyncExternalStore(localeSubscribe, localeSnapshot);
          if (props.phase !== 'result') return React.createElement('div', { role: 'status' }, t('pending'));
          if (props.block.isError) return React.createElement('div', { role: 'alert' }, t('failed'));
          var meta = visualizeMeta(props.block.meta);
          return React.createElement('div', { role: meta ? 'status' : 'alert' }, t(meta ? 'inBody' : 'invalid'));
        }
        var removeDefinition = scope.uiConversation.events.register(visualizeDefinition());
        var removeBody = scope.slots.inject('conversation.chat.node', function () {
          return scope.slots.register({ name: 'conversation.chat.node', key: 'fanframe-visualization' }, Body);
        });
        var removeTool = scope.slots.inject('tool.call.toolview', function () {
          return scope.slots.register({ name: 'tool.call.toolview', key: 'fanframe_visualize' }, View);
        });
        return function () { removeTool(); removeBody(); removeDefinition(); };
      });
    }

    // Paint only. Native Markdown, React's text nodes and clipboard sources stay intact.
    var proseBlocks = 'p,li,td,th,dt,dd';
    var proseAssistant = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"])';
    var proseExcluded = 'pre,code,kbd,samp,a,button,input,textarea,select,math,svg,[role="math"],.katex,.katex-display,[contenteditable],[data-step-process],[data-turn-process-inline],[data-fan-visualize],summary';
    var proseHidden = '[hidden],[aria-hidden="true"],[data-turn-process-hidden="true"]';
    var proseCjkBreak = /[，。！？；、：…]/, proseAsciiBreak = /[.,;:!?]/, proseAnyBreak = /[，。！？；、：….,;:!?]/, proseSpace = /\s/;
    var proseSemantic = 'strong,b,em,i,mark,del,s,strike,q,blockquote';
    var proseStops = '（(［[【〔〖〘〚｛{〈《「『＜';
    var proseEnds =   '）)］]】〕〗〙〛｝}〉》」』＞';
    var proseNames = [null, 'fanframe-prose-bracket', 'fanframe-prose-number', null, 'fanframe-prose-soft', 'fanframe-prose-mid'];
    var proseBudget = 16000;

    function proseTones(text) {
      var n = text.length, tone = new Uint8Array(n), pairs = new Int32Array(n + 1), stack = [], i;
      for (i = 0; i < n; i++) {
        var ch = text[i], open = proseStops.indexOf(ch), close = proseEnds.indexOf(ch);
        if (open >= 0) stack.push([open, i]);
        else if (close >= 0) {
          var top = stack.pop();
          if (top && top[0] === close) { pairs[top[1]]++; pairs[i + 1]--; }
          else stack.length = 0;
        } else if (ch === '\n') stack.length = 0;
      }
      for (i = 0, open = 0; i < n; i++) { open += pairs[i]; if (open > 0) tone[i] = 1; }
      var numbers = /[+\-−＋－]?[0-9０-９]+(?:[,，][0-9０-９]{3}(?![0-9０-９]))*(?:[.．:：/／][0-9０-９]+)*(?:[%％])?/g, match;
      while ((match = numbers.exec(text))) tone.fill(2, match.index, numbers.lastIndex);
      // Base + two quiet neutral tones; position is stable as a stream appends.
      var shade = 3;
      for (i = 0; i < n; i++) {
        if (!tone[i]) tone[i] = shade;
        if (tone[i] !== 1 && tone[i] !== 2 && (proseCjkBreak.test(text[i]) ||
            (proseAsciiBreak.test(text[i]) && (i + 1 === n || proseSpace.test(text[i + 1]))))) {
          // Treat successive punctuation marks as one boundary, not a tiny new clause.
          if (!proseAnyBreak.test(text[i + 1] || '')) {
            var mixed = Math.imul(i + 1, 0x9e3779b1);
            shade = 3 + (shade - 3 + 1 + ((mixed >>> 16) & 1)) % 3;
          }
        }
      }
      return tone;
    }

    function proseRanges(block) {
      var text = '', leaves = [], budget = 1800, buckets = [];
      function visit(node, neutral, depth) {
        if (--budget < 0 || depth > 48 || text.length >= proseBudget) return;
        if (node.nodeType === 3) {
          var part = node.data.slice(0, proseBudget - text.length);
          if (part) { leaves.push([node, text.length, part.length, neutral]); text += part; }
          return;
        }
        if (node.nodeType !== 1) return;
        if (node !== block && node.matches(proseBlocks + ',br')) { text += '\n'; return; }
        if (node.matches(proseExcluded + ',' + proseHidden)) { text += '\u0000'; return; }
        neutral = neutral && !node.matches(proseSemantic);
        for (var child = node.firstChild; child && budget >= 0 && text.length < proseBudget; child = child.nextSibling) visit(child, neutral, depth + 1);
      }
      visit(block, !block.closest(proseSemantic), 0);
      if (!text || budget < 0 || text.length >= proseBudget) return [];
      var tones = proseTones(text), rangeCount = 0;
      for (var leaf of leaves) {
        var base = leaf[1], size = leaf[2], tone = 0, start = 0;
        for (var i = 0; i <= size; i++) {
          var next = i < size ? tones[base + i] : 0;
          if (next > 3 && !leaf[3]) next = 0;
          if (next === tone) continue;
          if (proseNames[tone]) {
            if (++rangeCount > 512) return [];
            if (!buckets[tone]) buckets[tone] = [];
            buckets[tone].push(new StaticRange({startContainer:leaf[0], startOffset:start, endContainer:leaf[0], endOffset:i}));
          }
          start = i; tone = next;
        }
      }
      return buckets;
    }

    function installProsePaint() {
      var registry = window.CSS && window.CSS.highlights;
      if (!registry || typeof Highlight !== 'function' || typeof StaticRange !== 'function' || typeof IntersectionObserver !== 'function') return;
      var channels = proseNames.map(function (name) { return name && new Highlight(); });
      var style = document.createElement('style');
      style.dataset.plugin = 'fanframe'; style.setAttribute('data-fan-prose-paint', '');
      function color(name, ink, prefix) { return (prefix || '') + '::highlight(' + name + '){color:' + ink + '}'; }
      function muted(percent) { return 'color-mix(in srgb,var(--dsw-alias-label-primary,CanvasText) ' + percent + '%,var(--dsw-alias-bg-base,Canvas))'; }
      var light = 'body:not([data-ds-dark-theme]) ';
      style.textContent = color(proseNames[1], inkBlueDark) + color(proseNames[2], inkAmberDark) +
        color(proseNames[1], inkBlueLight, light) + color(proseNames[2], inkAmberLight, light) +
        color(proseNames[4], muted(82)) + color(proseNames[5], muted(91)) +
        '@media(forced-colors:active){::highlight(' + proseNames[4] + '),::highlight(' + proseNames[5] + '){color:CanvasText}}';
      document.head.appendChild(style);
      channels.forEach(function (value, i) { if (value) registry.set(proseNames[i], value); });
      function clear(entry) {
        if (!entry.ranges) return;
        entry.ranges.forEach(function (ranges, tone) { ranges.forEach(function (range) { channels[tone].delete(range); }); });
        entry.ranges = null;
      }
      var stop = watchRoots('[data-chat-flow]', function (flow) {
        var blocks = new Map(), pending = new Set(), frame = 0;
        function eligible(el) { return flow.contains(el) && el.closest(proseAssistant) && !el.closest(proseExcluded); }
        function render() {
          frame = 0;
          var deadline = performance.now() + 4, count = 0;
          for (var el of pending) {
            pending.delete(el);
            var entry = blocks.get(el);
            if (entry) {
              clear(entry);
              if (entry.visible && eligible(el) && !el.closest(proseHidden)) {
                entry.ranges = proseRanges(el);
                entry.ranges.forEach(function (ranges, tone) { ranges.forEach(function (range) { channels[tone].add(range); }); });
              }
            }
            if (++count >= 8 || performance.now() > deadline) break;
          }
          if (pending.size) frame = requestAnimationFrame(render);
        }
        function enqueue(el) {
          var entry = blocks.get(el);
          if (!entry || !entry.visible) return;
          pending.add(el); if (!frame) frame = requestAnimationFrame(render);
        }
        var visibility = new IntersectionObserver(function (changes) {
          changes.forEach(function (change) {
            var entry = blocks.get(change.target);
            if (!entry) return;
            // A zero-threshold observer treats edge contact as entering; a
            // positive-area callback is not guaranteed until it leaves again.
            entry.visible = change.isIntersecting;
            if (entry.visible) enqueue(change.target);
            else { pending.delete(change.target); clear(entry); }
          });
        });
        function track(el) {
          if (blocks.has(el) || !eligible(el)) return;
          blocks.set(el, {visible:false, ranges:null}); visibility.observe(el);
        }
        function untrack(el) {
          var entry = blocks.get(el);
          if (!entry || eligible(el)) return;
          clear(entry); pending.delete(el); visibility.unobserve(el); blocks.delete(el);
        }
        function scan(root, visit) {
          if (root.nodeType !== 1) return;
          if (root.matches(proseBlocks)) visit(root);
          root.querySelectorAll(proseBlocks).forEach(visit);
        }
        scan(flow, track);
        var mutations = new MutationObserver(function (records) {
          records.forEach(function (record) {
            var el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            var block = el && el.closest(proseBlocks);
            if (block) enqueue(block);
            record.removedNodes.forEach(function (node) { scan(node, untrack); });
            record.addedNodes.forEach(function (node) { scan(node, track); });
          });
        });
        mutations.observe(flow, {childList:true, characterData:true, subtree:true});
        return function () {
          mutations.disconnect(); visibility.disconnect(); cancelAnimationFrame(frame);
          blocks.forEach(clear); blocks.clear(); pending.clear();
        };
      }, false, true);
      return function () {
        stop(); style.remove();
        channels.forEach(function (value, i) { if (value && registry.get(proseNames[i]) === value) registry.delete(proseNames[i]); });
      };
    }

    function apply(ctx) {
      if (typeof ctx.inject === 'function') installVisualize(ctx);
      ctx.effect(installProsePaint, 'fanframe: prose-paint');
      var motionOutputs = new WeakSet(), motionCache = motionIndexCache(defaultMotionIndex), flushMotionRecords = null, observeMotionMedia = null, queueMotionCss = null, motionCssIndex = null;
      function ownedMotionOutput(node) {
        for (; node && node !== document.head; node = node.parentNode) if (motionOutputs.has(node)) return true;
        return false;
      }
      function readMotionIndex(fast) {
        // Process pending DOM edits before a synchronous consumer. Draining the
        // queue still runs the normal handler, including its queued CSS refresh.
        if (flushMotionRecords) flushMotionRecords();
        // Pointer movement keeps the old O(1) cache-hit path. A dirty generation,
        // popup consumer or CSS refresh still validates the source snapshot.
        var index = fast ? motionCache.current() : null;
        if (!index) {
          var sources = snapshotMotionSources(Array.from(document.styleSheets), motionOutputs, motionCache.snapshot());
          index = motionCache.read(sources);
        }
        // A sync read can discover a new query before the CSS refresh frame.
        // Subscribe now, otherwise a media change in between could be missed.
        if (observeMotionMedia) observeMotionMedia(index);
        // Metadata can change through CSSOM without a head mutation. A newly
        // parsed generation still needs its CSS committed, but not reparsed.
        if (queueMotionCss && index !== motionCssIndex) queueMotionCss();
        return index;
      }
      function nativeSurface(root) {
        // These two exact classes are read from the installed shell's Modal /
        // Tooltip exports, not hash guesses. The engine is pinned to rc.3.
        if (!root.matches('[role="menu"],[role="listbox"],[role="dialog"],[role="tooltip"],._root_o6lrb_6[role="presentation"],._bubble_44yfq_1') || root.matches('select') || root.closest('.xterm,[data-fan-footer-ghost],[data-fan-footer-panel],[data-fan-default-surface]')) return false;
        var index = readMotionIndex();
        if (Array.from(root.style).some(function (key) { return /^(?:transition|animation)(?:-|$)/.test(key); })) return false;
        if (root.getAnimations().some(function (a) { return a.constructor.name === 'Animation' && a.effect && a.effect.getKeyframes().some(function (k) { return 'opacity' in k || 'transform' in k; }); })) return false;
        var names = Array.from(root.classList);
        return names.some(function (name) { return index.nativeClasses.has(name); }) && !names.some(function (name) { return index.protectedClasses.has(name); });
      }
      ctx.effect(function () {
        var style = document.createElement('style'), frame = 0, disposed = false, rebuilding = false, media = new Map(), mediaIndex = null;
        style.setAttribute('data-fan-default-motion',''); style.dataset.plugin = 'fanframe'; motionOutputs.add(style);
        function queue() { if (!disposed && !frame && !rebuilding) frame = requestAnimationFrame(rebuild); }
        function schedule() { if (disposed) return; motionCache.invalidate(); queue(); }
        queueMotionCss = queue;
        function syncMedia(index) {
          if (mediaIndex === index) return;
          media.forEach(function (query, text) { if (!index.mediaQueries.has(text)) { query.removeEventListener('change',schedule); media.delete(text); } });
          index.mediaQueries.forEach(function (text) { if (!media.has(text)) { var query = window.matchMedia(text); query.addEventListener('change',schedule); media.set(text,query); } });
          mediaIndex = index;
        }
        observeMotionMedia = syncMedia;
        function rebuild() {
          frame = 0; if (disposed) return;
          rebuilding = true;
          try {
            var index = readMotionIndex();
            if (style.textContent !== index.css) style.textContent = index.css;
            motionCssIndex = index;
          } finally { rebuilding = false; }
        }
        rebuild(); document.head.appendChild(style);
        function changed(records) { if (hasExternalMotionMutation(records, ownedMotionOutput)) schedule(); }
        var observer = new MutationObserver(changed);
        observer.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','href','media','data-plugin-css']});
        var flush = function () { changed(observer.takeRecords()); }; flushMotionRecords = flush;
        return function () { disposed = true; observer.disconnect(); if (flushMotionRecords === flush) flushMotionRecords = null; if (observeMotionMedia === syncMedia) observeMotionMedia = null; if (queueMotionCss === queue) queueMotionCss = null; motionCssIndex = null; cancelAnimationFrame(frame); media.forEach(function (query) { query.removeEventListener('change',schedule); }); media.clear(); style.remove(); motionCache.clear(); };
      }, 'fanframe: default-control-motion');

      // Existing edges only. No border widths, new shadow layers, cloned controls,
      // focus rings, handlers or layout changes. Inspect only the pointer's path.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), style = document.createElement('style');
        style.setAttribute('data-fan-hover-feedback', ''); style.dataset.plugin = 'fanframe'; style.dataset.fanCandidate = '1.11.0-beta.9'; motionOutputs.add(style);
        var current = null, records = new Map(), ownedCss = new WeakMap(), ownedTransitions = new Set(), disposed = false, composerClass = null, rebuildFrame = 0;
        function list(text) {
          var out = [], start = 0, depth = 0;
          for (var i = 0; i < text.length; i++) { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; else if (text[i] === ',' && !depth) { out.push(text.slice(start,i).trim()); start = i + 1; } }
          if (text.slice(start).trim()) out.push(text.slice(start).trim()); return out;
        }
        function visibleColor(value) {
          if (!value || value === 'transparent') return false;
          var alpha = /\/\s*([\d.]+)(%)?\s*\)$/.exec(value) || (/^rgba\(/.test(value) && /,\s*([\d.]+)(%)?\s*\)$/.exec(value));
          return !alpha || parseFloat(alpha[1]) > 0;
        }
        function blend(color) { return 'color-mix(in srgb,' + color + ' 60%,var(--dsw-alias-label-primary,currentColor) 40%)'; }
        function strokeShadow(value) {
          var changed = false;
          var result = list(value).map(function (layer) {
            var match = /(?:rgba?|hsla?|color|oklab|oklch|lab|lch)\(/.exec(layer); if (!match) return layer;
            var start = match.index, end = start + match[0].length, depth = 1;
            while (end < layer.length && depth) { if (layer[end] === '(') depth++; else if (layer[end] === ')') depth--; end++; }
            var color = layer.slice(start,end), geometry = layer.slice(0,start) + layer.slice(end);
            var numbers = geometry.match(/[-+]?(?:\d*\.)?\d+px/g) || [], n = numbers.map(parseFloat);
            if (n.length !== 4 || n[0] || n[1] || n[2] || n[3] <= 0 || n[3] > 2 || !visibleColor(color)) return layer;
            changed = true; return layer.slice(0,start) + blend(color) + layer.slice(end);
          });
          return changed ? result.join(',') : null;
        }
        function transitionSnapshot(el) { return new Set(el.getAnimations().filter(function (a) { return a.constructor.name === 'CSSTransition'; })); }
        function remember(el, before, keys) {
          // Flush the color write, then retain only newly-created paint transitions.
          getComputedStyle(el).boxShadow;
          el.getAnimations().forEach(function (a) {
            if (a.constructor.name !== 'CSSTransition' || before.has(a) || keys.indexOf(a.transitionProperty) < 0) return;
            ownedTransitions.add(a); a.finished.then(function () { ownedTransitions.delete(a); }, function () { ownedTransitions.delete(a); });
          });
        }
        function finish(record) { clearTimeout(record.timer); record.motion.restore(); ownedCss.set(record.el,record.el.style.cssText); records.delete(record.el); }
        function leave() {
          if (!current) return;
          var record = current; current = null;
          var before = transitionSnapshot(record.el); record.colors.restore(); ownedCss.set(record.el,record.el.style.cssText); remember(record.el,before,record.keys);
          record.timer = setTimeout(function () { finish(record); }, 180);
        }
        function augment(record, css) {
          var props = list(css.transitionProperty), durations = list(css.transitionDuration), easings = list(css.transitionTimingFunction), delays = list(css.transitionDelay);
          if (props.indexOf('none') >= 0) return;
          if (props.indexOf('all') >= 0) {
            if (durations.some(function (v) { return parseFloat(v) > 0; })) return;
            props = []; durations = []; easings = []; delays = [];
          }
          var original = props.length;
          function expand(values, fallback) { return props.map(function (_,i) { return values.length ? values[i % values.length] : fallback; }); }
          durations = expand(durations,'0s'); easings = expand(easings,'ease'); delays = expand(delays,'0s');
          record.keys.forEach(function (key) {
            if (props.indexOf(key) >= 0 || (/^border-/.test(key) && props.indexOf('border-color') >= 0)) return;
            props.push(key); durations.push(media.matches ? '0s' : '.1s'); easings.push('cubic-bezier(.4,0,.2,1)'); delays.push('0s');
          });
          if (props.length === original) return;
          record.motion.set('transition-property',props.join(','),'important'); record.motion.set('transition-duration',durations.join(','),'important');
          record.motion.set('transition-timing-function',easings.join(','),'important'); record.motion.set('transition-delay',delays.join(','),'important');
        }
        function paintEndpoint(el, key, fallback) {
          var transition = el.getAnimations().find(function (a) { return a.constructor.name === 'CSSTransition' && ownedTransitions.has(a) && a.transitionProperty === key; });
          if (!transition || !transition.effect) return fallback;
          var frames = transition.effect.getKeyframes(), last = frames[frames.length - 1];
          var camel = key.replace(/-([a-z])/g,function (_,letter) { return letter.toUpperCase(); });
          return last && last[camel] || fallback;
        }
        function find(target) {
          var start = target && (target.nodeType === 1 ? target : target.parentElement);
          // The iframe has its own pointer/focus lifecycle. Its host figure is a
          // structural surface, not a control, and must never own generic hover.
          if (start && start.closest('[data-fan-visualize]')) return null;
          for (var el = start; el && el !== document.body; el = el.parentElement) {
            if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.closest('.xterm,[data-fan-footer-ghost],[data-fan-exit-ghost],[inert]')) continue;
            if (composerClass && el.classList.contains(composerClass)) return null;
            if (el.matches(':disabled,[aria-disabled="true"],[aria-invalid="true"],[data-state="error"],[data-state="invalid"]')) return null;
            var css = getComputedStyle(el), colors = {}, keys = [];
            if (css.visibility !== 'visible' || !el.getBoundingClientRect().width) continue;
            ['top','right','bottom','left'].forEach(function (edge) {
              if (parseFloat(css.getPropertyValue('border-' + edge + '-width')) > 0 && !/^(?:none|hidden)$/.test(css.getPropertyValue('border-' + edge + '-style')) && visibleColor(css.getPropertyValue('border-' + edge + '-color'))) {
                var key = 'border-' + edge + '-color'; keys.push(key); colors[key] = blend(paintEndpoint(el,key,css.getPropertyValue(key)));
              }
            });
            // A focused unknown component may be showing a ring, not a permanent edge.
            var shadow = !el.matches(':focus,:focus-within') && strokeShadow(paintEndpoint(el,'box-shadow',css.boxShadow));
            if (shadow) { colors['box-shadow'] = shadow; keys.push('box-shadow'); }
            if (!keys.length) continue;
            var index = readMotionIndex(true);
            var nativeHover = index.borderHoverSelectors.some(function (selector) { try { return el.matches(selector); } catch (_) { return false; } });
            var nativePaint = el.getAnimations().some(function (a) { return a.constructor.name !== 'CSSTransition' && a.effect && a.effect.getKeyframes().some(function (frame) { return Object.keys(frame).some(function (key) { return /^(?:border|boxShadow)/.test(key); }); }); });
            if (nativeHover || nativePaint || el.matches(':focus,:focus-within,[aria-selected="true"],[aria-pressed="true"],[data-state="active"]')) colors = {};
            return {el:el,css:css,values:colors,keys:keys};
          }
          return null;
        }
        function pointer(event) {
          if (disposed || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
          var target = event.type === 'pointerout' ? event.relatedTarget : event.target;
          if (current && target === current.el) return;
          var found = find(target);
          if (current && found && current.el === found.el) return;
          leave(); if (!found) return;
          var old = records.get(found.el); if (old) finish(old);
          var record = {el:found.el,keys:found.keys,colors:ownStyles(found.el),motion:ownStyles(found.el),timer:0,lastCss:''};
          records.set(found.el,record); current = record;
          augment(record,found.css); getComputedStyle(found.el).boxShadow;
          var before = transitionSnapshot(found.el);
          Object.keys(found.values).forEach(function (key) { record.colors.set(key,found.values[key],'important'); });
          record.lastCss = found.el.style.cssText; ownedCss.set(found.el,record.lastCss); remember(found.el,before,record.keys);
        }
        function rebuild() {
          rebuildFrame = 0; if (disposed) return; leave();
          var nav = nativeClass('@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css','navCell');
          composerClass = nativeClass('@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css','card');
          var trigger = nativeClass('@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css','cardWorkspaceTrigger');
          var css = sidebarPaintEdgeCss();
          if (nav) {
            var row = '[data-shortcut-modal="settings"] .' + window.CSS.escape(nav) + '.' + window.CSS.escape(nav);
            var enabledHover = ':hover:where(:not(:disabled):not([aria-disabled="true"]))';
            css += row + enabledHover + '{background-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary)) 18%,var(--dsw-alias-bg-layer-2))!important;}' +
              row + '[aria-current="true"]' + enabledHover + '{background-color:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,var(--dsw-specific-sidebar-nav-item-active,var(--dsw-alias-bg-layer-2)))!important;}';
          }
          if (composerClass) {
            var card = '.' + window.CSS.escape(composerClass) + '.' + window.CSS.escape(composerClass) + (trigger ? ':not(.' + window.CSS.escape(trigger) + ')' : '');
            css += '@layer fanframe-hover-feedback{@media(prefers-reduced-motion:no-preference){' + card + '{transition-property:background-color,color,border-color,fill,stroke,text-decoration-color,box-shadow;transition-duration:.1s;transition-timing-function:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));transition-delay:0s;}}}' +
              card + ':hover{--dsw-elevation-stroke-color:color-mix(in srgb,var(--dsw-alias-label-primary) 55%,transparent)!important;}' +
              card + ':focus-within{--dsw-elevation-stroke-color:color-mix(in srgb,var(--dsw-alias-label-primary) 75%,transparent)!important;box-shadow:var(--dsw-elevation-soft)!important;}';
          }
          if (style.textContent !== css) style.textContent = css;
        }
        function schedule() { if (!disposed && !rebuildFrame) rebuildFrame = requestAnimationFrame(rebuild); }
        rebuild(); document.head.append(style);
        var head = new MutationObserver(function (changes) {
          if (hasExternalMotionMutation(changes, ownedMotionOutput)) schedule();
        });
        head.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','href','media','data-plugin-css']});
        var body = new MutationObserver(function (changes) {
          if (!current) return;
          if (!current.el.isConnected || changes.some(function (r) { return r.type === 'attributes' && (r.target === document.body || r.target === document.documentElement || r.target.contains(current.el) || current.el.contains(r.target)) && !(r.attributeName === 'style' && r.target.style.cssText === ownedCss.get(r.target)); })) leave();
        });
        body.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-ds-dark-theme','disabled','aria-disabled','aria-invalid','aria-selected','data-state']});
        function yieldFocus(event) { if (current && current.el.contains(event.target)) leave(); }
        document.addEventListener('pointerover',pointer,true); document.addEventListener('pointerout',pointer,true); document.addEventListener('focusin',yieldFocus,true);
        function reduced() { leave(); records.forEach(finish); }
        media.addEventListener('change',reduced);
        return function () { disposed = true; head.disconnect(); body.disconnect(); cancelAnimationFrame(rebuildFrame); document.removeEventListener('pointerover',pointer,true); document.removeEventListener('pointerout',pointer,true); document.removeEventListener('focusin',yieldFocus,true); media.removeEventListener('change',reduced); leave(); records.forEach(finish); ownedTransitions.forEach(function (a) { a.cancel(); }); ownedTransitions.clear(); style.remove(); };
      }, 'fanframe: hover-feedback');

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
          if (ownedClass(root,'@deepseek-ai/dsh-client-ui-conversation/ContextMeter.module.css','panel')) return 'context';
          // Common shipped surfaces are motion-only: do not apply the footer's
          // opacity/material overrides or take over custom third-party dialogs.
          return nativeSurface(root) ? 'native-' + (root.matches('._bubble_44yfq_1') ? 'tooltip' : root.matches('._root_o6lrb_6') ? 'dialog' : root.getAttribute('role')) + ':' + Array.from(root.classList)[0] : null;
        }
        function sidebarLayer(root, type) {
          // Native body portals sit below Pocket's drawer. Borrow only its
          // actual layer while our drawer adapter is active; keep native geometry.
          if ((type !== 'sidebar-more' && type !== 'account') || root.parentElement !== document.body) return null;
          var slot = document.querySelector('[data-slot="sidebar"]'), column = slot && slot.parentElement, frame = column && column.parentElement;
          if (!frame) return null;
          var styles = ownStyles(root);
          function sync() {
            styles.restore();
            if (!frame.querySelector('[data-fan-rail-drawer]')) return;
            var layer = Number.parseFloat(getComputedStyle(column).zIndex), nativeLayer = Number.parseFloat(getComputedStyle(root).zIndex) || 0;
            if (Number.isFinite(layer)) styles.set('z-index',String(Math.max(nativeLayer,layer + 1)),'important');
          }
          var observer = new MutationObserver(sync);
          observer.observe(frame,{subtree:true,attributes:true,attributeFilter:['data-fan-rail-drawer']});
          observer.observe(column,{attributes:true,attributeFilter:['style','class']});
          sync();
          return function () { observer.disconnect(); styles.restore(); };
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
          state.key = state.kind + ':' + Math.round(rect.left) + (state.defaultSurface ? ':' + Math.round(rect.top) + ':' + Math.round(rect.width) + ':' + css.zIndex + ':' + (root.id || root.getAttribute('aria-labelledby') || '') : '');
          if (state.defaultSurface) {
            // Never retain user input or start active content in an exit copy.
            // Keep the native immediate close for editors/media and large trees.
            var unsafe = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]),textarea,select,[contenteditable]:not([contenteditable="false"]),iframe,frame,object,embed,script,audio,video,canvas,.xterm';
            state.paint = null;
            if (!media.matches && !document.hidden && !root.isContentEditable && !root.querySelector(unsafe)) {
              var children = Array.from(root.querySelectorAll('*'));
              // cloneNode cannot preserve scroll offsets. Never repaint a
              // scrolled/virtual viewport at its initial offset during close.
              if (children.length <= 400 && ![root].concat(children).some(function (node) { return node.scrollTop || node.scrollLeft; })) state.paint = paintCopy(root,true);
            }
          }
          return true;
        }
        function paintCopy(root, defaultSurface) {
          var copy = root.cloneNode(true), nodes = [copy].concat(Array.from(copy.querySelectorAll('*'))), ids = new Map();
          var originals = defaultSurface ? [root].concat(Array.from(root.querySelectorAll('*'))) : null;
          var prefix = 'fan-footer-paint-' + (++serial) + '-';
          nodes.forEach(function (el, i) { if (el.id) { ids.set(el.id, prefix + i); el.id = prefix + i; } });
          nodes.forEach(function (el, i) {
            if (defaultSurface) {
              // Cache presentation while attached, before identity/state attributes
              // are stripped. Never read value/checked/text from an input control.
              var original = originals[i], owner = original.closest('[aria-checked],[aria-selected],[aria-pressed],[data-state],[data-open],[data-active]');
              if (!i || (owner && root.contains(owner))) {
                var css = getComputedStyle(original);
                var props = ['color','background-color','background-image','border-color','border-style','border-width','border-radius','box-shadow','display','visibility','font-weight','text-decoration-line','fill','stroke'];
                if (i) props.push('opacity','transform');
                props.forEach(function (key) { el.style.setProperty(key,css.getPropertyValue(key)); });
              }
            }
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
          copy.removeAttribute('id'); copy.setAttribute(defaultSurface ? 'data-fan-default-surface' : marker, ''); copy.setAttribute(ghostMarker, '');
          copy.setAttribute('aria-hidden', 'true'); copy.inert = true;
          return copy;
        }
        function leave(state) {
          var from = opacity(state); stopEntry(state);
          if (disposed || media.matches || !state.rect || from < 0.01 || !state.root.animate) return;
          removeGhost(state.key);
          var copy = state.defaultSurface ? state.paint : paintCopy(state.root, false), rect = state.rect, key = state.key;
          state.paint = null;
          if (!copy) return;
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
        var unwatch = watchRoots('[role="dialog"], [role="menu"], [role="listbox"]:not(select), [role="tooltip"], ._root_o6lrb_6[role="presentation"], ._bubble_44yfq_1, [data-dsh-usage-glass="dialog"], [data-cordis-panel], div:has(> [role="tree"])', function (root) {
          var type = kind(root); if (!type || root.closest('[' + ghostMarker + ']')) return null;
          var defaultSurface = type.indexOf('native-') === 0, surfaceMarker = defaultSurface ? 'data-fan-default-surface' : marker;
          var oldMarker = root.getAttribute(surfaceMarker), styles = ownStyles(root);
          root.setAttribute(surfaceMarker, '');
          if (defaultSurface) {
            // One opacity driver, but no background/material/geometry changes.
            styles.set('transition','none','important');
          } else {
            // Preserve the earlier, separately approved opaque footer contract.
            styles.set('background', 'var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#22262c))', 'important');
            if (window.CSS && window.CSS.supports('background', 'rgb(from #22262c r g b / 1)')) styles.set('background', 'rgb(from var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#22262c)) r g b / 1)', 'important');
            styles.set('backdrop-filter','none','important'); styles.set('-webkit-backdrop-filter','none','important');
            styles.set('--dsw-menu-backdrop-filter','none','important');
          }
          var state = {root:root,kind:type,defaultSurface:defaultSurface,visible:false,entry:null,opacity:1,releaseLayer:sidebarLayer(root,type)}; mounted.add(state);
          var observer = new MutationObserver(function () { refresh(state); });
          observer.observe(root,{attributes:true,attributeFilter:['style','class','hidden'],childList:true,subtree:true});
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { refresh(state); }) : null;
          if (resize) resize.observe(root);
          refresh(state);
          return function () {
            observer.disconnect(); if (resize) resize.disconnect();
            if (state.visible) leave(state); else stopEntry(state);
            mounted.delete(state); if (state.releaseLayer) state.releaseLayer(); styles.restore();
            if (root.getAttribute(surfaceMarker) === '') { if (oldMarker === null) root.removeAttribute(surfaceMarker); else root.setAttribute(surfaceMarker,oldMarker); }
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
      var railMenuState={current:null,controllers:new Set()};
      if(typeof ctx.inject==='function')ctx.inject(['contextMenus'],function(scope){
        scope.effect(function(){
          var menus=scope.contextMenus;
          if(!menus||!menus.active||typeof menus.active.getSnapshot!=='function'||typeof menus.register!=='function'||typeof menus.open!=='function'||typeof menus.close!=='function')return;
          var owner=railUnpinMenu(menus);railMenuState.current=owner;
          railMenuState.controllers.forEach(function(controller){controller.start();});
          return function(){
            if(railMenuState.current===owner)railMenuState.current=null;
            railMenuState.controllers.forEach(function(controller){controller.start();});owner.dispose();
          };
        },'fanframe: sidebar-unpin-menu');
      });
      ctx.effect(function () {
        var controllers = railMenuState.controllers, disposed = false;
        var sidebarSheet = '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css';
        var frameSheet = '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css';
        var workspaceSheet = '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css';
        function isDrawer(frame) { return frame.hasAttribute('data-sidebar-drawer') || frame.getAttribute('data-mobile-nav') === 'frame'; }
        function columns(frame) {
          // Preserve the original right track verbatim. No root-store writes,
          // actual grid-template overwrite or feedback into the native resizer.
          return frame.style.gridTemplateColumns.match(/^([\d.]+)px\s+minmax\(([\d.]+)px,\s*1fr\)\s+(minmax\(0px,\s*[\d.]+px\))$/);
        }
        function mount(slot) {
          var root = null, frame = null, nav = null, foot = null, parts = null, localClosed = false, drawerMode = false, nestedMode = false;
          // Pocket owns its outer drawer, including the native collapsed state.
          // Keep watching the owner even while the closed drawer has no adapter.
          var modeFrame = null, modeObserver = new MutationObserver(function (records) {
            if (root && records.some(function (r) { return r.attributeName === 'data-mobile-nav' || r.attributeName === 'data-sidebar-drawer'; })) end();
            if (!root) start();
          });
          function observeMode(owner) {
            if (modeFrame === owner) return;
            modeObserver.disconnect(); modeFrame = owner;
            modeObserver.observe(owner,{attributes:true,attributeFilter:['data-mobile-nav','data-sidebar-drawer','data-sidebar-collapsed','style']});
          }
          var required = ['logoRow','newSession','panelList','regionArea','footArea','footerActions','settingsArea'];
          var wrappers = ['newSessionRow','scrollRegion','scrollArea','scrollFade'];
          function structure(candidate, seats) {
            if (seats.scrollRegion || seats.scrollArea) {
              return seats.newSessionRow && seats.scrollRegion && seats.scrollArea &&
                seats.newSessionRow.parentElement === candidate && seats.newSessionRow.contains(seats.newSession) &&
                seats.scrollRegion.parentElement === candidate && seats.scrollArea.parentElement === seats.scrollRegion &&
                seats.panelList.parentElement === seats.scrollArea && seats.regionArea.parentElement === seats.scrollArea &&
                (!seats.scrollFade || seats.scrollFade.parentElement === seats.scrollRegion) ? 'nested' : null;
            }
            return seats.panelList.parentElement === candidate && seats.regionArea.parentElement === candidate ? 'legacy' : null;
          }
          function railWheel(event) {
            var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
            if (!nav || !nav.isConnected || (target && nestedPopup(target)) || event.defaultPrevented || event.ctrlKey ||
              !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) || nav.scrollHeight <= nav.clientHeight) return;
            // The browser scrolls this rail. At either edge it must not reach
            // the native ancestor, which would explicitly scroll the workspace.
            event.stopPropagation();
          }
          function valid() {
            var rootClass = nativeClass(sidebarSheet,'root'), frameClass = nativeClass(frameSheet,'frame'), colClass = nativeClass(frameSheet,'sidebarCol');
            return root && root.isConnected && rootClass && frameClass && colClass && root.classList.contains(rootClass) &&
              frame.classList.contains(frameClass) && slot.parentElement && slot.parentElement.classList.contains(colClass) && slot.parentElement.parentElement === frame &&
              required.every(function (key) { var name = nativeClass(sidebarSheet,key), el = parts[key]; return name && el && root.contains(el) && el.classList.contains(name); }) &&
              structure(root,parts) === (nestedMode ? 'nested' : 'legacy') &&
              wrappers.every(function (key) { var el = parts[key], name = nativeClass(sidebarSheet,key); return !el || (name && el.classList.contains(name)); }) &&
              nav.tagName === 'NAV' && parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]') && foot.contains(parts.settingsArea) && foot.contains(parts.footerActions) &&
              parts.settingsArea.querySelector('[data-slot="sidebar.settings"]') && parts.footerActions.querySelector('[data-slot="sidebar.footer.action"]');
          }
          var marks = new Map(), buttons = new Map(), labels = new Map(), popups = new Map(), unpinMenus = new Map(), frameStyles = null, frameObserver = null, rootStyles = null, railObserver = null;
          function mark(el, name) { if (!el) return; var owned = marks.get(el); if (!owned) { owned = ownAttrs(el); marks.set(el,owned); } owned.set(name,''); }
          function end() {
            unpinMenus.forEach(function(record){record.binding.dispose();});unpinMenus.clear();
            if (railObserver) railObserver.disconnect(); railObserver = null;
            if (parts && parts.footerActions) parts.footerActions.removeEventListener('scroll',syncPopups);
            if (nav) nav.removeEventListener('wheel',railWheel);
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
            root = frame = nav = foot = parts = null; drawerMode = nestedMode = false;
          }
          function syncFrame() {
            if (!frame) return false;
            var tracks = columns(frame);
            if (isDrawer(frame) !== drawerMode) { end(); start(); return false; }
            if (!tracks || (drawerMode && frame.hasAttribute('data-sidebar-collapsed'))) { end(); return false; }
            if (drawerMode) return true; // Never allocate a desktop track in Pocket.
            // Browser shells fold into their own icon strip, which keeps the
            // expand and new-session controls the rail would clip at 52px.
            if (!document.documentElement.hasAttribute('data-windows-titlebar') && Number(tracks[1]) < 160) { end(); return false; }
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
          function newSessionEndInset(style, inset) {
            // Mirror the native expanded row's inline padding + paint margin.
            // Only resolve known px tokens; unknown layouts keep the old inset.
            var inline = style.getPropertyValue('--dsh-sidebar-inline-padding').trim(), paint = style.getPropertyValue('--dsh-sidebar-paint-inset').trim();
            var pixels = /^(?:\d+(?:\.\d*)?|\.\d+)px$|^0$/;
            if (!pixels.test(inline) || !pixels.test(paint)) return inset;
            var gutter = parseFloat(inline) + parseFloat(paint) + 1;
            return gutter <= 64 ? Math.max(inset,gutter) : inset;
          }
          function syncRail() {
            // Independent first-column stacks: list rows and native wide/rail
            // animations cannot move global buttons. No React reparenting.
            var caption = !drawerMode && document.querySelector('[data-windows-menu]');
            var menu = caption && caption.shadowRoot && caption.shadowRoot.querySelector('[role="menubar"] > button[role="menuitem"]');
            var style = getComputedStyle(root), gap = Number.parseFloat(style.getPropertyValue('--fan-rail-gap')) || 4;
            var listY = null;
            if (nestedMode) {
              if (frame.hasAttribute('data-sidebar-collapsed')) listY = 0;
              else {
                var seatBox = parts.newSessionRow.getBoundingClientRect(), viewportBox = parts.scrollArea.getBoundingClientRect();
                var seatStyle = getComputedStyle(parts.newSessionRow);
                var offsetY = seatBox.bottom - viewportBox.top + (parseFloat(seatStyle.marginBottom) || 0) + (parseFloat(style.rowGap) || 0);
                if (seatBox.height && viewportBox.height && Number.isFinite(offsetY)) listY = Math.max(0,Math.min(parts.scrollArea.clientHeight,offsetY));
              }
            }
            var newEndInset = 0;
            if (!frame.hasAttribute('data-sidebar-collapsed')) {
              // Retain the native hover-box alignment, without letting a flush
              // action erase the nested new-session row's native paint gutter.
              var workspace = parts.regionArea.querySelector('[data-fan-rail-workspaces]');
              var headerClass = nativeClass(workspaceSheet,'sectionHeader'), actionClass = nativeClass(workspaceSheet,'iconButton');
              var header = workspace && headerClass && workspace.getElementsByClassName(headerClass)[0];
              if (header && actionClass) {
                var right = -Infinity;
                Array.from(header.getElementsByClassName(actionClass)).forEach(function (button) {
                  if (button.tagName !== 'BUTTON' || button.closest('[data-fan-rail-workspaces]') !== workspace) return;
                  var box = button.getBoundingClientRect(); if (box.width && box.height) right = Math.max(right,box.right);
                });
                var endInset = root.getBoundingClientRect().right - right;
                if (Number.isFinite(endInset) && endInset >= 0 && endInset <= 64) newEndInset = endInset;
              }
              if (nestedMode && !drawerMode) newEndInset = newSessionEndInset(style,newEndInset);
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
            rootStyles.set('--fan-rail-new-end-inset',newEndInset.toFixed(3)+'px');
            var available = Math.max(0,root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parts.settingsArea.getBoundingClientRect().height - 8);
            var navNatural = nav.scrollHeight, actionsNatural = parts.footerActions.scrollHeight, between = actionsNatural ? gap : 0;
            var navLimit = navNatural + between + actionsNatural <= available ? navNatural : Math.min(navNatural,Math.max(42,available - Math.min(actionsNatural,available/2) - between));
            if (listY !== null) rootStyles.set('--fan-rail-list-y',listY.toFixed(3)+'px');
            rootStyles.set('--fan-rail-nav-limit',navLimit+'px');
            rootStyles.set('--fan-rail-actions-top',(navLimit+between)+'px');
            rootStyles.set('--fan-rail-actions-limit',Math.max(0,available-navLimit-between)+'px');
            syncPopups();
          }
          function nestedPopup(el) {
            var popup = el.closest('[role="menu"],[role="dialog"],[role="listbox"],[data-cordis-panel]');
            // A native mobile sidebar is itself a dialog; only its nested
            // popup surfaces own controls outside the rail presentation.
            return popup && popup !== root;
          }
          function syncUnpinMenus(unpins){
            var next=new Map(), owner=railMenuState.current;
            if(owner)unpins.forEach(function(unpin){
              var entry=unpin.closest('[data-fan-rail-entry]'), primary=entry&&entry.querySelector('button[data-fan-rail-button]');
              if(entry&&entry.parentElement===nav&&primary&&buttons.has(primary))next.set(primary,{unpin:unpin,entry:entry});
            });
            unpinMenus.forEach(function(record,primary){
              var wanted=next.get(primary);
              if(!wanted||record.owner!==owner||record.unpin!==wanted.unpin||record.entry!==wanted.entry){record.binding.dispose();unpinMenus.delete(primary);}
            });
            next.forEach(function(wanted,primary){
              var record=unpinMenus.get(primary);
              if(record){if(!record.binding.refresh()){record.binding.dispose();unpinMenus.delete(primary);}return;}
              var binding=owner.bind(primary,wanted.unpin,wanted.entry,nav);
              if(binding)unpinMenus.set(primary,{owner:owner,unpin:wanted.unpin,entry:wanted.entry,binding:binding});
            });
          }
          function syncControls() {
            if (!root) return;
            if (!valid()) { end(); start(); return; }
            if (!syncFrame()) return;
            var next = new Set(), nextLabels = new Set(), entries = new Set(), unpins = new Set(), expanded = !frame.hasAttribute('data-sidebar-collapsed');
            var accountTrigger = nativeClass('@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','trigger');
            var unpin = nativeClass(sidebarSheet,'panelUnpin'), entryClass = nativeClass(sidebarSheet,'panelEntry');
            [nav,parts.footerActions,parts.settingsArea].forEach(function (area) {
              area.querySelectorAll('button').forEach(function (button) {
                if (nestedPopup(button)) return;
                if (area === nav && unpin && button.classList.contains(unpin)) {
                  var entry = entryClass && button.closest('.' + window.CSS.escape(entryClass));
                  if (entry && entry.parentElement === nav) {
                    entries.add(entry); unpins.add(button); mark(entry,'data-fan-rail-entry'); mark(button,'data-fan-rail-unpin');
                  }
                  return;
                }
                next.add(button); var record = buttons.get(button);
                if (!record) { record = {attrs:ownAttrs(button),title:button.getAttribute('title')}; buttons.set(button,record); }
                record.attrs.set('data-fan-rail-button','');
                // wide=true disables the shipped nav Tooltip. A genuine native
                // title restores its help without manufacturing another menu.
                var footerHelp = area === parts.footerActions || (accountTrigger && button.classList.contains(accountTrigger));
                var help = button.getAttribute('aria-label') || button.textContent.replace(/\s+/g,' ').trim();
                if (!record.title && help && (area === nav || footerHelp)) record.attrs.set('title',expanded || footerHelp ? help : record.title);
              });
            });
            buttons.forEach(function (record,button) { if (!next.has(button)) { record.attrs.restore(); buttons.delete(button); } });
            syncUnpinMenus(unpins);
            [['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','layer'],['@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css','triggerRow']].forEach(function (spec) {
              var name = nativeClass(spec[0],spec[1]); if (name) Array.from(foot.getElementsByClassName(name)).forEach(function (group) { mark(group,'data-fan-rail-cluster'); });
            });
            var labelSpecs = [[sidebarSheet,'panelTitle'],['@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css','label'],['@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css','triggerLabel'],
              ['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','badgeLabel'],['@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css','badgeCount']];
            labelSpecs.forEach(function (spec) {
              var name = nativeClass(spec[0],spec[1]); if (!name) return;
              [nav,foot].forEach(function (area) { Array.from(area.getElementsByClassName(name)).forEach(function (label) {
                if (nestedPopup(label)) return;
                nextLabels.add(label); var attrs = labels.get(label); if (!attrs) { attrs = ownAttrs(label); labels.set(label,attrs); } attrs.set('data-fan-rail-label','');
              }); });
            });
            labels.forEach(function (attrs,label) { if (!nextLabels.has(label)) { attrs.restore(); labels.delete(label); } });
            var workspaceClass = nativeClass(workspaceSheet,'root'), workspaces = new Set();
            if (workspaceClass) Array.from(parts.regionArea.getElementsByClassName(workspaceClass)).forEach(function (el) {
              if (el.closest('[data-slot="sidebar.workspaces"]') === parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]')) { workspaces.add(el); mark(el,'data-fan-rail-workspaces'); }
            });
            marks.forEach(function (attrs,el) { if ((el !== frame && el !== root && !root.contains(el)) || (el.hasAttribute('data-fan-rail-workspaces') && !workspaces.has(el)) ||
              (el.hasAttribute('data-fan-rail-entry') && !entries.has(el)) || (el.hasAttribute('data-fan-rail-unpin') && !unpins.has(el))) { attrs.restore(); marks.delete(el); } });
            syncRail();
          }
          function start() {
            if (disposed || localClosed || !slot.isConnected) return;
            if (root) { syncControls(); return; }
            // Detect the actual frame mode before requiring desktop chrome.
            var rootClass = nativeClass(sidebarSheet,'root'), frameClass = nativeClass(frameSheet,'frame'), colClass = nativeClass(frameSheet,'sidebarCol');
            if (!rootClass || !frameClass || !colClass) return;
            var candidate = Array.from(slot.getElementsByClassName(rootClass)).find(function (el) { return el.closest('[data-slot="sidebar"]') === slot; });
            if (!candidate || !slot.parentElement.classList.contains(colClass)) return;
            var owner = slot.parentElement.parentElement;
            if (!owner || !owner.classList.contains(frameClass)) return;
            observeMode(owner);
            var nextDrawer = isDrawer(owner);
            var ownerTracks = columns(owner);
            // Browser shells keep their own collapsed icon strip; mounting the
            // rail there would clip the host's expand and new-session controls.
            var nativeFold = !nextDrawer && !document.documentElement.hasAttribute('data-windows-titlebar') && ownerTracks && Number(ownerTracks[1]) < 160;
            if (!ownerTracks || (nextDrawer && owner.hasAttribute('data-sidebar-collapsed')) || nativeFold) return;
            parts = {};
            required.concat(wrappers).forEach(function (key) { var name = nativeClass(sidebarSheet,key); parts[key] = name && candidate.getElementsByClassName(name)[0]; });
            if (required.some(function (key) { return !parts[key]; })) return;
            var layout = structure(candidate,parts); if (!layout) return;
            if (parts.panelList.tagName !== 'NAV' || !parts.regionArea.querySelector('[data-slot="sidebar.workspaces"]') ||
              !parts.footArea.contains(parts.settingsArea) || !parts.footArea.contains(parts.footerActions) ||
              !parts.settingsArea.querySelector('[data-slot="sidebar.settings"]') || !parts.footerActions.querySelector('[data-slot="sidebar.footer.action"]')) return;
            root = candidate; frame = owner; drawerMode = nextDrawer; nestedMode = layout === 'nested'; nav = parts.panelList; foot = parts.footArea; frameStyles = ownStyles(frame); rootStyles = ownStyles(root);
            if (!syncFrame()) return;
            if (drawerMode) mark(root,'data-fan-rail-drawer'); else mark(frame,'data-fan-rail-frame');
            mark(root,'data-fan-sidebar-rail');
            [['logoRow','brand'],['newSession','new'],['panelList','nav'],['regionArea','browser'],['footArea','footer'],['footerActions','actions'],['settingsArea','settings']].forEach(function (row) { mark(parts[row[0]],'data-fan-rail-'+row[1]); });
            if (nestedMode) [['newSessionRow','new-row'],['scrollRegion','scroll-region'],['scrollArea','scroll-area'],['scrollFade','scroll-fade']].forEach(function (row) { mark(parts[row[0]],'data-fan-rail-'+row[1]); });
            nav.addEventListener('wheel',railWheel,{passive:true});
            var glyph = nativeClass(sidebarSheet,'panelGlyph'); if (glyph) Array.from(nav.getElementsByClassName(glyph)).forEach(function (el) { mark(el,'data-fan-rail-glyph'); });
            frameObserver = new MutationObserver(function () { if (root) syncControls(); });
            frameObserver.observe(frame,{attributes:true,attributeFilter:['style','class','data-sidebar-collapsed']});
            railObserver = new ResizeObserver(function () { if (root) syncControls(); });
            [root,nav,parts.logoRow,parts.footerActions,parts.settingsArea].concat(nestedMode ? [parts.newSessionRow] : []).forEach(function (el) { railObserver.observe(el); });
            parts.footerActions.addEventListener('scroll',syncPopups,{passive:true});
            syncControls();
          }
          var observer = new MutationObserver(function (records) {
            if (root && (!root.isConnected || !slot.contains(root))) end();
            if (!root) { start(); return; }
            if (records.some(function (r) { var target = r.target.nodeType === 1 ? r.target : r.target.parentElement; return target === root || nav.contains(target) || foot.contains(target) || parts.logoRow.contains(target) || parts.regionArea.contains(target) ||
              (nestedMode && (parts.newSessionRow.contains(target) || target === parts.scrollRegion || target === parts.scrollArea)); })) syncControls();
          });
          observer.observe(slot,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','aria-label','data-collapsed','disabled','aria-disabled']});
          var controller = {start:start}; controllers.add(controller); start();
          return function () { localClosed = true; observer.disconnect(); modeObserver.disconnect(); modeFrame = null; end(); controllers.delete(controller); };
        }
        var unwatch = watchRoots('[data-slot="sidebar"]',mount);
        var unwatchMenu = watchRoots('[data-windows-menu]',function (host) {
          var shadow = host.shadowRoot; if (!shadow) return function () {};
          // The preload's open shadow is otherwise outside the existing
          // square/no-ring policy. Do not change its handlers or roving tabs.
          var policy = document.createElement('style');
          policy.textContent = '[role="menubar"] > button{border-radius:0 !important}[role="menubar"] > button:focus{outline:none !important}[role="menubar"] > button:focus-visible{color:var(--dsw-alias-brand-primary)!important}';
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
          function bodyOf() {
            var body = nativeClass(sheet,'menuBody'), menu = nativeClass(sheet,'menu');
            if (!body || !menu) return null;
            if (tree.classList.contains(body) && tree.parentElement && tree.parentElement.classList.contains(menu)) return tree;
            var parent = tree.parentElement;
            return parent && parent.classList.contains(body) && parent.parentElement && parent.parentElement.classList.contains(menu) ? parent : null;
          }
          var scroller = bodyOf();
          if (!scroller) return function () {};
          var done = false, frame = 0;
          var events = ['wheel','pointerdown','touchstart','keydown'];
          function stop() {
            done = true; cancelAnimationFrame(frame); frame = 0;
            observer.disconnect(); if (resize) resize.disconnect();
            events.forEach(function (name) { scroller.removeEventListener(name,stop,true); });
          }
          function scroll() {
            frame = 0;
            if (done || !tree.isConnected) return;
            if (bodyOf() !== scroller) { stop(); return; }
            if (!scroller.clientHeight || !tree.querySelector('[role="treeitem"]')) return;
            // Native keyboard opening chooses a focused row. Never hide that
            // focus or move it just to impose the pointer-opening default.
            var focused = document.activeElement;
            if (!(tree.contains(focused) && focused.matches(':focus-visible'))) scroller.scrollTop = scroller.scrollHeight;
            stop();
          }
          function schedule() { if (!done && !frame) frame = requestAnimationFrame(scroll); }
          var observer = new MutationObserver(schedule);
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
          observer.observe(tree,{childList:true,subtree:true}); if (resize) resize.observe(scroller);
          events.forEach(function (name) { scroller.addEventListener(name,stop,{capture:true,passive:true}); });
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
            if (state.created) {
              if (el.hasAttribute('data-fan-model-owned')) el.remove();
              return;
            }
            if (el.textContent === state.last) el.textContent = state.text;
            if (!state.append && el.getAttribute("title") === state.text) {
              if (state.title === null) el.removeAttribute("title");
              else el.setAttribute("title", state.title);
            }
          }
          function paint(el, text) {
            var state = painted.get(el);
            if (!state) { state = { text: el.textContent, title: el.getAttribute("title"), append: false }; painted.set(el, state); }
            else if (el.textContent !== state.last) state.text = el.textContent;
            if (el.getAttribute("title") !== state.text) el.setAttribute("title", state.text);
            if (el.textContent !== text) el.textContent = text;
            state.last = text;
          }
          function paintNative(row, secondary, content, text) {
            var owned = row.querySelector('[data-fan-model-owned]'), parent = secondary || content;
            if (!parent) return;
            if (!owned) { owned = document.createElement('span'); owned.setAttribute('data-fan-model-owned', ''); painted.set(owned, { created: true }); }
            if (owned.parentElement !== parent) parent.appendChild(owned);
            owned.className = secondary ? '' : classes.secondary;
            var prefix = secondary && Array.from(secondary.childNodes).some(function (node) { return node !== owned && (node.textContent || '').trim(); }) ? ' · ' : '';
            if (owned.textContent !== prefix + text) owned.textContent = prefix + text;
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
              if (!classes || (classes.mode === 'native' && !row.classList.contains(classes.row))) return;
              var label = row.querySelector('.' + classes.label);
              var native = classes.mode === 'native';
              var content = native ? row.querySelector('.' + classes.content) : null;
              var summary = native
                ? Array.from(row.querySelectorAll('.' + classes.secondary)).find(function (el) { return !el.hasAttribute('data-fan-model-owned'); })
                : row.querySelector('.' + classes.summary);
              var owned = native ? row.querySelector('[data-fan-model-owned]') : null;
              if (!label || (!summary && !content)) return;
              var ids = byLabel[textOf(label)] || [];
              if (ids.length !== 1) {
                var stale = native ? owned : summary;
                if (stale && painted.has(stale)) { restore(stale, painted.get(stale)); painted.delete(stale); }
                return;
              }
              var id = ids[0], hit = cache.get(id);
              if (hit && hit.until > now) {
                if (hit.text) {
                  if (native) paintNative(row, summary, content, hit.text);
                  else paint(summary, hit.text);
                } else {
                  var old = native ? owned : summary;
                  if (old && painted.has(old)) { restore(old, painted.get(old)); painted.delete(old); }
                }
                return;
              }
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
        var targets = 'section[data-turn-trigger], div[data-tool="todo_write"], div[data-tool="create_goal"], div[data-tool="update_goal"], div[data-tool="get_goal"], div[data-tool="subagent"], div[data-tool^="subagent_"], [data-goal-bar] > div, section[data-testid="todo-panel"], ' + flow + ' div[data-variant="think"]:not([data-tool]), [data-question-key] > section, ' + flow + ' div[data-tool], ' + ':is(div,section):has(> [data-disclosure-header]), li[data-plugin-module]:has(> button[aria-expanded]), ' + flow + ' div:has(> [data-sample="bash"]), ' + flow + ' div:has(> button [data-compaction-disclosure]), ' + flow + ' [data-question-reply] > div:first-child, ' + flow + ' :is([data-terminal], [data-read], [data-search], [data-diff]), ' + flow + ' [role="treeitem"]:is(:has(> [data-json-expander]), :has(> [data-expanded]))';
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
            if (root.matches('li[data-plugin-module]')) return root.querySelector(':scope > button[aria-expanded]');
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
              // Idle question edits use native layout; captured toggles and
              // in-flight motion still retain their original measurement path.
              if (!job && !(hold && (isContent || isQuestion))) { if (!hold) measure(); return; }
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
        }, true, true);
        function reduced() { if (media.matches) active.forEach(function (settle) { settle(); }); }
        media.addEventListener('change', reduced);
        return function () { unwatch(); media.removeEventListener('change', reduced); active.clear(); };
      }, 'fan-de-hai: card-disclosure-motion');

      // Native details update UA shadow content asynchronously. Unlike React
      // cards, measure on toggle; never set open/hidden or replay summary input.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), active = new Set();
        var unwatch = watchRoots('details', function (root) {
          if (root.closest('.xterm,[data-fan-footer-ghost]')) return function () {};
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
            if (event.type === 'keyup' && event.key !== ' ') return;
            var height = root.getBoundingClientRect().height; inset = readInset();
            lock(height);
            frame = requestAnimationFrame(function () { frame = 0; if (hold && root.open === expanded) settle(); });
          }
          function changed() {
            if (closed || !root.isConnected || root.open === expanded) return;
            var next = root.open, from = hold ? hold.height : job ? root.getBoundingClientRect().height : lastHeight;
            expanded = next;
            // New out-of-chat coverage must not delay browser-find/auto reveal.
            if (!hold && !root.closest('[data-slot^="conversation.chat"],[data-chat-flow]')) { settle(); return; }
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
            if (!closed && root.open !== expanded && !media.matches && !hold) {
              if (!root.closest('[data-slot^="conversation.chat"],[data-chat-flow]')) { expanded = root.open; settle(); return; }
              lock(job ? root.getBoundingClientRect().height : lastHeight);
            }
          });
          observer.observe(root, {attributes:true,attributeFilter:['open']});
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { if(!closed&&!job&&!hold){lastHeight=root.getBoundingClientRect().height;inset=readInset();} }) : null;
          if(resize)resize.observe(root);
          root.addEventListener('click',before,true); root.addEventListener('keydown',before,true); root.addEventListener('keyup',before,true); root.addEventListener('toggle',changed);
          active.add(settle);
          return function () { closed=true;observer.disconnect();if(resize)resize.disconnect();root.removeEventListener('click',before,true);root.removeEventListener('keydown',before,true);root.removeEventListener('keyup',before,true);root.removeEventListener('toggle',changed);active.delete(settle);cancel();release(); };
        });
        function reduced() { if(media.matches)active.forEach(function(settle){settle();}); }
        media.addEventListener('change',reduced);
        return function () {unwatch();media.removeEventListener('change',reduced);active.clear();};
      }, 'fan-de-hai: native-details-motion');

      // Newly mounted dock surfaces and local submission echoes fade without
      // changing their extent, scrolling, content or Host submission lifecycle.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), jobs = new Map(), boot = true, seen = new WeakSet();
        var FLOW = '[data-chat-flow], [data-slot="conversation.chat.flow"]';
        function cancel(el) { var job = jobs.get(el); if (job) { jobs.delete(el); job.animation.cancel(); } }
        function reveal(el, owner, from, duration) {
          if (!el.isConnected || media.matches || !el.animate || getComputedStyle(el).display === 'none' || el.closest('.xterm,[data-fan-footer-ghost]')) return;
          if (el.getAnimations().some(function (a) { return a.effect && a.effect.getKeyframes().some(function (frame) { return 'opacity' in frame; }); })) return;
          var opacity = parseFloat(getComputedStyle(el).opacity); if (!(opacity > 0)) return;
          var animation = el.animate([{opacity:from == null ? 0 : from},{opacity:opacity}],{duration:duration == null ? 140 : Math.max(0,duration),easing:'ease',fill:'both'});
          var job = {animation:animation,opacity:opacity,owner:owner}; jobs.set(el,job);
          animation.finished.then(function () { if (jobs.get(el) === job) cancel(el); }, function () { if (jobs.get(el) === job) cancel(el); });
        }
        var unwatchDock = watchRoots('section[data-testid="todo-panel"], [data-goal-bar] > div, [data-composer-stat="usage"], [data-composer-stat="activity"], [data-composer-dock] > span:has(> button[aria-haspopup="dialog"])',function (el) {
          if (!boot) reveal(el,null);
          return function () { cancel(el); };
        });
        var unwatchFlow = watchRoots(FLOW,function (root) {
          function owned(el) { return el.closest(FLOW) === root; }
          function echoes(node) {
            if (node.nodeType !== 1) return [];
            var list = node.matches('[data-submission-echo]') ? [node] : [];
            return list.concat(Array.from(node.querySelectorAll('[data-submission-echo]'))).filter(owned);
          }
          function echo(el) { if (seen.has(el)) return; seen.add(el); reveal(el,root); }
          Array.from(root.querySelectorAll('[data-submission-echo]')).filter(owned).forEach(function (el) { if (boot) seen.add(el); else echo(el); });
          var observer = new MutationObserver(function (changes) {
            var added = new Set(), users = new Set(), removedHistory = false;
            changes.forEach(function (change) {
              change.addedNodes.forEach(function (node) {
                echoes(node).forEach(function (el) { added.add(el); });
                if (node.nodeType !== 1) return;
                var nodes = node.matches('[data-chat-flow-kind="user"]') ? [node] : [];
                nodes.concat(Array.from(node.querySelectorAll('[data-chat-flow-kind="user"]'))).filter(owned).forEach(function (el) { users.add(el); });
              });
              change.removedNodes.forEach(function (node) { if (node.nodeType === 1 && (node.matches('[data-chat-flow-kind="user"]') || node.querySelector('[data-chat-flow-kind="user"]'))) removedHistory = true; });
            });
            var removed = [];
            jobs.forEach(function (job,el) { if (job.owner === root && !el.isConnected) removed.push({el:el,job:job}); });
            // DOM has no reflected requestId for echoes. Transfer only an unambiguous
            // same-batch single echo -> newest durable user row; never infer from text.
            var durable = Array.from(users);
            if (isEchoTransfer(removedHistory, added.size, removed.length, durable, function () {
              return Array.from(root.querySelectorAll('[data-chat-flow-kind="user"]')).filter(owned);
            })) {
              var old = removed[0].job, timing = old.animation.effect.getComputedTiming();
              var elapsed = Math.max(0,Math.min(140,Number(old.animation.currentTime) || 0));
              var from = old.opacity * (timing.progress == null ? 0 : timing.progress);
              cancel(removed[0].el); reveal(durable[0],root,from,140 - elapsed);
            }
            removed.forEach(function (item) { cancel(item.el); });
            added.forEach(echo);
          });
          observer.observe(root,{subtree:true,childList:true});
          return function () { observer.disconnect(); jobs.forEach(function (job,el) { if (job.owner === root) cancel(el); }); };
        });
        boot = false;
        function settle() { if (media.matches) Array.from(jobs.keys()).forEach(cancel); }
        media.addEventListener('change',settle);
        return function () { unwatchDock(); unwatchFlow(); media.removeEventListener('change',settle); Array.from(jobs.keys()).forEach(cancel); };
      }, 'fanframe: new-content-presence');

      // Decorate the registered model control, not its private component state.
      // Reuse its exact injected store/select/preference controllers: no parallel
      // RPC, synthetic clicks, duplicated persistence or replacement model picker.
      if (typeof ctx.inject === 'function') ctx.inject(['slots'], function (scope) {
        var slots = scope.slots;
        if (!slots || !slots.entries || !slots.subscribe) return;
        slots.inject('conversation.input.model', function () {
          var React = require('react'), sequence = 0;
          var installed = null, nativeEntry = null, changing = false, stopped = false;
          function attr(el, name, value) {
            var before = el.getAttribute(name); el.setAttribute(name, value);
            return function () { if (el.getAttribute(name) === value) { if (before === null) el.removeAttribute(name); else el.setAttribute(name, before); } };
          }
          function mount(panel, menu, face, t, locked, picker, codex, codexEntry) {
            var closed = false, records = new Map(), hidden = new Map(), pending = false, submitted = null, failure = false;
            var role = menu.getAttribute('role'), modelCell = menu.querySelector(':scope > ' + picker.cell);
            var restoreMenu = attr(menu, 'data-fan-model-menu', ''), restoreModelRole = null;
            var id = 'fan-model-' + (++sequence), identity = '', editing = null;
            var alert = document.createElement('div'); alert.className = 'fan-model-error'; alert.setAttribute('role', 'alert'); alert.hidden = true; panel.appendChild(alert);
            function state() { return face.directory.getSnapshot(); }
            function preferenceFace() {
              if (face.preference) return face;
              if (!codex || codex.available !== true || typeof slots.entriesOfSlot !== 'function') return null;
              var live = slots.entriesOfSlot('conversation.input.model.options').filter(function (entry) { return entry.options && entry.options.id === 'codex-subscription'; });
              if (live.length !== 1 || live[0] !== codexEntry) return null;
              var current = state().current, other = codex.directory.getSnapshot().current;
              return current && other && current.provider === 'openai-codex' && other.provider === current.provider && other.model === current.model ? codex : null;
            }
            function prefs() { var owner = preferenceFace(); return owner ? owner.preference.getSnapshot() : {}; }
            function key(s) { return JSON.stringify([s.current && s.current.provider, s.current && s.current.model]); }
            function choices() {
              var s = state(), p = prefs(), current = s.current, model, parameterT = codex ? codex.t : t;
              if (!current) return [];
              (s.groups || []).forEach(function (group) { if (group.id === current.provider) model = (group.models || []).find(function (m) { return m.id === current.model; }); });
              var list = [], reasoning = model && model.reasoning;
              if (reasoning && Array.isArray(reasoning.efforts)) {
                var efforts = reasoning.efforts.map(function (e) { return { value: e.id, label: typeof face.resolveText === 'function' ? face.resolveText(e.name) : e.name, hint: e.description === void 0 ? void 0 : typeof face.resolveText === 'function' ? face.resolveText(e.description) : e.description }; });
                if (reasoning.defaultEffort === void 0) efforts.unshift({ value: void 0, label: t(picker.providerDefault) });
                list.push({ kind: 'effort', label: t(picker.effortLabel), value: current.reasoningEffort === void 0 ? reasoning.defaultEffort : current.reasoningEffort, options: efforts });
              }
              if (current.provider === 'openai-codex') {
                // An unknown capability catalog keeps that native row untouched.
                if (Array.isArray(p.fastModels) && Array.isArray(p.ultrafastModels)) {
                  var speeds = [{ value: 'standard', label: parameterT('speedStandard'), hint: parameterT('speedStandardHint') }];
                  if (p.fastModels.includes(current.model)) speeds.push({ value: 'fast', label: parameterT('speedFast'), hint: parameterT(current.model === 'gpt-6-astra' ? 'speedFastAstraHint' : 'speedFastHint') });
                  if (p.ultrafastModels.includes(current.model)) speeds.push({ value: 'ultrafast', label: parameterT('speedUltrafast'), hint: parameterT('speedUltrafastHint') });
                  var speed = p.speedMode === 'ultrafast' && p.ultrafastModels.includes(current.model) ? 'ultrafast' : p.speedMode === 'fast' && p.fastModels.includes(current.model) ? 'fast' : 'standard';
                  if (speeds.length > 1) list.push({ kind: 'speed', label: parameterT('speedTitle'), value: speed, options: speeds });
                }
                if (Array.isArray(p.verbosityModels) && p.verbosityModels.includes(current.model)) list.push({ kind: 'verbosity', label: parameterT('verbosityTitle'), value: p.outputVerbosity, options: ['default', 'low', 'medium', 'high'].map(function (value, i) { var label = ['verbosityDefault', 'verbosityLow', 'verbosityMedium', 'verbosityHigh'][i]; return { value: value, label: parameterT(label), hint: parameterT(label + 'Hint') }; }) });
              }
              var cells = Array.from(menu.querySelectorAll(':scope > ' + picker.cell));
              return list.filter(function (spec) {
                if (codex && spec.kind !== 'effort') {
                  var field = spec.kind === 'speed' ? 'speedMode' : 'outputVerbosity';
                  var options = menu.querySelectorAll(':scope > [data-slot="conversation.input.model.options"] > button[role="menuitem"][aria-haspopup="menu"][data-codex-model-option="' + field + '"]');
                  spec.cell = options.length === 1 ? options[0] : null;
                } else spec.cell = cells.find(function (cell) { var label = cell.querySelector(picker.label); return label && label.textContent === spec.label; });
                spec.index = spec.options.findIndex(function (option) { return option.value === spec.value; });
                return spec.cell && spec.options.length > 0 && spec.index >= 0;
              });
            }
            function disabled(spec) {
              var s = state(), p = prefs(), owner = preferenceFace(), other = owner && owner !== face && owner.directory.getSnapshot();
              return locked || (picker.ownerTrigger && picker.ownerTrigger.disabled) || (spec.cell && spec.cell.disabled) || pending ||
                s.status === 'selecting' || s.pending != null || !face.available ||
                (spec.kind !== 'effort' && (!owner || (other && (other.status === 'selecting' || other.pending != null)) || p.status !== 'ready' || !p.writable || p.saving));
            }
            function signature(spec) { return JSON.stringify([key(state()), spec.options.map(function (o) { return o.value; }), spec.value]); }
            function clearSubmitted() { if (submitted && submitted.timer) clearTimeout(submitted.timer); submitted = null; }
            function paint(record, index) {
              var spec = record.spec, option = spec.options[index];
              if (!option) return;
              record.input.value = String(index); if (record.value.textContent !== option.label) record.value.textContent = option.label;
              record.input.setAttribute('aria-valuetext', option.label); record.input.setAttribute('aria-description', option.hint || ''); record.input.title = option.hint || option.label;
              var position = (spec.options.length > 1 ? index * 100 / (spec.options.length - 1) : 0) + '%';
              record.fill.style.width = position; record.thumb.style.left = position;
            }
            function cancel() { if (!editing) return; var record = editing.record; editing = null; delete record.row.dataset.editing; paint(record, record.spec.index); }
            function optionKey(spec) { return JSON.stringify(spec.options.map(function (option) { return option.value; })); }
            function create(spec) {
              var row = document.createElement('div'); row.className = 'fan-model-row'; row.dataset.setting = spec.kind;
              var label = document.createElement('label'), control = document.createElement('span'), track = document.createElement('span'), fill = document.createElement('span'), thumb = document.createElement('span'), ticks = document.createElement('span'), input = document.createElement('input'), value = document.createElement('span');
              control.className = 'fan-model-control'; track.className = 'fan-model-track'; fill.className = 'fan-model-fill'; thumb.className = 'fan-model-thumb'; ticks.className = 'fan-model-ticks'; value.className = 'fan-model-value'; value.setAttribute('aria-hidden', 'true');
              track.setAttribute('aria-hidden', 'true'); ticks.setAttribute('aria-hidden', 'true');
              input.type = 'range'; input.min = '0'; input.step = '1'; input.id = id + '-' + spec.kind; label.htmlFor = input.id;
              track.append(fill, thumb); control.append(track, ticks, input); row.append(label, control, value); panel.insertBefore(row, alert);
              var record = { row: row, label: label, control: control, input: input, value: value, fill: fill, thumb: thumb, ticks: ticks, spec: spec, count: 0 }, point = null;
              function hover(event) {
                if (event && typeof event.clientX === 'number' && event.pointerType !== 'touch') point = { x: event.clientX, y: event.clientY };
                if (!point || (input.disabled && !pending)) { control.removeAttribute('data-thumb-hover'); return; }
                var box = thumb.getBoundingClientRect();
                var inside = Math.abs(point.x - (box.left + box.width / 2)) + Math.abs(point.y - (box.top + box.height / 2)) <= box.width / 2 + .5;
                control.toggleAttribute('data-thumb-hover', inside);
              }
              control.addEventListener('pointermove', hover); control.addEventListener('pointerenter', hover);
              control.addEventListener('pointerleave', function () { point = null; control.removeAttribute('data-thumb-hover'); });
              thumb.addEventListener('transitionend', function () { hover(); });
              function begin(mode) { if (input.disabled) return; failure = false; editing = { record: record, mode: mode, signature: signature(record.spec) }; row.dataset.editing = mode; }
              function commit() {
                var requested = Number(input.value), current = choices().find(function (s) { return s.kind === record.spec.kind; });
                var valid = !closed && current && (!editing || editing.signature === signature(current)) && !disabled(current);
                editing = null; delete row.dataset.editing;
                if (!valid || requested === current.index || !current.options[requested]) { update(); return; }
                var s = state(), option = current.options[requested], operation;
                // Preserve the released value before a controller can synchronously
                // publish 'selecting' with its still-old authoritative snapshot.
                var transaction = { record: record, identity: key(s), options: optionKey(current), index: requested };
                submitted = transaction; pending = true; failure = false;
                try {
                  if (current.kind === 'effort') {
                    var selection = { provider: s.current.provider, model: s.current.model };
                    if (option.value !== void 0) selection.reasoningEffort = option.value;
                    operation = face.select(selection);
                  } else {
                    var preferenceOwner = preferenceFace(), patch = {};
                    patch[current.kind === 'speed' ? 'speedMode' : 'outputVerbosity'] = option.value;
                    operation = preferenceOwner ? preferenceOwner.preference.set(patch) : false;
                  }
                } catch (_) { operation = Promise.reject(_); }
                update();
                Promise.resolve(operation).then(function (accepted) {
                  if (closed) return;
                  transaction.failed = accepted === false || (accepted && accepted.ok === false) || (current.kind === 'effort' ? state().status === 'error' : !!prefs().error);
                }, function () { transaction.failed = true; }).then(function () {
                  if (closed) return;
                  transaction.settled = true;
                  if (submitted !== transaction) { pending = false; update(); return; }
                  if (transaction.failed) { failure = true; pending = false; clearSubmitted(); }
                  // Preferences have already accepted/normalized their fallback at
                  // resolve. Effort confirmation may arrive in a LATER projection.
                  else if (current.kind !== 'effort') { pending = false; clearSubmitted(); }
                  update();
                  if (submitted === transaction) transaction.timer = setTimeout(function () {
                    if (closed || submitted !== transaction) return;
                    pending = false; failure = { kind: 'unconfirmed', identity: transaction.identity, setting: current.kind, options: transaction.options, index: transaction.index }; clearSubmitted(); update();
                  }, 8000);
                });
              }
              var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
              input.addEventListener('pointerdown', function (event) { begin('pointer'); if (editing && input.setPointerCapture) { try { input.setPointerCapture(event.pointerId); } catch (_) {} } });
              input.addEventListener('input', function () { paint(record, Number(input.value)); });
              input.addEventListener('pointerup', function () { if (editing && editing.record === record && editing.mode === 'pointer') commit(); });
              input.addEventListener('pointercancel', cancel); input.addEventListener('lostpointercapture', function () { if (editing && editing.record === record && editing.mode === 'pointer') cancel(); });
              input.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && editing && editing.record === record) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
                // Let native Tab traversal leave the range without the owner's
                // menu handler treating it as selection or closing the card.
                if (picker.ownerTrigger && event.key === 'Tab') { event.stopPropagation(); return; }
                if (keys.includes(event.key)) { event.stopPropagation(); if (!editing || editing.record !== record) begin('keyboard'); }
              });
              input.addEventListener('keyup', function (event) { if (keys.includes(event.key) && editing && editing.record === record && editing.mode === 'keyboard') commit(); });
              input.addEventListener('change', function () { if (!editing) commit(); });
              input.addEventListener('blur', function () { if (editing && editing.record === record) cancel(); });
              return record;
            }
            function restoreCell(cell, owned) { if (cell.getAttribute('data-fan-model-cell') === owned.last) { if (owned.before === null) cell.removeAttribute('data-fan-model-cell'); else cell.setAttribute('data-fan-model-cell', owned.before); } }
            function update() {
              if (closed) return;
              var currentCell = menu.querySelector(':scope > ' + picker.cell);
              if (currentCell !== modelCell) {
                if (restoreModelRole) { restoreModelRole(); restoreModelRole = null; }
                modelCell = currentCell;
              }
              var list = choices(), next = new Set(list.map(function (s) { return s.kind; })), cells = new Set(list.map(function (s) { return s.cell; }));
              var nextIdentity = key(state());
              if (identity !== nextIdentity || (editing && !list.some(function (s) { return s.kind === editing.record.spec.kind && !disabled(s) && signature(s) === editing.signature; }))) cancel();
              identity = nextIdentity;
              if (failure && failure.kind === 'unconfirmed') {
                var late = list.find(function (spec) { return spec.kind === failure.setting && optionKey(spec) === failure.options; });
                if (failure.identity !== nextIdentity || !late || late.index === failure.index) failure = false;
              }
              if (submitted) {
                var confirm = list.find(function (spec) { return spec.kind === submitted.record.spec.kind && optionKey(spec) === submitted.options; });
                if (submitted.identity !== nextIdentity || !confirm || (submitted.settled && confirm.index === submitted.index)) {
                  if (submitted.settled) pending = false;
                  clearSubmitted();
                }
              }
              records.forEach(function (record, kind) { if (!next.has(kind)) { record.row.remove(); records.delete(kind); } });
              hidden.forEach(function (owned, cell) { if (!cells.has(cell)) { restoreCell(cell, owned); hidden.delete(cell); } });
              list.forEach(function (spec, index) {
                var record = records.get(spec.kind); if (!record) { record = create(spec); records.set(spec.kind, record); }
                if (panel.children[index] !== record.row) panel.insertBefore(record.row, panel.children[index] || alert);
                record.spec = spec; if (record.label.textContent !== spec.label) record.label.textContent = spec.label; record.input.max = String(spec.options.length - 1);
                record.input.disabled = disabled(spec) || spec.options.length < 2;
                if (record.count !== spec.options.length) { record.ticks.replaceChildren(); spec.options.forEach(function (_, i) { var tick = document.createElement('i'); tick.style.left = (spec.options.length > 1 ? i * 100 / (spec.options.length - 1) : 0) + '%'; record.ticks.appendChild(tick); }); record.count = spec.options.length; }
                if (!editing || editing.record !== record) paint(record, submitted && submitted.record === record ? submitted.index : spec.index);
                var owned = hidden.get(spec.cell); if (!owned) { owned = { before: spec.cell.getAttribute('data-fan-model-cell') }; hidden.set(spec.cell, owned); }
                owned.last = spec.kind; if (spec.cell.getAttribute('data-fan-model-cell') !== spec.kind) spec.cell.setAttribute('data-fan-model-cell', spec.kind);
              });
              panel.hidden = list.length === 0; panel.setAttribute('aria-busy', String(pending || !!prefs().saving || state().status === 'selecting' || state().pending != null));
              if (list.length && !picker.ownerTrigger) {
                // The native owner and Codex's option contributions both rely
                // on menu/menuitem roles. Only the legacy picker owns every row.
                if (menu.getAttribute('role') === 'menu') menu.setAttribute('role', 'group');
                if (!restoreModelRole && modelCell) restoreModelRole = attr(modelCell, 'role', 'button');
              } else {
                if (restoreModelRole) { restoreModelRole(); restoreModelRole = null; }
                if (!picker.ownerTrigger && menu.querySelector(':scope > ' + picker.cell) && menu.getAttribute('role') === 'group') { if (role === null) menu.removeAttribute('role'); else menu.setAttribute('role', role); }
              }
              alert.hidden = !failure;
              if (failure) alert.textContent = /[\u3400-\u9fff]/.test(t(picker.providerDefault)) ? (failure.kind === 'unconfirmed' ? '同步未确认，请重试' : '未保存，请重试') : (failure.kind === 'unconfirmed' ? 'Sync not confirmed. Try again.' : 'Not saved. Try again.');
            }
            // The original picker measures before this portal's layout effect.
            // Keep the same native anchor/margins after the compact rows resize.
            var position = ownStyles(menu);
            function place() {
              if (closed || !menu.isConnected) return;
              var trigger = Array.from(document.querySelectorAll(picker.trigger)).find(function (button) { return button.getAttribute('aria-controls') === menu.id; });
              if (!trigger) return;
              var box = trigger.getBoundingClientRect();
              position.set('left', Math.max(12, Math.min(box.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 12)) + 'px');
              position.set('top', Math.max(12, Math.min(box.top - 8 - menu.offsetHeight, window.innerHeight - menu.offsetHeight - 12)) + 'px');
            }
            // The owner's arrow navigation queries hidden native effort rows.
            // Traverse visible native items and our ranges in their DOM order,
            // while leaving range arrow keys and every other native key intact.
            function nativeNavigation(event) {
              if (!picker.ownerTrigger || panel.hidden || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || panel.contains(event.target)) return;
              var selector = 'button[role="menuitem"]:not([disabled]),button[role="menuitemradio"]:not([disabled]),button[role="switch"]:not([disabled]),.fan-model-sliders input[type="range"]:not([disabled])';
              var items = Array.from(menu.querySelectorAll(selector)).filter(function (el) { return el.getClientRects().length > 0; });
              var at = items.indexOf(document.activeElement), forward = event.key === 'ArrowDown';
              if (!items.length || (at < 0 && document.activeElement !== picker.ownerTrigger)) return;
              event.preventDefault(); event.stopPropagation();
              var next = at < 0 ? (forward ? 0 : items.length - 1) : (at + (forward ? 1 : -1) + items.length) % items.length;
              items[next].focus();
            }
            if (picker.ownerTrigger) { menu.addEventListener('keydown', nativeNavigation, true); picker.ownerTrigger.addEventListener('keydown', nativeNavigation, true); }
            var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
            if (resize) resize.observe(menu); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
            var unstate = face.directory.subscribe(update), unpref = face.preference ? face.preference.subscribe(update) : function () {};
            var unoptionsPreference = codex ? codex.preference.subscribe(update) : function () {};
            var unoptionsDirectory = codex && codex.directory !== face.directory ? codex.directory.subscribe(update) : function () {};
            var observer = new MutationObserver(function (changes) { if (changes.some(function (r) { return !panel.contains(r.target); })) { update(); place(); } });
            observer.observe(menu, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
            if (picker.ownerTrigger) observer.observe(picker.ownerTrigger, { attributes: true, attributeFilter: ['disabled'] });
            update(); place();
            return function () {
              closed = true; editing = null; clearSubmitted(); observer.disconnect(); if (resize) resize.disconnect(); if (picker.ownerTrigger) { menu.removeEventListener('keydown', nativeNavigation, true); picker.ownerTrigger.removeEventListener('keydown', nativeNavigation, true); } window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); position.restore(); unstate(); unpref(); unoptionsPreference(); unoptionsDirectory(); hidden.forEach(function (owned, cell) { restoreCell(cell, owned); }); hidden.clear();
              if (!picker.ownerTrigger && menu.querySelector(':scope > ' + picker.cell) && menu.getAttribute('role') === 'group') { if (role === null) menu.removeAttribute('role'); else menu.setAttribute('role', role); }
              if (restoreModelRole) restoreModelRole(); restoreMenu(); panel.replaceChildren(); records.clear();
            };
          }
          function ModelControls(props) {
            var face = props.fanFace || {}, forwarded = Object.assign({}, props, face);
            var preferences = face.preference && typeof face.preference.subscribe === 'function' && typeof face.preference.getSnapshot === 'function' && typeof face.preference.set === 'function';
            var nativePicker = face.preference === void 0 && typeof face.load === 'function' && typeof face.resolveText === 'function';
            var usable = face.available === true && face.directory && typeof face.directory.subscribe === 'function' && typeof face.directory.getSnapshot === 'function' && typeof face.select === 'function' && (preferences || nativePicker);
            // The picker no longer renders the optional model-label child slot,
            // so the compact rows own their own attachment: the first open menu
            // with native cells receives one panel container, and the mount is
            // released when that menu leaves the document.
            React.useLayoutEffect(function () {
              if (!usable) return;
              var picker = { menu: '.codexModelSelectMenu', cell: '.codexModelSelectCell', label: '.codexModelSelectCellLabel', trigger: '.codexModelSelectTrigger', effortLabel: 'effortLabel', providerDefault: 'providerDefault' };
              if (nativePicker) {
                var sheet = '@deepseek-ai/dsh-client-ui-model-selection/ModelSelect.module.css';
                var names = ['menu', 'cell', 'cellLabel', 'trigger'].map(function (name) { return nativeClass(sheet, name); });
                if (names.some(function (name) { return !name; })) return;
                picker = { menu: '.' + names[0], cell: '.' + names[1], label: '.' + names[2], trigger: '.' + names[3], effortLabel: 'menu.effort', providerDefault: 'effort.providerDefault' };
              }
              var closed = false, owned = null, optionsEntry = null, optionsFace = null;
              var optionsKey = 'conversation.input.model.options';
              function refreshOptions() {
                var entries = nativePicker && typeof slots.entriesOfSlot === 'function' ? slots.entriesOfSlot(optionsKey).filter(function (entry) { return entry.options && entry.options.id === 'codex-subscription'; }) : [];
                var next = entries.length === 1 ? entries[0] : null;
                if (next === optionsEntry) return false;
                detach(); optionsEntry = next; optionsFace = null;
                if (next && !next.store && typeof next.inject === 'function') {
                  try {
                    var candidate = next.inject(props.sessionId), preference = candidate && candidate.preference, directory = candidate && candidate.directory;
                    if (candidate && candidate.available === true && typeof candidate.t === 'function' && preference && directory &&
                      typeof preference.getSnapshot === 'function' && typeof preference.subscribe === 'function' && typeof preference.set === 'function' &&
                      typeof directory.getSnapshot === 'function' && typeof directory.subscribe === 'function') optionsFace = candidate;
                  } catch (error) { console.warn('FanFrame: Codex options bridge unavailable',error); }
                }
                return true;
              }
              function detach() {
                if (!owned) return;
                var drop = owned; owned = null;
                drop.cleanup(); drop.container.remove();
              }
              function attach(menu) {
                if (closed || (owned && owned.menu === menu) || !menu.querySelector(':scope > ' + picker.cell)) return;
                var trigger = nativePicker && props.fanAnchor && props.fanAnchor.current && props.fanAnchor.current.closest(picker.trigger);
                if (nativePicker && (!trigger || !trigger.isConnected || trigger.getAttribute('aria-controls') !== menu.id)) return;
                detach();
                // A mounted controller keeps its own owner through cleanup.
                var attachedPicker = nativePicker ? Object.assign({}, picker, { ownerTrigger: trigger }) : picker;
                var container = document.createElement('div');
                container.className = 'fan-model-sliders';
                container.addEventListener('click', function (event) { event.stopPropagation(); });
                menu.appendChild(container);
                owned = { menu: menu, trigger: trigger, container: container, cleanup: mount(container, menu, face, forwarded.t, props.locked, attachedPicker, optionsFace, optionsEntry) };
              }
              function scan() {
                if (closed) { detach(); return; }
                var trigger = nativePicker && props.fanAnchor && props.fanAnchor.current && props.fanAnchor.current.closest(picker.trigger);
                if (owned && (!owned.menu.isConnected || !owned.menu.matches(picker.menu) || owned.container.parentNode !== owned.menu || (nativePicker && (trigger !== owned.trigger || !trigger || !trigger.isConnected || trigger.getAttribute('aria-controls') !== owned.menu.id)))) detach();
                var menus = document.querySelectorAll(picker.menu);
                for (var i = menus.length - 1; i >= 0; i--) {
                  if (menus[i] === (owned && owned.menu)) return;
                  if (!menus[i].isConnected || !menus[i].querySelector(':scope > ' + picker.cell)) continue;
                  if (nativePicker && (!trigger || !trigger.isConnected || trigger.getAttribute('aria-controls') !== menus[i].id)) continue;
                  attach(menus[i]); return;
                }
              }
              var observer = new MutationObserver(function (records) {
                if (menuDiscoveryChanged(records, picker, owned, nativePicker && props.fanAnchor && props.fanAnchor.current)) scan();
              });
              // Explicit identity changes replace the old accidental retry on
              // unrelated chat text; late native cells still take the same scan.
              observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class','id','aria-controls'] });
              var unoptions = nativePicker ? slots.subscribe(optionsKey,function () { if (!closed && refreshOptions()) scan(); }) : function () {};
              refreshOptions(); scan();
              return function () { closed = true; observer.disconnect(); unoptions(); detach(); };
            }, [usable, nativePicker, face.directory, face.preference, face.select, forwarded.t, props.locked, props.sessionId, props.fanAnchor]);
            return props.fanNative ? React.createElement(props.fanNative, forwarded) : null;
          }
          function ModelLabelBridge(props) {
            var anchor = React.useRef(null), label;
            if (props.fanLabel) {
              var forwarded = Object.assign({}, props, props.fanLabelFace);
              ['fanLabel', 'fanLabelFace', 'fanFace', 'fanNativeT'].forEach(function (key) { delete forwarded[key]; });
              label = React.createElement(props.fanLabel, forwarded);
            } else {
              var model = props.model, badge = model.badge, sheet = '@deepseek-ai/dsh-client-ui-model-selection/ModelSelect.module.css';
              label = model.name;
              if (badge !== void 0) {
                // Native client packages are not guaranteed to be importable
                // from a dynamic plugin. Keep badge text if Tag is unavailable.
                var Tag = null;
                try { Tag = require('@deepseek-ai/dsh-client-ui-primitives').Tag; } catch (_) {}
                var tag = React.createElement(Tag || 'span', { className: nativeClass(sheet, 'badge'), tone: Tag ? badge.tone : void 0 }, props.fanFace.resolveText(badge.text));
                var name = React.createElement('span', { className: nativeClass(sheet, 'badgedNameText') }, model.name);
                label = React.createElement('span', { className: nativeClass(sheet, 'badgedName') }, props.placement === 'trigger' ? tag : name, ' ', props.placement === 'trigger' ? name : tag);
              }
            }
            // The label remains non-interactive. Only its trigger instance owns
            // a null-rendering controller; controls stay in the owner's menu.
            return React.createElement('span', { ref: anchor }, props.placement === 'trigger' ? React.createElement(ModelControls, { fanFace: props.fanFace, fanAnchor: anchor, t: props.fanNativeT, sessionId: props.sessionId }) : null, label);
          }
          function entryPriority(entry) {
            var priority = entry.options && entry.options.priority;
            return typeof priority === 'number' ? priority : 0;
          }
          var labelKey = 'conversation.input.model.label', labelEntry = null;
          function reconcile() {
            if (stopped || changing) return;
            var base = slots.entries('conversation.input.model').filter(function (entry) { return entry.component !== ModelControls; }).sort(function (a, b) { return entryPriority(a) - entryPriority(b); })[0];
            var label = slots.entries(labelKey).filter(function (entry) { return entry.component !== ModelLabelBridge; }).sort(function (a, b) { return entryPriority(a) - entryPriority(b); })[0];
            if (base === nativeEntry && label === labelEntry) return;
            changing = true;
            try {
              if (installed) { installed(); installed = null; }
              nativeEntry = base; labelEntry = label;
              if (!base || typeof base.inject !== 'function' || typeof base.component !== 'function') return;
              var options, component;
              if (base.children && base.children[labelKey]) {
                // A child declaration has one owner. Never redeclare it or call
                // the native parent without its registration-bound renderSlot.
                if (label && label.children && Object.keys(label.children).length) return;
                var locale = scope.get && scope.get('locale');
                if (!locale || typeof locale.bind !== 'function') return;
                options = { name: labelKey, priority: label ? entryPriority(label) - 1 : 0,
                  inject: function (sessionId) { return { fanFace: base.inject(sessionId), fanNativeT: locale.bind(base.locale || 'common'), fanLabel: label && label.component, fanLabelFace: label && typeof label.inject === 'function' ? label.inject(sessionId) : {} }; }
                };
                if (label && label.locale !== void 0) options.locale = label.locale;
                component = ModelLabelBridge;
              } else {
                if (base.children && Object.keys(base.children).length) return;
                options = { name: 'conversation.input.model', priority: entryPriority(base) - 1,
                  inject: function (sessionId) { return { fanNative: base.component, fanFace: base.inject(sessionId) }; }
                };
                if (base.locale !== void 0) options.locale = base.locale;
                component = ModelControls;
              }
              installed = slots.register(options, component);
            } finally { changing = false; }
          }
          var unsubscribe = slots.subscribe('conversation.input.model', reconcile), unlabel = slots.subscribe(labelKey, reconcile); reconcile();
          return function () { stopped = true; unsubscribe(); unlabel(); if (installed) installed(); };
        });
      }, 'fanframe: compact-model-controls');

      // First mount owns the OUTER dock's occupied height, separately from the
      // existing inner-bar fade and later disclosure animation. No React nodes
      // are retained, moved, cloned or resurrected on removal.
      ctx.effect(function () {
        var media = matchMedia('(prefers-reduced-motion: reduce)'), active = new Set(), boot = true;
        var unwatch = watchRoots('section[data-testid="todo-panel"], [data-goal-bar]', function (root) {
          if (boot || media.matches || !root.animate || !root.getClientRects().length || root.closest('[hidden]')) return function () {};
          if (root.getAnimations().some(function (a) { return a.effect && a.effect.getKeyframes().some(function (k) { return 'height' in k || 'maxHeight' in k; }); })) return function () {};
          var height = root.getBoundingClientRect().height;
          if (height <= 0) return function () {};
          var styles = ownStyles(root), css = getComputedStyle(root), job, closed = false;
          var end = { height: height + 'px', paddingTop: css.paddingTop, paddingBottom: css.paddingBottom, marginTop: css.marginTop, marginBottom: css.marginBottom };
          function settle() {
            if (closed) return; closed = true;
            active.delete(settle); observer.disconnect(); if (resize) resize.disconnect();
            root.removeEventListener('click', settle, true); root.removeEventListener('keydown', settle, true); root.removeEventListener('focusin', settle, true);
            if (job) job.cancel(); styles.restore();
          }
          var observer = new MutationObserver(settle);
          var width = root.getBoundingClientRect().width;
          var resize = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { if (Math.abs(root.getBoundingClientRect().width - width) > 0.5) settle(); }) : null;
          styles.set('overflow-x', 'hidden'); styles.set('overflow-y', 'hidden'); styles.set('min-height', '0'); styles.set('box-sizing', 'border-box');
          try {
            job = root.animate([{ height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }, end], { duration: 180, easing: 'ease', fill: 'both' });
            observer.observe(root, { subtree: true, childList: true }); if (resize) resize.observe(root);
            root.addEventListener('click', settle, true); root.addEventListener('keydown', settle, true); root.addEventListener('focusin', settle, true);
            active.add(settle); job.finished.then(settle, settle);
          } catch (_) { settle(); }
          return settle;
        });
        boot = false;
        function reduce() { if (media.matches) Array.from(active).forEach(function (settle) { settle(); }); }
        media.addEventListener('change', reduce);
        return function () { unwatch(); media.removeEventListener('change', reduce); Array.from(active).forEach(function (settle) { settle(); }); };
      }, 'fanframe: dock-first-layout');

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
        var GROUP='[data-step-process], [data-step-process-body]', mountedGroups=new WeakSet();
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
        function rememberGroups(node,fresh){
          function remember(el){if(!mountedGroups.has(el)){mountedGroups.add(el);if(fresh)fresh.add(el);}}
          if(node.matches(GROUP))remember(node);
          node.querySelectorAll(GROUP).forEach(remember);
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
          rememberGroups(root);
          var observer=new MutationObserver(function(records){
            var fresh=new Set(), added=new Set();
            records.forEach(function(r){
              if(r.type==='attributes'&&r.attributeName==='data-turn-process-inline')inlineOwners.add(r.target);
              if(r.type==='childList')Array.from(r.addedNodes).forEach(function(node){if(node.nodeType===1)added.add(node);});
            });
            // First hidden commits of newly mounted groups are native initial state,
            // not folds. Remember identity across moves; scan added subtrees only once.
            added.forEach(function(node){
              if(!root.contains(node))return;
              for(var parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement)if(added.has(parent))return;
              rememberGroups(node,fresh);
            });
            jobs.forEach(function(_,el){if(!el.isConnected)cancel(el);});
            animateBatch(records.filter(function(r){return r.type==='attributes'&&r.attributeName==='hidden'&&!fresh.has(r.target);}));
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
