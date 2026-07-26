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
  { id: 'ooverta', name: 'Ooverta', apiId: 'meta-llama/llama-4-scout-17b-16e-instruct', category: 'Premium', description: 'Llama 4 Scout - Advanced reasoning and analysis.' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', apiId: 'meta-llama/llama-4-scout-17b-16e-instruct', category: 'Premium', description: 'Meta\'s latest Llama 4 model with enhanced capabilities.' },
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
