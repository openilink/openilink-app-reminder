/**
 * SQLite 持久化存储层（基于 better-sqlite3）
 *
 * 管理两张表：
 * - installations: 安装实例记录
 * - reminders: 提醒记录
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { Installation, Reminder } from "./hub/types.js";

/** 数据库存储管理器 */
export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 内存数据库不需要创建目录
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initTables();
    this.migrate();
  }

  /** 创建所需的数据表 */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installations (
        id            TEXT PRIMARY KEY,
        hub_url       TEXT NOT NULL,
        app_id        TEXT NOT NULL,
        bot_id        TEXT NOT NULL,
        app_token     TEXT NOT NULL,
        webhook_secret TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        installation_id TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        content         TEXT NOT NULL,
        trigger_at      INTEGER NOT NULL,
        repeat_cron     TEXT,
        fired           INTEGER NOT NULL DEFAULT 0,
        retry_count     INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_trigger
        ON reminders(trigger_at, fired);
      CREATE INDEX IF NOT EXISTS idx_reminders_user
        ON reminders(installation_id, user_id);
    `);
  }

  /** 数据库迁移：为已有表添加缺失字段 */
  private migrate(): void {
    // 检查 reminders 表是否已有 retry_count 字段，若无则添加
    const columns = this.db.prepare("PRAGMA table_info(reminders)").all() as { name: string }[];
    const hasRetryCount = columns.some((col) => col.name === "retry_count");
    if (!hasRetryCount) {
      this.db.exec("ALTER TABLE reminders ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0");
    }
  }

  // ─── Installation 操作 ─────────────────────────────────

  /** 保存或更新安装记录 */
  saveInstallation(inst: Installation): void {
    const stmt = this.db.prepare(`
      INSERT INTO installations (id, hub_url, app_id, bot_id, app_token, webhook_secret, created_at)
      VALUES (@id, @hubUrl, @appId, @botId, @appToken, @webhookSecret, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        hub_url        = excluded.hub_url,
        app_id         = excluded.app_id,
        bot_id         = excluded.bot_id,
        app_token      = excluded.app_token,
        webhook_secret = excluded.webhook_secret
    `);
    stmt.run({
      id: inst.id,
      hubUrl: inst.hubUrl,
      appId: inst.appId,
      botId: inst.botId,
      appToken: inst.appToken,
      webhookSecret: inst.webhookSecret,
      createdAt: inst.createdAt || new Date().toISOString(),
    });
  }

  /** 根据 ID 获取单条安装记录 */
  getInstallation(id: string): Installation | undefined {
    const row = this.db
      .prepare("SELECT * FROM installations WHERE id = ?")
      .get(id) as Record<string, string> | undefined;

    if (!row) return undefined;
    return this.rowToInstallation(row);
  }

  /** 获取所有安装记录 */
  getAllInstallations(): Installation[] {
    const rows = this.db
      .prepare("SELECT * FROM installations ORDER BY created_at DESC")
      .all() as Record<string, string>[];

    return rows.map((row) => this.rowToInstallation(row));
  }

  /** 将数据库行映射为 Installation 对象 */
  private rowToInstallation(row: Record<string, string>): Installation {
    return {
      id: row.id,
      hubUrl: row.hub_url,
      appId: row.app_id,
      botId: row.bot_id,
      appToken: row.app_token,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
    };
  }

  // ─── Reminder 操作 ─────────────────────────────────────

  /** 创建提醒记录，返回插入的 ID */
  createReminder(
    installationId: string,
    userId: string,
    content: string,
    triggerAt: number,
    repeatCron: string | null = null,
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO reminders (installation_id, user_id, content, trigger_at, repeat_cron)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(installationId, userId, content, triggerAt, repeatCron);
    return Number(result.lastInsertRowid);
  }

  /** 获取指定用户的所有未触发提醒 */
  getReminders(installationId: string, userId: string): Reminder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reminders
         WHERE installation_id = ? AND user_id = ? AND fired = 0
         ORDER BY trigger_at ASC`,
      )
      .all(installationId, userId) as Record<string, any>[];

    return rows.map((row) => this.rowToReminder(row));
  }

  /** 获取指定用户的所有重复提醒（含已触发的） */
  getRepeatReminders(installationId: string, userId: string): Reminder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reminders
         WHERE installation_id = ? AND user_id = ? AND repeat_cron IS NOT NULL
         ORDER BY trigger_at ASC`,
      )
      .all(installationId, userId) as Record<string, any>[];

    return rows.map((row) => this.rowToReminder(row));
  }

  /** 删除指定用户的某条提醒 */
  deleteReminder(installationId: string, userId: string, reminderId: number): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM reminders WHERE id = ? AND installation_id = ? AND user_id = ?",
      )
      .run(reminderId, installationId, userId);
    return result.changes > 0;
  }

  /** 清空指定用户的所有提醒 */
  clearReminders(installationId: string, userId: string): number {
    const result = this.db
      .prepare(
        "DELETE FROM reminders WHERE installation_id = ? AND user_id = ?",
      )
      .run(installationId, userId);
    return result.changes;
  }

  /** 获取所有已到期、未触发且重试次数未超限的提醒 */
  getDueReminders(nowSec: number): Reminder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reminders
         WHERE trigger_at <= ? AND fired = 0 AND retry_count < 3
         ORDER BY trigger_at ASC`,
      )
      .all(nowSec) as Record<string, any>[];

    return rows.map((row) => this.rowToReminder(row));
  }

  /** 标记提醒为已触发 */
  markFired(reminderId: number): void {
    this.db
      .prepare("UPDATE reminders SET fired = 1 WHERE id = ?")
      .run(reminderId);
  }

  /** 递增提醒的重试计数 */
  incrementRetryCount(reminderId: number): void {
    this.db
      .prepare("UPDATE reminders SET retry_count = retry_count + 1 WHERE id = ?")
      .run(reminderId);
  }

  /** 更新提醒的触发时间并重置 fired 状态（用于重复提醒） */
  updateTriggerAt(reminderId: number, newTriggerAt: number): void {
    this.db
      .prepare("UPDATE reminders SET trigger_at = ?, fired = 0 WHERE id = ?")
      .run(newTriggerAt, reminderId);
  }

  /** 将数据库行映射为 Reminder 对象 */
  private rowToReminder(row: Record<string, any>): Reminder {
    return {
      id: row.id,
      installationId: row.installation_id,
      userId: row.user_id,
      content: row.content,
      triggerAt: row.trigger_at,
      repeatCron: row.repeat_cron ?? null,
      fired: row.fired,
      retryCount: row.retry_count ?? 0,
      createdAt: row.created_at,
    };
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }
}
