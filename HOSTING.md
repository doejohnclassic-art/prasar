# Host Prasar for ₹0 — Cloudflare Pages (free forever)

You need **two free accounts**. Nothing is billed if you stay on the Free plan
(the defaults — never add a credit card).

| Account | What it does | Cost |
| --- | --- | --- |
| [GitHub](https://github.com/signup) | Stores the code | Free |
| [Cloudflare](https://dash.cloudflare.com/sign-up) | Builds, hosts, CDN, stream-relay Function | Free |

Public URL you will get: `https://prasar.pages.dev`  
(or `https://<your-project-name>.pages.dev`)

Estimated time: **12–15 minutes**.

---

## Path A — GitHub + dashboard (recommended)

No command line required after the first push.

### 1. Create a GitHub account

1. Open https://github.com/signup
2. Use any email. Verify it.
3. Skip paid plans — stay on **Free**.

### 2. Put this project in a GitHub repository

**If you already have the project on your computer:**

1. Open https://github.com/new
2. Repository name: `prasar`
3. Visibility: **Public** (required for the free Cloudflare Git integration
   without extra setup — private also works on the Cloudflare free plan)
4. Do **not** tick “Add a README”
5. Click **Create repository**
6. On your computer, in the project folder, run:

```bash
git init
git add .
git commit -m "Prasar — live Indian IPTV console"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prasar.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

**If git is not installed:** download Git from https://git-scm.com/downloads,
install it, then re-run the commands above from the project folder.

### 3. Create a Cloudflare account

1. Open https://dash.cloudflare.com/sign-up
2. Sign up with the same or another email. Verify it.
3. If Cloudflare asks you to “add a domain”, click **skip** / go to the
   dashboard home. You do **not** need a domain.
4. Never add a payment method.

### 4. Connect the repo to Cloudflare Pages

1. In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar
   (or open https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Click **Create** → **Pages** → **Connect to Git**
3. Authorise Cloudflare to read your GitHub account
   - Grant access to the `prasar` repository (or “All repositories”)
4. Select the `prasar` repository → **Begin setup**

### 5. Build settings (copy exactly)

| Field | Value |
| --- | --- |
| Project name | `prasar` (becomes `prasar.pages.dev`) |
| Production branch | `main` |
| Framework preset | **None** / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* |

Then open **Environment variables** → **Add variable**:

| Name | Value | Environment |
| --- | --- | --- |
| `NODE_VERSION` | `20` | Production **and** Preview |

Click **Save and Deploy**.

### 6. Wait ~90 seconds

Cloudflare will:

1. `npm install`
2. `npm run build` → produces `dist/index.html`
3. Publish the static site on the global CDN
4. Attach `functions/proxy.ts` as a free Pages Function at `/proxy`

When the build is **Success**, click the URL:

```
https://prasar.pages.dev
```

That is live. No signup on the site. No further cost.

### 7. Every future change

```bash
git add .
git commit -m "update"
git push
```

Cloudflare rebuilds automatically. Preview URLs are created for pull requests.

---

## Path B — Wrangler CLI (no GitHub)

Use this if you just want to upload `dist/` from your laptop.

```bash
npm install
npx wrangler login          # opens a browser, approve Cloudflare
npm run build
npx wrangler pages deploy dist --project-name prasar
```

Wrangler prints the live URL. Re-run the last two commands to update.

The `functions/` folder is picked up automatically from the project root
(see `wrangler.toml`).

---

## What stays free

Cloudflare Pages **Free** plan (as of 2026):

- Unlimited sites
- 500 builds / month (plenty — each `git push` is one build)
- Unlimited static bandwidth
- 100,000 Pages Function requests / day for the stream relay
- Custom domain (optional, later) at no extra charge

Prasar only calls the Function when a stream blocks CORS (Settings → Stream
relay = Auto). Direct playback does not count against the Function quota.

---

## Optional: a custom domain (still free)

1. Buy a domain anywhere, **or** use a domain you already own
2. Cloudflare dashboard → **Workers & Pages** → `prasar` → **Custom domains**
3. Add `tv.yourdomain.com`
4. Cloudflare will tell you the CNAME to set. If the domain is already on
   Cloudflare DNS, this is one click.

No SSL fee — Cloudflare issues the certificate automatically.

---

## Checks after deploy

| Check | Expected |
| --- | --- |
| Open `https://prasar.pages.dev` | Boot screen, then the channel index |
| Open Settings (sliders icon) | Dark/light, relay Auto/Off/Always |
| Tune a channel | Player starts, or Auto hops through `/proxy` |
| Open `https://prasar.pages.dev/proxy?url=https://example.com` | Relayed response (not a 404) |
| Star a channel, refresh | Favourite still there (localStorage) |

If `/proxy` 404s, the Function did not bind — confirm `functions/proxy.ts`
is in the **repository root** (not inside `dist/`) and rebuild.

---

## What you should **not** use

| Host | Why not |
| --- | --- |
| GitHub Pages | No server Function → CORS relay cannot run |
| Netlify / Vercel free | Fine for static, but this project is already wired for Cloudflare Functions |
| A VPS | Costs money; not needed |

---

## Troubleshooting

**Build fails with `error vite`**
- Confirm `NODE_VERSION=20` is set for Production.

**Site loads but every stream errors**
- Settings → Stream relay → **Always**. The Function must be live
  (`/proxy?url=https://example.com` should not 404).

**`npm: command not found` during build**
- You set the build command wrong. It must be `npm run build`.

**Git push rejected**
- `git pull --rebase origin main` then `git push`.
