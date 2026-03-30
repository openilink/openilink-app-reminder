/**
 * Mock Hub Server — 模拟 OpeniLink Hub 行为
 */
import http from "node:http";
import crypto from "node:crypto";

/** Mock Hub 使用的常量 */
export const WEBHOOK_SECRET = "mock-webhook-secret";
export const APP_TOKEN = "mock_app_token";
export const INSTALLATION_ID = "mock-inst";
export const BOT_ID = "mock-bot";

/** 记录 App 发送的消息 */
let sentMessages: any[] = [];

/**
 * 创建 Mock Hub Server
 */
export function createMockHub(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    const body = await readBody(req);

    // POST /bot/v1/message/send — 记录发送的消息
    if (req.method === "POST" && url.pathname === "/bot/v1/message/send") {
      const msg = JSON.parse(body.toString());
      sentMessages.push({ ...msg, received_at: new Date().toISOString() });
      jsonReply(res, 200, { ok: true });
      return;
    }

    // PUT /bot/v1/app/tools — 记录工具同步
    if (req.method === "PUT" && url.pathname === "/bot/v1/app/tools") {
      jsonReply(res, 200, { ok: true });
      return;
    }

    // GET /health — 健康检查
    if (url.pathname === "/health") {
      jsonReply(res, 200, { status: "ok" });
      return;
    }

    jsonReply(res, 404, { error: "not found" });
  });

  return server;
}

/** 获取记录的消息 */
export function getSentMessages(): any[] {
  return sentMessages;
}

/** 清空消息记录 */
export function resetSentMessages(): void {
  sentMessages = [];
}

/** 读取请求体 */
function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** 返回 JSON 响应 */
function jsonReply(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
