// Shared Hugging Face router config/parsing - used by both the standalone
// single-model HF route (app/api/huggingface/route.ts) and the Groq-backed
// query gateway's Multi-Perspective combine mode (app/api/query-gateway/route.ts),
// so a Multi-Perspective leg that happens to be an HF model behaves
// identically to a direct HF chat request instead of drifting out of sync
// with a second, hand-copied implementation.

// Hugging Face model mapping - id/apiId must match HUGGINGFACE_MODELS in
// app/lib/models.ts. Served via HF's unified, OpenAI-compatible "Inference
// Providers" router, which auto-routes each model to whichever backend
// (Together, Novita, HF's own serverless infra, etc.) currently hosts it -
// closely mirroring app/api/openrouter/route.ts's structure since the wire
// format (SSE chunks shaped like OpenAI's chat completion stream) is the same.
export const HUGGINGFACE_MODEL_MAP: Record<string, string> = {
  'hf-qwen-2.5-72b': 'Qwen/Qwen2.5-72B-Instruct',
  'hf-qwen-2.5-7b': 'Qwen/Qwen2.5-7B-Instruct',
  'hf-deepseek-v3': 'deepseek-ai/DeepSeek-V3',
  'hf-phi-4': 'microsoft/phi-4',
  'hf-kimi-k3': 'moonshotai/Kimi-K3',
  'hf-deepseek-r1': 'deepseek-ai/DeepSeek-R1',
  'hf-gpt-oss-120b': 'openai/gpt-oss-120b',
  'hf-qwen-3-235b': 'Qwen/Qwen3-235B-A22B-Instruct-2507',
};

// Extended-thinking parsing: reasoning-capable models on HF's router don't
// all shape their chain-of-thought the same way. Confirmed live against the
// router on 2026-08-01:
//   - Kimi K3 (moonshotai/Kimi-K3) uses a separate OpenAI o1-style
//     `delta.reasoning_content` field, cleanly split from `delta.content`.
//   - DeepSeek R1 (deepseek-ai/DeepSeek-R1, served via the
//     "deepseek-r1-turbo" backend) has NO `reasoning_content` field at all -
//     it inlines its reasoning directly in `delta.content`, wrapped in
//     literal `<think>...</think>` tags alongside the eventual answer.
// The parser below normalizes both shapes into the same typed chunk stream
// so callers get a consistent split regardless of which wire format the
// underlying model used.
export type ThinkChunk = { type: 'reasoning' | 'content'; text: string };
export type ThinkState = { insideThink: boolean; pending: string };

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

// Splits a raw content delta into reasoning/content chunks based on
// <think> tags, carrying state across calls since a tag can be split
// across successive stream deltas (e.g. "<thi" then "nk>"). Pure function -
// returns new chunks/state rather than mutating the passed-in state.
export function extractThinkChunks(text: string, state: ThinkState): { chunks: ThinkChunk[]; state: ThinkState } {
  let buffer = state.pending + text;
  let insideThink = state.insideThink;
  const chunks: ThinkChunk[] = [];

  while (true) {
    const marker = insideThink ? THINK_CLOSE : THINK_OPEN;
    const markerIndex = buffer.indexOf(marker);
    if (markerIndex === -1) break;

    const before = buffer.slice(0, markerIndex);
    if (before) chunks.push({ type: insideThink ? 'reasoning' : 'content', text: before });
    insideThink = !insideThink;
    buffer = buffer.slice(markerIndex + marker.length);
  }

  // No more full markers in the buffer - check whether its tail could be
  // the start of one split across the next delta, and hold it back if so.
  const marker = insideThink ? THINK_CLOSE : THINK_OPEN;
  let pending = '';
  for (let len = Math.min(marker.length - 1, buffer.length); len > 0; len--) {
    const tail = buffer.slice(buffer.length - len);
    if (marker.startsWith(tail)) {
      pending = tail;
      break;
    }
  }
  const safe = pending ? buffer.slice(0, buffer.length - pending.length) : buffer;
  if (safe) chunks.push({ type: insideThink ? 'reasoning' : 'content', text: safe });

  return { chunks, state: { insideThink, pending } };
}
