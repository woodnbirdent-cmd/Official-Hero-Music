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
| `DATABASE_URL` | Neon Postgres connection string (pooled). New account. |
| `BETTER_AUTH_SECRET` | Session secret. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Production site URL, e.g. `https://officialheromusic.com`. Leave unset on Preview. |
| `STRIPE_SECRET_KEY` | Stripe server key. Already set in Vercel. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /api/stripe/webhook` |
| `SHIPPO_API_TOKEN` | Live merch rates and paid-order sync. Already set in Vercel. VIP checkout skips live rates. |
| `ADMIN_EMAILS` | Comma-separated emails allowed to open `/admin`. Set to `woodnbirdent@gmail.com,hero@officialheromusic.com`. Everyone else is denied. |
| `RESEND_API_KEY` | Sends admin magic-link sign-in email. |
| `ADMIN_EMAIL_FROM` | From address for that email. The domain must be verified in Resend. |

Membership tables are created on the first account request. Paid plans use inline Stripe prices ($7 and $15 monthly), so no Price IDs are required. Enable the Stripe customer portal once in the Dashboard so “Manage billing” can open.

`/admin` is limited to `ADMIN_EMAILS`. Sign in at `/admin/sign-in` with an email magic link (Resend) or the password on an allowlisted account that already exists. New sign-ups cannot claim an admin email. The orders and customers pages read paid Stripe Checkout sessions (cached about a minute): merch, feature-verse Payment Links, and playlist submissions. Times are America/Chicago. Those pages do not refund or edit Stripe. Merch fulfilled and archived flags are saved in Postgres. A paid merch checkout creates a Shippo order so the label can be bought in the Shippo dashboard. `/admin` sends `noindex` and is omitted from `robots.txt` and the sitemap.

The Stripe webhook at `POST /api/stripe/webhook` needs `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `checkout.session.completed`.

Forms (Join, Booking, Prayer, Merch waitlist) use server actions and show lasting success UI. Submissions are logged server-side in MVP (swap for Formspree/DB/email later).

## Pages / routes

| Route | Page |
|-------|------|
| `/` | Home |
| `/music` | Spotify + Apple embeds |
| `/videos` | YouTube embeds |
| `/merch` | Shop coming soon + waitlist |
| `/community` | Give-back / testimony / prayer form |
| `/join` | Membership tiers and mailing list (`/support` redirects here) |
| `/members` | Member updates, early access, VIP downloads |
| `/account` | Current plan and billing |
| `/admin` | Private dashboard for `ADMIN_EMAILS` |
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
