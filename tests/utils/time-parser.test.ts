/**
 * 时间解析器测试
 */
import { describe, it, expect } from "vitest";
import { parseTime } from "../../src/utils/time-parser.js";

describe("parseTime", () => {
  const NOW_SEC = 1700000000; // 固定时间点用于测试

  describe("相对时间", () => {
    it("5m → now + 300 秒", () => {
      const result = parseTime("5m", NOW_SEC);
      expect(result).toBe(NOW_SEC + 300);
    });

    it("1h → now + 3600 秒", () => {
      const result = parseTime("1h", NOW_SEC);
      expect(result).toBe(NOW_SEC + 3600);
    });

    it("2d → now + 172800 秒", () => {
      const result = parseTime("2d", NOW_SEC);
      expect(result).toBe(NOW_SEC + 172800);
    });

    it("30s → now + 30 秒", () => {
      const result = parseTime("30s", NOW_SEC);
      expect(result).toBe(NOW_SEC + 30);
    });

    it("1w → now + 604800 秒", () => {
      const result = parseTime("1w", NOW_SEC);
      expect(result).toBe(NOW_SEC + 604800);
    });

    it("大写单位也支持: 5M", () => {
      const result = parseTime("5M", NOW_SEC);
      expect(result).toBe(NOW_SEC + 300);
    });

    it("数字和单位间可以有空格", () => {
      const result = parseTime("10 m", NOW_SEC);
      expect(result).toBe(NOW_SEC + 600);
    });
  });

  describe("ISO 日期", () => {
    it("解析 ISO 日期字符串", () => {
      const result = parseTime("2025-06-01T10:00:00Z");
      const expected = Math.floor(Date.parse("2025-06-01T10:00:00Z") / 1000);
      expect(result).toBe(expected);
    });

    it("解析纯日期字符串", () => {
      const result = parseTime("2025-06-01");
      const expected = Math.floor(Date.parse("2025-06-01") / 1000);
      expect(result).toBe(expected);
    });

    it("解析带时区的 ISO 日期", () => {
      const result = parseTime("2025-06-01T10:00:00+08:00");
      const expected = Math.floor(Date.parse("2025-06-01T10:00:00+08:00") / 1000);
      expect(result).toBe(expected);
    });
  });

  describe("异常处理", () => {
    it("空字符串抛出异常", () => {
      expect(() => parseTime("")).toThrow("不能为空");
    });

    it("无效表达式抛出异常", () => {
      expect(() => parseTime("abc")).toThrow("无法解析");
    });

    it("纯空白字符串抛出异常", () => {
      expect(() => parseTime("   ")).toThrow("不能为空");
    });
  });
});
