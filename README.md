# 繁界 · FanFrame

繁界为 DeepSeek Harness 整理界面细节：直角设计、聊天富文本层次、克制动效、侧栏布局和插件列表工具。中文显示名为“繁界”，英文显示名为“FanFrame”，npm 包名为 `fanframe`。

这是 `1.10.0-beta.8` 测试版本。安装兼容范围为 **DSH Desktop `0.2.1-rc.1` 至 `0.2.1-rc.6`（含两端）**，对应 `>=0.2.1-rc.1 <=0.2.1-rc.6`。实际验证基线仍为 `0.2.1-rc.3`，其余版本未逐一实测；插件依赖原生语义标记和部分样式模块，不保证跨版本样式完全一致。

## 功能

- **直角与阅读层次。** 统一无圆角外观，整理聊天 Markdown 配色与侧栏会话标题明暗。
- **默认控件过渡。** 为缺失动效的原生控件补约100ms颜色过渡；保留原生过渡、动画和动态内联样式，不插值位置或尺寸，不使用 `transition: all`。
- **浮层与折叠动效。** 已有实色页脚浮层保持原样；新识别的默认浮层仅补约140ms透明度进退，不改变材质。折叠优先交给宿主，缺失时使用约180ms候补动效。绘制副本不可交互，不截留 React 卸载；新增通用退出路径不复制可编辑输入、媒体、已滚动视口或大树，这些表面保留原生即时关闭。
- **现有描边反馈。** 设置导航保留当前选中态，并补清晰的悬停反馈。原有可见结构描边补颜色过渡；底部输入框沿用现有细描边层区分悬停和聚焦，不新增边框、阴影层或焦点光环。
- **新内容入场。** 新出现的任务列表、目标栏和聊天中的本地发送回显使用约140ms淡入。历史消息不补播，发送、滚动及原有180ms开合行为不变。
- **侧栏布局。** 使用窄图标栏，保留原生操作和必要的滚动条空间。
- **插件列表。** 提供搜索、默认顺序及名称正倒序，不把名称排序称为安装时间排序。
- **子智能体目录。** 指针打开时默认滚到底部；用户开始滚动或导航后不持续吸底，已有键盘焦点保持可见。模型摘要依赖既有子智能体导演桥这一非公开兼容接口；服务缺失或升级后接口失效时保留原生摘要。

## 安装与迁移

通过 DSH 插件管理器安装 `fanframe@1.10.0-beta.8`。`latest` 和 `beta` 标签均用于这一测试版；标签名称不代表稳定版或扩大兼容范围。

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

The npm package is `fanframe`; the Chinese display name is 繁界. The declared DSH Desktop engine range is `>=0.2.1-rc.1 <=0.2.1-rc.6`, inclusive. The verification baseline remains `0.2.1-rc.3`; other versions in this range have not been individually tested. Disable the legacy `fan-de-hai` package before enabling FanFrame. Never enable both together. This release does not replace image viewers or claim to repair image upload or storage.

## License

[MIT](<LICENSE>). The four-point-star and radial-line icon is distributed with the package.
