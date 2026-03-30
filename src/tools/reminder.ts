/**
 * 提醒工具模块 — 创建/查看/删除/清空提醒
 */

import type { ToolModule, ToolDefinition, ToolHandler, ToolContext } from "../hub/types.js";
import type { Store } from "../store.js";
import { parseTime } from "../utils/time-parser.js";

/** 工具定义 */
const definitions: ToolDefinition[] = [
  {
    name: "create_reminder",
    description: "创建一个定时提醒，支持相对时间（5m/1h/2d）或 ISO 日期，可选重复（cron 表达式）",
    command: "create_reminder",
    parameters: {
      content: { type: "string", description: "提醒内容", required: true },
      time: {
        type: "string",
        description: "触发时间，支持 5m/1h/2d 或 ISO 日期格式",
        required: true,
      },
      repeat: {
        type: "string",
        description: "重复规则（cron 表达式，如 '0 9 * * *' 表示每天9点），留空为一次性",
        required: false,
      },
    },
  },
  {
    name: "list_reminders",
    description: "查看我的所有未触发提醒",
    command: "list_reminders",
    parameters: {},
  },
  {
    name: "delete_reminder",
    description: "删除指定的提醒",
    command: "delete_reminder",
    parameters: {
      reminder_id: { type: "number", description: "提醒 ID", required: true },
    },
  },
  {
    name: "clear_reminders",
    description: "清空我的所有提醒",
    command: "clear_reminders",
    parameters: {},
  },
  {
    name: "list_repeat_reminders",
    description: "查看我的所有重复提醒",
    command: "list_repeat_reminders",
    parameters: {},
  },
];

/** 格式化 Unix 时间戳为可读字符串 */
function formatTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** 创建处理函数（需要 Store 实例） */
function createHandlersWithStore(store: Store): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 创建提醒
  handlers.set("create_reminder", async (ctx: ToolContext) => {
    try {
      const { content, time, repeat } = ctx.args;
      if (!content) return "错误：请提供提醒内容（content）";
      if (!time) return "错误：请提供触发时间（time）";

      const triggerAt = parseTime(String(time));
      const repeatCron = repeat ? String(repeat) : null;

      const id = store.createReminder(
        ctx.installationId,
        ctx.userId,
        String(content),
        triggerAt,
        repeatCron,
      );

      const lines: string[] = [];
      lines.push(`✅ 提醒已创建（ID: ${id}）`);
      lines.push(`📝 内容: ${content}`);
      lines.push(`⏰ 触发时间: ${formatTime(triggerAt)}`);
      if (repeatCron) {
        lines.push(`🔁 重复规则: ${repeatCron}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `创建提醒失败：${err.message}`;
    }
  });

  // 查看提醒列表
  handlers.set("list_reminders", async (ctx: ToolContext) => {
    try {
      const reminders = store.getReminders(ctx.installationId, ctx.userId);
      if (reminders.length === 0) {
        return "📭 暂无未触发的提醒";
      }

      const lines: string[] = [`📋 你有 ${reminders.length} 条待触发的提醒：`, ""];
      for (const r of reminders) {
        const repeatTag = r.repeatCron ? ` 🔁(${r.repeatCron})` : "";
        lines.push(`  #${r.id} | ${formatTime(r.triggerAt)} | ${r.content}${repeatTag}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `查询提醒失败：${err.message}`;
    }
  });

  // 删除提醒
  handlers.set("delete_reminder", async (ctx: ToolContext) => {
    try {
      const { reminder_id } = ctx.args;
      if (reminder_id == null) return "错误：请提供提醒 ID（reminder_id）";

      const deleted = store.deleteReminder(
        ctx.installationId,
        ctx.userId,
        Number(reminder_id),
      );

      if (deleted) {
        return `✅ 提醒 #${reminder_id} 已删除`;
      } else {
        return `❌ 未找到提醒 #${reminder_id}（可能已被删除或不属于你）`;
      }
    } catch (err: any) {
      return `删除提醒失败：${err.message}`;
    }
  });

  // 清空提醒
  handlers.set("clear_reminders", async (ctx: ToolContext) => {
    try {
      const count = store.clearReminders(ctx.installationId, ctx.userId);
      if (count === 0) {
        return "📭 没有需要清除的提醒";
      }
      return `🗑️ 已清除 ${count} 条提醒`;
    } catch (err: any) {
      return `清空提醒失败：${err.message}`;
    }
  });

  // 查看重复提醒
  handlers.set("list_repeat_reminders", async (ctx: ToolContext) => {
    try {
      const reminders = store.getRepeatReminders(ctx.installationId, ctx.userId);
      if (reminders.length === 0) {
        return "📭 暂无重复提醒";
      }

      const lines: string[] = [`🔁 你有 ${reminders.length} 条重复提醒：`, ""];
      for (const r of reminders) {
        const status = r.fired ? "⏸️ 等待下次" : "⏳ 待触发";
        lines.push(`  #${r.id} | ${r.repeatCron} | ${r.content} | ${status} ${formatTime(r.triggerAt)}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `查询重复提醒失败：${err.message}`;
    }
  });

  return handlers;
}

/** 提醒工具模块工厂（需要 Store 实例） */
export function createReminderTools(store: Store): ToolModule {
  return {
    definitions,
    createHandlers: () => createHandlersWithStore(store),
  };
}

/** 导出定义列表，供外部使用 */
export { definitions as reminderDefinitions };
