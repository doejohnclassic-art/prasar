import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type HlsType from "hls.js";
import { Icon } from "./Icons";
import type { RelayMode } from "../hooks/usePrefs";
import type { Channel } from "../lib/playlist";
import { initials, hueOf } from "../lib/playlist";
import { readPref, writePref } from "../lib/cache";

type HlsCtor = typeof HlsType;
type HlsInstance = HlsType;

let enginePromise: Promise<HlsCtor> | null = null;
function loadEngine(): Promise<HlsCtor> {
  if (!enginePromise) {
    enginePromise = import("hls.js/light").then((m) => (m.default ?? m) as unknown as HlsCtor);
  }
  return enginePromise;
}

export function proxyUrl(url: string): string {
  return `/proxy?url=${encodeURIComponent(url)}`;
}

export type PlayerHandle = {
  play: () => void;
  pause: () => void;
  toggleMute: () => void;
  bumpVolume: (delta: number) => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  reload: () => void;
};

type Props = {
  channel: Channel | null;
  relay: RelayMode;
  autoplay: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRelayUsed: () => void;
  onSurprise?: () => void;
  onPlaybackState?: (playing: boolean) => void;
  nowTitle?: string | null;
  nextTitle?: string | null;
  progressPct?: number;
};

type Stats = { w: number; h: number; bitrate: number; dropped: number; buffered: number; via: string };

export default function Player({
  channel,
  relay,
  autoplay,
  isFavorite,
  onToggleFavorite,
  onPrev,
  onNext,
  onRelayUsed,
  onSurprise,
  onPlaybackState,
  nowTitle,
  nextTitle,
  progressPct = 0,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<HlsInstance | null>(null);
  const hideTimer = useRef<number | null>(null);
  const statsTimer = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [muted, setMuted] = useState(() => readPref<boolean>("muted", true));
  const [volume, setVolume] = useState(() => readPref<number>("volume", 0.8));
  const [levels, setLevels] = useState<{ height: number; bitrate: number; index: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [uiLevel, setUiLevel] = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [controls, setControls] = useState(true);
  const [menu, setMenu] = useState<null | "quality">(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [viaRelay, setViaRelay] = useState(false);
  const [flash, setFlash] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const channelKey = channel?.key ?? null;

  /* ---------- volume persistence ---------- */
  useEffect(() => writePref("volume", volume), [volume]);
  useEffect(() => writePref("muted", muted), [muted]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted, channelKey]);

  /* ---------- channel switch transition ---------- */
  useEffect(() => {
    if (!channel) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 420);
    return () => window.clearTimeout(t);
  }, [channel]);

  /* ---------- stream lifecycle ---------- */
  const attach = useCallback(
    async (useRelay: boolean) => {
      const video = videoRef.current;
      if (!video || !channel) return;
      setStatus("loading");
      setError(null);
      setViaRelay(useRelay);
      tokenRef.current = channel.key;
      setLevels([]);
      setUiLevel(-1);

      const source = useRelay ? proxyUrl(channel.url) : channel.url;

      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();

      let Hls: HlsCtor;
      try {
        Hls = await loadEngine();
      } catch {
        setStatus("error");
        setError({ title: "Player engine unavailable", detail: "Could not load the HLS engine bundle." });
        return;
      }

      // stale-closure guards: the user may have zapped away while the engine loaded
      if (hlsRef.current || videoRef.current !== video || tokenRef.current !== channel.key) return;

      const isNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          maxBufferSize: 4 * 1000 * 1000,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          manifestLoadingTimeOut: 12000,
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 800,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 3,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 700,
          startLevel: -1,
          capLevelToPlayerSize: true,
          stretchShortVideoTrack: true,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels(
            (data.levels || [])
              .map((l, index) => ({ height: l.height || 0, bitrate: l.bitrate || 0, index }))
              .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate),
          );
          if (autoplay || !muted) {
            video.play().catch(() => {
              if (!video.muted) {
                video.muted = true;
                setMuted(true);
                video.play().catch(() => setStatus("paused"));
              } else {
                setStatus("paused");
              }
            });
          } else {
            setStatus("paused");
          }
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setLevel(data.level));
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !useRelay && relay !== "off") {
            // most live streams block cross-origin playback — hop through the relay
            onRelayUsed();
            void attach(true);
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          setStatus("error");
          setError({
            title: useRelay ? "Relay could not reach the stream" : "Stream unreachable",
            detail:
              data.details === "manifestLoadError"
                ? "The broadcaster's manifest did not load (offline stream or CORS block)."
                : data.details === "fragLoadError" || data.details === "levelLoadError"
                  ? "Media segments stopped arriving. The channel may be temporarily off-air."
                  : `${data.details}${useRelay ? " (via relay)" : ""}`,
          });
        });

        hls.loadSource(source);
        hls.attachMedia(video);
      } else if (isNative) {
        video.src = source;
        video.play().catch(() => setStatus("paused"));
      } else {
        setStatus("error");
        setError({ title: "Unsupported browser", detail: "This browser has no HLS or MSE support." });
      }
    },
    [channel, autoplay, muted, relay, onRelayUsed],
  );

  useEffect(() => {
    if (!channel) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      videoRef.current?.removeAttribute("src");
      setStatus("idle");
      setStartedAt(null);
      return;
    }
    setStartedAt(Date.now());
    void attach(relay === "always");
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, relay]);

  /* ---------- media event wiring ---------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "error" ? s : "paused"));
    const onWaiting = () => setStatus((s) => (s === "error" ? s : "loading"));
    const onPlaying = () => setStatus("playing");
    const onEnded = () => setStatus("paused");
    const onEnterPip = () => setPip(true);
    const onLeavePip = () => setPip(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  /* ---------- report playback state upwards ---------- */
  useEffect(() => {
    onPlaybackState?.(status === "playing");
  }, [status, onPlaybackState]);

  /* ---------- stats ticker ---------- */
  useEffect(() => {
    if (!showStats) {
      setStats(null);
      return;
    }
    const tick = () => {
      const video = videoRef.current;
      if (!video) return;
      const q = video.getVideoPlaybackQuality?.();
      const active = hlsRef.current?.levels?.[level];
      let buffered = 0;
      try {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
            buffered = video.buffered.end(i) - video.currentTime;
            break;
          }
        }
      } catch {
        /* ignore */
      }
      setStats({
        w: video.videoWidth,
        h: video.videoHeight,
        bitrate: active?.bitrate ?? hlsRef.current?.bandwidthEstimate ?? 0,
        dropped: q?.droppedVideoFrames ?? 0,
        buffered,
        via: viaRelay ? "relay" : hlsRef.current ? "mse" : "native",
      });
    };
    tick();
    statsTimer.current = window.setInterval(tick, 900);
    return () => {
      if (statsTimer.current) window.clearInterval(statsTimer.current);
    };
  }, [showStats, level, viaRelay]);

  /* ---------- controls ---------- */
  const wake = useCallback(() => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!menu) setControls(false);
    }, 2800);
  }, [menu]);

  useEffect(() => {
    wake();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [wake, status]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !channel) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
    wake();
  }, [channel, wake]);

  const reload = useCallback(() => {
    if (channel) void attach(viaRelay);
  }, [attach, channel, viaRelay]);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (shell.requestFullscreen) void shell.requestFullscreen();
    else if ((shell as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen)
      (shell as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const applyLevel = (value: number) => {
    setUiLevel(value);
    setMenu(null);
    if (hlsRef.current) hlsRef.current.currentLevel = value;
    wake();
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      const onWidget =
        !!target && (target.tagName === "BUTTON" || target.tagName === "A" || target.getAttribute("role") === "button");
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          if (onWidget && e.key === " ") return;
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          setMuted((m) => !m);
          wake();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "p":
          void togglePip();
          break;
        case "r":
          reload();
          break;
        case "s":
          setShowStats((s) => !s);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => Math.min(1, +(v + 0.1).toFixed(2)));
          setMuted(false);
          wake();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => Math.max(0, +(v - 0.1).toFixed(2)));
          wake();
          break;
        case "arrowright":
          onNext();
          break;
        case "arrowleft":
          onPrev();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, togglePip, reload, onNext, onPrev, wake]);

  const activeLevel = useMemo(() => {
    if (!levels.length) return null;
    const pick = uiLevel === -1 ? level : uiLevel;
    return levels.find((l) => l.index === pick) ?? levels[0];
  }, [levels, level, uiLevel]);

  const uptime = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const hue = channel ? hueOf(channel.name) : 24;

  return (
    <div
      ref={shellRef}
      className="group/stage relative isolate overflow-hidden rounded-[16px] border border-line bg-[#05080c] shadow-[var(--c-shadow)]"
      onMouseMove={wake}
      onTouchStart={wake}
      onMouseLeave={() => !menu && setControls(false)}
    >
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          playsInline
          muted={muted}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* idle / no-signal state */}
        {!channel && (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_100%_at_50%_0%,#101a26_0%,#05080c_70%)]">
            <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative flex flex-col items-center gap-4 px-6 text-center">
              <div className="flex h-14 items-end gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="eq-bar w-1.5 rounded-full bg-ember/70"
                    style={{ height: `${18 + ((i * 7) % 30)}px`, animationDelay: `${i * 110}ms` }}
                  />
                ))}
              </div>
              <p className="font-display text-2xl text-white/90">Signal standby</p>
              <p className="max-w-sm font-mono text-[11px] tracking-[0.18em] text-white/40 uppercase">
                Pick a channel from the index to tune in
              </p>
              {onSurprise && (
                <button
                  onClick={onSurprise}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[13px] font-semibold text-white/90 backdrop-blur transition hover:border-ember hover:bg-ember hover:text-[#150a02]"
                >
                  <Icon name="bolt" className="h-4 w-4" />
                  Surprise me
                </button>
              )}
            </div>
          </div>
        )}

        {/* static flash on channel switch */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
            flash && channel ? "opacity-70" : "opacity-0"
          }`}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 3px), radial-gradient(circle at 50% 50%, rgba(255,255,255,.12), transparent 60%)",
          }}
        />

        {/* buffering */}
        {channel && status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <span className="spin h-9 w-9 rounded-full border-2 border-white/15 border-t-ember" />
              <span className="font-mono text-[10px] tracking-[0.22em] text-white/60 uppercase">
                Tuning {channel.name}
              </span>
              {progressPct > 0 && (
                <span className="h-0.5 w-32 overflow-hidden rounded bg-white/10">
                  <span className="block h-full bg-ember transition-[width]" style={{ width: `${progressPct}%` }} />
                </span>
              )}
            </div>
          </div>
        )}

        {/* error */}
        {status === "error" && error && (
          <div className="absolute inset-0 grid place-items-center bg-[#0a0d12]/92 px-6">
            <div className="w-full max-w-md rounded-xl border border-live/30 bg-surface/80 p-5 text-center">
              <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-live/12 text-live">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <p className="font-display text-lg text-ink">{error.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{error.detail}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={reload}
                  className="rounded-lg bg-ember px-3.5 py-2 text-[13px] font-semibold text-[#150a02] transition hover:brightness-110"
                >
                  Retry stream
                </button>
                {!viaRelay && relay === "off" && (
                  <button
                    onClick={() => void attach(true)}
                    className="rounded-lg border border-line bg-surface2 px-3.5 py-2 text-[13px] font-medium text-ink transition hover:border-ember/60"
                  >
                    Try via relay
                  </button>
                )}
                <button
                  onClick={onNext}
                  className="rounded-lg border border-line bg-surface2 px-3.5 py-2 text-[13px] font-medium text-ink transition hover:border-ember/60"
                >
                  Next channel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* top overlay */}
        {channel && (
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/35 to-transparent p-3.5 transition-opacity duration-300 sm:p-4 ${
              controls || status !== "playing" ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-white/8">
                {channel.logo ? (
                  <img src={channel.logo} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                ) : (
                  <span
                    className="grid h-full w-full place-items-center font-mono text-[11px] font-semibold text-white"
                    style={{ background: `hsl(${hue} 70% 32%)` }}
                  >
                    {initials(channel.name)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] leading-tight text-white sm:text-lg">{channel.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] tracking-[0.14em] text-white/55 uppercase">
                  <span className="inline-flex items-center gap-1.5 rounded bg-live/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
                    LIVE
                  </span>
                  <span className="truncate">{channel.group}</span>
                  {activeLevel?.height ? <span>{activeLevel.height}p</span> : null}
                  {viaRelay && <span className="text-jade">relay</span>}
                </div>
              </div>
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <button
                onClick={onToggleFavorite}
                title={isFavorite ? "Remove from favourites" : "Save to favourites"}
                className={`grid h-9 w-9 place-items-center rounded-lg border backdrop-blur transition ${
                  isFavorite
                    ? "border-ember/60 bg-ember/20 text-ember"
                    : "border-white/15 bg-black/40 text-white/75 hover:border-ember/60 hover:text-ember"
                }`}
              >
                <Icon name="star" className="h-4.5 w-4.5" strokeWidth={isFavorite ? 2.2 : 1.7} />
              </button>
              {nowTitle && (
                <div className="hidden max-w-[220px] rounded-lg border border-white/12 bg-black/45 px-2.5 py-1.5 backdrop-blur md:block">
                  <p className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">On now</p>
                  <p className="truncate text-[12px] font-medium text-white/90">{nowTitle}</p>
                  {nextTitle && <p className="truncate text-[11px] text-white/45">Next · {nextTitle}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* stats */}
        {showStats && stats && channel && (
          <div className="pointer-events-none absolute top-16 right-3 rounded-lg border border-white/10 bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-jade backdrop-blur sm:top-20">
            <p>RES {stats.w || "?"}×{stats.h || "?"}</p>
            <p>BITRATE {stats.bitrate ? `${(stats.bitrate / 1000).toFixed(0)} kbps` : "—"}</p>
            <p>BUFFER {stats.buffered.toFixed(1)} s</p>
            <p>DROPPED {stats.dropped}</p>
            <p>PATH {stats.via.toUpperCase()}</p>
            <p>UPTIME {Math.floor(uptime / 60)}m {uptime % 60}s</p>
          </div>
        )}

        {/* centre play affordance */}
        {channel && status === "paused" && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/15"
            aria-label="Play"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-ember/95 text-[#150a02] shadow-[0_10px_40px_-8px_rgba(255,138,61,.8)] transition hover:scale-105">
              <Icon name="play" className="ml-1 h-7 w-7" strokeWidth={1.4} />
            </span>
          </button>
        )}

        {/* bottom control bar */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/55 to-transparent px-3 pt-8 pb-2.5 transition-all duration-300 sm:px-4 ${
            controls || status !== "playing" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {channel && (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <Ctl label="Previous channel" onClick={onPrev}>
                <Icon name="prev" className="h-4.5 w-4.5" />
              </Ctl>
              <button
                onClick={togglePlay}
                aria-label={status === "playing" ? "Pause" : "Play"}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0a0d12] transition hover:scale-105 hover:bg-ember active:scale-95"
              >
                <Icon name={status === "playing" ? "pause" : "play"} className="h-5 w-5" strokeWidth={1.6} />
              </button>
              <Ctl label="Next channel" onClick={onNext}>
                <Icon name="next" className="h-4.5 w-4.5" />
              </Ctl>

              <div className="ml-0.5 flex items-center gap-2">
                <Ctl label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
                  <Icon name={muted || volume === 0 ? "mute" : "volume"} className="h-4.5 w-4.5" />
                </Ctl>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setMuted(Number(e.target.value) === 0);
                  }}
                  aria-label="Volume"
                  className="prasar-range w-16 sm:w-24"
                  style={{
                    background: `linear-gradient(to right, var(--c-ember) ${(muted ? 0 : volume) * 100}%, color-mix(in oklab, var(--c-ink) 22%, transparent) ${(muted ? 0 : volume) * 100}%)`,
                  }}
                />
              </div>

              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                {levels.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setMenu((m) => (m === "quality" ? null : "quality"))}
                      className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 font-mono text-[10px] tracking-wider text-white/85 uppercase backdrop-blur transition hover:border-ember/60 hover:text-ember"
                    >
                      {uiLevel === -1 ? "Auto" : `${activeLevel?.height || "?"}p`}
                      <Icon name="chevronDown" className="h-3 w-3" />
                    </button>
                    {menu === "quality" && (
                      <div className="absolute right-0 bottom-12 z-30 w-44 overflow-hidden rounded-xl border border-line bg-surface/95 shadow-xl backdrop-blur">
                        <p className="border-b border-linesoft px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-ink3 uppercase">
                          Quality
                        </p>
                        <button
                          onClick={() => applyLevel(-1)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition hover:bg-surface2 ${
                            uiLevel === -1 ? "text-ember" : "text-ink"
                          }`}
                        >
                          Auto {activeLevel?.height ? <span className="font-mono text-[11px] text-ink3">{activeLevel.height}p</span> : null}
                          {uiLevel === -1 && <Icon name="check" className="h-4 w-4" />}
                        </button>
                        {levels.map((l) => (
                          <button
                            key={l.index}
                            onClick={() => applyLevel(l.index)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition hover:bg-surface2 ${
                              uiLevel === l.index ? "text-ember" : "text-ink"
                            }`}
                          >
                            {l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`}
                            <span className="font-mono text-[11px] text-ink3">{Math.round(l.bitrate / 1000)}k</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Ctl label="Stream stats (S)" active={showStats} onClick={() => setShowStats((s) => !s)}>
                  <Icon name="bolt" className="h-4.5 w-4.5" />
                </Ctl>
                <Ctl label="Reload stream (R)" onClick={reload}>
                  <Icon name="refresh" className="h-4.5 w-4.5" />
                </Ctl>
                <Ctl label="Picture in picture (P)" active={pip} onClick={() => void togglePip()}>
                  <Icon name="pip" className="h-4.5 w-4.5" />
                </Ctl>
                <Ctl label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={toggleFullscreen}>
                  <Icon name={fullscreen ? "collapse" : "expand"} className="h-4.5 w-4.5" />
                </Ctl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Ctl({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-lg border backdrop-blur transition active:scale-90 ${
        active
          ? "border-ember/60 bg-ember/18 text-ember"
          : "border-white/12 bg-black/40 text-white/80 hover:border-ember/50 hover:text-ember"
      }`}
    >
      {children}
    </button>
  );
}
