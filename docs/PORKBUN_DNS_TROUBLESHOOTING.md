# Porkbun DNS Troubleshooting: "CNAME or ALIAS record already exists"

## The Problem

You're seeing this error because:
- There's already a **CNAME** or **ALIAS** record for `@` (root domain)
- DNS doesn't allow both CNAME and A records for the same hostname
- You need to **delete** the existing CNAME/ALIAS before adding the A record

## Solution: Delete the Conflicting Record First

### Step 1: Find the Existing Record

1. In Porkbun DNS settings, look at your current DNS records
2. Find any record with:
   - **Hostname:** `@` (or blank, or `roovert.com`)
   - **Type:** `CNAME` or `ALIAS`
3. Note what it says (you might need to delete it)

### Step 2: Delete the Conflicting Record

1. Find the CNAME/ALIAS record for `@`
2. Click **Delete** or **Remove** (usually a trash icon or X button)
3. Confirm deletion

### Step 3: Add the A Record

Now you can add the A record:
- **Type:** `A`
- **Hostname:** `@`
- **Answer:** `216.198.79.1`
- **TTL:** `600` (or `3600`)
- Click **Save**

### Step 4: Add the CNAME for www

Add the CNAME for www subdomain:
- **Type:** `CNAME`
- **Hostname:** `www`
- **Answer:** `cname.vercel-dns.com`
- **TTL:** `600` (or `3600`)
- Click **Save**

## Alternative: Edit Existing Record

If you see an **A record** already exists for `@`:
- Don't add a new one
- **Edit** the existing A record
- Change the value to: `216.198.79.1`
- Save

## What Your DNS Records Should Look Like

After setup, you should have:

```
Type    Hostname    Answer
A       @           216.198.79.1
CNAME   www         cname.vercel-dns.com
```

**Important:** Only ONE record for `@` (the A record)

## Common Scenarios

### Scenario 1: Default CNAME from Porkbun
- Porkbun might have added a default CNAME pointing to their parking page
- Delete it and add your A record

### Scenario 2: Multiple A Records
- If you see multiple A records for `@`
- Delete all except one
- Edit that one to point to `216.198.79.1`

### Scenario 3: ALIAS Record
- Some registrars use ALIAS instead of CNAME
- Delete the ALIAS record
- Add the A record

## Still Having Issues?

1. **Screenshot your DNS records** - This helps identify the problem
2. **Check for typos** - Make sure hostname is exactly `@`
3. **Try editing instead of adding** - If an A record exists, edit it
4. **Contact Porkbun support** - support@porkbun.com

---

**Once you delete the conflicting record and add the A record, it should work!**

