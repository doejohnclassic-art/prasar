import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { nowNext, timeFmt, type Guide } from "../lib/epg";
import type { Channel } from "../lib/playlist";

type Props = {
  channel: Channel | null;
  guide: Guide | null;
  status: "idle" | "loading" | "ready" | "error";
  onLoad: () => void;
};

function Ticker({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface2/70 px-2.5 py-1.5">
      <p className="font-mono text-[9px] tracking-[0.18em] text-ink3 uppercase">{label}</p>
      <p className="truncate text-[12px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function EpgDock({ channel, guide, status, onLoad }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => force((n) => n + 1), 15000);
    return () => window.clearInterval(i);
  }, []);

  const { now, next } = nowNext(guide, channel?.id ?? "");

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-linesoft bg-surface2/60 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="calendar" className="h-4 w-4 text-ember" />
          <h2 className="font-display text-[13.5px] font-bold tracking-tight text-ink">Programme guide</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.16em] uppercase ${
            status === "ready" ? "text-jade" : status === "error" ? "text-live" : "text-ink3"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "ready" ? "bg-jade" : status === "error" ? "bg-live" : status === "loading" ? "bg-ember live-dot" : "bg-ink3"
            }`}
          />
          {status === "ready" ? "synced" : status === "loading" ? "syncing" : status === "error" ? "no data" : "idle"}
        </span>
      </header>

      <div className="scroll-thin max-h-[46vh] overflow-y-auto p-3.5">
        {status === "idle" || status === "error" ? (
          <div className="py-3 text-center">
            <p className="text-[13px] leading-relaxed text-ink2">
              {status === "error"
                ? "No public XMLTV feed answered. You can point Prasar at your own guide URL in settings."
                : "Load the community XMLTV guide to see now/next schedules for every channel."}
            </p>
            <button
              onClick={onLoad}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:border-ember/60 hover:text-ember"
            >
              <Icon name="download" className="h-4 w-4" />
              {status === "error" ? "Try again" : "Load guide"}
            </button>
          </div>
        ) : status === "loading" ? (
          <div className="space-y-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative h-12 overflow-hidden rounded-lg bg-surface2">
                <span className="sweep absolute inset-0" />
              </div>
            ))}
          </div>
        ) : !channel ? (
          <p className="py-6 text-center text-[13px] text-ink3">Tune into a channel to see its schedule.</p>
        ) : now ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-ember/35 bg-ember/8 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[9.5px] tracking-[0.2em] text-ember uppercase">On now</p>
                <p className="font-mono text-[10.5px] text-ink2 tabular-nums">
                  {timeFmt(now.start)}–{timeFmt(now.stop)}
                </p>
              </div>
              <p className="mt-1.5 font-display text-[15px] leading-snug font-bold text-ink">{now.title}</p>
              {now.desc && <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink2">{now.desc}</p>}
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/25">
                <span
                  className="block h-full rounded-full bg-ember transition-[width] duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(2, ((Date.now() - now.start) / Math.max(1, now.stop - now.start)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-ink3">
                {Math.max(0, Math.round((now.stop - Date.now()) / 60000))} min remaining
                {now.category ? ` · ${now.category}` : ""}
              </p>
            </div>

            <div className="flex gap-2">
              <Ticker label="Channel" value={channel.name} />
              <Ticker label="Feed" value={guide?.source.split("/").pop()?.replace(".epg.xml", "") ?? "—"} />
            </div>

            {next.length > 0 && (
              <ul className="divide-y divide-linesoft overflow-hidden rounded-lg border border-line">
                {next.map((pr, i) => (
                  <li key={`${pr.start}-${i}`} className="flex gap-3 bg-surface2/40 px-3 py-2.5 transition hover:bg-surface2">
                    <span className="w-11 shrink-0 font-mono text-[11px] text-ink3 tabular-nums">{timeFmt(pr.start)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{pr.title}</p>
                      {pr.desc && <p className="line-clamp-1 text-[11.5px] text-ink3">{pr.desc}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[13px] text-ink2">
              No listings published for <span className="font-semibold text-ink">{channel.name}</span>.
            </p>
            <p className="mt-1 text-[11.5px] text-ink3">
              Public guides only cover a subset of channels — try a bigger broadcaster or add your own XMLTV URL.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
