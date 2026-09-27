import { useEffect, useRef, useState } from "react";
import { Icon, LogoMark } from "./Icons";
import type { Phase } from "../hooks/usePlaylist";
import type { Settings, ViewMode } from "../hooks/usePrefs";
import type { SortMode } from "../lib/playlist";

type Props = {
  query: string;
  onQuery: (q: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
  phase: Phase;
  progress: number;
  fetchedAt: number | null;
  resultCount: number;
  onRefresh: () => void;
  onOpenGuide: () => void;
  onOpenShortcuts: () => void;
  onOpenDrawer: () => void;
};

function agoLabel(t: number | null) {
  if (!t) return "never";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TopBar(p: Props) {
  const [open, setOpen] = useState<null | "settings">(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const i = window.setInterval(() => force((n) => n + 1), 30000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const busy = p.phase === "network" || p.phase === "boot";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <button
          onClick={p.onOpenDrawer}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink2 transition hover:border-ember/50 hover:text-ember lg:hidden"
          aria-label="Open navigation"
        >
          <Icon name="menu" className="h-4.5 w-4.5" />
        </button>

        <span className="flex shrink-0 items-center text-ember lg:hidden" aria-hidden>
          <LogoMark className="h-7 w-7" />
        </span>

        {/* search */}
        <div className="group relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink3 transition group-focus-within:text-ember">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            ref={p.searchRef}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Search channels, categories, languages…"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-16 pl-9 text-[13.5px] text-ink placeholder:text-ink3 transition focus:border-ember/60 focus:bg-surface2 focus:outline-none"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {p.query && (
              <button
                onClick={() => p.onQuery("")}
                aria-label="Clear search"
                className="grid h-6 w-6 place-items-center rounded text-ink3 transition hover:text-ember"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-ink3 sm:block">
              /
            </kbd>
          </div>
        </div>

        {/* status pill */}
        <div className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 md:flex">
          <span
            className={`h-2 w-2 rounded-full ${
              p.phase === "error" ? "bg-live" : busy ? "bg-ember" : "bg-jade"
            } ${busy ? "live-dot" : ""}`}
          />
          <span className="font-mono text-[10px] tracking-[0.16em] text-ink2 uppercase">
            {busy ? `tuning ${p.progress > 0 ? `${p.progress}%` : ""}` : p.phase === "error" ? "signal lost" : "on air"}
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="font-mono text-[10px] text-ink3 tabular-nums">{p.resultCount} ch</span>
          <span className="font-mono text-[10px] text-ink3">· {agoLabel(p.fetchedAt)}</span>
        </div>

        {/* view toggle */}
        <div className="hidden shrink-0 overflow-hidden rounded-xl border border-line bg-surface sm:flex">
          {(["grid", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => p.setView(v)}
              aria-label={`${v} view`}
              className={`grid h-10 w-9 place-items-center transition ${
                p.view === v ? "bg-ember/15 text-ember" : "text-ink3 hover:text-ink"
              }`}
            >
              <Icon name={v} className="h-4 w-4" />
            </button>
          ))}
        </div>

        <button
          onClick={p.onOpenGuide}
          className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink2 transition hover:border-ember/50 hover:text-ember md:flex"
          title="Electronic programme guide"
        >
          <Icon name="calendar" className="h-4 w-4" />
          Guide
        </button>

        <button
          onClick={p.onRefresh}
          disabled={busy}
          aria-label="Refresh playlist"
          title="Refresh playlist"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink2 transition hover:border-ember/50 hover:text-ember disabled:opacity-50"
        >
          <Icon name="refresh" className={`h-4 w-4 ${busy ? "spin" : ""}`} />
        </button>

        <button
          onClick={p.onToggleTheme}
          aria-label="Toggle colour theme"
          title="Toggle theme"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink2 transition hover:border-ember/50 hover:text-ember"
        >
          <Icon name={p.theme === "dark" ? "sun" : "moon"} className="h-4.5 w-4.5" />
        </button>

        {/* settings */}
        <div className="relative shrink-0" ref={popRef}>
          <button
            onClick={() => setOpen((o) => (o === "settings" ? null : "settings"))}
            aria-label="Settings"
            className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
              open === "settings"
                ? "border-ember/60 bg-ember/12 text-ember"
                : "border-line bg-surface text-ink2 hover:border-ember/50 hover:text-ember"
            }`}
          >
            <Icon name="sliders" className="h-4.5 w-4.5" />
          </button>

          {open === "settings" && (
            <div className="toast-in absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
              <p className="border-b border-linesoft px-4 py-3 font-mono text-[10px] tracking-[0.22em] text-ink3 uppercase">
                Playback & data
              </p>
              <div className="max-h-[62vh] space-y-4 overflow-y-auto px-4 py-4 scroll-thin">
                <Field label="Stream relay" hint="Route playback through a Cloudflare Worker to bypass CORS blocks.">
                  <Segmented
                    value={p.settings.relay}
                    options={[
                      { v: "off", l: "Direct" },
                      { v: "auto", l: "Auto" },
                      { v: "always", l: "Always" },
                    ]}
                    onChange={(v) => p.setSettings((s) => ({ ...s, relay: v as Settings["relay"] }))}
                  />
                </Field>
                <Field label="Autoplay on select" hint="Start playback the moment a channel is picked.">
                  <Switch
                    on={p.settings.autoplay}
                    onChange={(v) => p.setSettings((s) => ({ ...s, autoplay: v }))}
                  />
                </Field>
                <Field label="Programme guide (EPG)" hint="Fetch XMLTV schedules for now/next and the guide grid.">
                  <Switch on={p.settings.epg} onChange={(v) => p.setSettings((s) => ({ ...s, epg: v }))} />
                </Field>
                <Field label="Custom EPG URL" hint="Optional XMLTV source (.xml or .xml.gz).">
                  <input
                    value={p.settings.customEpg}
                    onChange={(e) => p.setSettings((s) => ({ ...s, customEpg: e.target.value }))}
                    placeholder="https://…/guide.xml"
                    className="h-9 w-full rounded-lg border border-line bg-bg2 px-2.5 font-mono text-[11.5px] text-ink placeholder:text-ink3 focus:border-ember/60 focus:outline-none"
                  />
                </Field>
                <Field label="Sort order">
                  <Segmented
                    value={p.sort}
                    options={[
                      { v: "az", l: "A–Z" },
                      { v: "recent", l: "Recent" },
                      { v: "za", l: "Z–A" },
                    ]}
                    onChange={(v) => p.setSort(v as SortMode)}
                  />
                </Field>
                <Field label="Layout">
                  <Segmented
                    value={p.view}
                    options={[
                      { v: "grid", l: "Grid" },
                      { v: "list", l: "List" },
                    ]}
                    onChange={(v) => p.setView(v as ViewMode)}
                  />
                </Field>
                <button
                  onClick={() => {
                    setOpen(null);
                    p.onOpenShortcuts();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2.5 text-[13px] text-ink2 transition hover:border-ember/50 hover:text-ember"
                >
                  <Icon name="keyboard" className="h-4 w-4" />
                  Keyboard shortcuts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* mobile status strip */}
      <div className="flex items-center justify-between gap-2 border-t border-linesoft px-4 py-1.5 font-mono text-[9.5px] tracking-[0.16em] text-ink3 uppercase md:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${p.phase === "error" ? "bg-live" : busy ? "bg-ember" : "bg-jade"}`} />
          {busy ? "tuning signal" : p.phase === "error" ? "signal lost" : "on air"}
        </span>
        <span>{p.resultCount} channels</span>
        <span>{agoLabel(p.fetchedAt)}</span>
      </div>
    </header>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-ink3">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full border transition-colors ${
        on ? "border-ember/60 bg-ember/30" : "border-line bg-surface3"
      }`}
    >
      <span
        className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full transition-all ${
          on ? "left-[calc(100%-1.35rem)] bg-ember" : "left-0.5 bg-ink3"
        }`}
      />
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line bg-bg2 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] tracking-wide uppercase transition ${
            value === o.v ? "bg-ember text-[#150a02]" : "text-ink3 hover:text-ink"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
