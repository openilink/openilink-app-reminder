/**
 * 应用清单定义
 *
 * 向 Hub 注册时使用的元信息，包含应用名称、图标、订阅的事件类型等。
 */

/** 应用清单结构 */
export interface AppManifest {
  /** 应用唯一标识（URL 友好） */
  slug: string;
  /** 应用显示名称 */
  name: string;
  /** 应用图标（emoji 或 URL） */
  icon: string;
  /** 应用描述 */
  description: string;
  /** 订阅的事件类型列表 */
  events: string[];
  /** 配置表单 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装引导说明（Markdown） */
  guide?: string;
}

/** 定时提醒应用清单 */
export const manifest: AppManifest = {
  slug: "reminder",
  name: "定时提醒",
  icon: "⏰",
  description: "定时提醒工具，支持一次性和重复提醒，支持自然语言时间表达（如 5m、1h、2d）和 ISO 日期",
  events: ["command"],
  config_schema: { type: "object", properties: {} },
  guide: "## 定时提醒\n无需配置，直接安装即可使用。",
};
