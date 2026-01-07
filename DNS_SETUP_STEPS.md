# DNS Setup Steps for roovert.com

## Current Status
- ✅ Domain added to Vercel
- ❌ DNS records not configured yet
- ⏳ Waiting for DNS configuration

## Required DNS Records

### For roovert.com (root domain):
```
Type: A
Name: @ (or leave blank)
Value: 216.198.79.1
TTL: 3600 (or Auto)
```

### For www.roovert.com:
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

## Step-by-Step by Registrar

### Namecheap
1. Log in to Namecheap
2. Go to **Domain List**
3. Click **Manage** next to roovert.com
4. Go to **Advanced DNS** tab
5. Click **Add New Record**
6. For root domain:
   - Type: **A Record**
   - Host: **@**
   - Value: **216.198.79.1**
   - TTL: **Automatic**
   - Click **Save**
7. For www:
   - Type: **CNAME Record**
   - Host: **www**
   - Value: **cname.vercel-dns.com**
   - TTL: **Automatic**
   - Click **Save**

### GoDaddy
1. Log in to GoDaddy
2. Go to **My Products**
3. Click **DNS** next to roovert.com
4. Scroll to **Records** section
5. Click **Add** button
6. For root domain:
   - Type: **A**
   - Name: **@**
   - Value: **216.198.79.1**
   - TTL: **1 hour**
   - Click **Save**
7. For www:
   - Type: **CNAME**
   - Name: **www**
   - Value: **cname.vercel-dns.com**
   - TTL: **1 hour**
   - Click **Save**

### Google Domains
1. Log in to Google Domains
2. Click on **roovert.com**
3. Go to **DNS** in left sidebar
4. Scroll to **Custom resource records**
5. Click **Manage custom records**
6. For root domain:
   - Type: **A**
   - Name: **@**
   - Data: **216.198.79.1**
   - TTL: **3600**
   - Click **Add**
7. For www:
   - Type: **CNAME**
   - Name: **www**
   - Data: **cname.vercel-dns.com**
   - TTL: **3600**
   - Click **Add**

### Cloudflare
1. Log in to Cloudflare
2. Select **roovert.com** domain
3. Go to **DNS** → **Records**
4. For root domain:
   - Type: **A**
   - Name: **@**
   - IPv4 address: **216.198.79.1**
   - Proxy status: **DNS only** (gray cloud)
   - Click **Save**
5. For www:
   - Type: **CNAME**
   - Name: **www**
   - Target: **cname.vercel-dns.com**
   - Proxy status: **DNS only** (gray cloud)
   - Click **Save**

### Other Registrars
The process is similar:
1. Find DNS/DNS Management/Name Servers section
2. Add A record: `@` → `216.198.79.1`
3. Add CNAME record: `www` → `cname.vercel-dns.com`
4. Save changes

## After Adding Records

1. **Wait 5-60 minutes** for DNS propagation
2. **Check Vercel dashboard** - status should change from "Invalid Configuration" to "Valid Configuration"
3. **Visit https://roovert.com** - should load your site
4. **SSL certificate** will be automatically provisioned (may take a few more minutes)

## Verify DNS Propagation

You can check if DNS has propagated globally:
- Visit: https://dnschecker.org
- Enter: `roovert.com`
- Select: **A Record**
- Check if `216.198.79.1` appears in results

## Troubleshooting

**Still showing "Invalid Configuration" after 1 hour?**
- Double-check the A record value is exactly `216.198.79.1`
- Make sure the record name is `@` (not `roovert.com` or blank)
- Verify you saved the changes at your registrar
- Clear your browser cache and refresh Vercel dashboard

**Site not loading?**
- Wait a bit longer (DNS can take up to 48 hours, but usually much faster)
- Check DNS propagation with dnschecker.org
- Make sure SSL certificate has been provisioned (Vercel does this automatically)

---

**Once Vercel shows "Valid Configuration", your site will be live at https://roovert.com!** 🎉

