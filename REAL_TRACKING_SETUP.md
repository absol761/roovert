# How to Enable Real User Tracking

To track **actual unique visitors** persistently, you need to connect a database (Vercel KV). Otherwise, the count resets on every deployment or falls back to a simulation.

## Step 1: Create Vercel KV Database
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click on the **Storage** tab (at the top, or inside your project).
3. Click **Create Database**.
4. Select **KV** (Redis).
5. Give it a name (e.g., `roovert-kv`) and region (use the same region as your app, e.g., Washington/iad1).
6. Click **Create**.

## Step 2: Connect to Your Project
1. Once created, go to your **roovert** project settings.
2. Go to **Storage**.
3. Click **Connect Database** and select the KV database you just created.
4. **Important:** This automatically adds the necessary environment variables (`KV_REST_API_URL`, etc.) to your project.

## Step 3: Redeploy
1. Go to **Deployments**.
2. **Redeploy** your latest commit.

## Verification
Once connected and redeployed:
- The "Unique Minds" count will start at 0 (or whatever initial value is set) and increment by exactly 1 for every *new* device that visits the site.
- It will persist forever, even after updates.

