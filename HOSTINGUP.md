# Host Prasar for ₹0 — Cloudflare Workers (free forever)

Cloudflare’s 2026 dashboard deploys this as a **Worker with static assets**
(`npx wrangler deploy` after `npm run build`). That is still 100% free.

You need **two free accounts**. Never add a credit card.

| Account                                           | What it does                     | Cost |
| ------------------------------------------------- | -------------------------------- | ---- |
| [GitHub](https://github.com/signup)               | Stores the code                  | Free |
| [Cloudflare](https://dash.cloudflare.com/sign-up) | Builds, CDN, stream-relay Worker | Free |

Public URL you will get:

```
https://prasar.<your-subdomain>.workers.dev
```

(or a `*.pages.dev` URL if the project was originally created as Pages —
both work with this config.)

---

## If a previous deploy failed

The error:

```
Missing entry-point to Worker script or to assets directory
```

happened because `wrangler.toml` used the **Pages-only** key
`pages_build_output_dir`. The dashboard now runs `wrangler deploy`, which
needs `main` + `[assets]`. That is already fixed in this repo.

**Do this:**

1. Make sure the latest files are on GitHub (`worker.ts`, new `wrangler.toml`,
   no `functions/` folder).
2. Cloudflare dashboard → your project → **Deployments** → **Retry deployment**
   (or just `git push` — a new commit triggers a rebuild).
3. If the Worker `name` in Cloudflare is **not** `prasar`, edit `wrangler.toml`
   and set `name` to match the dashboard project name exactly.

```toml
name = "your-dashboard-project-name"
```

---

## Path A — GitHub + dashboard (recommended)

### 1. GitHub account

1. Open https://github.com/signup
2. Verify email, stay on **Free**

### 2. Create a repository

1. Open https://github.com/new
2. Name: `prasar` · **Public** · do **not** add a README
3. Create repository, then from this project folder:

```bash
git init
git add .
git commit -m "Prasar — live Indian IPTV console"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prasar.git
git push -u origin main
```

### 3. Cloudflare account

1. Open https://dash.cloudflare.com/sign-up
2. Verify email. Skip “add a domain”. No payment method.

### 4. Connect the repo

1. Dashboard → **Workers & Pages**
   https://dash.cloudflare.com/?to=/:account/workers-and-pages
2. **Create** → **Workers** (or **Connect to Git**).
   In 2026 this is the default — it is correct.
3. Authorise GitHub, pick the `prasar` repo.

### 5. Build settings (copy exactly)

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Project name      | `prasar` (must match `name` in `wrangler.toml`)           |
| Production branch | `main`                                                    |
| Build command     | `npm run build`                                           |
| Deploy command    | _(leave default — Cloudflare runs `npx wrangler deploy`)_ |
| Root directory    | _(empty)_                                                 |

Environment variable:

| Name           | Value |
| -------------- | ----- |
| `NODE_VERSION` | `20`  |

Click **Save and Deploy**. Wait ~90 seconds.

`wrangler.toml` already tells Wrangler:

- Worker script = `worker.ts` (the `/proxy` stream relay)
- Static assets = `./dist` (the Vite app)

### 6. Open the URL

Cloudflare prints something like:

```
https://prasar.<account>.workers.dev
```

That is live. No login on the site.

---

## Path B — Wrangler CLI (no GitHub)

```bash
npm install
npx wrangler login
npm run build
npx wrangler deploy
```

---

## After it’s live

```bash
git add .
git commit -m "update"
git push
```

Cloudflare rebuilds automatically.

Settings → **Stream relay = Auto**. The Worker at `/proxy` only runs when a
channel blocks CORS, so you stay well under the free 100,000 Worker
requests/day.

Optional custom domain: project → **Custom domains** → add `tv.yourdomain.com`.
SSL is free.

---

## Checks

| Check                            | Expected                                             |
| -------------------------------- | ---------------------------------------------------- |
| Open the `workers.dev` URL       | Boot screen, then the channel index                  |
| `/proxy?url=https://example.com` | Relayed HTML, **not** a 404                          |
| Tune a channel                   | Player starts (Auto hops through `/proxy` if needed) |
| Star a channel, refresh          | Favourite still there                                |

---

## Troubleshooting

**Still “Missing entry-point…”**

- Confirm `wrangler.toml` contains `main = "worker.ts"` and `[assets]`
  `directory = "./dist"`. There must be **no** `pages_build_output_dir`.
- Confirm `worker.ts` is in the **repo root** (next to `package.json`).

**Build works, deploy fails “Could not resolve worker.ts”**

- The file was not committed. `git add worker.ts wrangler.toml && git push`.

**Name mismatch**

- Dashboard project name must equal `name` in `wrangler.toml`.

**Streams all fail**

- Open `/proxy?url=https://example.com`. If that 404s, the Worker is not bound.
- Settings → Stream relay → **Always**.

**`NODE_VERSION` errors**

- Set `NODE_VERSION=20` for Production **and** Preview.
