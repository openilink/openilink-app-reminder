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

## License

MIT
