/**
 * 繁界（FanFrame）— host 半边（无后端逻辑）。
 * 这个插件的界面工作都在 lib/client.js 的 CSS 与可清理 effect 中完成，
 * host 侧故意留空，避免引入任何服务端依赖与配置项。
 */

/** 无服务依赖。 */
export const inject = []

/**
 * 空 apply：占位即可，让 Cordis 认为本插件已挂载。
 */
export function apply() {}
