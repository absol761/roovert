// Shared max_tokens mapping for the 'outputLength' setting - kept in one
// place so every AI provider route applies the same limits.
export const OUTPUT_LENGTH_TOKENS = {
  small: 800,
  medium: 2000,
  large: 4000,
} as const;

export function resolveMaxTokens(outputLength: unknown): number {
  return OUTPUT_LENGTH_TOKENS[outputLength as 'small' | 'medium' | 'large'] || OUTPUT_LENGTH_TOKENS.medium;
}
