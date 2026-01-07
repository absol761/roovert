# Porkbun DNS Setup for roovert.com

## Step 1: Log In to Porkbun

1. Go to: **https://porkbun.com**
2. Click **"Log In"** (top right corner)
3. Enter your email and password
   - Use the email address that received the order confirmation
   - If you forgot your password, click "Forgot Password"

## Step 2: Access DNS Management

1. Once logged in, you'll see your dashboard
2. Find **"My Domains"** or **"Domain List"**
3. Click on **roovert.com**
4. Look for **"DNS"** or **"DNS Records"** tab/section
5. Click on it to view/edit DNS records

## Step 3: Add DNS Records for Vercel

You need to add these two records:

### Record 1: A Record (for roovert.com)

1. Click **"Add Record"** or **"Add DNS Record"**
2. Fill in:
   - **Type:** `A`
   - **Hostname:** `@` (or leave blank, or `roovert.com`)
   - **Answer:** `216.198.79.1`
   - **TTL:** `3600` (or leave as default)
3. Click **"Save"** or **"Add Record"**

### Record 2: CNAME Record (for www.roovert.com)

1. Click **"Add Record"** again
2. Fill in:
   - **Type:** `CNAME`
   - **Hostname:** `www`
   - **Answer:** `cname.vercel-dns.com`
   - **TTL:** `3600` (or leave as default)
3. Click **"Save"** or **"Add Record"**

## Step 4: Remove/Update Existing Records (if needed)

If you see any existing A records for `@` or `www`, you may need to:
- **Delete** the old ones, OR
- **Edit** them to match Vercel's values

**Important:** Make sure only ONE A record exists for `@` pointing to `216.198.79.1`

## Step 5: Verify and Wait

1. **Save all changes**
2. **Wait 5-60 minutes** for DNS propagation
3. **Check Vercel dashboard:**
   - Go to: https://vercel.com/dashboard
   - Select your **roovert** project
   - Go to **Settings** → **Domains**
   - Status should change from "Invalid Configuration" to "Valid Configuration"

## Step 6: Test Your Site

1. Visit: **https://roovert.com**
2. Your site should load!
3. Visit: **https://www.roovert.com** (should also work)

## Troubleshooting

**Still showing "Invalid Configuration" after 1 hour?**
- Double-check the A record value is exactly `216.198.79.1`
- Make sure hostname is `@` (not `roovert.com`)
- Verify you saved the changes
- Check if there are conflicting records

**Can't find DNS settings?**
- Look for tabs: "DNS", "DNS Records", "Name Servers", or "Advanced"
- Porkbun's interface may vary, but DNS settings are always accessible

**Need help?**
- Porkbun Support: support@porkbun.com
- Phone: 1.855.PORKBUN (1.855.767.5286)

---

**Once DNS propagates, your site will be live at https://roovert.com!** 🎉

