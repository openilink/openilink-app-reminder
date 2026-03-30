/**
 * 定时调度器
 *
 * 每 10 秒检查 trigger_at <= now 且 fired = 0 的提醒记录：
 * 1. 触发提醒 → 通过 HubClient 发送回调消息
 * 2. 标记为已触发（fired = 1）
 * 3. 若为重复提醒，计算下次触发时间并更新
 */

import type { Store } from "./store.js";
import type { HubClient } from "./hub/client.js";
import type { Installation, Reminder } from "./hub/types.js";
import { cronNext } from "./utils/cron-next.js";

/** 调度检查间隔（毫秒） */
const CHECK_INTERVAL_MS = 10_000;

/** 调度器选项 */
export interface SchedulerOptions {
  /** 数据存储实例 */
  store: Store;
  /** 根据安装实例获取 HubClient 的工厂函数 */
  getHubClient: (installation: Installation) => HubClient;
}

/**
 * 定时调度器
 *
 * 使用 setInterval 周期检查到期提醒，并通过 HubClient 发送消息通知用户。
 */
export class Scheduler {
  private store: Store;
  private getHubClient: (installation: Installation) => HubClient;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: SchedulerOptions) {
    this.store = opts.store;
    this.getHubClient = opts.getHubClient;
  }

  /** 启动调度器 */
  start(): void {
    if (this.timer) return;
    console.log("[scheduler] 启动定时调度器，检查间隔:", CHECK_INTERVAL_MS, "ms");
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
    // 启动后立即执行一次检查
    this.tick();
  }

  /** 停止调度器 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[scheduler] 调度器已停止");
    }
  }

  /** 单次检查并处理到期提醒 */
  async tick(): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    let dueReminders: Reminder[];

    try {
      dueReminders = this.store.getDueReminders(nowSec);
    } catch (err) {
      console.error("[scheduler] 查询到期提醒失败:", err);
      return;
    }

    for (const reminder of dueReminders) {
      await this.fireReminder(reminder, nowSec);
    }
  }

  /** 触发单条提醒 */
  private async fireReminder(reminder: Reminder, nowSec: number): Promise<void> {
    try {
      // 获取安装实例
      const installation = this.store.getInstallation(reminder.installationId);
      if (!installation) {
        console.warn("[scheduler] 找不到安装实例:", reminder.installationId);
        this.store.markFired(reminder.id);
        return;
      }

      // 构建提醒消息
      const message = `⏰ 提醒：${reminder.content}`;

      // 发送消息给用户
      const hubClient = this.getHubClient(installation);
      await hubClient.sendText(reminder.userId, message);

      console.log(
        `[scheduler] 已触发提醒: id=${reminder.id}, user=${reminder.userId}, content="${reminder.content}"`,
      );

      // 标记为已触发
      this.store.markFired(reminder.id);

      // 若为重复提醒，计算下次触发时间
      if (reminder.repeatCron) {
        const next = cronNext(reminder.repeatCron, nowSec);
        if (next) {
          this.store.updateTriggerAt(reminder.id, next);
          console.log(
            `[scheduler] 重复提醒已更新: id=${reminder.id}, 下次触发=${new Date(next * 1000).toISOString()}`,
          );
        } else {
          console.warn(
            `[scheduler] 重复提醒无法计算下次时间: id=${reminder.id}, cron="${reminder.repeatCron}"`,
          );
        }
      }
    } catch (err) {
      console.error(`[scheduler] 触发提醒失败: id=${reminder.id}`, err);
      // 即使发送失败也标记为已触发，避免反复重试
      this.store.markFired(reminder.id);
    }
  }
}
