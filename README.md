# Official #Hero Music

Fan hub for **#Hero** (Christopher James Killion) — Christian hip-hop / Yahfamilia — at [officialheromusic.com](https://officialheromusic.com).

Dark black/white graffiti aesthetic. Next.js App Router + TypeScript + Tailwind.

## Local run

```bash
cd Official-Hero-Music
cp .env.example .env.local   # optional for now
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

## Environment

See `.env.example`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `STRIPE_SECRET_KEY` | **TODO** — Stripe server key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **TODO** — Stripe publishable key |
| `STRIPE_PRICE_SUPPORT` | **TODO** — $7/mo Support price ID |
| `STRIPE_PRICE_INNER_CIRCLE` | **TODO** — $25/mo Inner Circle price ID |
| `STRIPE_WEBHOOK_SECRET` | **TODO** — webhook signing |

Paid Support / Inner Circle buttons are stubbed with clear TODOs until Stripe is wired.

Forms (Join, Booking, Prayer, Merch waitlist) use server actions and show lasting success UI. Submissions are logged server-side in MVP (swap for Formspree/DB/email later).

## Pages / routes

| Route | Page |
|-------|------|
| `/` | Home |
| `/music` | Spotify + Apple embeds |
| `/videos` | YouTube embeds |
| `/merch` | Shop coming soon + waitlist |
| `/community` | Give-back / testimony / prayer form |
| `/support` | Free / Support $7 / Inner Circle $25 |
| `/join` | Mailing list |
| `/booking` | Booking form |

PWA: `manifest.webmanifest` + icons in `/public`.

## Deploy on Vercel

1. Push this project to a **private** GitHub repo (do not use Adobe Portfolio).
2. Import the repo in [Vercel](https://vercel.com) → Framework Preset: Next.js.
3. Add env vars from `.env.example` as needed.
4. Deploy. Note the `*.vercel.app` URL.

### Point officialheromusic.com DNS to Vercel

In Vercel: Project → Settings → Domains → add `officialheromusic.com` and `www.officialheromusic.com`.

At your DNS provider:

| Type | Name | Value |
|------|------|-------|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

Wait for DNS propagation, then verify both domains in Vercel.

## Brand

Assets live in `public/` (logo-hero, logo-mark, logo-full, site-logo, og, favicon, photo-1, photo-2).

Artist: **#Hero** / Christopher James Killion · Jefferson City, MO · Yahfamilia.

## License

All rights reserved. Music and likeness © #Hero / YahFamilia Music.
