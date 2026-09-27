import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import { LogoTile } from "./ChannelCard";
import { timeFmt, type Guide, type Programme } from "../lib/epg";
import type { Channel } from "../lib/playlist";

const PX_PER_HOUR = 210;
const ROW_H = 60;
const LEFT_W = 208;
const HOURS = 6;

type Props = {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  guide: Guide | null;
  status: "idle" | "loading" | "ready" | "error";
  onLoad: () => void;
  onTune: (c: Channel) => void;
};

export default function GuideModal({ open, onClose, channels, guide, status, onLoad, onTune }: Props) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [windowStart, setWindowStart] = useState(() => Math.floor(Date.now() / 1800000) * 1800000 - 3600000);
  const [picked, setPicked] = useState<{ channel: Channel; program: Programme } | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = Math.floor(Date.now() / 1800000) * 1800000 - 3600000;
    setWindowStart(start);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = scroller.current;
      if (el) el.scrollLeft = Math.max(0, ((Date.now() - start) / 3600000) * PX_PER_HOUR - 160);
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const rows = useMemo(() => channels.slice(0, 60), [channels]);
  const nowLeft = ((Date.now() - windowStart) / 3600000) * PX_PER_HOUR;
  const width = PX_PER_HOUR * HOURS;
  const windowEnd = windowStart + HOURS * 3600000;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-[var(--c-scrim)] backdrop-blur-sm" onClick={onClose} aria-label="Close guide" />
      <div className="toast-in relative flex h-[88vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ember/14 text-ember">
            <Icon name="calendar" className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-none font-extrabold text-ink">Electronic programme guide</h2>
            <p className="mt-1 truncate font-mono text-[10px] tracking-[0.16em] text-ink3 uppercase">
              {new Date(windowStart).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              {" · "}
              {rows.length} channels
              {guide ? ` · ${guide.count.toLocaleString()} listings` : ""}
            </p>
          </div>
          {(status === "idle" || status === "error") && (
            <button
              onClick={onLoad}
              className="rounded-lg bg-ember px-3.5 py-2 text-[13px] font-semibold text-[#150a02] transition hover:brightness-110"
            >
              {status === "error" ? "Retry guide" : "Load guide"}
            </button>
          )}
          {status === "loading" && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-[11px] text-ink2">
              <span className="spin h-3.5 w-3.5 rounded-full border-2 border-line border-t-ember" />
              fetching xmltv
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface2 text-ink2 transition hover:border-live/50 hover:text-live"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        <div ref={scroller} className="scroll-thin relative min-h-0 flex-1 overflow-auto">
          <div className="relative" style={{ width: LEFT_W + width }}>
            {/* ruler */}
            <div className="sticky top-0 z-30 flex border-b border-line bg-surface/95 backdrop-blur">
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-line bg-surface px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-ink3 uppercase"
                style={{ width: LEFT_W }}
              >
                channel
              </div>
              <div className="relative flex" style={{ width }}>
                {Array.from({ length: HOURS * 2 }).map((_, i) => (
                  <div
                    key={i}
                    className={`shrink-0 border-r border-linesoft px-2 py-2 font-mono text-[10.5px] tabular-nums ${
                      i % 2 === 0 ? "text-ink2" : "text-ink3"
                    }`}
                    style={{ width: PX_PER_HOUR / 2 }}
                  >
                    {i % 2 === 0 ? timeFmt(windowStart + i * 1800000) : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* now marker */}
            {nowLeft >= 0 && nowLeft <= width && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-live"
                style={{ left: LEFT_W + nowLeft }}
              >
                <span className="absolute -top-0.5 -left-[26px] rounded bg-live px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white">
                  {timeFmt(Date.now())}
                </span>
              </div>
            )}

            {rows.length === 0 && (
              <p className="px-5 py-10 text-[13.5px] text-ink3">No channels in the current selection.</p>
            )}

            {rows.map((c) => {
              const list = (guide?.programs[c.id.toLowerCase()] ?? []).filter(
                (p) => p.stop > windowStart && p.start < windowEnd,
              );
              return (
                <div key={c.key} className="flex border-b border-linesoft" style={{ height: ROW_H }}>
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r border-line bg-surface px-2.5"
                    style={{ width: LEFT_W }}
                  >
                    <LogoTile channel={c} size="xs" rounded="rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{c.name}</p>
                      <p className="truncate font-mono text-[9.5px] tracking-wide text-ink3 uppercase">{c.group}</p>
                    </div>
                    <button
                      onClick={() => {
                        onTune(c);
                        onClose();
                      }}
                      aria-label={`Watch ${c.name}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-ink3 transition hover:border-ember/60 hover:text-ember"
                    >
                      <Icon name="play" className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="relative bg-bg2/40" style={{ width, height: ROW_H }}>
                    {list.length === 0 && (
                      <span className="absolute inset-2 grid place-items-center rounded-md border border-dashed border-line font-mono text-[10px] tracking-[0.16em] text-ink3 uppercase">
                        no listings
                      </span>
                    )}
                    {list.map((pr, i) => {
                      const left = ((Math.max(pr.start, windowStart) - windowStart) / 3600000) * PX_PER_HOUR;
                      const w =
                        ((Math.min(pr.stop, windowEnd) - Math.max(pr.start, windowStart)) / 3600000) * PX_PER_HOUR - 4;
                      const live = pr.start <= Date.now() && pr.stop > Date.now();
                      return (
                        <button
                          key={`${pr.start}-${i}`}
                          onClick={() => setPicked({ channel: c, program: pr })}
                          style={{ left, width: Math.max(24, w) }}
                          className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border px-2 py-1 text-left transition ${
                            picked?.program.start === pr.start && picked.channel.key === c.key
                              ? "border-ember bg-ember/18 text-ink"
                              : live
                                ? "border-jade/45 bg-jade/12 text-ink hover:border-jade"
                                : "border-line bg-surface text-ink2 hover:border-ember/50 hover:text-ink"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {live && <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-jade" />}
                            <span className="truncate text-[12px] font-medium">{pr.title}</span>
                          </span>
                          <span className="block truncate font-mono text-[9.5px] text-ink3 tabular-nums">
                            {timeFmt(pr.start)}–{timeFmt(pr.stop)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-line bg-surface px-4 py-3">
          {picked ? (
            <div className="flex flex-wrap items-start gap-3">
              <LogoTile channel={picked.channel} size="sm" rounded="rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-bold text-ink">{picked.program.title}</p>
                <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-ink3 uppercase tabular-nums">
                  {picked.channel.name} · {timeFmt(picked.program.start)}–{timeFmt(picked.program.stop)}
                  {picked.program.category ? ` · ${picked.program.category}` : ""}
                </p>
                {picked.program.desc && (
                  <p className="mt-1.5 line-clamp-2 max-w-3xl text-[12.5px] leading-relaxed text-ink2">
                    {picked.program.desc}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  onTune(picked.channel);
                  onClose();
                }}
                className="rounded-lg bg-ember px-4 py-2 text-[13px] font-semibold text-[#150a02] transition hover:brightness-110"
              >
                Tune in
              </button>
            </div>
          ) : (
            <p className="font-mono text-[10.5px] tracking-[0.16em] text-ink3 uppercase">
              Select a programme block for details · scroll to browse the window
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
