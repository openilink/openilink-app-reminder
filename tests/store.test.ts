/**
 * Store 持久化层测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Store", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reminder-store-test-"));
    dbPath = path.join(tmpDir, "test.db");
    store = new Store(dbPath);
  });

  afterEach(() => {
    store.close();
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ─── Installation 测试 ────────────────────────────────

  describe("saveInstallation / getInstallation", () => {
    it("保存并读取安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "token-001",
        webhookSecret: "secret-001",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      store.saveInstallation(inst);
      const result = store.getInstallation("inst-001");

      expect(result).toBeDefined();
      expect(result!.id).toBe("inst-001");
      expect(result!.hubUrl).toBe("https://hub.example.com");
      expect(result!.appToken).toBe("token-001");
    });

    it("查询不存在的安装记录返回 undefined", () => {
      const result = store.getInstallation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("更新已有的安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "old-token",
        webhookSecret: "old-secret",
      };

      store.saveInstallation(inst);
      store.saveInstallation({ ...inst, appToken: "new-token", webhookSecret: "new-secret" });

      const result = store.getInstallation("inst-001");
      expect(result!.appToken).toBe("new-token");
      expect(result!.webhookSecret).toBe("new-secret");
    });
  });

  describe("getAllInstallations", () => {
    it("返回所有安装记录", () => {
      store.saveInstallation({
        id: "inst-001", hubUrl: "https://hub.test", appId: "app-001",
        botId: "bot-001", appToken: "t1", webhookSecret: "s1",
      });
      store.saveInstallation({
        id: "inst-002", hubUrl: "https://hub.test", appId: "app-002",
        botId: "bot-002", appToken: "t2", webhookSecret: "s2",
      });

      const all = store.getAllInstallations();
      expect(all).toHaveLength(2);
    });

    it("空数据库返回空数组", () => {
      const all = store.getAllInstallations();
      expect(all).toEqual([]);
    });
  });

  // ─── Reminder 测试 ────────────────────────────────────

  describe("createReminder / getReminders", () => {
    it("创建提醒并读取", () => {
      const id = store.createReminder("inst-001", "user-001", "喝水", 1700000000);
      expect(id).toBeGreaterThan(0);

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(1);
      expect(reminders[0].content).toBe("喝水");
      expect(reminders[0].triggerAt).toBe(1700000000);
      expect(reminders[0].fired).toBe(0);
      expect(reminders[0].repeatCron).toBeNull();
    });

    it("创建带 cron 的重复提醒", () => {
      store.createReminder("inst-001", "user-001", "站起来", 1700000000, "0 * * * *");

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(1);
      expect(reminders[0].repeatCron).toBe("0 * * * *");
    });

    it("只返回未触发的提醒", () => {
      const id = store.createReminder("inst-001", "user-001", "已触发", 1700000000);
      store.createReminder("inst-001", "user-001", "未触发", 1700001000);
      store.markFired(id);

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(1);
      expect(reminders[0].content).toBe("未触发");
    });

    it("不同用户的提醒互不影响", () => {
      store.createReminder("inst-001", "user-001", "用户1的提醒", 1700000000);
      store.createReminder("inst-001", "user-002", "用户2的提醒", 1700000000);

      const r1 = store.getReminders("inst-001", "user-001");
      const r2 = store.getReminders("inst-001", "user-002");
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r1[0].content).toBe("用户1的提醒");
      expect(r2[0].content).toBe("用户2的提醒");
    });
  });

  describe("getRepeatReminders", () => {
    it("返回所有重复提醒（含已触发）", () => {
      const id1 = store.createReminder("inst-001", "user-001", "每小时", 1700000000, "0 * * * *");
      store.createReminder("inst-001", "user-001", "一次性", 1700001000);
      store.markFired(id1);

      const repeats = store.getRepeatReminders("inst-001", "user-001");
      expect(repeats).toHaveLength(1);
      expect(repeats[0].content).toBe("每小时");
    });
  });

  describe("deleteReminder", () => {
    it("删除属于自己的提醒返回 true", () => {
      const id = store.createReminder("inst-001", "user-001", "测试", 1700000000);
      const deleted = store.deleteReminder("inst-001", "user-001", id);
      expect(deleted).toBe(true);

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(0);
    });

    it("删除不属于自己的提醒返回 false", () => {
      const id = store.createReminder("inst-001", "user-001", "测试", 1700000000);
      const deleted = store.deleteReminder("inst-001", "user-002", id);
      expect(deleted).toBe(false);
    });

    it("删除不存在的提醒返回 false", () => {
      const deleted = store.deleteReminder("inst-001", "user-001", 9999);
      expect(deleted).toBe(false);
    });
  });

  describe("clearReminders", () => {
    it("清空所有提醒并返回删除数量", () => {
      store.createReminder("inst-001", "user-001", "提醒1", 1700000000);
      store.createReminder("inst-001", "user-001", "提醒2", 1700001000);
      store.createReminder("inst-001", "user-001", "提醒3", 1700002000);

      const count = store.clearReminders("inst-001", "user-001");
      expect(count).toBe(3);

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(0);
    });

    it("无提醒时返回 0", () => {
      const count = store.clearReminders("inst-001", "user-001");
      expect(count).toBe(0);
    });
  });

  describe("getDueReminders", () => {
    it("返回到期且未触发的提醒", () => {
      store.createReminder("inst-001", "user-001", "过期", 1000);
      store.createReminder("inst-001", "user-001", "未到期", 9999999999);

      const due = store.getDueReminders(2000);
      expect(due).toHaveLength(1);
      expect(due[0].content).toBe("过期");
    });

    it("已触发的提醒不会返回", () => {
      const id = store.createReminder("inst-001", "user-001", "已触发", 1000);
      store.markFired(id);

      const due = store.getDueReminders(2000);
      expect(due).toHaveLength(0);
    });
  });

  describe("updateTriggerAt", () => {
    it("更新触发时间并重置 fired 状态", () => {
      const id = store.createReminder("inst-001", "user-001", "重复", 1000, "0 * * * *");
      store.markFired(id);

      store.updateTriggerAt(id, 5000);

      const reminders = store.getReminders("inst-001", "user-001");
      expect(reminders).toHaveLength(1);
      expect(reminders[0].triggerAt).toBe(5000);
      expect(reminders[0].fired).toBe(0);
    });
  });
});
