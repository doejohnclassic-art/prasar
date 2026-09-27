import { readCache, writeCache } from "./cache";

export type Programme = {
  start: number;
  stop: number;
  title: string;
  desc: string;
  category: string;
};

export type Guide = {
  source: string;
  fetchedAt: number;
  programs: Record<string, Programme[]>;
  count: number;
};

/** Public XMLTV sources tried in order (first success wins). */
export const EPG_SOURCES = [
  "https://iptv-org.github.io/epg/guides/in/dishtv.in.epg.xml",
  "https://iptv-org.github.io/epg/guides/in/tataplay.com.epg.xml",
  "https://dearbulut.github.io/iptv/epg/in.xml.gz",
  "https://iptv-epg.org/files/epg-in.xml.gz",
];

const CACHE_KEY = "epg:in";
const TTL = 6 * 60 * 60 * 1000; // 6h

async function fetchMaybeGzipped(url: string, timeout = 25000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors", cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (gzipped && typeof DecompressionStream !== "undefined") {
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    }
    return new TextDecoder("utf-8").decode(bytes);
  } finally {
    clearTimeout(timer);
  }
}

/** XMLTV start/stop timestamps look like 20260214183000 +0530 */
export function parseXmltvDate(value: string | null | undefined): number {
  if (!value) return 0;
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return Date.parse(value) || 0;
  const [, y, mo, d, h, mi, s, off] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s || "00"}${off ? `${off.slice(0, 3)}:${off.slice(3)}` : "Z"}`;
  const t = Date.parse(iso);
  if (!Number.isNaN(t)) return t;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0));
}

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

export function parseXmltv(xml: string, windowMs = 48 * 3600 * 1000): Omit<Guide, "source" | "fetchedAt"> {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const programs = doc.getElementsByTagName("programme");
  const now = Date.now();
  const from = now - 2 * 3600 * 1000;
  const to = now + windowMs;
  const out: Record<string, Programme[]> = {};
  let count = 0;

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    const start = parseXmltvDate(p.getAttribute("start"));
    const stop = parseXmltvDate(p.getAttribute("stop")) || start + 30 * 60 * 1000;
    if (stop < from || start > to) continue;
    const cid = (p.getAttribute("channel") || "").toLowerCase();
    if (!cid) continue;
    const title = text(p.getElementsByTagName("title")[0]) || "Untitled";
    (out[cid] ||= []).push({
      start,
      stop,
      title,
      desc: text(p.getElementsByTagName("desc")[0]).slice(0, 400),
      category: text(p.getElementsByTagName("category")[0]),
    });
    count++;
  }
  for (const key of Object.keys(out)) out[key].sort((a, b) => a.start - b.start);
  return { programs: out, count };
}

export async function loadGuide(customUrl?: string): Promise<Guide> {
  const cached = await readCache<Guide>(CACHE_KEY, TTL);
  if (cached && cached.count > 0 && !customUrl) return cached;

  const urls = customUrl ? [customUrl, ...EPG_SOURCES] : EPG_SOURCES;
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const xml = await fetchMaybeGzipped(url);
      if (!xml.includes("<programme")) throw new Error("no programme entries");
      const parsed = parseXmltv(xml);
      if (parsed.count < 5) throw new Error("guide is empty");
      const guide: Guide = { source: url, fetchedAt: Date.now(), ...parsed };
      await writeCache(CACHE_KEY, guide);
      return guide;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("EPG unavailable");
}

export function nowNext(guide: Guide | null, channelId: string, at = Date.now()) {
  if (!guide || !channelId) return { now: null as Programme | null, next: [] as Programme[] };
  const list = guide.programs[channelId.toLowerCase()];
  if (!list?.length) return { now: null, next: [] };
  let idx = list.findIndex((p) => p.start <= at && p.stop > at);
  if (idx === -1) idx = list.findIndex((p) => p.start > at);
  if (idx === -1) return { now: null, next: [] };
  const isNow = list[idx].start <= at;
  return {
    now: isNow ? list[idx] : null,
    next: (isNow ? list.slice(idx + 1, idx + 5) : list.slice(idx, idx + 5)),
  };
}

export const timeFmt = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
