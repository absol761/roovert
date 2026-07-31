import { NextRequest, NextResponse } from 'next/server';
import { containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit, getRateLimitStatus } from '../../lib/security/rateLimit';
import { validateString, validateBodySize, createValidationErrorResponse, MAX_LENGTHS } from '../../lib/security/validation';

// Route segment config - image generation runs ~10-20s of real diffusion
// time on the provider side, well past the default serverless timeout.
export const maxDuration = 60;
export const runtime = 'nodejs';

// Text-to-image via Hugging Face's Inference Providers router. Unlike the
// chat completions router (router.huggingface.co/v1/chat/completions),
// text-to-image isn't OpenAI-shaped: it's a per-provider REST endpoint that
// returns raw image bytes (not JSON, not SSE). This targets the
// "hf-inference" provider specifically, since that's the one confirmed
// live against the real API key.
//
// Model choice: stabilityai/stable-diffusion-3-medium-diffusers is the
// model Hugging Face's own docs map to the hf-inference provider for the
// text-to-image task. Verified live: black-forest-labs/FLUX.1-schnell,
// which looks like the more obviously "trending" pick, returns
// `{"error":"The requested model is deprecated and no longer supported by
// provider hf-inference"}` (HTTP 410) - it's only served by other
// providers (together, nscale, etc.) that would require separate API
// credentials this app doesn't have. SD3-Medium is the one genuinely
// buildable with just HUGGINGFACE_API_KEY.
const IMAGE_MODEL = 'stabilityai/stable-diffusion-3-medium-diffusers';
const HF_IMAGE_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${IMAGE_MODEL}`;

// User-friendly error messages - NEVER expose internal API details
function getUserFriendlyErrorMessage(errorType: 'unavailable' | 'rate_limit' | 'permissions' | 'timeout' | 'generic'): string {
  const messages: Record<string, string> = {
    unavailable: "Image generation is temporarily unavailable. The model may be experiencing high demand or is still loading - please try again in a moment.",
    rate_limit: "You've reached the image generation limit for this session. Please wait before trying again.",
    permissions: "This Hugging Face token doesn't have permission to call Inference Providers. Edit the token at huggingface.co/settings/tokens and enable that permission, then update HUGGINGFACE_API_KEY.",
    timeout: 'Image generation took too long. Please try again with a shorter, simpler prompt.',
    generic: 'Something went wrong while generating the image. Please try again.',
  };
  return messages[errorType] || messages.generic;
}

function getErrorType(statusCode: number, errorBody: string): 'unavailable' | 'rate_limit' | 'permissions' | 'timeout' | 'generic' {
  if (statusCode === 403) {
    return errorBody.includes('sufficient permissions') ? 'permissions' : 'unavailable';
  }
  if (statusCode === 429 || errorBody.includes('rate limit')) {
    return 'rate_limit';
  }
  if (statusCode === 503 || statusCode === 502 || statusCode === 500 || statusCode === 410) {
    return 'unavailable';
  }
  if (errorBody.includes('timeout') || errorBody.includes('timed out')) {
    return 'timeout';
  }
  return 'generic';
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting - apply before processing (own bucket, see
    // rateLimit.ts's 'huggingface-image' comment for why it's stricter
    // than the chat 'huggingface' bucket)
    const rateLimitResponse = await applyRateLimit(request, 'huggingface-image');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: Validate request body size before parsing
    const contentLength = request.headers.get('content-length');
    const bodySizeErrors = validateBodySize(contentLength, 1024 * 1024); // 1MB - a text prompt only
    if (bodySizeErrors.length > 0) {
      return createValidationErrorResponse(bodySizeErrors);
    }

    // Security: Parse and validate payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return jsonError('Invalid JSON payload', 400);
    }

    // Security: Strict input validation
    const promptValidation = validateString(payload.prompt, 'prompt', MAX_LENGTHS.IMAGE_PROMPT, true);
    if (!promptValidation.valid) {
      return createValidationErrorResponse([promptValidation.error!]);
    }
    const prompt = promptValidation.sanitized!;

    // Security: Content moderation - check for offensive content
    const promptCheck = containsOffensiveContent(prompt);
    if (promptCheck.isOffensive) {
      return jsonError("I can't generate an image for that request. Please try a different description.", 400);
    }

    // Security: API key validation - ensure key exists in environment (never exposed to client)
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HUGGINGFACE_API_KEY is missing from environment variables');
      return jsonError(getUserFriendlyErrorMessage('unavailable'), 503);
    }

    try {
      const hfResponse = await fetch(HF_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        console.error('Hugging Face image API error:', hfResponse.status, errorText);
        const errorType = getErrorType(hfResponse.status, errorText);
        return jsonError(getUserFriendlyErrorMessage(errorType), hfResponse.status === 429 ? 429 : 502);
      }

      // Security: Increment rate limit after successful request
      await incrementRateLimit(request, 'huggingface-image');

      // Response body is raw image bytes (JPEG), not JSON - base64-encode
      // it into a data URL so the client can drop it straight into an
      // <img src>.
      const contentType = hfResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await hfResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return NextResponse.json({ image: `data:${contentType};base64,${base64}` });
    } catch (error) {
      console.error('Hugging Face image API error:', error);
      await incrementRateLimit(request, 'huggingface-image');
      return jsonError(getUserFriendlyErrorMessage('generic'), 502);
    }
  } catch (error) {
    console.error('Image generation request processing error:', error);
    return jsonError(getUserFriendlyErrorMessage('generic'), 500);
  }
}

// GET endpoint to check rate limit status - mirrors the pattern in
// app/api/huggingface/route.ts, used to hide/disable the "Generate Image"
// composer button once this session has exhausted its quota.
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, 'stats');
  if (rateLimitResponse) {
    try {
      const errorData = await rateLimitResponse.json();
      return NextResponse.json(errorData, {
        status: 429,
        headers: Object.fromEntries(rateLimitResponse.headers.entries())
      });
    } catch {
      return rateLimitResponse;
    }
  }

  const status = await getRateLimitStatus(request, 'huggingface-image');
  await incrementRateLimit(request, 'stats');

  return NextResponse.json({
    shouldHide: status.isBlocked,
    count: status.count,
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}
