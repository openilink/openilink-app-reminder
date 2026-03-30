/**
 * 时间解析工具
 *
 * 支持格式：
 * - 相对时间："5m"（5分钟后）、"1h"（1小时后）、"2d"（2天后）
 * - ISO 日期："2025-06-01T10:00:00Z" 或 "2025-06-01"
 */

/** 相对时间单位映射（秒） */
const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** 相对时间正则：数字 + 单位字母 */
const RELATIVE_RE = /^(\d+)\s*([smhdw])$/i;

/**
 * 解析时间字符串为 Unix 时间戳（秒）
 *
 * @param input 时间表达式，如 "5m"、"1h"、"2d" 或 ISO 日期
 * @param nowSec 当前时间的 Unix 秒数（用于测试注入），默认 Date.now()/1000
 * @returns Unix 时间戳（秒）
 * @throws 无法解析时抛出异常
 */
export function parseTime(input: string, nowSec?: number): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("时间表达式不能为空");
  }

  // 尝试匹配相对时间
  const match = RELATIVE_RE.exec(trimmed);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const seconds = UNIT_SECONDS[unit];
    if (!seconds) {
      throw new Error(`不支持的时间单位: ${unit}`);
    }
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    return now + amount * seconds;
  }

  // 尝试解析为 ISO 日期
  const ts = Date.parse(trimmed);
  if (!isNaN(ts)) {
    return Math.floor(ts / 1000);
  }

  throw new Error(`无法解析时间表达式: "${trimmed}"，支持格式：5m / 1h / 2d / ISO日期`);
}
