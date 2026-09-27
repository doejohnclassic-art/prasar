/**
 * Prasar — Cloudflare Worker (free plan)
 *
 * Serves the Vite build from [assets] and relays IPTV streams at /proxy
 * so the browser can play sources that omit CORS headers.
 *
 * Dashboard "Workers Builds" runs `npx wrangler deploy` after `npm run build`.
 */

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, If-None-Match",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function proxied(rawUrl: string, base: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("/proxy?url=") || rawUrl.startsWith("proxy?url="))
    return rawUrl;
  let absolute: string;
  try {
    absolute = new URL(rawUrl, base).toString();
  } catch {
    return rawUrl;
  }
  if (!/^https?:\/\//i.test(absolute)) return rawUrl;
  return `/proxy?url=${encodeURIComponent(absolute)}`;
}

function rewritePlaylist(body: string, base: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(
          /URI="([^"]+)"/gi,
          (_m, u: string) => `URI="${proxied(u, base)}"`,
        );
      }
      return proxied(trimmed, base);
    })
    .join("\n");
}

function isPlaylist(contentType: string, pathname: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("mpegurl") ||
    ct.includes("x-mpeg") ||
    ct.includes("text/") ||
    ct.includes("application/json") ||
    /\.(m3u8?)(?:$|[?#])/i.test(pathname)
  );
}

async function handleProxy(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const incoming = new URL(request.url);
  const target = incoming.searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Missing or malformed `url` parameter", {
      status: 400,
      headers: CORS,
    });
  }

  let upstream: URL;
  try {
    upstream = new URL(target);
  } catch {
    return new Response("Unparseable url", { status: 400, headers: CORS });
  }

  const headers = new Headers();
  headers.set("User-Agent", BROWSER_UA);
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const referer =
    upstream.searchParams.get("referer") ??
    incoming.searchParams.get("referer");
  if (referer) headers.set("Referer", referer);

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "follow",
      cf: { cacheTtl: 20, cacheEverything: false },
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502, headers: CORS });
  }

  if (!res.ok) {
    return new Response(`Upstream responded ${res.status}`, {
      status: res.status,
      headers: CORS,
    });
  }

  const out = new Headers();
  for (const key of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = res.headers.get(key);
    if (value) out.set(key, value);
  }
  for (const [k, v] of Object.entries(CORS)) out.set(k, v);

  const contentType = res.headers.get("content-type") ?? "";
  if (isPlaylist(contentType, upstream.pathname) && res.body) {
    const text = await res.text();
    const rewritten =
      text.trimStart().startsWith("#EXTM3U") || contentType.includes("mpegurl")
        ? rewritePlaylist(text, upstream.toString())
        : text;
    out.set(
      "content-type",
      contentType.includes("mpegurl")
        ? contentType
        : "application/vnd.apple.mpegurl",
    );
    out.delete("content-length");
    out.set("cache-control", "public, max-age=15");
    return new Response(rewritten, { status: 200, headers: out });
  }

  out.set(
    "cache-control",
    contentType.includes("mpegurl")
      ? "public, max-age=15"
      : "public, max-age=1800",
  );
  return new Response(res.body, { status: 200, headers: out });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/proxy" || url.pathname.startsWith("/proxy/")) {
      return handleProxy(request);
    }
    return env.ASSETS.fetch(request);
  },
};
