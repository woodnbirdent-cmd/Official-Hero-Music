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
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob for unreleased audio. Set by connecting a **private** Blob store. `BLOB_STORE_ID` also works on Vercel via OIDC. |
| `ADMIN_EMAILS` | Comma-separated emails allowed to open `/admin`. Set to `woodnbirdent@gmail.com,hero@officialheromusic.com`. Everyone else is denied. |
| `RESEND_API_KEY` | Sends admin magic-link sign-in email. |
| `ADMIN_EMAIL_FROM` | From address for that email. The domain must be verified in Resend. |

Membership tables are created on the first account request. Paid plans use inline Stripe prices ($7 and $15 monthly), so no Price IDs are required. Enable the Stripe customer portal once in the Dashboard so “Manage billing” can open.

Unreleased tracks (Listen, Still There) are listed on `/members/early-access`. Supporter and VIP stream them from `GET /api/stream/[trackId]`. The MP3s are not in git. Upload them at `/admin/unreleased` after a private Blob store is connected. Free members see an upgrade link to `/join`. Signed-out and free requests to the stream route get 401 and 403.

`/admin` is limited to `ADMIN_EMAILS`, checked on the server against the database email for every admin page, export, and action. Sign in at `/admin/sign-in`. Magic links expire in 5 minutes, are single-use, and are stored hashed. Password sign-in uses the same generic error for every failure. Admin sessions must be newer than 8 hours. A password is optional. After signing in, each admin can set or change their own password at `/admin/password`. Setting or changing it requires that same 8-hour session (sign in again with an email link when it is older), a same-origin request, and at least 12 characters. Changing a password also requires the current one. Common passwords are rejected, and breached passwords are rejected when the Have I Been Pwned range check answers. Other sessions are revoked after a successful change. Canceling a Stripe subscription or deleting a Stripe customer requires a sign-in from the last 15 minutes plus a typed confirmation, and neither happens unless that confirmation is present. `/admin` sends `noindex`, `no-store`, and is omitted from `robots.txt` and the sitemap.

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
