import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? 10000);
const functionUrl = process.env.SUPABASE_EMAIL_FUNCTION_URL;
const webhookSecret = process.env.WEBHOOK_SECRET;
const maxBodyBytes = 64 * 1024;

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error("payload_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function forwardWebhook(request: IncomingMessage, response: ServerResponse) {
  if (!functionUrl || !webhookSecret) return json(response, 503, { error: "backend_not_configured" });
  if (!safeEqual(request.headers["x-webhook-secret"]?.toString() ?? "", webhookSecret)) {
    return json(response, 401, { error: "unauthorized" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    return json(response, error instanceof Error && error.message === "payload_too_large" ? 413 : 400, {
      error: error instanceof Error && error.message === "payload_too_large" ? "payload_too_large" : "invalid_json",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": webhookSecret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await upstream.text();
    response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
    response.end(body);
  } catch {
    json(response, 502, { error: "upstream_unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true });
  if (request.method === "GET" && url.pathname === "/ready") {
    return json(response, functionUrl && webhookSecret ? 200 : 503, {
      ready: Boolean(functionUrl && webhookSecret),
    });
  }
  if (request.method === "POST" && url.pathname === "/reservation-email") return forwardWebhook(request, response);
  return json(response, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Pine Wood backend listening on port ${port}`);
});
