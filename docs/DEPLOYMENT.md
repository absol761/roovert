# Deployment Guide

This guide covers deploying Roovert to production: environment variables, deploying to Vercel (dashboard or CLI), verifying the deploy, and alternative hosting options.

For pointing a custom domain (e.g. `roovert.com`) at your deployment, see [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md). For enabling persistent visitor tracking via Vercel KV, see [REAL_TRACKING_SETUP.md](./REAL_TRACKING_SETUP.md).

## Prerequisites

- Node.js 18 or higher
- A GitHub repository containing your Roovert code (Vercel deploys from Git)
- A [Vercel](https://vercel.com) account (free tier is sufficient to start)

## Environment Variables

Set these in your deployment platform's dashboard (never commit them to git). This list matches `.env.example` in the repo root.

### Required in production

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq API key for the default (Ooverta) chat model. Without it, `/api/query-gateway` returns a graceful error to users instead of a response. |

### Optional

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your deployed site URL, used for OpenRouter's `HTTP-Referer` header and page metadata. Falls back to `https://roovert.com` if unset. |
| `ADMIN_API_KEY` | Admin key required to call `/api/admin/visitors`. If unset, that endpoint returns `503` rather than serving data unauthenticated. `AI_GATEWAY_API_KEY` is accepted as a fallback name for the same purpose, kept only for backward compatibility — prefer `ADMIN_API_KEY` for new setups. |
| `OPENROUTER_API_KEY` | Enables the OpenRouter multi-provider model picker. |
| `HUGGINGFACE_API_KEY` | Enables the Hugging Face model picker entries (Qwen, DeepSeek, Phi-4, Kimi, GPT-OSS) and image generation. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Visitor tracking storage (Vercel KV / Upstash Redis REST API). Falls back to local SQLite if unset — see [REAL_TRACKING_SETUP.md](./REAL_TRACKING_SETUP.md). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared rate-limit storage, checked before the `KV_REST_API_*` pair. Required for multi-instance production deployments — without it, rate limiting falls back to a per-instance in-memory store that isn't shared across serverless instances. |
| `NEXT_PUBLIC_SEGMENT_WRITE_KEY` | Segment.io write key for anonymous analytics. Get one from [app.segment.com](https://app.segment.com/). If unset, analytics is silently disabled — no warning is shown in production. |

**Note:** `KV_REST_API_URL`/`TOKEN` and `UPSTASH_REDIS_REST_URL`/`TOKEN` can point at the *same* Upstash database — Vercel KV is Upstash Redis under the hood, and the app checks the Upstash-named variables first, falling back to the KV-named ones. If you provision storage via the Vercel KV integration, it sets the `KV_REST_API_*` pair automatically, which is sufficient for both tracking and rate limiting.

Generate an admin key with:

```bash
openssl rand -hex 32
```

## Deploy to Vercel

Vercel is the recommended platform for Next.js apps: automatic Git deploys, zero-config builds, a global CDN, managed SSL, and an environment variable dashboard.

### Option A: Vercel Dashboard (recommended)

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
3. Click **Add New...** → **Project** → **Import Git Repository**, and select your repository.
4. Vercel auto-detects the Next.js framework preset. Confirm:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
5. Under **Environment Variables**, add the variables from the table above (at minimum `GROQ_API_KEY`).
6. Click **Deploy** and wait for the build to complete (typically 2-3 minutes).
7. Your app is live at `https://<your-project>.vercel.app`.

### Option B: Vercel CLI

```bash
# Install the CLI
npm i -g vercel

# Log in
vercel login

# Deploy from the project directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No (or Yes, if re-deploying)
# - Project name? roovert
# - Directory? ./
# - Override settings? No
```

Environment variables set via the CLI (`vercel env add`) or the dashboard are equivalent; either way you must **redeploy** after adding or changing a variable for it to take effect.

### Automatic Deployments

Once the repository is connected, Vercel deploys automatically:
- Every push to `main` → Production deployment
- Every pull request → Preview deployment

## Post-Deployment Verification

1. Visit your deployment URL and confirm the site loads.
2. Send a test query and confirm streaming responses work (requires `GROQ_API_KEY`).
3. If you set `ADMIN_API_KEY`, confirm the admin endpoint works:
   ```bash
   curl -H "x-admin-key: your-key-here" https://your-deployment-url/api/admin/visitors
   ```
   and that it returns `401` without the header, not visitor data.
4. Check security headers are present, e.g. via [SecurityHeaders.com](https://securityheaders.com) — see [SECURITY.md](./SECURITY.md) for what's currently configured.
5. If applicable, follow [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md) to point your custom domain at the deployment.

## Security Checklist for Production

- [x] Environment variables configured in the deployment platform, not in git
- [x] `.env.local` never committed (it's git-ignored)
- [x] Security headers configured in `next.config.ts`
- [x] Source maps disabled in production (`productionBrowserSourceMaps: false`)
- [x] HTTPS enabled (automatic on Vercel)
- [ ] `ADMIN_API_KEY` set to a strong, random value if the admin endpoint is in use
- [ ] `UPSTASH_REDIS_REST_URL`/`TOKEN` set if running multiple instances (otherwise rate limiting isn't shared across them)
- [ ] Custom domain configured (if applicable)
- [ ] Analytics configured (if needed)

## Alternative Deployment Options

### Netlify

1. Connect your GitHub repository.
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add the same environment variables in the Netlify dashboard.

Note: the rest of this repo's docs (custom domain, security notes) are written with Vercel specifics (e.g. `cname.vercel-dns.com`); adjust accordingly for other platforms.

### Self-Hosting

```bash
# Build the application
npm run build

# Start the production server
npm start
```

You are responsible for TLS termination, process management, and setting the same environment variables in your host's environment.

## Troubleshooting

**Build fails:**
- Check the build logs in the Vercel dashboard.
- Ensure all dependencies are listed in `package.json`.
- Verify `next.config.ts` is valid.

**Admin endpoint returns 503 ("Admin access not configured"):**
- `ADMIN_API_KEY` (or the legacy `AI_GATEWAY_API_KEY`) isn't set in the deployment environment. Add it and redeploy.

**Admin endpoint returns 401 Unauthorized:**
- The `x-admin-key` request header doesn't match the configured key. Double-check you're sending the exact value you set.

**Environment variable changes don't seem to take effect:**
- Redeploy after adding or changing environment variables — Vercel does not hot-reload them into a running deployment.

**Chat responses fail immediately:**
- `GROQ_API_KEY` is missing or invalid. Check the function logs in the Vercel dashboard.
