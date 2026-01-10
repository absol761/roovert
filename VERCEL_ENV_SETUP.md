# How to Set Environment Variables in Vercel

## Setting AI_GATEWAY_API_KEY

After the security fixes, you need to set the `AI_GATEWAY_API_KEY` environment variable in Vercel to protect the admin endpoint.

### Step-by-Step Instructions:

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in to your account

2. **Navigate to Your Project**
   - Click on your project: **roovert**
   - Or go directly to: `https://vercel.com/[your-username]/roovert`

3. **Open Settings**
   - Click on **Settings** tab (top navigation)
   - Click on **Environment Variables** in the left sidebar

4. **Add New Variable**
   - Click **Add New** button
   - **Key:** `AI_GATEWAY_API_KEY`
   - **Value:** Generate a secure random key (see below)
   - **Environment:** Select all environments (Production, Preview, Development)
   - Click **Save**

5. **Redeploy**
   - After adding the variable, go to **Deployments** tab
   - Click the **⋯** (three dots) on the latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger automatic deployment

### Generate a Secure Key

**Option 1: Using OpenSSL (Recommended)**
```bash
openssl rand -hex 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: Using PowerShell**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Option 4: Online Generator**
- Visit: https://randomkeygen.com/
- Use a "CodeIgniter Encryption Keys" (64 characters)

### Example:
```
Key: AI_GATEWAY_API_KEY
Value: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Using the Admin Endpoint

After setting the key, use it in API requests:

```bash
curl -H "x-admin-key: your-key-here" https://roovert.com/api/admin/visitors
```

Or in JavaScript:
```javascript
fetch('https://roovert.com/api/admin/visitors', {
  headers: {
    'x-admin-key': 'your-key-here'
  }
})
```

### Other Environment Variables

You may also need these (if not already set):

- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `KV_REST_API_URL` - Vercel KV URL (if using KV)
- `KV_REST_API_TOKEN` - Vercel KV token (if using KV)
- `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `https://roovert.com`)

### Security Notes

⚠️ **Important:**
- Never commit the `AI_GATEWAY_API_KEY` to git
- Use different keys for different environments if needed
- Rotate keys periodically
- Keep keys secure and don't share them publicly

### Troubleshooting

**Problem:** Admin endpoint returns 401 Unauthorized
- **Solution:** Make sure `ADMIN_API_KEY` is set in Vercel and you're using the correct key in the request header

**Problem:** Admin endpoint returns 503 Admin access not configured
- **Solution:** The `AI_GATEWAY_API_KEY` environment variable is not set in Vercel. Add it and redeploy.

**Problem:** Changes not taking effect
- **Solution:** After adding environment variables, you must redeploy the application for changes to take effect.
