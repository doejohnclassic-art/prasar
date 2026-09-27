import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "../lib/cache";
import {
  CHANNELS_META_URL,
  PLAYLIST_URL,
  enrichWithMeta,
  parseM3U,
  type Channel,
} from "../lib/playlist";
import { toast } from "../lib/toast";

type MetaRow = { id: string; name: string; languages?: string[]; country?: string; is_nsfw?: boolean; logo?: string };

export type Phase = "boot" | "cache" | "network" | "ready" | "error";

const PLAYLIST_KEY = "playlist:in";
const META_KEY = "meta:channels";
const PLAYLIST_TTL = 12 * 60 * 60 * 1000;
const META_TTL = 7 * 24 * 60 * 60 * 1000;

async function fetchWithProgress(url: string, onProgress: (loaded: number, total: number) => void) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const total = Number(res.headers.get("content-length") || 0);
    if (!res.body) {
      const text = await res.text();
      onProgress(text.length, total || text.length);
      return text;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
      }
    }
    const merged = new Uint8Array(loaded);
    let at = 0;
    for (const c of chunks) {
      merged.set(c, at);
      at += c.byteLength;
    }
    return new TextDecoder("utf-8").decode(merged);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMeta(): Promise<MetaRow[] | null> {
  const cached = await readCache<MetaRow[]>(META_KEY, META_TTL);
  if (cached?.length) return cached;
  try {
    const res = await fetch(CHANNELS_META_URL, { cache: "force-cache" });
    if (!res.ok) return null;
    const json = (await res.json()) as MetaRow[];
    if (Array.isArray(json) && json.length) {
      await writeCache(META_KEY, json);
      return json;
    }
  } catch {
    /* metadata is a progressive enhancement only */
  }
  return null;
}

export function usePlaylist() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [enriched, setEnriched] = useState(false);
  const [bytes, setBytes] = useState(0);
  const inflight = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (inflight.current) return;
    inflight.current = true;
    setError(null);
    try {
      const cached = await readCache<{ channels: Channel[]; fetchedAt: number }>(
        PLAYLIST_KEY,
        force ? 1 : PLAYLIST_TTL,
      );
      if (cached?.channels?.length) {
        setChannels(cached.channels);
        setFetchedAt(cached.fetchedAt);
        setPhase("cache");
        setEnriched(cached.channels.some((c) => c.languages.length > 0));
        if (Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000 && !force) {
          inflight.current = false;
          setPhase("ready");
          return;
        }
      }

      setPhase("network");
      setProgress(0);
      const raw = await fetchWithProgress(PLAYLIST_URL, (loaded, total) => {
        setBytes(loaded);
        setProgress(total ? Math.min(100, Math.round((loaded / total) * 100)) : -1);
      });
      const parsed = parseM3U(raw);
      if (!parsed.length) throw new Error("playlist contained no streams");
      setChannels(parsed);
      setFetchedAt(Date.now());
      setPhase("ready");
      setEnriched(false);
      toast(`${parsed.length} channels indexed from iptv-org`, "good");
      await writeCache(PLAYLIST_KEY, { channels: parsed, fetchedAt: Date.now() });

      // background enrichment: languages / regional tagging
      const meta = await fetchMeta();
      if (meta) {
        const { channels: merged } = enrichWithMeta(parsed.map((c) => ({ ...c })), meta);
        setChannels(merged);
        setEnriched(true);
        await writeCache(PLAYLIST_KEY, { channels: merged, fetchedAt: Date.now() });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setError(message);
      setPhase((p) => (p === "cache" ? "cache" : "error"));
      if (!navigator.onLine) toast("You appear to be offline — showing cached channels", "bad");
      else toast(`Could not refresh playlist (${message})`, "bad");
    } finally {
      inflight.current = false;
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return { channels, phase, error, progress, fetchedAt, enriched, bytes, refresh };
}
