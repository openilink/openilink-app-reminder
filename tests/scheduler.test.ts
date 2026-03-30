/**
 * 调度器测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Store } from "../src/store.js";
import { Scheduler } from "../src/scheduler.js";
import type { Installation } from "../src/hub/types.js";

describe("Scheduler", () => {
  let store: Store;
  let sentMessages: Array<{ to: string; text: string }>;
  let scheduler: Scheduler;

  const mockInstallation: Installation = {
    id: "inst-001",
    hubUrl: "https://hub.test",
    appId: "app-001",
    botId: "bot-001",
    appToken: "token-001",
    webhookSecret: "secret-001",
  };

  beforeEach(() => {
    store = new Store(":memory:");
    store.saveInstallation(mockInstallation);
    sentMessages = [];

    const mockHubClient = {
      sendText: vi.fn(async (to: string, text: string) => {
        sentMessages.push({ to, text });
      }),
    } as any;

    scheduler = new Scheduler({
      store,
      getHubClient: () => mockHubClient,
    });
  });

  afterEach(() => {
    scheduler.stop();
    store.close();
  });

  it("触发到期的一次性提醒", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    store.createReminder("inst-001", "user-001", "喝水", nowSec - 10);

    await scheduler.tick();

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].to).toBe("user-001");
    expect(sentMessages[0].text).toContain("喝水");

    // 验证已标记为已触发
    const due = store.getDueReminders(nowSec);
    expect(due).toHaveLength(0);
  });

  it("不触发未到期的提醒", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    store.createReminder("inst-001", "user-001", "未来", nowSec + 3600);

    await scheduler.tick();

    expect(sentMessages).toHaveLength(0);
  });

  it("不重复触发已触发的提醒", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const id = store.createReminder("inst-001", "user-001", "已触发", nowSec - 10);
    store.markFired(id);

    await scheduler.tick();

    expect(sentMessages).toHaveLength(0);
  });

  it("重复提醒触发后更新下次触发时间", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const id = store.createReminder("inst-001", "user-001", "每小时", nowSec - 10, "0 * * * *");

    await scheduler.tick();

    expect(sentMessages).toHaveLength(1);

    // 验证提醒已重新激活（fired = 0，trigger_at 已更新）
    const reminders = store.getReminders("inst-001", "user-001");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(id);
    expect(reminders[0].fired).toBe(0);
    expect(reminders[0].triggerAt).toBeGreaterThan(nowSec);
  });

  it("安装实例不存在时标记为已触发", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    store.createReminder("nonexistent-inst", "user-001", "无效", nowSec - 10);

    await scheduler.tick();

    // 没有发送消息
    expect(sentMessages).toHaveLength(0);

    // 但提醒已被标记为已触发
    const due = store.getDueReminders(nowSec);
    expect(due).toHaveLength(0);
  });

  it("start 和 stop 正常工作", () => {
    scheduler.start();
    // 再次 start 不会重复启动
    scheduler.start();
    scheduler.stop();
    // 再次 stop 不会报错
    scheduler.stop();
  });
});
