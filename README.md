# Roovert
Rigorously Pursuing Truth. An AI Engine of Truth.

A Next.js application for querying multiple AI models through a unified interface. The default model (Ooverta) provides web-aware responses with real-time information access.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm, yarn, pnpm, or bun

### Installation

Clone the repository:

```bash
git clone https://github.com/absol761/roovert.git
cd roovert
```

Install dependencies:

```bash
npm install
```

Set up environment variables. Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Admin API key (for testing /api/admin/visitors endpoint locally)
# If not set, admin endpoint will return 503 in local development
ADMIN_API_KEY=your_admin_key_here

# Optional: Segment.io Analytics (for anonymous user analytics)
# Get your write key from https://app.segment.com/
NEXT_PUBLIC_SEGMENT_WRITE_KEY=your_segment_write_key_here
```

Never commit `.env.local` or any file containing secrets.

**Note:** The Segment write key is optional. If not provided, analytics will be disabled and no warning will be shown in production.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Access to multiple AI models, including Hugging Face-hosted open models
- Default Ooverta model with web search capabilities
- Image upload and vision support for AI models
- Multi-conversation history with server-side conversation sharing
- Command palette and keyboard shortcuts
- Message editing, regeneration, and thumbs-up/down feedback
- Response style presets and adjustable response length
- Privacy-focused visitor tracking using hashed identifiers
- Customizable themes, layouts, and an audio-reactive 3D visualizer
- Real-time streaming responses
- Code block syntax highlighting and copy functionality

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4, shadcn/ui, and Radix UI primitives
- Framer Motion for animations
- React Three Fiber / drei for the 3D visualizer
- React Markdown for response rendering
- Vercel KV / Upstash Redis for visitor tracking (production)
- SQLite for local development

## Project Structure

```
roovert/
├── app/
│   ├── api/           # API routes
│   ├── lib/            # Utilities and database
│   ├── globals.css     # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx        # Homepage
├── public/             # Static assets
├── data/               # SQLite database (gitignored)
└── package.json
```

## Security

The application includes security headers configured in `next.config.ts`:
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Content Security Policy
- Referrer Policy

Environment variables are excluded from version control. Source maps are disabled in production. React Strict Mode is enabled.

## Deployment

Deploy to Vercel:

1. Push your code to GitHub
2. Import the repository on Vercel
3. Add environment variables in the Vercel dashboard
4. Deploy

Required environment variables:
- `GROQ_API_KEY` - Groq API key for the default (Ooverta) chat model

Optional environment variables:
- `NEXT_PUBLIC_SITE_URL` - Your deployed site URL (falls back to `https://roovert.com`)
- `ADMIN_API_KEY` - Admin API key for accessing `/api/admin/visitors` endpoint
- `OPENROUTER_API_KEY` - enables the OpenRouter multi-provider model picker
- `HUGGINGFACE_API_KEY` - enables the Hugging Face model picker and image generation
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` - visitor tracking storage (falls back to local SQLite)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - shared rate-limit storage (required for multi-instance production deployments)
- `NEXT_PUBLIC_SEGMENT_WRITE_KEY` - Segment.io write key for anonymous analytics (get from [app.segment.com](https://app.segment.com/))

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment walkthrough (Vercel dashboard/CLI, verification, troubleshooting), [docs/CUSTOM_DOMAIN_SETUP.md](docs/CUSTOM_DOMAIN_SETUP.md) for pointing a custom domain at your deployment, and [docs/SECURITY.md](docs/SECURITY.md) for the current security posture.

## Design

The interface supports multiple visual themes and layouts. Users can customize the appearance, font size, and layout style. The design emphasizes clarity and performance with smooth animations and responsive layouts.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

**License:** MIT License  
**Author:** dcyoung

Key implementations adapted from the original repository:
- InstancedMesh-based visualizers for performance
- Golden angle (Fibonacci sphere) distribution for sphere visualizer
- LUT-based color palette system
- Coordinate mapping patterns for audio reactivity
- Camera setup and lighting configurations

We are grateful for the open-source contributions that made these visualizations possible.

## Links

- Repository: [https://github.com/absol761/roovert](https://github.com/absol761/roovert)
- Website: [https://roovert.com](https://roovert.com)
