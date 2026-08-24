import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mirrors tsconfig.json's "@/*": ["./*"] path alias. Without this, vitest
// falls back to plain Node resolution and any file using an `@/...` import
// (several API routes under app/api/**, e.g. `@/app/lib/db`) throws
// "Cannot find package '@/...'" the moment it's loaded in a test - silently
// making those files untestable rather than failing loudly at config time.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
