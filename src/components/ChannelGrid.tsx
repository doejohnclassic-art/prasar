import { useEffect, useRef, useState } from "react";
import { ChannelCard } from "./ChannelCard";
import { Icon } from "./Icons";
import type { Channel } from "../lib/playlist";

const PAGE = 60;

type Props = {
  channels: Channel[];
  activeKey: string | null;
  favSet: Set<string>;
  view: "grid" | "list";
  loading?: boolean;
  onSelect: (c: Channel) => void;
  onToggleFavorite: (c: Channel) => void;
  empty?: { title: string; hint: string; action?: { label: string; run: () => void } };
};

export default function ChannelGrid({
  channels,
  activeKey,
  favSet,
  view,
  loading,
  onSelect,
  onToggleFavorite,
  empty,
}: Props) {
  const [visible, setVisible] = useState(PAGE);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observed = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    setVisible(PAGE);
  }, [channels.length, view]);

  /* scroll reveals */
  useEffect(() => {
    const root = wrapRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      root?.querySelectorAll<HTMLElement>(".reveal").forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "120px 0px", threshold: 0.02 },
    );
    root.querySelectorAll<HTMLElement>(".reveal:not(.is-in)").forEach((el) => {
      if (observed.current.has(el)) return;
      observed.current.add(el);
      io.observe(el);
    });
    return () => io.disconnect();
  }, [visible, channels, view]);

  /* infinite paging */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => Math.min(v + PAGE, channels.length));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [channels.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface p-3">
            <span className="sweep absolute inset-0 overflow-hidden opacity-60" />
            <span className="h-11 w-11 shrink-0 rounded-lg bg-surface3" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-2/3 rounded bg-surface3" />
              <span className="block h-2 w-1/3 rounded bg-surface3/70" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!channels.length && empty) {
    return (
      <div className="rise rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-surface2 text-ink3">
          <Icon name="search" className="h-5 w-5" />
        </span>
        <p className="font-display text-xl">{empty.title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-ink2">{empty.hint}</p>
        {empty.action && (
          <button
            onClick={empty.action.run}
            className="mt-5 rounded-lg bg-ember px-4 py-2 text-[13px] font-semibold text-[#150a02] transition hover:brightness-110"
          >
            {empty.action.label}
          </button>
        )}
      </div>
    );
  }

  const slice = channels.slice(0, visible);

  return (
    <div ref={wrapRef}>
      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {slice.map((c) => (
            <ChannelCard
              key={c.key}
              channel={c}
              view="grid"
              active={c.key === activeKey}
              favorite={favSet.has(c.key)}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface/70">
          {slice.map((c) => (
            <ChannelCard
              key={c.key}
              channel={c}
              view="list"
              active={c.key === activeKey}
              favorite={favSet.has(c.key)}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-px w-full" />

      {visible < channels.length && (
        <p className="mt-4 text-center font-mono text-[10.5px] tracking-[0.2em] text-ink3 uppercase">
          Showing {slice.length} / {channels.length}
        </p>
      )}
      {visible >= channels.length && channels.length > 0 && (
        <p className="mt-5 text-center font-mono text-[10.5px] tracking-[0.2em] text-ink3 uppercase">
          End of index · {channels.length} channels
        </p>
      )}
    </div>
  );
}
