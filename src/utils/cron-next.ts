/**
 * 简易 Cron 下次执行时间计算（零外部依赖）
 *
 * 支持标准 5 段 cron 格式：分 时 日 月 周
 * 仅支持数字和 *，不支持范围、步长等高级语法（保持简单）
 */

/** Cron 各字段解析结果 */
interface CronFields {
  minute: number | null;   // 0-59，null 表示 *
  hour: number | null;     // 0-23，null 表示 *
  day: number | null;      // 1-31，null 表示 *
  month: number | null;    // 1-12，null 表示 *
  weekday: number | null;  // 0-6（周日=0），null 表示 *
}

/**
 * 解析 cron 表达式的单个字段
 */
function parseField(field: string, min: number, max: number): number | null {
  if (field === "*") return null;
  const num = parseInt(field, 10);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`无效的 cron 字段值: "${field}"（范围 ${min}-${max}）`);
  }
  return num;
}

/**
 * 解析 5 段 cron 表达式
 */
function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`无效的 cron 表达式: "${expr}"（需要 5 个字段：分 时 日 月 周）`);
  }
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    day: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    weekday: parseField(parts[4], 0, 6),
  };
}

/**
 * 检查日期是否匹配 cron 字段
 */
function matchField(value: number, field: number | null): boolean {
  return field === null || field === value;
}

/**
 * 计算 cron 表达式的下次执行时间
 *
 * @param cronExpr cron 表达式（分 时 日 月 周）
 * @param afterSec 从此 Unix 时间戳（秒）之后开始搜索
 * @returns 下次执行的 Unix 时间戳（秒），找不到返回 null
 */
export function cronNext(cronExpr: string, afterSec: number): number | null {
  const fields = parseCron(cronExpr);

  // 从 afterSec + 60 秒开始搜索（向上取整到下一整分钟）
  const startMs = (afterSec + 60) * 1000;
  const start = new Date(startMs);
  start.setSeconds(0, 0);

  // 最多搜索 366 天（避免无限循环）
  const maxMs = startMs + 366 * 86400 * 1000;

  const current = new Date(start);

  while (current.getTime() < maxMs) {
    const minute = current.getMinutes();
    const hour = current.getHours();
    const day = current.getDate();
    const month = current.getMonth() + 1; // JS 月份从 0 开始
    const weekday = current.getDay();

    if (
      matchField(minute, fields.minute) &&
      matchField(hour, fields.hour) &&
      matchField(day, fields.day) &&
      matchField(month, fields.month) &&
      matchField(weekday, fields.weekday)
    ) {
      return Math.floor(current.getTime() / 1000);
    }

    // 推进一分钟
    current.setMinutes(current.getMinutes() + 1);
  }

  // 366 天内无匹配
  return null;
}
