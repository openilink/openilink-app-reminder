/**
 * 工具注册中心 — 汇总所有提醒工具模块
 */

import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { Store } from "../store.js";
import { createReminderTools } from "./reminder.js";

/**
 * 收集所有工具定义和处理函数
 * @param store Store 实例（提醒工具需要访问数据库）
 * @returns 工具定义列表和处理函数映射
 */
export function collectAllTools(store: Store): {
  definitions: ToolDefinition[];
  handlers: Map<string, ToolHandler>;
} {
  const allModules = [createReminderTools(store)];

  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const mod of allModules) {
    definitions.push(...mod.definitions);
    const moduleHandlers = mod.createHandlers();
    for (const [name, handler] of moduleHandlers) {
      handlers.set(name, handler);
    }
  }

  return { definitions, handlers };
}
