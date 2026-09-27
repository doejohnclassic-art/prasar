export type SectionId =
  | "all"
  | "favorites"
  | "recent"
  | "news"
  | "sports"
  | "entertainment"
  | "movies"
  | "music"
  | "kids"
  | "devotional"
  | "factual"
  | "regional"
  | "general";

export type Channel = {
  key: string;
  id: string;
  name: string;
  url: string;
  logo: string;
  group: string;
  section: SectionId;
  languages: string[];
  country: string;
  chno: string;
};

export const PLAYLIST_URL = "https://iptv-org.github.io/iptv/countries/in.m3u";
export const CHANNELS_META_URL = "https://iptv-org.github.io/api/channels.json";

export const SECTIONS: {
  id: SectionId;
  label: string;
  blurb: string;
  groups: string[];
}[] = [
  { id: "news", label: "News", blurb: "24×7 bulletins & debates", groups: ["news"] },
  {
    id: "sports",
    label: "Sports",
    blurb: "Live action & replays",
    groups: ["sports"],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    blurb: "General entertainment",
    groups: [
      "entertainment",
      "general",
      "series",
      "comedy",
      "lifestyle",
      "family",
      "fashion",
      "legislative",
      "outdoor",
    ],
  },
  { id: "movies", label: "Movies", blurb: "Feature films & classics", groups: ["movies", "classic", "animation-movie"] },
  { id: "music", label: "Music", blurb: "Songs, charts & culture", groups: ["music"] },
  { id: "kids", label: "Kids", blurb: "Cartoons & junior TV", groups: ["kids", "animation"] },
  { id: "devotional", label: "Devotional", blurb: "Faith & spiritual", groups: ["religious"] },
  {
    id: "factual",
    label: "Factual",
    blurb: "Docs, science & travel",
    groups: ["documentary", "science", "education", "travel", "weather", "culture", "cooking", "auto", "business", "shop"],
  },
];

const GROUP_TO_SECTION = new Map<string, SectionId>();
for (const s of SECTIONS) for (const g of s.groups) GROUP_TO_SECTION.set(g, s.id);

export function sectionForGroup(group: string): SectionId {
  const g = group.trim().toLowerCase();
  if (!g) return "general";
  const direct = GROUP_TO_SECTION.get(g);
  if (direct) return direct;
  for (const [key, value] of GROUP_TO_SECTION) if (g.includes(key) || key.includes(g)) return value;
  return "general";
}

/** Spoken languages of India — used for the Regional rail. */
export const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  en: "English",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
  kn: "Kannada",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  or: "Odia",
  od: "Odia",
  as: "Assamese",
  ur: "Urdu",
  bho: "Bhojpuri",
  mai: "Maithili",
  mag: "Magahi",
  raj: "Rajasthani",
  kok: "Konkani",
  sa: "Sanskrit",
  sd: "Sindhi",
  ne: "Nepali",
  ks: "Kashmiri",
  sat: "Santali",
  mni: "Manipuri",
  lus: "Mizo",
  kha: "Khasi",
  dv: "Dhivehi",
  dz: "Dzongkha",
  bo: "Tibetan",
  my: "Burmese",
  he: "Hebrew",
  ar: "Arabic",
  fa: "Persian",
  fr: "French",
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  tr: "Turkish",
  id: "Indonesian",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

const ATTR_RE = /([a-zA-Z0-9-]+)="([^"]*)"/g;

function attr(line: string, name: string): string {
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(line))) if (m[1].toLowerCase() === name) return m[2].trim();
  return "";
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse an extended-M3U playlist (iptv-org flavour).
 * Tolerates #EXTVLCOPT / #KODIPROP hint lines, CRLF, BOM and malformed rows.
 */
export function parseM3U(raw: string): Channel[] {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/);
  const out: Channel[] = [];
  const seen = new Set<string>();
  let pending: { name: string; logo: string; group: string; id: string; chno: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const name = (comma >= 0 ? line.slice(comma + 1) : "").trim();
      pending = {
        name: name || attr(line, "tvg-name") || "Unknown channel",
        logo: attr(line, "tvg-logo"),
        group: attr(line, "group-title"),
        id: attr(line, "tvg-id"),
        chno: attr(line, "tvg-chno") || attr(line, "channel-number"),
      };
      continue;
    }
    if (line.startsWith("#")) continue;

    // a bare URL
    if (!/^https?:\/\//i.test(line)) continue;
    const meta = pending;
    pending = null;
    if (!meta) continue;

    const key = `${meta.id || slug(meta.name)}|${line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      key,
      id: meta.id,
      name: meta.name.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim() || "Unknown channel",
      url: line,
      logo: meta.logo,
      group: meta.group || "Uncategorised",
      section: sectionForGroup(meta.group),
      languages: [],
      country: "IN",
      chno: meta.chno,
    });
  }
  return out;
}

type MetaRow = {
  id: string;
  name: string;
  alt_names?: string[];
  country?: string;
  languages?: string[];
  is_nsfw?: boolean;
  logo?: string;
};

/** Merge iptv-org's channels.json metadata (languages, nsfw flags) onto parsed rows. */
export function enrichWithMeta(channels: Channel[], meta: MetaRow[]): { channels: Channel[]; nsfwDropped: number } {
  const byId = new Map<string, MetaRow>();
  const byName = new Map<string, MetaRow>();
  for (const row of meta) {
    if (row.id) byId.set(row.id.toLowerCase(), row);
    if (row.name) byName.set(row.name.toLowerCase().trim(), row);
  }
  let dropped = 0;
  const enriched = channels.filter((c) => {
    const hit = (c.id && byId.get(c.id.toLowerCase())) || byName.get(c.name.toLowerCase().trim());
    if (!hit) return true;
    if (hit.is_nsfw) {
      dropped++;
      return false;
    }
    c.languages = Array.isArray(hit.languages) ? hit.languages.filter(Boolean) : [];
    c.country = hit.country || c.country;
    if (!c.logo && hit.logo) c.logo = hit.logo;
    return true;
  });
  return { channels: enriched, nsfwDropped: dropped };
}

export type SortMode = "az" | "za" | "recent";

export function sortChannels(list: Channel[], mode: SortMode, recent: string[]): Channel[] {
  const copy = [...list];
  if (mode === "az") copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  else if (mode === "za") copy.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  else {
    const rank = new Map(recent.map((k, i) => [k, i]));
    copy.sort((a, b) => (rank.get(a.key) ?? 1e9) - (rank.get(b.key) ?? 1e9) || a.name.localeCompare(b.name));
  }
  return copy;
}

/** Cheap, dependency-free relevance search. */
export function scoreChannel(c: Channel, tokens: string[]): number {
  const name = c.name.toLowerCase();
  const group = c.group.toLowerCase();
  const langs = c.languages.map((l) => LANGUAGE_NAMES[l] ?? l).join(" ").toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (name === t) score += 120;
    else if (name.startsWith(t)) score += 70;
    else if (name.includes(t)) score += 45;
    else if (group.includes(t)) score += 22;
    else if (langs.includes(t)) score += 18;
    else if (c.id && c.id.toLowerCase().includes(t)) score += 12;
    else {
      // subsequence match for typo-tolerant zapping
      let idx = 0;
      for (const ch of name) if (ch === t[idx]) idx++;
      if (idx === t.length) score += 6;
      else return 0;
    }
  }
  return score;
}

export function searchChannels(list: Channel[], query: string): Channel[] {
  const tokens = query
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!tokens.length) return list;
  return list
    .map((c) => ({ c, s: scoreChannel(c, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .map((r) => r.c);
}

export function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic hue from a channel name, for logo placeholders & accents. */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
