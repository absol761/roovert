# Vercel AI Gateway Integration

This application supports Vercel AI Gateway for AI model access.

## Setup

### 1. Install Dependencies

The required packages are already installed:
- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider for AI SDK

### 2. Environment Variables

Add to your `.env.local` (for local development) and Vercel environment variables:

```bash
# AI Gateway API Key (required for AI Gateway endpoint)
AI_GATEWAY_API_KEY=your_gateway_api_key_here

# Optional: Custom AI Gateway base URL
# Default: https://gateway.ai.cloudflare.com/v1
AI_GATEWAY_BASE_URL=https://your-gateway-url.com/v1
```

### 3. API Endpoints

The application has the following AI endpoint:

#### `/api/query-gateway` (AI Gateway)
- Uses Vercel AI Gateway
- Requires: `AI_GATEWAY_API_KEY`
- Uses Vercel AI SDK for streaming
- Supports OpenAI-compatible models

## Usage

### Frontend Integration

The frontend uses the AI Gateway endpoint. The fetch call in `app/page.tsx` should use:

```typescript
const res = await fetch('/api/query-gateway', {
```

### Supported Models

AI Gateway endpoint supports these models (mapped from internal IDs):

- `ooverta` → `google/gemini-2.0-flash-exp:free`
- `gemini-flash` → `google/gemini-2.0-flash-exp:free`
- `gpt-4o` → `gpt-4o`
- `claude-3-5-sonnet` → `claude-3-5-sonnet`
- `claude-3-opus` → `claude-3-opus`
- `claude-3-haiku` → `claude-3-haiku`

## Benefits of AI Gateway

1. **Unified Interface**: Single API for multiple providers
2. **Rate Limiting**: Built-in rate limiting and caching
3. **Cost Optimization**: Automatic failover and cost tracking
4. **Better Error Handling**: Improved error recovery
5. **Streaming Support**: Native streaming with Vercel AI SDK

## Configuration Options

### Using Cloudflare AI Gateway

```bash
AI_GATEWAY_API_KEY=your_cloudflare_gateway_key
AI_GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1
```

### Using Custom Gateway

```bash
AI_GATEWAY_API_KEY=your_custom_gateway_key
AI_GATEWAY_BASE_URL=https://your-custom-gateway.com/v1
```

## Testing

Test the AI Gateway endpoint:

```bash
curl -X POST http://localhost:3000/api/query-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello, how are you?",
    "model": "ooverta"
  }'
```

## Setup Guide

To set up AI Gateway:

1. Set `AI_GATEWAY_API_KEY` in environment variables
2. Ensure frontend uses `/api/query-gateway` endpoint
3. Test with your models
4. Monitor performance and costs

## Troubleshooting

**Error: AI Gateway API key missing**
- Make sure `AI_GATEWAY_API_KEY` is set in environment variables
- Restart your development server after adding to `.env.local`

**Error: Invalid model specified**
- Check that the model ID is in the `MODEL_MAP` allowlist
- Add more models to `MODEL_MAP` if needed

**Error: Gateway connection failed**
- Verify `AI_GATEWAY_BASE_URL` is correct
- Check network connectivity
- Ensure gateway API key is valid
