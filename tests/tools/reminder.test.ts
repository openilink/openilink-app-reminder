/**
 * 提醒工具测试 — create_reminder / list_reminders / delete_reminder / clear_reminders / list_repeat_reminders
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../../src/store.js";
import { createReminderTools } from "../../src/tools/reminder.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 构建 ToolContext */
function makeCtx(args: Record<string, unknown>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-001",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

describe("reminderTools", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("定义了 5 个工具", () => {
    const tools = createReminderTools(store);
    expect(tools.definitions).toHaveLength(5);
    expect(tools.definitions.map((d) => d.name)).toEqual([
      "create_reminder",
      "list_reminders",
      "delete_reminder",
      "clear_reminders",
      "list_repeat_reminders",
    ]);
  });

  describe("create_reminder", () => {
    it("成功创建一次性提醒", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(makeCtx({ content: "喝水", time: "2025-06-01T10:00:00Z" }));
      expect(result).toContain("提醒已创建");
      expect(result).toContain("喝水");
    });

    it("支持相对时间格式", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(makeCtx({ content: "休息", time: "5m" }));
      expect(result).toContain("提醒已创建");
      expect(result).toContain("休息");
    });

    it("支持创建带 cron 的重复提醒", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(
        makeCtx({ content: "站起来", time: "5m", repeat: "0 * * * *" }),
      );
      expect(result).toContain("提醒已创建");
      expect(result).toContain("0 * * * *");
    });

    it("缺少 content 返回错误", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(makeCtx({ time: "5m" }));
      expect(result).toContain("错误");
      expect(result).toContain("content");
    });

    it("缺少 time 返回错误", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(makeCtx({ content: "测试" }));
      expect(result).toContain("错误");
      expect(result).toContain("time");
    });

    it("无效时间格式返回错误", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("create_reminder")!;

      const result = await handler(makeCtx({ content: "测试", time: "abc" }));
      expect(result).toContain("失败");
    });
  });

  describe("list_reminders", () => {
    it("没有提醒时返回空提示", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("list_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("暂无");
    });

    it("正确列出待触发的提醒", async () => {
      store.createReminder("inst-001", "user-001", "喝水", 1700000000);
      store.createReminder("inst-001", "user-001", "吃药", 1700001000);

      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("list_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("2 条");
      expect(result).toContain("喝水");
      expect(result).toContain("吃药");
    });
  });

  describe("delete_reminder", () => {
    it("成功删除提醒", async () => {
      const id = store.createReminder("inst-001", "user-001", "测试", 1700000000);

      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("delete_reminder")!;

      const result = await handler(makeCtx({ reminder_id: id }));
      expect(result).toContain("已删除");
    });

    it("删除不存在的提醒返回提示", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("delete_reminder")!;

      const result = await handler(makeCtx({ reminder_id: 9999 }));
      expect(result).toContain("未找到");
    });

    it("缺少 reminder_id 返回错误", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("delete_reminder")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
    });
  });

  describe("clear_reminders", () => {
    it("清空所有提醒", async () => {
      store.createReminder("inst-001", "user-001", "提醒1", 1700000000);
      store.createReminder("inst-001", "user-001", "提醒2", 1700001000);

      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("clear_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("2 条");
    });

    it("没有提醒时返回空提示", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("clear_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("没有");
    });
  });

  describe("list_repeat_reminders", () => {
    it("正确列出重复提醒", async () => {
      store.createReminder("inst-001", "user-001", "每小时", 1700000000, "0 * * * *");
      store.createReminder("inst-001", "user-001", "一次性", 1700001000);

      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("list_repeat_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("1 条");
      expect(result).toContain("每小时");
      expect(result).toContain("0 * * * *");
    });

    it("没有重复提醒时返回空提示", async () => {
      const tools = createReminderTools(store);
      const handlers = tools.createHandlers();
      const handler = handlers.get("list_repeat_reminders")!;

      const result = await handler(makeCtx({}));
      expect(result).toContain("暂无");
    });
  });
});
