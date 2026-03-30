# @openilink/app-reminder

定时提醒工具，支持一次性和重复提醒，零外部依赖（纯 Node.js + SQLite）。

## 特色

- **零外部依赖** — 无需第三方 API Key
- **相对时间** — 支持 `5m`、`1h`、`2d` 等自然语言时间表达
- **ISO 日期** — 支持标准 ISO 日期格式
- **重复提醒** — 支持 cron 表达式定义重复规则
- **自动调度** — 每 10 秒检查到期提醒并自动发送

## 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | — | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | — | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/reminder.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8094` | HTTP 服务端口 |

## 5 个 AI Tools

| 工具名 | 说明 |
|--------|------|
| `create_reminder` | 创建提醒（支持相对时间/ISO日期/重复cron） |
| `list_reminders` | 查看我的待触发提醒 |
| `delete_reminder` | 删除指定提醒 |
| `clear_reminders` | 清空所有提醒 |
| `list_repeat_reminders` | 查看重复提醒 |

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 安装通知 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

## 安全与隐私

### 数据存储说明

本 App 需要存储用户数据以实现功能（提醒内容和触发时间）。所有数据：

- **严格按用户隔离**：每条记录绑定 `installation_id` + `user_id`，不同用户之间完全隔离
- **无法跨用户访问**：所有查询、删除操作均在 SQL 层面强制过滤用户归属
- **数据存储在 SQLite**：数据文件位于 `data/` 目录，不上传到任何云端

### 应用市场安装（托管模式）

通过应用市场安装时，您的数据存储在我们的服务器上。我们承诺：

- 不会查看、分析或使用您的个人数据
- 所有 App 代码完全开源，接受社区审查
- 我们会对每个 App 进行严格的安全审查

### 自部署（推荐注重隐私的用户）

如果您对数据隐私有更高要求，**强烈建议自行部署**：

```bash
docker compose up -d
```

自部署后所有数据（提醒内容、触发时间、重复规则）仅存储在您自己的服务器上。

## License

MIT
