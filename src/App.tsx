import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./components/TopBar";
import Sidebar, { type Selection } from "./components/Sidebar";
import Player from "./components/Player";
import ChannelGrid from "./components/ChannelGrid";
import EpgDock from "./components/EpgDock";
import GuideModal from "./components/GuideModal";
import ToastHost from "./components/Toasts";
import { MiniDock, ShortcutsModal, Spotlight, Ticker } from "./components/Chrome";
import { Icon, LogoMark } from "./components/Icons";
import { LogoTile } from "./components/ChannelCard";
import { usePlaylist } from "./hooks/usePlaylist";
import { useFavorites, useRecent, useSettings, useTheme, useViewMode } from "./hooks/usePrefs";
import { loadGuide, nowNext, type Guide } from "./lib/epg";
import { readPref, writePref } from "./lib/cache";
import {
  SECTIONS,
  languageName,
  searchChannels,
  sortChannels,
  type Channel,
  type SortMode,
} from "./lib/playlist";
import { toast } from "./lib/toast";

export default function App() {
  /* ------------------------------------------------------------ data & prefs */
  const { channels, phase, error, progress, fetchedAt, enriched, refresh } = usePlaylist();
  const { theme, toggle: toggleTheme } = useTheme();
  const [settings, setSettings] = useSettings();
  const { favSet, toggleFav } = useFavorites();
  const { recent, push: pushRecent } = useRecent();
  const [view, setView] = useViewMode();

  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("az");
  const [currentKey, setCurrentKey] = useState<string | null>(() => readPref<string | null>("lastChannel", null));
  const [playing, setPlaying] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const relayToastShown = useRef(false);

  /* ------------------------------------------------------------------- guide */
  const [guide, setGuide] = useState<Guide | null>(null);
  const [guideStatus, setGuideStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadGuideNow = useCallback(async () => {
    setGuideStatus("loading");
    try {
      const g = await loadGuide(settings.customEpg.trim() || undefined);
      setGuide(g);
      setGuideStatus("ready");
      toast(`Guide synced · ${g.count.toLocaleString()} listings`, "good");
    } catch {
      setGuideStatus("error");
    }
  }, [settings.customEpg]);

  useEffect(() => {
    if (settings.epg && guideStatus === "idle") void loadGuideNow();
    if (!settings.epg) setGuide(null);
  }, [settings.epg, guideStatus, loadGuideNow]);

  /* ------------------------------------------------------------ derived data */
  const current = useMemo(
    () => channels.find((c) => c.key === currentKey) ?? null,
    [channels, currentKey],
  );

  useEffect(() => {
    writePref<string | null>("lastChannel", currentKey);
    document.title = current ? `${current.name} · Prasar` : "Prasar · Live Indian IPTV Console";
  }, [currentKey, current]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { favs: favSet.size, recent: recent.length };
    for (const s of SECTIONS) map[`s:${s.id}`] = 0;
    map["s:general"] = 0;
    for (const c of channels) map[`s:${c.section}`] = (map[`s:${c.section}`] ?? 0) + 1;
    return map;
  }, [channels, favSet, recent]);

  const languages = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of channels) for (const l of c.languages) m.set(l, (m.get(l) ?? 0) + 1);
    return [...m.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  }, [channels]);

  const baseList = useMemo(() => {
    if (selection.kind === "all") return channels;
    if (selection.kind === "favs") return channels.filter((c) => favSet.has(c.key));
    if (selection.kind === "recent") {
      const rank = new Map(recent.map((k, i) => [k, i]));
      return channels.filter((c) => rank.has(c.key)).sort((a, b) => rank.get(a.key)! - rank.get(b.key)!);
    }
    if (selection.kind === "section") return channels.filter((c) => c.section === selection.value);
    if (selection.kind === "lang") return channels.filter((c) => c.languages.includes(selection.value));
    if (selection.kind === "group") return channels.filter((c) => c.group === selection.value);
    return channels;
  }, [channels, selection, favSet, recent]);

  const groupChips = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of baseList) m.set(c.group, (m.get(c.group) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [baseList]);

  const visible = useMemo(() => {
    const afterGroup = groupFilter ? baseList.filter((c) => c.group === groupFilter) : baseList;
    const afterSearch = query.trim() ? searchChannels(afterGroup, query.trim()) : afterGroup;
    if (query.trim()) return afterSearch;
    if (selection.kind === "recent" || sort === "recent") {
      const rank = new Map(recent.map((k, i) => [k, i]));
      return [...afterSearch].sort((a, b) => (rank.get(a.key) ?? 1e9) - (rank.get(b.key) ?? 1e9));
    }
    return sortChannels(afterSearch, sort, recent);
  }, [baseList, groupFilter, query, sort, selection.kind, recent]);

  const selectionLabel = useMemo(() => {
    if (query.trim()) return `Results for “${query.trim()}”`;
    switch (selection.kind) {
      case "all":
        return "All channels";
      case "favs":
        return "Favourites";
      case "recent":
        return "Recently watched";
      case "section":
        return SECTIONS.find((s) => s.id === selection.value)?.label ?? "Uncategorised";
      case "lang":
        return `${languageName(selection.value)} channels`;
      case "group":
        return selection.value;
    }
  }, [selection, query]);

  const selectionBlurb = useMemo(() => {
    if (query.trim()) return `${visible.length} match${visible.length === 1 ? "" : "es"} across the India index`;
    const s = SECTIONS.find((x) => x.id === (selection.kind === "section" ? selection.value : ""));
    if (s) return s.blurb;
    if (selection.kind === "lang") return `Regional broadcasts in ${languageName(selection.value)}`;
    if (selection.kind === "favs") return "Saved locally in this browser — nothing is uploaded";
    if (selection.kind === "recent") return "The last channels you tuned into";
    return "Every public stream listed for India by the iptv-org community";
  }, [query, selection, visible.length]);

  const zapList = useMemo(() => {
    if (!current) return visible.slice(0, 14);
    const idx = visible.findIndex((c) => c.key === current.key);
    const from = idx === -1 ? 0 : Math.max(0, idx - 3);
    return visible.slice(from, from + 14);
  }, [visible, current]);

  /* ------------------------------------------------------------------ tuning */
  const tune = useCallback(
    (c: Channel, opts?: { scroll?: boolean }) => {
      setCurrentKey(c.key);
      pushRecent(c.key);
      document.title = `${c.name} · Prasar`;
      if (opts?.scroll !== false && typeof window !== "undefined") {
        const el = stageRef.current;
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 8;
          if (Math.abs(window.scrollY - top) > 80) window.scrollTo({ top, behavior: "smooth" });
        }
      }
    },
    [pushRecent],
  );

  const stop = useCallback(() => {
    setCurrentKey(null);
    setPlaying(false);
    document.title = "Prasar · Live Indian IPTV Console";
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!visible.length) return;
      const idx = current ? visible.findIndex((c) => c.key === current.key) : -1;
      const nextIdx = idx === -1 ? 0 : (idx + dir + visible.length) % visible.length;
      tune(visible[nextIdx], { scroll: false });
    },
    [visible, current, tune],
  );

  const surprise = useCallback(() => {
    const pool = visible.length ? visible : channels;
    if (!pool.length) return;
    tune(pool[Math.floor(Math.random() * Math.min(pool.length, 80))], { scroll: false });
  }, [visible, channels, tune]);

  const onToggleFavorite = useCallback(
    (c: Channel) => {
      const added = toggleFav(c.key);
      toast(added ? `${c.name} saved to favourites` : `${c.name} removed from favourites`, added ? "good" : "info");
    },
    [toggleFav],
  );

  const toggleVideo = useCallback(() => {
    const v = document.querySelector("video");
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const onRelayUsed = useCallback(() => {
    if (relayToastShown.current) return;
    relayToastShown.current = true;
    toast("Stream relay engaged — bypassing the broadcaster's CORS block", "info");
  }, []);

  /* ------------------------------------------------------- stage visibility */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => setStageVisible(e[0]?.isIntersecting ?? true), {
      threshold: 0.12,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* --------------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "g") {
        e.preventDefault();
        setGuideOpen(true);
        if (guideStatus === "idle") void loadGuideNow();
      } else if (k === "v") {
        setView(view === "grid" ? "list" : "grid");
      } else if (k === "x" && current) {
        onToggleFavorite(current);
      } else if (e.key === "?") {
        setShortcutsOpen(true);
      } else if (k === "escape" && drawer) {
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, drawer, guideStatus, loadGuideNow, onToggleFavorite, setView, view]);

  const { now: nowProgramme, next: nextProgrammes } = nowNext(guide, current?.id ?? "");

  const booting = channels.length === 0 && phase !== "error";
  const stats = {
    total: channels.length,
    groups: new Set(channels.map((c) => c.group)).size,
    languages: languages.length,
    updated: fetchedAt
      ? new Date(fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : "—",
  };

  return (
    <div className="relative min-h-screen bg-bg text-ink">
      {/* ambient layers */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="app-grid absolute inset-0 opacity-45" />
        <div
          className="absolute -top-56 left-1/2 h-[34rem] w-[70rem] -translate-x-1/2 blur-[130px]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--c-ember) 16%, transparent), transparent 78%)",
          }}
        />
        <div className="app-noise absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      </div>

      <div className="relative flex">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-line bg-surface/70 backdrop-blur-xl lg:block">
          <Sidebar
            selection={selection}
            onSelect={(s) => {
              setSelection(s);
              setGroupFilter(null);
              setQuery("");
            }}
            counts={counts}
            languages={languages}
            total={channels.length}
            enriched={enriched}
            ready={channels.length > 0}
          />
        </aside>

        {/* main */}
        <main className="min-w-0 flex-1">
          <TopBar
            query={query}
            onQuery={setQuery}
            searchRef={searchRef}
            theme={theme}
            onToggleTheme={toggleTheme}
            settings={settings}
            setSettings={setSettings}
            view={view}
            setView={setView}
            sort={sort}
            setSort={setSort}
            phase={phase}
            progress={progress}
            fetchedAt={fetchedAt}
            resultCount={visible.length}
            onRefresh={() => void refresh(true)}
            onOpenGuide={() => {
              setGuideOpen(true);
              if (guideStatus === "idle") void loadGuideNow();
            }}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenDrawer={() => setDrawer(true)}
          />

          <Ticker channels={visible.length ? visible : channels} activeKey={currentKey} onTune={(c) => tune(c)} />

          <div className="mx-auto max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5">
            {phase === "error" && !channels.length && (
              <div className="rise mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-live/35 bg-surface p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-live/12 text-live">
                  <Icon name="alert" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold text-ink">Could not reach the playlist</p>
                  <p className="mt-1 text-[13px] text-ink2">
                    {error ?? "Network error"} · Prasar pulls the live index from iptv-org at launch.
                  </p>
                </div>
                <button
                  onClick={() => void refresh(true)}
                  className="rounded-lg bg-ember px-4 py-2.5 text-[13px] font-bold text-[#150a02] transition hover:brightness-110"
                >
                  Retry
                </button>
              </div>
            )}

            {phase === "cache" && error && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-ember/35 bg-ember/8 px-3.5 py-2.5 text-[12.5px] text-ink2">
                <Icon name="info" className="h-4 w-4 shrink-0 text-ember" />
                Showing your cached index — the live playlist could not be refreshed ({error}).
              </div>
            )}

            {/* ------------------------------------------------------ on air */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_336px] xl:items-start">
              <section ref={stageRef} className="min-w-0 space-y-3 xl:col-start-1 xl:row-start-1">
                <Player
                  channel={current}
                  relay={settings.relay}
                  autoplay={settings.autoplay}
                  isFavorite={current ? favSet.has(current.key) : false}
                  onToggleFavorite={() => current && onToggleFavorite(current)}
                  onPrev={() => step(-1)}
                  onNext={() => step(1)}
                  onRelayUsed={onRelayUsed}
                  onSurprise={surprise}
                  onPlaybackState={setPlaying}
                  nowTitle={nowProgramme?.title ?? null}
                  nextTitle={nextProgrammes[0]?.title ?? null}
                />

                {/* zap rail */}
                {zapList.length > 0 && (
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-mono text-[9.5px] tracking-[0.22em] text-ink3 uppercase">
                        {current ? "Zap · same selection" : "Quick pick"}
                      </p>
                      <p className="hidden font-mono text-[9.5px] tracking-[0.18em] text-ink3 uppercase sm:block">
                        ← → to zap
                      </p>
                    </div>
                    <div className="scroll-thin hide-scroll flex gap-2 overflow-x-auto pb-1">
                      {zapList.map((c) => {
                        const active = c.key === currentKey;
                        return (
                          <button
                            key={c.key}
                            onClick={() => tune(c, { scroll: false })}
                            className={`group flex w-[9.5rem] shrink-0 flex-col gap-2 rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5 ${
                              active
                                ? "border-ember/70 bg-ember/10"
                                : "border-line bg-surface hover:border-ember/40 hover:bg-surface2"
                            }`}
                          >
                            <LogoTile channel={c} size="sm" rounded="rounded-md" />
                            <span className="min-w-0">
                              <span
                                className={`block truncate text-[12.5px] font-semibold ${active ? "text-ember" : "text-ink"}`}
                              >
                                {c.name}
                              </span>
                              <span className="block truncate font-mono text-[9px] tracking-wide text-ink3 uppercase">
                                {c.group}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* channel facts */}
                {current && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 py-2.5">
                    <span className="font-mono text-[9.5px] tracking-[0.2em] text-ink3 uppercase">stream</span>
                    <code className="max-w-[min(100%,26rem)] truncate rounded bg-bg2 px-2 py-1 font-mono text-[11px] text-ink3">
                      {current.url}
                    </code>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          void navigator.clipboard?.writeText(current.url);
                          toast("Stream URL copied", "good");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-[12px] text-ink2 transition hover:border-ember/50 hover:text-ember"
                      >
                        <Icon name="copy" className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      {current.languages.map((l) => (
                        <button
                          key={l}
                          onClick={() => {
                            setSelection({ kind: "lang", value: l });
                            setGroupFilter(null);
                          }}
                          className="rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-[12px] text-ink2 transition hover:border-jade/50 hover:text-jade"
                        >
                          {languageName(l)}
                        </button>
                      ))}
                      {current && (
                        <button
                          onClick={() => stop()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-[12px] text-ink2 transition hover:border-live/50 hover:text-live"
                        >
                          <Icon name="stop" className="h-3.5 w-3.5" />
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ------------------------------------------------------- index */}
              <section className="mt-2 xl:col-start-1 xl:row-start-2 xl:mt-0">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[26px] leading-none font-extrabold tracking-tight text-ink sm:text-[32px]">
                    {selectionLabel}
                  </h2>
                  <p className="mt-2 text-[13px] text-ink2">{selectionBlurb}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.16em] text-ink3 uppercase tabular-nums">
                    {visible.length} / {channels.length || "—"}
                  </span>
                  <button
                    onClick={() => setShortcutsOpen(true)}
                    className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink2 transition hover:border-ember/50 hover:text-ember sm:inline-flex"
                  >
                    <Icon name="keyboard" className="h-3.5 w-3.5" />
                    Shortcuts
                  </button>
                </div>
              </div>

              {groupChips.length > 1 && (
                <div className="hide-scroll -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  <Chip active={!groupFilter} onClick={() => setGroupFilter(null)} label="All groups" />
                  {groupChips.map(([g, n]) => (
                    <Chip
                      key={g}
                      active={groupFilter === g}
                      onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                      label={`${g} · ${n}`}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4">
                <ChannelGrid
                  channels={visible}
                  activeKey={currentKey}
                  favSet={favSet}
                  view={view}
                  loading={booting}
                  onSelect={(c) => tune(c)}
                  onToggleFavorite={onToggleFavorite}
                  empty={{
                    title: selection.kind === "favs" ? "No favourites yet" : "Nothing on this frequency",
                    hint:
                      selection.kind === "favs"
                        ? "Tap the star on any channel to pin it here — favourites live in this browser only."
                        : "Try a different search term, or clear the group filter to widen the sweep.",
                    action:
                      query || groupFilter
                        ? {
                            label: "Reset filters",
                            run: () => {
                              setQuery("");
                              setGroupFilter(null);
                              setSelection({ kind: "all" });
                            },
                          }
                        : selection.kind === "favs"
                          ? { label: "Browse all channels", run: () => setSelection({ kind: "all" }) }
                          : undefined,
                  }}
                />
              </div>
              </section>

              <aside className="scroll-thin mt-1 space-y-4 xl:sticky xl:top-[84px] xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:mt-0 xl:max-h-[calc(100vh-104px)] xl:overflow-y-auto xl:pr-1">
                <EpgDock channel={current} guide={guide} status={guideStatus} onLoad={() => void loadGuideNow()} />
                <Spotlight channels={channels} onTune={(c) => tune(c)} stats={stats} />
              </aside>
            </div>

            {/* ------------------------------------------------------ footer */}
            <footer className="mt-10 border-t border-line pt-6 pb-10">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-ember">
                      <LogoMark className="h-7 w-7" />
                    </span>
                    <p className="font-display text-[16px] font-extrabold tracking-tight text-ink">PRASAR</p>
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink3">
                    An open IPTV console for India. Streams are collected by the iptv-org community from publicly
                    available sources; Prasar stores nothing on a server and asks for nothing in return.
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
                  <FooterStat label="channels" value={channels.length ? channels.length.toLocaleString() : "—"} />
                  <FooterStat label="categories" value={String(SECTIONS.length + 1)} />
                  <FooterStat label="languages" value={String(languages.length)} />
                  <FooterStat label="favourites" value={String(favSet.size)} />
                  <FooterStat label="cache" value={fetchedAt ? "indexed" : "empty"} />
                  <FooterStat label="cost" value="₹0" />
                </dl>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.16em] text-ink3 uppercase">
                <span>playlist · iptv-org/countries/in.m3u</span>
                <span className="hidden h-3 w-px bg-line sm:block" />
                <span>deploys free on cloudflare pages</span>
                <span className="hidden h-3 w-px bg-line sm:block" />
                <button onClick={() => setShortcutsOpen(true)} className="transition hover:text-ember">
                  keyboard shortcuts
                </button>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------ mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-[var(--c-scrim)] backdrop-blur-sm" onClick={() => setDrawer(false)} aria-label="Close navigation" />
          <div className="toast-in absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-line bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.22em] text-ink3 uppercase">navigate</span>
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink2"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Sidebar
                selection={selection}
                onSelect={(s) => {
                  setSelection(s);
                  setGroupFilter(null);
                  setQuery("");
                  setDrawer(false);
                }}
                counts={counts}
                languages={languages}
                total={channels.length}
                enriched={enriched}
                ready={channels.length > 0}
              />
            </div>
          </div>
        </div>
      )}

      {current && !stageVisible && (
        <MiniDock
          channel={current}
          playing={playing}
          isFavorite={favSet.has(current.key)}
          onOpen={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          onTogglePlay={toggleVideo}
          onStop={stop}
          onToggleFavorite={() => onToggleFavorite(current)}
        />
      )}

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        channels={selection.kind === "favs" ? visible : visible.length ? visible : channels}
        guide={guide}
        status={guideStatus}
        onLoad={() => void loadGuideNow()}
        onTune={(c) => tune(c)}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ToastHost />

      {/* ---------------------------------------------------------- boot veil */}
      {booting && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-bg">
          <div className="app-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex w-[min(90vw,26rem)] flex-col items-center text-center">
            <span className="text-ember">
              <LogoMark className="h-14 w-14" />
            </span>
            <h1 className="mt-5 font-display text-[40px] leading-none font-extrabold tracking-tight text-ink">
              PRASAR
            </h1>
            <p className="mt-2 font-mono text-[10px] tracking-[0.34em] text-ink3 uppercase">
              live indian television · free
            </p>
            <div className="mt-7 flex h-12 items-end gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className="eq-bar w-1.5 rounded-full bg-ember/70"
                  style={{ height: `${14 + ((i * 11) % 34)}px`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-surface2">
              <span
                className="block h-full rounded-full bg-ember transition-[width] duration-300"
                style={{ width: `${progress > 0 ? progress : phase === "boot" ? 12 : 60}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-[10.5px] tracking-[0.18em] text-ink3 uppercase">
              {phase === "boot" ? "opening tuner" : progress > 0 ? `downloading index · ${progress}%` : "parsing playlist"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase transition ${
        active
          ? "border-ember/60 bg-ember/14 text-ember"
          : "border-line bg-surface text-ink3 hover:border-ember/40 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-[0.2em] text-ink3 uppercase">{label}</dt>
      <dd className="mt-1 font-display text-[18px] font-bold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
