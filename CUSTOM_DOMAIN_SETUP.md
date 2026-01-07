# Custom Domain Setup: roovert.com

## Quick Steps to Connect roovert.com to Vercel

Your site is currently live at `https://roovert.vercel.app` (Vercel's free subdomain). To use your custom domain `roovert.com`:

### Step 1: Add Domain in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **roovert** project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `roovert.com`
6. Click **Add**

### Step 2: Configure DNS Records

Vercel will show you the exact DNS records needed. Here's what you'll typically configure:

#### At Your Domain Registrar (where you bought roovert.com):

**For the root domain (roovert.com):**

**Option 1: A Record (if your registrar supports it)**
```
Type: A
Name: @ (or leave blank)
Value: [IP address from Vercel - usually 76.76.21.21]
TTL: 3600 (or Auto)
```

**Option 2: CNAME Record (Recommended)**
```
Type: CNAME
Name: @ (or leave blank, or roovert.com)
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

**For www subdomain (www.roovert.com):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

### Step 3: Wait for DNS Propagation

- DNS changes typically take 5 minutes to 48 hours
- Usually works within 1-2 hours
- Vercel dashboard will show "Valid Configuration" when ready
- SSL certificate is automatically provisioned (can take a few minutes)

### Step 4: Verify

1. Check Vercel dashboard - domain should show "Valid Configuration"
2. Visit `https://roovert.com` - should load your site
3. Visit `https://www.roovert.com` - should also work
4. Check SSL certificate (green padlock in browser)

### Common Domain Registrars

**Namecheap:**
- Go to Domain List → Manage → Advanced DNS
- Add the records shown in Vercel

**GoDaddy:**
- Go to DNS Management
- Add the records shown in Vercel

**Google Domains:**
- Go to DNS → Custom records
- Add the records shown in Vercel

**Cloudflare:**
- Go to DNS → Records
- Add the records shown in Vercel
- Set Proxy status to "DNS only" (gray cloud) initially

### Troubleshooting

**Domain not working after 24 hours?**
- Double-check DNS records match exactly what Vercel shows
- Use [dnschecker.org](https://dnschecker.org) to verify DNS propagation globally
- Make sure you're using the exact values from Vercel dashboard

**SSL certificate issues?**
- Wait 5-10 minutes after DNS is configured
- Vercel automatically provisions SSL certificates
- If issues persist, contact Vercel support

**Both domains work?**
- Yes! Your site will work on both `roovert.vercel.app` AND `roovert.com`
- Vercel automatically handles redirects

### Need Help?

- Vercel Docs: [vercel.com/docs/concepts/projects/domains](https://vercel.com/docs/concepts/projects/domains)
- Vercel Support: Available in dashboard

---

**Once configured, your site will be live at `https://roovert.com`!** 🎉

