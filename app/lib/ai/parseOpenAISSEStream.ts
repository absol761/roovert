// Shared line-parsing mechanics for OpenAI-compatible chat-completions SSE
// streams (used by OpenRouter, Hugging Face's router, and the Multi-
// Perspective HF leg in query-gateway). Owns the TextDecoder/buffer state
// and yields each parsed `delta` object back to the caller, which is
// responsible for interpreting provider-specific fields (delta.content,
// delta.reasoning_content, etc.) and formatting/enqueuing its own SSE
// frames.
export async function* parseOpenAISSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta;
        if (delta) yield delta;
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
