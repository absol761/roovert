// NOTE: this file is not the *only* source of models the picker in
// app/page.tsx offers. It's the complete, static list of the three
// built-in curated providers (Groq/OpenRouter/Hugging Face below); a
// fourth, dynamic source - generic OpenAI-compatible providers configured
// at deploy time (Cerebras/Gemini/Mistral/CUSTOM_PROVIDERS, see
// app/lib/providers.ts) - is appended to `availableModels` in page.tsx at
// runtime via GET /api/models, since which of those are actually available
// depends on server-only env vars this file can't (and shouldn't) know
// about statically. Every entry from either source shares this same
// `Model` shape, so if you're reading page.tsx and wondering where a model
// not listed here came from, that's why.
export interface Model {
  id: string;
  name: string;
  apiId: string;
  category: string;
  description: string;
}

// Groq Models - Free tier available
export const MODELS: Model[] = [
  { id: 'multi-perspective', name: 'Multi-Perspective', apiId: 'multi-perspective', category: 'Premium', description: 'Uses multiple AI models simultaneously for comprehensive answers.' },
  { id: 'ooverta', name: 'Ooverta', apiId: 'llama-3.3-70b-versatile', category: 'Premium', description: 'Advanced reasoning and analysis.' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', apiId: 'llama-3.3-70b-versatile', category: 'Advanced', description: 'Powerful 70B parameter model for complex tasks.' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', apiId: 'llama-3.1-8b-instant', category: 'Standard', description: 'Extremely fast and lightweight.' },
];

// OpenRouter Models - id/apiId must match the keys in
// app/api/openrouter/route.ts's OPENROUTER_MODEL_MAP.
export const OPENROUTER_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', apiId: 'gpt-4o', category: 'OpenRouter', description: "OpenAI's flagship multimodal model." },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', apiId: 'gpt-4-turbo', category: 'OpenRouter', description: 'Fast, capable GPT-4 variant.' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', apiId: 'claude-3.5-sonnet', category: 'OpenRouter', description: "Anthropic's balanced mid-tier model." },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', apiId: 'claude-3-opus', category: 'OpenRouter', description: "Anthropic's most capable Claude 3 model." },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', apiId: 'claude-3-sonnet', category: 'OpenRouter', description: 'Balanced Claude 3 variant.' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', apiId: 'claude-3-haiku', category: 'OpenRouter', description: 'Fast, lightweight Claude 3 variant.' },
  { id: 'gemini-pro', name: 'Gemini Pro', apiId: 'gemini-pro', category: 'OpenRouter', description: "Google's Gemini Pro model." },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', apiId: 'llama-3.1-405b', category: 'OpenRouter', description: "Meta's largest open model." },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', apiId: 'llama-3.1-70b', category: 'OpenRouter', description: 'Large open-weight Llama model.' },
  { id: 'mistral-large', name: 'Mistral Large', apiId: 'mistral-large', category: 'OpenRouter', description: "Mistral's flagship model." },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', apiId: 'mixtral-8x7b', category: 'OpenRouter', description: "Mistral's mixture-of-experts model." },
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B', apiId: 'qwen-2.5-72b', category: 'OpenRouter', description: "Alibaba's large open model." },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', apiId: 'deepseek-chat', category: 'OpenRouter', description: "DeepSeek's general-purpose chat model." },
];

// Hugging Face Models - served via HF's OpenAI-compatible router
// (https://router.huggingface.co/v1/chat/completions). id/apiId must match
// the keys in app/api/huggingface/route.ts's HUGGINGFACE_MODEL_MAP.
// Deliberately curated to ungated repos only - gated models (many Llama/
// Gemma checkpoints) return 403 until the user individually accepts that
// specific model's license on huggingface.co, which would be a confusing
// dead end for a model picker entry.
// Display names are suffixed with "(HF)" - the flat inline model picker in
// page.tsx lists every provider's models together with no grouping, and
// "Qwen 2.5 72B" already exists as an OpenRouter entry above; an
// undifferentiated duplicate name there would be genuinely confusing about
// which backend actually serves the request.
export const HUGGINGFACE_MODELS: Model[] = [
  { id: 'hf-qwen-2.5-72b', name: 'Qwen 2.5 72B (HF)', apiId: 'qwen-2.5-72b', category: 'Hugging Face', description: "Alibaba's large open-weight instruct model, via Hugging Face." },
  { id: 'hf-qwen-2.5-7b', name: 'Qwen 2.5 7B (HF)', apiId: 'qwen-2.5-7b', category: 'Hugging Face', description: 'Fast, lightweight open-weight instruct model.' },
  { id: 'hf-deepseek-v3', name: 'DeepSeek V3 (HF)', apiId: 'deepseek-v3', category: 'Hugging Face', description: "DeepSeek's flagship model, via Hugging Face." },
  { id: 'hf-phi-4', name: 'Phi-4 (HF)', apiId: 'phi-4', category: 'Hugging Face', description: "Microsoft's compact reasoning-focused model." },
  // A reasoning model - emits internal "thinking" tokens (reasoning_content)
  // before the real answer. app/api/huggingface/route.ts already only
  // forwards `content` deltas, so this just shows a longer "thinking" pause
  // in the UI before text streams in, rather than needing special handling.
  { id: 'hf-kimi-k3', name: 'Kimi K3 (HF)', apiId: 'kimi-k3', category: 'Hugging Face', description: "Moonshot AI's reasoning-focused model, via Hugging Face." },
  // Also a reasoning model (see Kimi K3 comment above for why no special
  // handling is needed for the reasoning_content/content split).
  { id: 'hf-deepseek-r1', name: 'DeepSeek R1 (HF)', apiId: 'deepseek-r1', category: 'Hugging Face', description: "DeepSeek's reasoning-focused model, via Hugging Face." },
  { id: 'hf-gpt-oss-120b', name: 'GPT-OSS 120B (HF)', apiId: 'gpt-oss-120b', category: 'Hugging Face', description: "OpenAI's open-weight model, via Hugging Face." },
  { id: 'hf-qwen-3-235b', name: 'Qwen 3 235B (HF)', apiId: 'qwen-3-235b', category: 'Hugging Face', description: "Alibaba's newest, larger-scale open-weight model, via Hugging Face." },
];
