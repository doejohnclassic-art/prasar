import { get, set, del } from "idb-keyval";

/** Tiny TTL cache on top of IndexedDB with a memory + localStorage safety net. */
const memory = new Map<string, unknown>();

export type CacheEnvelope<T> = { v: T; t: number };

export async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  const now = Date.now();
  try {
    const hit = (await get<CacheEnvelope<T> | undefined>(key)) ?? (memory.get(key) as CacheEnvelope<T> | undefined);
    if (hit && typeof hit.t === "number" && now - hit.t < ttlMs) return hit.v;
  } catch {
    /* IndexedDB unavailable (private mode) — fall through */
  }
  try {
    const raw = localStorage.getItem(`prasar:${key}`);
    if (raw) {
      const hit = JSON.parse(raw) as CacheEnvelope<T>;
      if (now - hit.t < ttlMs) {
        memory.set(key, hit);
        return hit.v;
      }
    }
  } catch {
    /* quota or parse error — ignore */
  }
  return null;
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { v: value, t: Date.now() };
  memory.set(key, envelope);
  try {
    await set(key, envelope);
    return;
  } catch {
    /* ignore */
  }
  try {
    const raw = JSON.stringify(envelope);
    if (raw.length < 3_500_000) localStorage.setItem(`prasar:${key}`, raw);
  } catch {
    /* ignore */
  }
}

export async function clearCache(key: string): Promise<void> {
  memory.delete(key);
  try {
    await del(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`prasar:${key}`);
  } catch {
    /* ignore */
  }
}

/** Plain persisted preference (sync, survives reloads). */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`prasar:pref:${key}`);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`prasar:pref:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
