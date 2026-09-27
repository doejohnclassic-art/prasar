# PRASAR — free live Indian IPTV console

A modern, zero-cost IPTV front-end for the community-maintained
[iptv-org](https://github.com/iptv-org/iptv) India playlist
(`https://iptv-org.github.io/iptv/countries/in.m3u`).

No accounts. No fees. No server-side storage — favourites, theme, history and the
channel cache all live in the visitor's browser (IndexedDB + localStorage).

---

## Features

| Area | What you get |
| --- | --- |
| Playlist | Auto-fetch + parse of the live `.m3u`, streamed with progress, deduplicated, NSFW-filtered |
| Categories | News, Sports, Entertainment, Movies, Music, Kids, Devotional, Factual + raw group chips |
| Regional | Channels tagged by language (Hindi, Tamil, Telugu, Bengali, Malayalam, …) using iptv-org's `channels.json`, merged in the background |
| Player | hls.js (light build, lazily imported), volume, quality selector, fullscreen, **Picture-in-Picture**, live stats overlay, recovery on media errors |
| Speed | Tuned low-latency HLS buffers, instant zap rail, `←`/`→` channel zapping, static-flash transition |
| Resilience | Optional **Cloudflare stream relay** (`functions/proxy.ts`) that rewrites `.m3u8` child URIs to defeat CORS blocks — auto-engages on failure |
| EPG | XMLTV guide (gz or plain) with now/next dock, programme progress bar and a full scrollable guide grid with a live time marker |
| Caching | Playlist (12 h), channel metadata (7 d) and guide (6 h) cached in IndexedDB with a localStorage fallback |
| UX | Dark/light themes, grid/list density, search with relevance scoring, favourites, recently-watched, keyboard remote, scroll reveals, marquee ticker |
| Delivery | Single inlined HTML build, lazy logo loading, infinite paging (60 channels per batch), CDN-friendly headers |

## Keyboard remote

`Space/K` play · `M` mute · `↑/↓` volume · `F` fullscreen · `P` PiP · `R` reload stream ·
`S` stats · `←/→` zap channels · `/` search · `G` guide · `V` view · `X` favourite · `?` help

---

## Deploy free on Cloudflare Pages

Full beginner walkthrough (GitHub account → live URL in ~15 minutes):
**[HOSTING.md](./HOSTING.md)**

Short version:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Env var | `NODE_VERSION=20` |
| Function | `functions/proxy.ts` → `/proxy` (free plan) |

```bash
# or skip GitHub and upload from your laptop
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name prasar
```

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # single-file production bundle in dist/
```

> The `/proxy` relay only exists in the Cloudflare environment. Locally, leave
> Stream relay on **Auto**: direct playback is attempted first and the relay is
> used only when a broadcaster blocks cross-origin requests.

## Project layout

```
functions/proxy.ts      Cloudflare Pages Function — CORS relay + m3u8 URI rewriting
public/_headers         Edge cache/security headers
src/lib/playlist.ts     m3u parser, category mapping, language tables, relevance search
src/lib/epg.ts          XMLTV fetch (gzip aware), parse, now/next helpers
src/lib/cache.ts        IndexedDB TTL cache + persisted preferences
src/hooks/usePlaylist.ts   fetch → parse → enrich → cache orchestration
src/components/Player.tsx  HLS player, quality/PiP/fullscreen/stats controls
src/App.tsx             shell: navigation, filtering, zapping, modals
```

## Legal & ethics

Prasar is a **player**, not a broadcaster. It indexes publicly available streams
maintained by iptv-org and does not host, upload or redistribute media. Remove any
channel you own the rights to by opening an issue upstream at
[iptv-org/iptv](https://github.com/iptv-org/iptv).
