# API Key Setup

To enable real AI responses on your site, you need to add your OpenRouter API key to Vercel.

## 1. Get Your API Key
You already have your key: `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`

## 2. Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **roovert** project
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Key:** `OPENROUTER_API_KEY`
   - **Value:** `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`
5. Click **Save**

## 3. Redeploy
For the environment variable to take effect, you might need to redeploy:
1. Go to **Deployments**
2. Click the three dots next to your latest deployment
3. Click **Redeploy**

## Local Development
I have automatically created a `.env.local` file on your computer with this key, so it works locally. This file is **ignored by Git** for security.

## Security Note
**Never commit this file or your key to GitHub.** If you accidentally leak your key, go to OpenRouter and regenerate it immediately.

