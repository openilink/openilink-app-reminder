/**
 * Router 命令路由器测试
 */
import { describe, it, expect, vi } from "vitest";
import { Router } from "../src/router.js";
import type { HubEvent, ToolDefinition, ToolHandler } from "../src/hub/types.js";

function mockStore() {
  return {
    getInstallation: vi.fn(),
    saveInstallation: vi.fn(),
    getAllInstallations: vi.fn(),
    close: vi.fn(),
  } as any;
}

function createTestTools() {
  const definitions: ToolDefinition[] = [
    { name: "create_reminder", description: "创建提醒", command: "create_reminder" },
    { name: "list_reminders", description: "查看提醒", command: "list_reminders" },
  ];

  const handlers = new Map<string, ToolHandler>();
  handlers.set("create_reminder", vi.fn().mockResolvedValue("✅ 提醒已创建"));
  handlers.set("list_reminders", vi.fn().mockResolvedValue("📋 你有 1 条提醒"));

  return { definitions, handlers };
}

function makeCommandEvent(command: string, args: Record<string, unknown> = {}): HubEvent {
  return {
    v: 1,
    type: "event",
    trace_id: "trace-001",
    installation_id: "inst-001",
    bot: { id: "bot-001" },
    event: {
      type: "command",
      id: "evt-001",
      timestamp: 1700000000,
      data: { command, args, sender: { id: "user-001" } },
    },
  };
}

describe("Router", () => {
  describe("handleCommand", () => {
    it("正确路由到对应的工具处理函数", async () => {
      const { definitions, handlers } = createTestTools();
      const router = new Router({ definitions, handlers, store: mockStore() });
      const event = makeCommandEvent("create_reminder", { content: "喝水", time: "5m" });
      const result = await router.handleCommand(event);
      expect(result).toBe("✅ 提醒已创建");
    });

    it("传递正确的 ToolContext 给处理函数", async () => {
      const { definitions, handlers } = createTestTools();
      const router = new Router({ definitions, handlers, store: mockStore() });
      const event = makeCommandEvent("create_reminder", { content: "喝水" });
      await router.handleCommand(event);

      const ctx = (handlers.get("create_reminder") as any).mock.calls[0][0];
      expect(ctx.installationId).toBe("inst-001");
      expect(ctx.botId).toBe("bot-001");
      expect(ctx.userId).toBe("user-001");
      expect(ctx.traceId).toBe("trace-001");
      expect(ctx.args).toEqual({ content: "喝水" });
    });

    it("未知命令返回提示信息", async () => {
      const { definitions, handlers } = createTestTools();
      const router = new Router({ definitions, handlers, store: mockStore() });
      const event = makeCommandEvent("unknown_command");
      const result = await router.handleCommand(event);
      expect(result).toContain("未知命令");
      expect(result).toContain("unknown_command");
    });

    it("非 event 类型返回 undefined", async () => {
      const { definitions, handlers } = createTestTools();
      const router = new Router({ definitions, handlers, store: mockStore() });
      const event: HubEvent = {
        v: 1,
        type: "url_verification",
        trace_id: "t1",
        installation_id: "inst-001",
        bot: { id: "b1" },
        challenge: "test",
      };
      const result = await router.handleCommand(event);
      expect(result).toBeUndefined();
    });

    it("处理函数抛出异常时返回错误消息", async () => {
      const definitions: ToolDefinition[] = [
        { name: "broken_tool", description: "会报错", command: "broken_tool" },
      ];
      const handlers = new Map<string, ToolHandler>();
      handlers.set("broken_tool", vi.fn().mockRejectedValue(new Error("数据库异常")));

      const router = new Router({ definitions, handlers, store: mockStore() });
      const event = makeCommandEvent("broken_tool");
      const result = await router.handleCommand(event);
      expect(result).toContain("命令执行失败");
      expect(result).toContain("数据库异常");
    });
  });

  describe("getDefinitions", () => {
    it("返回所有已注册的工具定义", () => {
      const { definitions, handlers } = createTestTools();
      const router = new Router({ definitions, handlers, store: mockStore() });
      const defs = router.getDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs[0].name).toBe("create_reminder");
    });
  });
});
