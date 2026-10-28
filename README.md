# 繁界 · FanFrame

繁界为 DeepSeek Harness 整理界面细节：直角设计、聊天富文本层次、克制动效、侧栏布局和插件列表工具。中文显示名为“繁界”，英文显示名为“FanFrame”，npm 包名为 `fanframe`。

这是 `1.10.0-beta.1` 候选版本。插件读取原生界面的语义标记和部分样式模块，当前仅声明支持 **DSH Desktop 0.2.1-rc.3**。没有验证其他版本，也不承诺跨版本样式兼容。

## 功能

- **直角与阅读层次。** 统一无圆角外观，整理聊天 Markdown 配色与侧栏会话标题明暗。
- **浮层与折叠动效。** 使用实色浮层及可取消的淡入淡出；聊天折叠优先交给宿主，候补效果只处理明确识别的节点。浮层退出可使用不可交互的绘制副本，不截留 React 卸载，也不复制业务事件。
- **侧栏布局。** 使用窄图标栏，保留原生操作和必要的滚动条空间。
- **插件列表。** 提供搜索、默认顺序及名称正倒序，不把名称排序称为安装时间排序。
- **子智能体目录。** 指针打开时默认滚到底部；用户开始滚动或导航后不持续吸底，已有键盘焦点保持可见。模型摘要依赖既有子智能体导演桥这一非公开兼容接口；服务缺失或升级后接口失效时保留原生摘要。

## 安装与迁移

通过 DSH 插件管理器安装 `fanframe@1.10.0-beta.1`。只有该版本实际发布到 npm 后，远程 npm 安装才可用；本地候选归档不代表已经公开发布。

`fanframe` 是新包名，不是旧 `fan-de-hai` 的 npm 原位升级。迁移时按顺序操作：

1. 记录旧包版本并保留回滚副本。
2. 禁用旧 `fan-de-hai` 插件或 bundle。
3. 安装并启用 `fanframe`，核对中文名称、图标和常用界面操作。
4. 确认正常后再考虑移除旧包。不要同时启用两个包。

回滚时先禁用 `fanframe`，再启用原来的 `fan-de-hai`。不要手改安装目录名称来模拟包迁移。

**Desktop 0.2.1-rc.3 刷新限制：** 宿主可能缓存旧客户端注入版本。优先验证插件热加载；确需完整重载时先确认再重启 Desktop，不直接硬刷新仍使用旧注入版本的页面。

## 边界与验证

插件不增加服务端业务逻辑，不替换图片查看器，不修改附件存储或消息数据。本候选版本不宣称修复上传图片不可见问题。

卸载会清理插件拥有的监听、计时器、样式和候补绘制层。未知原生结构尽量保持原状；其他同时修改全局主题、侧栏或浮层的插件仍可能发生冲突。

本地工程测试使用真实 DOM、MutationObserver、CSS 和 WAAPI。隔离测试不是产品截图、真实消息旅程或性能基准，也不能代替安装后的实机检查。npm 包只包含运行文件、元数据、图标及必要文档，不包含工程夹具和本机审计资料。

## English

FanFrame is a client-side interface-refinement plugin for DeepSeek Harness. It provides sharp corners, readable chat styling, restrained motion, sidebar refinements, plugin-list tools and subagent catalog enhancements.

The npm package is `fanframe`; the Chinese display name is 繁界. This beta targets DSH Desktop `0.2.1-rc.3` only. Disable the legacy `fan-de-hai` package before enabling FanFrame. Never enable both together. This release does not replace image viewers or claim to repair image upload or storage.

## License

[MIT](<LICENSE>). The four-point-star and radial-line icon is distributed with the package.
