# @openilink/app-reminder

微信定时提醒 -- 支持一次性、重复和 Cron 表达式提醒，零外部依赖，纯 Node.js + SQLite。

> **一键安装** -- 前往 [OpeniLink Hub 应用市场](https://hub.openilink.com) 搜索「提醒」，点击安装即可在微信中使用。

## 功能亮点

- **相对时间** -- 支持 `5m`、`1h`、`2d` 等自然语言时间表达
- **ISO 日期** -- 支持标准 ISO 日期格式精确设定
- **重复提醒** -- 支持 Cron 表达式定义重复规则
- **自动调度** -- 每 10 秒检查到期提醒并自动发送
- **零外部依赖** -- 无需第三方 API Key

## 使用方式

安装到 Bot 后，直接用微信对话即可：

**自然语言（推荐）**

- "5 分钟后提醒我喝水"
- "每天早上 9 点提醒我打卡"
- "看看我的提醒列表"

**命令调用**

- `/create_reminder --content 喝水 --time 5m`

**AI 自动调用** -- Hub AI 在多轮对话中会自动判断是否需要调用提醒功能，无需手动触发。

### AI Tools

| 工具名 | 说明 |
|--------|------|
| `create_reminder` | 创建提醒（支持相对时间/ISO 日期/重复 Cron） |
| `list_reminders` | 查看我的待触发提醒 |
| `delete_reminder` | 删除指定提醒 |
| `clear_reminders` | 清空所有提醒 |
| `list_repeat_reminders` | 查看重复提醒 |

<details>
<summary><strong>部署与开发</strong></summary>

### 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | -- | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | -- | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/reminder.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8094` | HTTP 服务端口 |

### API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 安装通知 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

</details>

## 安全与隐私

本 App 需要存储提醒内容和触发时间。所有数据：

- **严格按用户隔离** -- 每条记录绑定 `installation_id` + `user_id`，不同用户之间完全隔离
- **无法跨用户访问** -- 所有查询、删除操作均在 SQL 层面强制过滤用户归属
- **数据存储在 SQLite** -- 数据文件位于 `data/` 目录，不上传到任何云端
- **代码完全开源** -- 接受社区审查

如果您对数据隐私有更高要求，建议自行部署：`docker compose up -d`，所有数据仅存储在您自己的服务器上。

## License

MIT
