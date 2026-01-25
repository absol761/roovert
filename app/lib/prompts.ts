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
 * Get system prompt with Roovert context
 */
export function getSystemPrompt(customPrompt?: string): string {
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

  return basePrompt;
}
