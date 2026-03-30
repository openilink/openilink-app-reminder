/**
 * 应用清单测试
 */
import { describe, it, expect } from "vitest";
import { manifest } from "../../src/hub/manifest.js";

describe("manifest", () => {
  it("包含必要的 slug 字段", () => {
    expect(manifest.slug).toBe("reminder");
  });

  it("包含应用名称", () => {
    expect(manifest.name).toBe("定时提醒");
  });

  it("包含图标", () => {
    expect(manifest.icon).toBe("⏰");
  });

  it("包含应用描述", () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description).toContain("提醒");
  });

  it("订阅了 command 事件", () => {
    expect(manifest.events).toContain("command");
  });

  it("events 是字符串数组", () => {
    expect(Array.isArray(manifest.events)).toBe(true);
    for (const event of manifest.events) {
      expect(typeof event).toBe("string");
    }
  });

  it("config_schema 为空对象 schema", () => {
    expect(manifest.config_schema).toEqual({ type: "object", properties: {} });
  });
});
