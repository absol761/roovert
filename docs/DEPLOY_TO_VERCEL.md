# Deploy to Vercel

Your code has been pushed to GitHub. Follow these steps to deploy to Vercel:

## Quick Deploy (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub (or create an account)

2. **Import Project**
   - Click **"Add New..."** → **"Project"**
   - Select **"Import Git Repository"**
   - Find and select your `roovert` repository
   - Click **"Import"**

3. **Configure Project**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `roovert` (if your repo has nested structure)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

4. **Set Environment Variables** (if needed)
   - Go to **Settings** → **Environment Variables**
   - Add any required variables:
     - `AI_GATEWAY_API_KEY` (if using admin features)
     - `KV_REST_API_URL` (if using Vercel KV)
     - `KV_REST_API_TOKEN` (if using Vercel KV)

5. **Deploy**
   - Click **"Deploy"**
   - Wait for build to complete (~2-3 minutes)
   - Your app will be live at `https://your-project.vercel.app`

## Alternative: Vercel CLI

If you prefer using the CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd roovert
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? roovert
# - Directory? ./roovert
# - Override settings? No
```

## Post-Deployment

1. **Check Build Logs**
   - Go to your project dashboard
   - Check the **Deployments** tab for build status

2. **Test Your App**
   - Visit your deployment URL
   - Test the visualizer by clicking the Sparkles icon
   - Verify the config panel opens with the Square icon

3. **Set Custom Domain** (Optional)
   - Go to **Settings** → **Domains**
   - Add your custom domain
   - Follow DNS configuration instructions

## Troubleshooting

**Build fails:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify `next.config.ts` is correct

**Visualizer not working:**
- Check browser console for errors
- Ensure R3F dependencies are installed
- Verify webpack config is working

**Environment variables:**
- Make sure to set all required env vars in Vercel dashboard
- Redeploy after adding new variables

## Automatic Deployments

Once connected, every push to your `main` branch will automatically trigger a new deployment on Vercel!
