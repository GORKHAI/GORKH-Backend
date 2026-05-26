import { config } from "../../config.js";
import { ResearchProviderError } from "../types.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface FetchedPage {
  url: string;
  contentType: string | null;
  text: string;
  fetchedAt: string;
}

export async function fetchPublicPage(url: string, options: { signal?: AbortSignal; allowLocalForTest?: boolean } = {}): Promise<FetchedPage> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ResearchProviderError("fetch_blocked", "Only HTTP GET fetches are allowed");
  }
  if (!options.allowLocalForTest && (await isPrivateOrLocalTarget(parsed.hostname))) {
    throw new ResearchProviderError("fetch_blocked", "Local and private-network fetches are blocked");
  }
  const timeout = AbortSignal.timeout(config.RESEARCH_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const res = await fetch(parsed, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/html,text/plain,application/xhtml+xml,application/json;q=0.8",
      "User-Agent": "GORKH-ResearchFetcher/0.1 (+https://local.dev)",
    },
    signal,
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type");
  if (contentType && !/text\/html|text\/plain|application\/xhtml\+xml|application\/json/i.test(contentType)) {
    throw new ResearchProviderError("fetch_blocked", `Unsupported content type: ${contentType}`);
  }
  const reader = res.body?.getReader();
  if (!reader) return { url: res.url || url, contentType, text: "", fetchedAt: new Date().toISOString() };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > config.RESEARCH_MAX_FETCH_BYTES) break;
      chunks.push(value);
    }
  }
  return {
    url: res.url || url,
    contentType,
    text: Buffer.concat(chunks).toString("utf8"),
    fetchedAt: new Date().toISOString(),
  };
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  );
}

async function isPrivateOrLocalTarget(hostname: string): Promise<boolean> {
  if (isPrivateHost(hostname)) return true;
  if (isIP(hostname)) return isPrivateIp(hostname);
  try {
    const records = await lookup(hostname, { all: true, verbatim: false });
    return records.some((record) => isPrivateIp(record.address));
  } catch {
    return true;
  }
}

function isPrivateIp(address: string): boolean {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  return isPrivateHost(address);
}
