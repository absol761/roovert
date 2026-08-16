// Shared helper for one-shot SSE error responses. Several AI provider routes
// (query-gateway, huggingface, openrouter) need to return a single
// `data: {...}\n\n` event carrying an error/fallback message with the
// standard SSE headers and then end the stream - this is that exact
// boilerplate factored out so it isn't hand-copied at every error site.
export function sseError(content: string, status?: number): Response {
  return new Response(
    `data: ${JSON.stringify({ content, done: true })}\n\n`,
    {
      status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}
