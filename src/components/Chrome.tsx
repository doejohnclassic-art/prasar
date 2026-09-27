import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";
import { LogoTile } from "./ChannelCard";
import { languageName, type Channel } from "../lib/playlist";

/* ------------------------------------------------------------------ Ticker */
export function Ticker({
  channels,
  activeKey,
  onTune,
}: {
  channels: Channel[];
  activeKey: string | null;
  onTune: (c: Channel) => void;
}) {
  const items = useMemo(() => channels.slice(0, 40), [channels]);
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="relative flex items-center overflow-hidden border-y border-line bg-surface2/60">
      <span className="z-10 flex shrink-0 items-center gap-1.5 bg-live px-3 py-1.5 font-mono text-[9.5px] font-semibold tracking-[0.2em] text-white uppercase">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
        now tuning
      </span>
      <div className="relative flex-1 overflow-hidden py-1.5">
        <div className="ticker-track flex w-max items-center gap-6 pl-6">
          {doubled.map((c, i) => (
            <button
              key={`${c.key}-${i}`}
              onClick={() => onTune(c)}
              className={`flex shrink-0 items-center gap-2 font-mono text-[11px] tracking-wide transition-colors ${
                c.key === activeKey ? "text-ember" : "text-ink3 hover:text-ink"
              }`}
            >
              <span className="h-1 w-1 rounded-full bg-current opacity-60" />
              <span className="max-w-[14rem] truncate uppercase">{c.name}</span>
              <span className="text-ink3/70">{c.group}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface2 to-transparent" />
    </div>
  );
}

/* --------------------------------------------------------------- Spotlight */
export function Spotlight({
  channels,
  onTune,
  stats,
}: {
  channels: Channel[];
  onTune: (c: Channel) => void;
  stats: { total: number; groups: number; languages: number; updated: string };
}) {
  const picks = useMemo(() => {
    const withLogo = channels.filter((c) => c.logo);
    const pool = (withLogo.length ? withLogo : channels).slice(0, 400);
    const out: Channel[] = [];
    const used = new Set<string>();
    while (out.length < 5 && pool.length) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (!used.has(c.key)) {
        used.add(c.key);
        out.push(c);
      }
    }
    return out;
  }, [channels]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || picks.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % picks.length), 7000);
    return () => window.clearInterval(t);
  }, [paused, picks.length]);

  const c = picks[i % Math.max(1, picks.length)];

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <header className="flex items-center justify-between border-b border-linesoft bg-surface2/60 px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 font-display text-[13.5px] font-bold tracking-tight text-ink">
          <Icon name="bolt" className="h-4 w-4 text-ember" />
          Spotlight
        </h2>
        <div className="flex items-center gap-1">
          {picks.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Spotlight ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === i % picks.length ? "w-5 bg-ember" : "w-1.5 bg-line hover:bg-ink3"
              }`}
            />
          ))}
        </div>
      </header>

      {c ? (
        <div key={c.key} className="rise p-4">
          <div className="relative mb-3 grid h-24 place-items-center overflow-hidden rounded-lg border border-line bg-bg2">
            <div className="app-grid absolute inset-0 opacity-[0.35]" />
            {c.logo ? (
              <img src={c.logo} alt="" className="relative h-16 object-contain" loading="lazy" decoding="async" />
            ) : (
              <span className="relative font-display text-2xl text-ink3">{c.name}</span>
            )}
          </div>
          <p className="truncate font-display text-[17px] leading-tight font-extrabold text-ink">{c.name}</p>
          <p className="mt-1 truncate font-mono text-[10px] tracking-[0.14em] text-ink3 uppercase">
            {c.group}
            {c.languages[0] ? ` · ${languageName(c.languages[0])}` : ""}
          </p>
          <button
            onClick={() => onTune(c)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-3 py-2.5 text-[13px] font-bold text-[#150a02] transition hover:brightness-110 active:scale-[0.98]"
          >
            <Icon name="play" className="h-4 w-4" strokeWidth={1.8} />
            Tune in
          </button>
        </div>
      ) : (
        <p className="p-5 text-[13px] text-ink3">Loading the index…</p>
      )}

      <dl className="grid grid-cols-2 gap-px border-t border-linesoft bg-linesoft">
        <Stat label="channels" value={stats.total ? stats.total.toLocaleString() : "—"} />
        <Stat label="groups" value={String(stats.groups)} />
        <Stat label="languages" value={String(stats.languages)} />
        <Stat label="refreshed" value={stats.updated} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3.5 py-2.5">
      <dt className="font-mono text-[9px] tracking-[0.18em] text-ink3 uppercase">{label}</dt>
      <dd className="mt-0.5 font-display text-[15px] font-bold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- MiniDock */
export function MiniDock({
  channel,
  playing,
  isFavorite,
  onOpen,
  onTogglePlay,
  onStop,
  onToggleFavorite,
}: {
  channel: Channel;
  playing: boolean;
  isFavorite: boolean;
  onOpen: () => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="toast-in pointer-events-auto fixed inset-x-3 bottom-3 z-45 sm:inset-x-auto sm:right-5 sm:bottom-5 lg:hidden">
      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface/95 p-2 pr-2.5 shadow-2xl backdrop-blur-xl">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <LogoTile channel={channel} size="sm" rounded="rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{channel.name}</span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-live uppercase">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
              {playing ? "on air" : "paused"}
            </span>
          </span>
        </button>
        <button
          onClick={onToggleFavorite}
          aria-label="Favourite"
          className={`grid h-9 w-9 place-items-center rounded-lg border border-line transition ${
            isFavorite ? "text-ember" : "text-ink3 hover:text-ember"
          }`}
        >
          <Icon name="star" className="h-4 w-4" />
        </button>
        <button
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-9 w-9 place-items-center rounded-lg bg-ember text-[#150a02] transition hover:brightness-110"
        >
          <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
        </button>
        <button
          onClick={onStop}
          aria-label="Stop"
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink3 transition hover:border-live/50 hover:text-live"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- ShortcutsModal */
const KEYS: [string, string][] = [
  ["Space / K", "Play or pause"],
  ["M", "Mute"],
  ["↑ / ↓", "Volume"],
  ["F", "Fullscreen"],
  ["P", "Picture in picture"],
  ["R", "Reload stream"],
  ["S", "Stream stats"],
  ["← / →", "Previous / next channel"],
  ["/", "Focus search"],
  ["G", "Open programme guide"],
  ["V", "Grid / list view"],
  ["X", "Star the current channel"],
  ["?", "Open this panel"],
  ["Esc", "Close dialogs"],
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-[var(--c-scrim)] backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="toast-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
            <Icon name="keyboard" className="h-4.5 w-4.5 text-ember" />
            Remote control
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink2 transition hover:border-live/50 hover:text-live"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>
        <ul className="scroll-thin max-h-[60vh] divide-y divide-linesoft overflow-y-auto">
          {KEYS.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-[13px] text-ink2">{v}</span>
              <kbd className="shrink-0 rounded-md border border-line bg-surface2 px-2 py-1 font-mono text-[11px] text-ink">
                {k}
              </kbd>
            </li>
          ))}
        </ul>
        <footer className="border-t border-line bg-surface px-4 py-3">
          <p className="text-[12px] leading-relaxed text-ink3">
            Prasar is free and open: streams come from the community-maintained{" "}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ember underline decoration-dotted underline-offset-2"
            >
              iptv-org
            </a>{" "}
            index. Favourites, theme and history never leave your browser.
          </p>
        </footer>
      </div>
    </div>
  );
}
