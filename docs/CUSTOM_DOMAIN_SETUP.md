# Custom Domain Setup

This guide walks through pointing a custom domain (e.g. `roovert.com`) at your Vercel deployment: adding the domain in Vercel, finding your registrar, configuring DNS records (general instructions plus a Porkbun-specific walkthrough), and troubleshooting.

Assumes you've already deployed the app — see [DEPLOYMENT.md](./DEPLOYMENT.md) if not.

## Overview

Your site is live at `https://<your-project>.vercel.app` as soon as you deploy. To also serve it from your own domain:

1. Add the domain in the Vercel dashboard.
2. Add the DNS records Vercel gives you at your domain registrar.
3. Wait for DNS to propagate and for Vercel to provision SSL.

Both the `vercel.app` subdomain and your custom domain keep working afterward — Vercel doesn't disable one for the other.

## Step 1: Add the Domain in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) and select your project.
2. Go to **Settings** → **Domains**.
3. Click **Add Domain**, enter your domain (e.g. `roovert.com`), and click **Add**.
4. Vercel shows the exact DNS records it expects. **Always use the values shown in your own dashboard** — Vercel's IP addresses can change over time; the values below are current as a reference but the dashboard is the source of truth.

## Step 2: The DNS Records You'll Add

Typically two records, at whichever registrar/DNS provider manages your domain:

**Root/apex domain** (`roovert.com`):
```
Type:  A
Name:  @  (or blank, or the bare domain — conventions vary by registrar)
Value: 216.198.79.1
TTL:   3600 (or Auto)
```
Some registrars instead support a `CNAME`/`ALIAS`/`ANAME` record at the apex — if so, Vercel's dashboard will offer:
```
Type:  CNAME  (or ALIAS/ANAME, registrar-dependent)
Name:  @
Value: cname.vercel-dns.com
```

**`www` subdomain** (`www.roovert.com`):
```
Type:  CNAME
Name:  www
Value: cname.vercel-dns.com
TTL:   3600 (or Auto)
```

Only add the `www` record if you want `www.roovert.com` to work too — Vercel's dashboard will confirm which domains are configured.

## Step 3: Find Your Registrar

If you don't remember where the domain is registered:

- **Search your email** for "domain registration", "domain receipt", or the domain name itself — registrars send purchase confirmations and renewal reminders.
- **Check payment records** (credit card / PayPal statements) for a charge from a registrar around the time you bought the domain.
- **Run a WHOIS lookup**: visit [whois.net](https://whois.net) or [whois.com](https://whois.com), enter the domain, and check the "Registrar" field. This is the most reliable method if the other two come up empty.
- **Try common registrars directly** if you have a vague memory of which one: Namecheap, GoDaddy, Google Domains, Cloudflare, Name.com, Domain.com, Hover, Porkbun.

If you can't recover login access, use each registrar's "Forgot Password" flow with the email you likely used, or contact their support with proof of domain ownership (WHOIS record, payment receipt).

## Step 4: Add the Records at Your Registrar

General pattern everywhere: log in → find the domain → find "DNS", "DNS Management", or "Advanced DNS" → add records.

### Namecheap
1. **Domain List** → **Manage** next to your domain → **Advanced DNS** tab.
2. **Add New Record**.
3. Root: Type `A Record`, Host `@`, Value `216.198.79.1`, TTL `Automatic`.
4. `www`: Type `CNAME Record`, Host `www`, Value `cname.vercel-dns.com`, TTL `Automatic`.

### GoDaddy
1. **My Products** → **DNS** next to your domain → **Records** section → **Add**.
2. Root: Type `A`, Name `@`, Value `216.198.79.1`, TTL `1 hour`.
3. `www`: Type `CNAME`, Name `www`, Value `cname.vercel-dns.com`, TTL `1 hour`.

### Google Domains
1. Select the domain → **DNS** → **Custom resource records** → **Manage custom records**.
2. Root: Type `A`, Name `@`, Data `216.198.79.1`, TTL `3600`.
3. `www`: Type `CNAME`, Name `www`, Data `cname.vercel-dns.com`, TTL `3600`.

### Cloudflare
1. Select the domain → **DNS** → **Records**.
2. Root: Type `A`, Name `@`, IPv4 address `216.198.79.1`, **Proxy status: DNS only** (gray cloud).
3. `www`: Type `CNAME`, Name `www`, Target `cname.vercel-dns.com`, **Proxy status: DNS only** (gray cloud).
4. Keep the proxy (orange cloud) off initially — an active Cloudflare proxy in front of Vercel's own edge/SSL provisioning can interfere with domain verification. You can turn it on afterward once the domain shows "Valid Configuration" in Vercel, if you want Cloudflare's CDN/WAF in front.

### Porkbun

Porkbun's UI differs enough from the others that it's worth spelling out.

1. **Log in** at [porkbun.com](https://porkbun.com) (top-right **Log In**), using the email that received your order confirmation.
2. From the dashboard, find **My Domains** / **Domain List** and **click directly on the domain name** (not a settings icon) — this opens the domain's detail page.
3. On the detail page, look for a **DNS** or **DNS Records** tab/link. If it's not immediately visible, check for a gear icon (⚙️) next to the domain with a dropdown that includes a DNS option.
4. In DNS Records, click **Add Record** (or **Add DNS Record**) and add:
   - **Root A record:** Type `A`, Hostname `@` (or blank, or the bare domain), Answer `216.198.79.1`, TTL `3600` (or default) → **Save**.
   - **`www` CNAME record:** Type `CNAME`, Hostname `www`, Answer `cname.vercel-dns.com`, TTL `3600` (or default) → **Save**.
5. If Porkbun already has a default record for `@` (often a parking-page CNAME or ALIAS), delete or edit it — see the conflict troubleshooting below, since DNS doesn't allow both a CNAME/ALIAS and an A record on the same hostname.
6. Confirm you end up with exactly one record for `@` and one `CNAME` for `www`.

Porkbun support: support@porkbun.com, or 1.855.PORKBUN (1.855.767.5286).

### Any Other Registrar

The pattern is the same everywhere:
1. Find the DNS / DNS Management / Name Servers section.
2. Add an `A` record: `@` → `216.198.79.1` (or the CNAME/ALIAS Vercel's dashboard shows, if your registrar supports apex CNAMEs).
3. Add a `CNAME` record: `www` → `cname.vercel-dns.com`.
4. Save.

## Step 5: Wait for Propagation and Verify

1. DNS changes typically take 5 minutes to a few hours to propagate, and can take up to 48 hours in rare cases.
2. Check the Vercel dashboard (**Settings** → **Domains**) — status moves from "Invalid Configuration" to "Valid Configuration" once your records are visible.
3. Optionally check global propagation directly: visit [dnschecker.org](https://dnschecker.org), enter your domain, select the record type (`A` or `CNAME`), and confirm the value matches what you set.
4. Once valid, Vercel automatically provisions an SSL certificate (usually within a few minutes).
5. Visit `https://<your-domain>` and `https://www.<your-domain>` (if configured) and confirm both load with a valid certificate (padlock in the browser).

## Troubleshooting

**Still "Invalid Configuration" after an hour or more:**
- Double-check the record value matches *exactly* what Vercel's dashboard currently shows (values can change; don't rely solely on the examples in this doc).
- Confirm the hostname/name field is `@` (or blank) for the root record, not the full domain name or something else.
- Confirm you actually saved the change at the registrar — some UIs require a separate "Save"/confirm step per record.
- Clear your browser cache and re-check the Vercel dashboard.

**Error: "CNAME or ALIAS record already exists" (common on Porkbun and similar registrars):**
- DNS doesn't allow a CNAME/ALIAS and an A record on the same hostname simultaneously. Find the existing CNAME/ALIAS record for `@` (or blank/bare domain) in your DNS records list and delete it first, then add the `A` record.
- If an `A` record for `@` already exists instead, don't add a duplicate — edit the existing one to point to `216.198.79.1`.
- If you see multiple `A` records for `@`, delete all but one and set that one to the correct value.
- After setup, your records should look like:
  ```
  Type    Hostname    Answer
  A       @           216.198.79.1
  CNAME   www         cname.vercel-dns.com
  ```

**Site not loading after DNS shows "Valid Configuration":**
- Give SSL provisioning a few extra minutes — it happens automatically but isn't always instant.
- Re-check with [dnschecker.org](https://dnschecker.org) that the record has actually propagated to public resolvers, not just your own ISP.

**Need more help:**
- Vercel's domain docs: [vercel.com/docs/concepts/projects/domains](https://vercel.com/docs/concepts/projects/domains)
- Vercel support is available from within the dashboard.
- Porkbun support: support@porkbun.com / 1.855.PORKBUN.
