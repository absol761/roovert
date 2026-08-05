/**
 * System Prompts and Content Moderation
 * Provides Roovert-specific context and content filtering
 */

// Offensive content patterns
const OFFENSIVE_PATTERNS = [
  // Hate speech patterns
  /\b(n[il1]+g[ae]r|f[ae]g[go]t|k[i1]ke|sp[i1]c|ch[i1]nk|t[o0]wel[ie]|r[ea]tard)\b/i,
  /\b(k[i1]ll\s+(yourself|urself|urself)|kys|su[i1]c[il1]de)\b/i,
  
  // Violence
  /\b(bomb|terror|assassinate|murder|rape)\b/i,
  
  // Explicit content
  /\b(porn|xxx|sex\s+toy|nude|naked|penis|vagina)\b/i,
  
  // Illegal activities
  /\b(drug\s+deal|illegal\s+weapon|hack\s+into|steal\s+credit)\b/i,
];

/**
 * Check if text contains offensive content
 */
export function containsOffensiveContent(text: string): { isOffensive: boolean; matchedPattern?: string } {
  const normalized = text.toLowerCase().trim();
  
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { isOffensive: true, matchedPattern: pattern.toString() };
    }
  }
  
  return { isOffensive: false };
}

/**
 * Filter response to remove or replace offensive content
 */
export function filterResponse(response: string): { filtered: string; wasFiltered: boolean } {
  const check = containsOffensiveContent(response);
  if (check.isOffensive) {
    return {
      filtered: "I apologize, but I cannot provide content that may be inappropriate or offensive. Please ask me something else, and I'll be happy to help.",
      wasFiltered: true,
    };
  }
  return { filtered: response, wasFiltered: false };
}

/**
 * Response style presets - short, non-gimmicky instructions that adjust how
 * the model answers without the user having to write a custom prompt. Kept
 * separate from the custom system prompt so the two can be combined freely.
 */
export type ResponseStyle = 'normal' | 'concise' | 'explanatory' | 'formal';

export const RESPONSE_STYLES: Array<{ id: ResponseStyle; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'concise', label: 'Concise' },
  { id: 'explanatory', label: 'Explanatory' },
  { id: 'formal', label: 'Formal' },
];

// 'normal' intentionally has no entry - it's the default model behavior, so
// no modifier instruction is prepended for it.
const STYLE_INSTRUCTIONS: Partial<Record<ResponseStyle, string>> = {
  concise: 'Keep responses brief and to the point, avoiding unnecessary elaboration.',
  explanatory: 'Explain your reasoning and provide context, as if teaching the topic.',
  formal: 'Use a formal, professional tone.',
};

/**
 * Look up the instruction text for a response style. Returns undefined for
 * 'normal' (or an unrecognized value) since no modifier should be applied.
 */
export function getStyleInstruction(style?: ResponseStyle): string | undefined {
  if (!style) return undefined;
  return STYLE_INSTRUCTIONS[style];
}

/**
 * Response length presets - control how much the model elaborates,
 * independent of tone (ResponseStyle above). 'medium' is the default and
 * asks for no unrequested elaboration, not a specific word count.
 */
export type OutputLength = 'small' | 'medium' | 'large';

export const OUTPUT_LENGTHS: Array<{ id: OutputLength; label: string }> = [
  { id: 'small', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Long' },
];

const LENGTH_INSTRUCTIONS: Record<OutputLength, string> = {
  small: 'Answer in 1-3 sentences. Only the essential information.',
  medium: 'Answer only what was asked - no unrequested elaboration, caveats, or extra sections.',
  large: 'Be thorough: cover relevant context, edge cases, and examples in your answer.',
};

/**
 * Look up the instruction text for a response length. 'medium' always
 * resolves to an instruction (unlike ResponseStyle's 'normal') since the
 * "no unrequested fluff" default is itself an explicit behavior to request.
 */
export function getLengthInstruction(length?: OutputLength): string | undefined {
  if (!length) return undefined;
  return LENGTH_INSTRUCTIONS[length];
}

/**
 * Get system prompt with Roovert context, optionally prefixed with one or
 * more short modifier instructions (response style, response length, etc).
 * `customPrompt` and the modifiers are independent and compose naturally -
 * a saved custom prompt and any number of active modifiers can all be
 * active on the same request.
 */
export function getSystemPrompt(customPrompt?: string, ...modifiers: Array<string | undefined>): string {
  const styleModifier = modifiers.filter((m): m is string => Boolean(m)).join('\n\n');
  const basePrompt = customPrompt || `You are a helpful, intelligent, and precise AI assistant on Roovert, an advanced AI platform.

IMPORTANT CONTEXT:
- You are operating on the Roovert platform (https://roovert.com or the current domain)
- When asked "what website is this?" or "what platform are you on?", you should respond: "This is Roovert, an advanced AI platform."
- You should identify yourself as part of the Roovert ecosystem when relevant
- Always be helpful, accurate, and respectful

CONTENT GUIDELINES:
- Do not generate, discuss, or provide content that is:
  * Hateful, discriminatory, or offensive
  * Violent, threatening, or promoting harm
  * Sexually explicit or inappropriate
  * Illegal or promoting illegal activities
- If a request falls into these categories, politely decline and offer to help with something else
- Maintain a professional and respectful tone at all times

Answer the user's questions clearly, accurately, and in a helpful manner.`;

  return styleModifier ? `${styleModifier}\n\n${basePrompt}` : basePrompt;
}
