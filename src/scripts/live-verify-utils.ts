import "dotenv/config";
import WebSocket from "ws";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
}

export interface LiveConfig {
  apiUrl?: string;
  gatewayUrl?: string;
  apiWsUrl?: string;
  gatewayWsUrl?: string;
  email: string;
  displayName: string;
  token?: string;
  timeoutMs: number;
}

export function liveConfig(): LiveConfig {
  const apiUrl = cleanUrl(process.env.LIVE_API_URL);
  const gatewayUrl = cleanUrl(process.env.LIVE_GATEWAY_URL);
  return {
    apiUrl,
    gatewayUrl,
    apiWsUrl: cleanUrl(process.env.LIVE_API_WS_URL) ?? (apiUrl ? toWsUrl(apiUrl) : undefined),
    gatewayWsUrl: cleanUrl(process.env.LIVE_GATEWAY_WS_URL) ?? (gatewayUrl ? toWsUrl(gatewayUrl) : undefined),
    email: process.env.LIVE_TEST_EMAIL?.trim() || "render-smoke@gorkh.dev",
    displayName: process.env.LIVE_TEST_DISPLAY_NAME?.trim() || "Render Smoke",
    token: process.env.LIVE_TEST_JWT?.trim() || undefined,
    timeoutMs: Number(process.env.LIVE_VERIFY_TIMEOUT_MS ?? 30000),
  };
}

export function requireUrl(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required. Set ${label} in the environment before running live verification.`);
  return value;
}

export async function getLiveToken(apiUrl: string, cfg = liveConfig()): Promise<string> {
  if (cfg.token) return cfg.token;
  const response = await fetchJson<{ token: string }>(`${apiUrl}/dev/users`, {
    method: "POST",
    body: { email: cfg.email, displayName: cfg.displayName },
    timeoutMs: cfg.timeoutMs,
  });
  if (!response.token) throw new Error("Live test token was not returned. In production, set LIVE_TEST_JWT because /dev/users is disabled.");
  return response.token;
}

export async function fetchJson<T>(url: string, options: { method?: string; token?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? liveConfig().timeoutMs),
  });
  const text = await response.text();
  const parsed = text ? parseJson(text) : {};
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${redactUrl(url)} failed: HTTP ${response.status} ${truncate(text, 500)}`);
  return parsed as T;
}

export async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = liveConfig().timeoutMs, intervalMs = 500): Promise<T> {
  const started = Date.now();
  let lastError: Error | null = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err as Error;
    }
    await delay(intervalMs);
  }
  throw new Error(lastError ? `timed out: ${lastError.message}` : "timed out waiting for condition");
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function printSummary(title: string, checks: CheckResult[]): void {
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.error ? `: ${check.error}` : ""}`);
  }
  console.log(JSON.stringify({ title, ok: checks.every((check) => check.ok), checks }, null, 2));
  if (checks.some((check) => !check.ok)) process.exit(1);
}

export async function runCheck(name: string, fn: () => Promise<unknown>): Promise<CheckResult> {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, error: sanitizeError(err as Error) };
  }
}

export async function collectWsEvents(params: {
  url: string;
  token?: string;
  messages: unknown[];
  afterExpectedMessages?: unknown[];
  expectTypes: string[];
  timeoutMs?: number;
}): Promise<Array<Record<string, unknown>>> {
  const url = params.token ? `${params.url}?token=${encodeURIComponent(params.token)}` : params.url;
  const ws = new WebSocket(url);
  const events: Array<Record<string, unknown>> = [];
  ws.on("message", (data) => events.push(parseJson(data.toString()) as Record<string, unknown>));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  for (const message of params.messages) ws.send(JSON.stringify(message));
  await waitFor(
    async () => (params.expectTypes.every((type) => events.some((event) => event.type === type)) ? events : null),
    params.timeoutMs ?? liveConfig().timeoutMs,
    100,
  );
  for (const message of params.afterExpectedMessages ?? []) ws.send(JSON.stringify(message));
  ws.close();
  return events;
}

export async function expectWsAuthRejection(url: string): Promise<Record<string, unknown>> {
  const ws = new WebSocket(url);
  const events: Array<Record<string, unknown>> = [];
  ws.on("message", (data) => events.push(parseJson(data.toString()) as Record<string, unknown>));
  await new Promise<void>((resolve) => {
    ws.once("open", resolve);
    ws.once("close", resolve);
    ws.once("error", resolve);
  });
  await delay(300);
  ws.close();
  return { rejected: true, events };
}

export function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function cleanUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return value.trim().replace(/\/+$/g, "");
}

function toWsUrl(url: string): string {
  return url.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: truncate(text, 500) };
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function sanitizeError(err: Error): string {
  return err.message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/token=[A-Za-z0-9._-]+/g, "token=[redacted]");
}
