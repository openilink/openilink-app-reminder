/**
 * HubClient 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HubClient } from "../../src/hub/client.js";

describe("HubClient", () => {
  const hubUrl = "https://hub.example.com";
  const appToken = "test-app-token";
  let client: HubClient;

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new HubClient(hubUrl, appToken);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("构造函数去除末尾斜杠", () => {
    const c = new HubClient("https://hub.example.com///", appToken);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    c.sendText("u1", "hi");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "https://hub.example.com/bot/v1/message/send",
      expect.any(Object),
    );
  });

  it("sendText 发送正确的请求", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    await client.sendText("user-001", "测试消息", "trace-001");

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(callArgs[0]).toBe(`${hubUrl}/bot/v1/message/send`);

    const opts = callArgs[1] as any;
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe(`Bearer ${appToken}`);

    const body = JSON.parse(opts.body);
    expect(body.to).toBe("user-001");
    expect(body.type).toBe("text");
    expect(body.content).toBe("测试消息");
    expect(body.trace_id).toBe("trace-001");
  });

  it("HTTP 错误时抛出异常", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("服务器内部错误"),
    });

    await expect(client.sendText("u1", "hi")).rejects.toThrow("发送消息失败");
  });

  it("syncTools 发送 PUT 请求", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const tools = [
      { name: "create_reminder", description: "创建提醒", command: "create_reminder" },
    ];
    await client.syncTools(tools);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      `${hubUrl}/bot/v1/app/tools`,
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
