/**
 * Prasar stream relay — Cloudflare Pages Function (`/proxy?url=<encoded>`).
 *
 * Many public IPTV endpoints send no `Access-Control-Allow-Origin` header, which
 * stops MSE (hls.js) from loading them in a browser. This function fetches the
 * media server-side, streams it back with permissive CORS headers, and rewrites
 * child URIs inside .m3u8 playlists so every segment keeps flowing through the
 * relay. It runs on Cloudflare's free plan — no paid add-ons required.
 */

type Ctx = {
  request: Request;
  env: Record<string, unknown>;
  params: Record<string, string>;
  waitUntil: (p: Promise<unknown>) => void;
};

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function proxied(rawUrl: string, base: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("/proxy?url=") || rawUrl.startsWith("proxy?url=")) return rawUrl;
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
        return line.replace(/URI="([^"]+)"/gi, (_m, u: string) => `URI="${proxied(u, base)}"`);
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

export async function onRequest(ctx: Ctx): Promise<Response> {
  const { request } = ctx;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const incoming = new URL(request.url);
  const target = incoming.searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Missing or malformed `url` parameter", { status: 400, headers: CORS });
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
  const referer = upstream.searchParams.get("referer") ?? incoming.searchParams.get("referer");
  if (referer) headers.set("Referer", referer);

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "follow",
      cf: { cacheTtl: 20, cacheEverything: false },
    } as RequestInit & { cf?: unknown });
  } catch {
    return new Response("Upstream unreachable", { status: 502, headers: CORS });
  }

  if (!res.ok) {
    return new Response(`Upstream responded ${res.status}`, { status: res.status, headers: CORS });
  }

  const out = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = res.headers.get(key);
    if (value) out.set(key, value);
  }
  for (const [k, v] of Object.entries(CORS)) out.set(k, v);

  const contentType = res.headers.get("content-type") ?? "";
  if (isPlaylist(contentType, upstream.pathname) && res.body) {
    const text = await res.text();
    const rewritten = text.trimStart().startsWith("#EXTM3U") || contentType.includes("mpegurl")
      ? rewritePlaylist(text, upstream.toString())
      : text;
    out.set("content-type", contentType.includes("mpegurl") ? contentType : "application/vnd.apple.mpegurl");
    out.delete("content-length");
    out.set("cache-control", "public, max-age=15");
    return new Response(rewritten, { status: 200, headers: out });
  }

  out.set("cache-control", contentType.includes("mpegurl") ? "public, max-age=15" : "public, max-age=1800");
  return new Response(res.body, { status: 200, headers: out });
}
