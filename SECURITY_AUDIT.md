# Security Audit Report
**Date:** 2026-01-06  
**Auditor:** Security Review  
**Scope:** Full codebase security review

## Executive Summary

This audit identified **8 critical/high vulnerabilities** and **5 medium/low issues** that require attention. The codebase shows good security practices in some areas (parameterized SQL queries, environment variable usage) but has significant gaps in input validation, rate limiting, and access control.

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **Unprotected Admin Endpoint** (CRITICAL)
**Location:** `app/api/admin/visitors/route.ts`  
**Severity:** CRITICAL  
**Issue:** Admin endpoint exposes visitor statistics without any authentication or authorization.

```typescript
// Line 22-81: No authentication check
export async function GET(request: Request) {
  const db = getDatabase();
  // Exposes all visitor data without protection
}
```

**Impact:** Anyone can access sensitive visitor statistics including:
- Total unique visitors
- Visitor timestamps
- Visit patterns

**Recommendation:**
```typescript
export async function GET(request: Request) {
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of code
}
```

---

### 2. **Model Injection Vulnerability** (HIGH)
**Location:** `app/api/query-stream/route.ts:123-128`  
**Severity:** HIGH  
**Issue:** User-controlled `model` parameter is used directly without proper validation against allowlist.

```typescript
// Line 123-128: User can inject arbitrary model IDs
if (model.includes('/')) {
  targetModel = model.trim(); // ⚠️ Direct use of user input
} else {
  targetModel = MODEL_MAP[model] || model.trim(); // ⚠️ Fallback to user input
}
```

**Impact:**
- Users can specify arbitrary model IDs, potentially:
  - Accessing premium/paid models (cost escalation)
  - Bypassing model restrictions
  - Causing API errors

**Recommendation:**
```typescript
// Validate against allowlist
const ALLOWED_MODELS = new Set(Object.keys(MODEL_MAP));
if (!ALLOWED_MODELS.has(model)) {
  return new Response(
    JSON.stringify({ error: 'Invalid model specified' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
targetModel = MODEL_MAP[model];
```

---

### 3. **No Rate Limiting** (HIGH)
**Location:** All API routes  
**Severity:** HIGH  
**Issue:** No rate limiting implemented on any API endpoints.

**Impact:**
- **DoS attacks:** Unlimited requests can overwhelm the server
- **API cost escalation:** Unlimited calls to OpenRouter API
- **Resource exhaustion:** Memory/CPU exhaustion from concurrent requests

**Affected Endpoints:**
- `/api/query-stream` - Most critical (expensive API calls)
- `/api/query`
- `/api/track`
- `/api/visit`
- `/api/admin/visitors`

**Recommendation:**
Implement rate limiting using:
- Vercel Edge Middleware with rate limiting
- Or `@upstash/ratelimit` for serverless
- Or middleware like `express-rate-limit` if using Express

Example:
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }
  // ... rest of handler
}
```

---

### 4. **Insufficient Input Validation** (HIGH)
**Location:** Multiple API routes  
**Severity:** HIGH  
**Issues:**

#### 4a. Query Length Not Limited
**Location:** `app/api/query-stream/route.ts:46-53`
```typescript
const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image } = payload;

if (!query || typeof query !== 'string') {
  // Only checks type, not length
}
```

**Impact:** Extremely long queries can:
- Cause memory exhaustion
- Exceed API token limits
- Slow down processing

**Recommendation:**
```typescript
const MAX_QUERY_LENGTH = 10000; // characters
if (!query || typeof query !== 'string' || query.length > MAX_QUERY_LENGTH) {
  return new Response(
    JSON.stringify({ error: 'Query too long' }),
    { status: 400 }
  );
}
```

#### 4b. Conversation History Not Validated
**Location:** `app/api/query-stream/route.ts:172-182`
```typescript
if (conversationHistory && Array.isArray(conversationHistory)) {
  for (const msg of conversationHistory) {
    // ⚠️ No length limit on array
    // ⚠️ No validation of message structure
  }
}
```

**Impact:**
- Memory exhaustion from huge conversation arrays
- API token limit exceeded
- Processing delays

**Recommendation:**
```typescript
const MAX_HISTORY_LENGTH = 50; // messages
if (conversationHistory && Array.isArray(conversationHistory)) {
  if (conversationHistory.length > MAX_HISTORY_LENGTH) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
  }
  // Validate each message structure
  for (const msg of conversationHistory) {
    if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
      return new Response(JSON.stringify({ error: 'Invalid message format' }), { status: 400 });
    }
    if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) {
      return new Response(JSON.stringify({ error: 'Invalid message content' }), { status: 400 });
    }
  }
}
```

#### 4c. System Prompt Not Validated
**Location:** `app/api/query-stream/route.ts:96`
```typescript
let systemPrompt = customSystemPrompt || "...";
// ⚠️ No length or content validation
```

**Impact:** Malicious system prompts could:
- Inject instructions to AI models
- Exceed token limits
- Cause unexpected behavior

---

### 5. **CSP Allows Unsafe Eval** (HIGH)
**Location:** `next.config.ts:42`  
**Severity:** HIGH  
**Issue:** Content Security Policy allows `'unsafe-eval'` and `'unsafe-inline'`.

```typescript
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.segment.com",
"style-src 'self' 'unsafe-inline'",
```

**Impact:**
- XSS attacks can execute arbitrary JavaScript
- Defeats purpose of CSP
- Allows code injection

**Recommendation:**
- Remove `'unsafe-eval'` if possible
- Use nonces or hashes for inline scripts
- Move inline styles to external files

---

### 6. **Image Upload Security Issues** (MEDIUM-HIGH)
**Location:** `app/page.tsx:991-1000`  
**Severity:** MEDIUM-HIGH  
**Issues:**

#### 6a. File Type Validation Insufficient
```typescript
if (!file.type.startsWith('image/')) {
  alert('Please select an image file');
  return;
}
```

**Problem:** MIME type can be spoofed. Malicious files can be renamed with `.jpg` extension.

**Recommendation:**
```typescript
// Validate file extension
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
if (!allowedExtensions.includes(fileExtension)) {
  return;
}

// Validate actual file content (magic bytes)
// Consider using a library like 'file-type' to verify actual file type
```

#### 6b. No File Size Limit on Server
**Location:** Client-side only validation  
**Issue:** Client-side 20MB limit can be bypassed.

**Recommendation:**
Add server-side validation:
```typescript
// In API route
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
if (image && image.length > MAX_IMAGE_SIZE) {
  return new Response(JSON.stringify({ error: 'Image too large' }), { status: 413 });
}
```

---

## 🟡 MEDIUM VULNERABILITIES

### 7. **XSS Risk in Markdown Rendering** (MEDIUM)
**Location:** `app/page.tsx:1820` (ReactMarkdown)  
**Severity:** MEDIUM  
**Issue:** ReactMarkdown with `rehype-raw` can render raw HTML, potentially allowing XSS.

**Current Code:**
```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight]}
  // ⚠️ No sanitization configured
/>
```

**Impact:** If AI response contains malicious HTML/JavaScript, it could execute.

**Recommendation:**
```typescript
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight, rehypeSanitize]}
/>
```

---

### 8. **IP Address Spoofing** (MEDIUM)
**Location:** `app/lib/tracking.ts:24-44`  
**Severity:** MEDIUM  
**Issue:** IP address extraction trusts headers that can be spoofed.

```typescript
const forwardedFor = request.headers.get('x-forwarded-for');
if (forwardedFor) {
  return forwardedFor.split(',')[0].trim(); // ⚠️ Can be spoofed
}
```

**Impact:**
- Visitor tracking can be manipulated
- Rate limiting can be bypassed (if implemented)
- Analytics data can be skewed

**Recommendation:**
- Only trust headers from known proxies (Vercel, Cloudflare)
- Use `request.ip` when available (Next.js provides this)
- Implement additional fingerprinting

---

### 9. **Algorithmic Complexity - DoS Risk** (MEDIUM)
**Location:** `app/api/query-stream/route.ts:345-381`  
**Severity:** MEDIUM  
**Issue:** Streaming response processing has no timeout or size limits.

**Impact:**
- Long-running streams can exhaust server resources
- Memory can accumulate from large responses
- No protection against infinite streams

**Recommendation:**
```typescript
const MAX_STREAM_DURATION = 60 * 1000; // 60 seconds
const MAX_RESPONSE_LENGTH = 100000; // characters

const startTime = Date.now();
let totalLength = 0;

while (true) {
  if (Date.now() - startTime > MAX_STREAM_DURATION) {
    controller.close();
    return;
  }
  
  // ... read chunk
  
  totalLength += content.length;
  if (totalLength > MAX_RESPONSE_LENGTH) {
    controller.close();
    return;
  }
}
```

---

### 10. **Missing Request Size Limits** (MEDIUM)
**Location:** All API routes  
**Severity:** MEDIUM  
**Issue:** No explicit body size limits configured.

**Impact:**
- Large request bodies can cause memory exhaustion
- DoS via oversized payloads

**Recommendation:**
Configure in `next.config.ts`:
```typescript
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
```

Or in route handlers:
```typescript
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const contentLength = request.headers.get('content-length');
if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
  return new Response('Payload too large', { status: 413 });
}
```

---

## 🟢 LOW RISK / BEST PRACTICES

### 11. **SQL Injection Protection** ✅ GOOD
**Location:** `app/lib/db.ts`, `app/api/track/route.ts`  
**Status:** SECURE  
**Finding:** All database queries use parameterized statements correctly.

```typescript
// ✅ Good - parameterized query
db.prepare('INSERT OR IGNORE INTO unique_visitors (visitor_hash, first_seen, last_seen) VALUES (?, ?, ?)')
  .run(visitorHash, now, now);
```

**Recommendation:** Continue using parameterized queries for all database operations.

---

### 12. **API Key Storage** ✅ GOOD
**Location:** All API routes  
**Status:** SECURE  
**Finding:** API keys are properly stored in environment variables and not exposed in code.

```typescript
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
```

**Recommendation:** Continue this practice. Consider using a secrets management service for production.

---

### 13. **Security Headers** ✅ GOOD
**Location:** `next.config.ts:4-51`  
**Status:** MOSTLY SECURE  
**Finding:** Good security headers configured (HSTS, X-Frame-Options, CSP, etc.)

**Issue:** CSP has `'unsafe-eval'` and `'unsafe-inline'` (covered in #5)

---

## 📋 ADDITIONAL RECOMMENDATIONS

### 14. **Add Request Logging & Monitoring**
- Log all API requests with timestamps
- Monitor for suspicious patterns
- Alert on rate limit violations
- Track failed authentication attempts

### 15. **Implement CORS Properly**
Currently no explicit CORS configuration. Add if API is accessed from other domains:
```typescript
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL];
  
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }
  // ...
}
```

### 16. **Add Input Sanitization Library**
Consider using a library like `DOMPurify` or `validator.js` for comprehensive input validation.

### 17. **Implement Request ID Tracking**
Add unique request IDs for better debugging and security auditing:
```typescript
const requestId = crypto.randomUUID();
// Log all operations with requestId
```

---

## 🎯 PRIORITY FIX ORDER

1. **IMMEDIATE:** Fix #1 (Admin endpoint protection)
2. **IMMEDIATE:** Fix #3 (Rate limiting)
3. **HIGH:** Fix #2 (Model injection)
4. **HIGH:** Fix #4 (Input validation)
5. **HIGH:** Fix #5 (CSP unsafe-eval)
6. **MEDIUM:** Fix #6 (Image upload security)
7. **MEDIUM:** Fix #7 (XSS in markdown)
8. **MEDIUM:** Fix #9 (Streaming DoS protection)

---

## 📊 SUMMARY

- **Critical Issues:** 1
- **High Issues:** 5
- **Medium Issues:** 4
- **Low Issues:** 0
- **Good Practices:** 3

**Overall Security Rating:** ⚠️ **NEEDS IMPROVEMENT**

The codebase has good foundations (parameterized queries, environment variables) but requires significant hardening in input validation, rate limiting, and access control before production deployment.
