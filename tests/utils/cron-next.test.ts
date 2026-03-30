/**
 * Cron 下次执行时间计算测试
 */
import { describe, it, expect } from "vitest";
import { cronNext } from "../../src/utils/cron-next.js";

describe("cronNext", () => {
  it("每分钟执行 (* * * * *) 返回下一整分钟", () => {
    // 2023-11-14 12:00:00 UTC
    const afterSec = 1699963200;
    const next = cronNext("* * * * *", afterSec);
    expect(next).not.toBeNull();
    // 应该是 afterSec + 60 秒对齐到整分钟
    expect(next! - afterSec).toBeGreaterThanOrEqual(60);
    expect(next! % 60).toBe(0); // 整分钟
  });

  it("每小时整点 (0 * * * *)", () => {
    // 2023-11-14 12:30:00 UTC
    const afterSec = 1699965000;
    const next = cronNext("0 * * * *", afterSec);
    expect(next).not.toBeNull();
    const d = new Date(next! * 1000);
    expect(d.getMinutes()).toBe(0);
  });

  it("每天 9:00 (0 9 * * *)", () => {
    // 2023-11-14 10:00:00 UTC
    const afterSec = 1699956000;
    const next = cronNext("0 9 * * *", afterSec);
    expect(next).not.toBeNull();
    const d = new Date(next! * 1000);
    // cron 使用本地时间
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it("无效的 cron 表达式抛出异常", () => {
    expect(() => cronNext("invalid", 1700000000)).toThrow("无效的 cron 表达式");
  });

  it("字段数不对抛出异常", () => {
    expect(() => cronNext("0 9 *", 1700000000)).toThrow("需要 5 个字段");
  });

  it("字段值超范围抛出异常", () => {
    expect(() => cronNext("99 * * * *", 1700000000)).toThrow("无效的 cron 字段值");
  });

  it("每月1号 (0 0 1 * *)", () => {
    // 2023-11-15 00:00:00 UTC
    const afterSec = 1700006400;
    const next = cronNext("0 0 1 * *", afterSec);
    expect(next).not.toBeNull();
    const d = new Date(next! * 1000);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("每周一 (0 0 * * 1)", () => {
    // 2023-11-15 (周三) 00:00:00 UTC
    const afterSec = 1700006400;
    const next = cronNext("0 0 * * 1", afterSec);
    expect(next).not.toBeNull();
    const d = new Date(next! * 1000);
    expect(d.getDay()).toBe(1); // 周一
  });
});
