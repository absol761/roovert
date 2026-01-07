# Deployment Guide

## 🚀 Deploy to Vercel (Recommended)

Vercel is the recommended platform for Next.js applications. It provides:
- Automatic deployments from GitHub
- Zero-configuration setup
- Global CDN
- SSL certificates
- Environment variable management

### Step 1: Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **"Add New Project"**
3. Import your repository: `absol761/roovert`
4. Vercel will automatically detect it's a Next.js project

### Step 2: Configure Environment Variables

In the Vercel project settings, add any required environment variables:

- `NEXT_PUBLIC_API_URL` (if you have an API)
- `NEXT_PUBLIC_APP_URL` (your production URL)

**Note:** Never commit actual secrets. Use Vercel's environment variable dashboard.

### Step 3: Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy your site automatically
3. Your site will be live at: `https://roovert.vercel.app` (or your custom domain)

### Step 4: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `roovert.com`)
3. Follow DNS configuration instructions

## 🔄 Automatic Deployments

Once connected, Vercel will automatically deploy:
- Every push to `main` branch → Production
- Pull requests → Preview deployments

## 📊 Other Deployment Options

### Netlify

1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in Netlify dashboard

### Self-Hosting

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔒 Security Checklist for Production

- [x] Environment variables configured in deployment platform
- [x] `.env.local` never committed to git
- [x] Security headers configured in `next.config.ts`
- [x] Source maps disabled in production
- [x] HTTPS enabled (automatic on Vercel/Netlify)
- [ ] Custom domain configured (if applicable)
- [ ] Analytics configured (if needed)

## 📝 Post-Deployment

After deployment, verify:
1. Site loads correctly
2. All interactive features work
3. Security headers are present (check with [SecurityHeaders.com](https://securityheaders.com))
4. Environment variables are set correctly

---

**Your site is now live!** 🎉

