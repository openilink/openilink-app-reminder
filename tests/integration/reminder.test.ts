/**
 * 提醒应用集成测试
 *
 * 测试 Hub <-> App 的完整通信链路：
 * 1. Mock Hub Server 模拟 OpeniLink Hub
 * 2. 创建轻量 App HTTP 服务器（webhook handler + router + scheduler）
 * 3. 使用内存 SQLite 存储
 * 4. 验证命令到工具执行的完整链路
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import http from "node:http";
import crypto from "node:crypto";
import { Store } from "../../src/store.js";
import { handleWebhook } from "../../src/hub/webhook.js";
import { collectAllTools } from "../../src/tools/index.js";
import { Router } from "../../src/router.js";
import { HubClient } from "../../src/hub/client.js";
import { Scheduler } from "../../src/scheduler.js";
import type { HubEvent, Installation } from "../../src/hub/types.js";
import {
  createMockHub,
  getSentMessages,
  resetSentMessages,
  WEBHOOK_SECRET,
  APP_TOKEN,
  INSTALLATION_ID,
} from "./mock-hub.js";

/** 端口配置（使用不常见端口避免冲突） */
const MOCK_HUB_PORT = 9861;
const APP_PORT = 9862;
const MOCK_HUB_URL = `http://localhost:${MOCK_HUB_PORT}`;

describe("提醒应用集成测试", () => {
  let mockHubServer: http.Server;
  let appServer: http.Server;
  let store: Store;
  let scheduler: Scheduler;

  /** 保存原始 fetch */
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    // 1. 启动 Mock Hub Server
    mockHubServer = createMockHub(MOCK_HUB_PORT);
    await new Promise<void>((resolve, reject) => {
      mockHubServer.on("error", reject);
      mockHubServer.listen(MOCK_HUB_PORT, resolve);
    });

    // 2. 初始化 Store 和 Router
    store = new Store(":memory:");
    store.saveInstallation({
      id: INSTALLATION_ID,
      hubUrl: MOCK_HUB_URL,
      appId: "test-app",
      botId: "test-bot",
      appToken: APP_TOKEN,
      webhookSecret: WEBHOOK_SECRET,
      createdAt: new Date().toISOString(),
    });

    const { definitions, handlers } = collectAllTools(store);
    const router = new Router({ definitions, handlers, store });

    /** 获取 HubClient */
    function getHubClient(installation: Installation): HubClient {
      return new HubClient(installation.hubUrl, installation.appToken);
    }

    // 启动调度器
    scheduler = new Scheduler({ store, getHubClient });
    // 集成测试中不自动启动调度器，手动调用 tick

    // 3. 启动 App HTTP 服务器
    appServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${APP_PORT}`);

      if (url.pathname === "/hub/webhook" && req.method === "POST") {
        await handleWebhook(req, res, {
          store,
          onCommand: async (event: HubEvent, _installation: Installation) => {
            const result = await router.handleCommand(event);
            return result ?? null;
          },
          getHubClient,
        });
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      appServer.on("error", reject);
      appServer.listen(APP_PORT, resolve);
    });
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    scheduler.stop();
    await new Promise<void>((r) => appServer.close(() => r()));
    await new Promise<void>((r) => mockHubServer.close(() => r()));
    store.close();
  });

  beforeEach(() => {
    resetSentMessages();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /** 发送命令到 App 的 webhook */
  async function sendCommand(command: string, args: Record<string, unknown> = {}) {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: `tr_${Date.now()}`,
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
      event: {
        type: "command",
        id: `evt_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        data: { command, args, sender: { id: "test-user" } },
      },
    };

    const bodyStr = JSON.stringify(hubEvent);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig =
      "sha256=" +
      crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(timestamp + ":")
        .update(bodyStr)
        .digest("hex");

    const resp = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": sig,
      },
      body: bodyStr,
    });

    return resp;
  }

  it("Mock Hub Server 健康检查", async () => {
    const res = await originalFetch(`${MOCK_HUB_URL}/health`);
    expect(res.ok).toBe(true);
  });

  it("App Server 健康检查", async () => {
    const res = await originalFetch(`http://localhost:${APP_PORT}/health`);
    expect(res.ok).toBe(true);
  });

  it("url_verification 握手请求应正确返回", async () => {
    const challengeEvent = {
      v: 1,
      type: "url_verification",
      challenge: "test_challenge_123",
      trace_id: "tr_challenge",
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
    };

    const bodyStr = JSON.stringify(challengeEvent);

    const res = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ challenge: "test_challenge_123" });
  });

  it("无效签名应被拒绝", async () => {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: "tr_bad",
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
      event: {
        type: "command",
        id: "evt_bad",
        timestamp: Math.floor(Date.now() / 1000),
        data: { command: "list_reminders", args: {}, sender: { id: "test-user" } },
      },
    };

    const res = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": "1234567890",
        "X-Signature": "sha256=invalid_sig",
      },
      body: JSON.stringify(hubEvent),
    });

    expect(res.status).toBe(401);
  });

  it("create_reminder 命令正确返回", async () => {
    const res = await sendCommand("create_reminder", {
      content: "喝水",
      time: "5m",
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.reply).toContain("提醒已创建");
    expect(data.reply).toContain("喝水");
  });

  it("list_reminders 命令正确返回", async () => {
    // 先创建一个提醒
    await sendCommand("create_reminder", { content: "集成测试提醒", time: "1h" });

    const res = await sendCommand("list_reminders");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.reply).toContain("集成测试提醒");
  });

  it("调度器触发到期提醒并发送消息", async () => {
    // 创建一个已过期的提醒
    const nowSec = Math.floor(Date.now() / 1000);
    store.createReminder(INSTALLATION_ID, "test-user", "到期提醒", nowSec - 10);

    // 手动触发调度器
    await scheduler.tick();

    // 验证消息已发送到 Mock Hub
    const msgs = getSentMessages();
    const reminderMsg = msgs.find((m) => m.content?.includes("到期提醒"));
    expect(reminderMsg).toBeDefined();
    expect(reminderMsg.to).toBe("test-user");
  });
});
