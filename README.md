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
OPENROUTER_API_KEY=your_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Admin API key (for testing /api/admin/visitors endpoint locally)
# If not set, admin endpoint will return 503 in local development
AI_GATEWAY_API_KEY=your_admin_key_here

# Optional: Segment.io Analytics (for anonymous user analytics)
# Get your write key from https://app.segment.com/
NEXT_PUBLIC_SEGMENT_WRITE_KEY=your_segment_write_key_here
```

Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai). Never commit `.env.local` or any file containing secrets.

**Note:** The Segment write key is optional. If not provided, analytics will be disabled and no warning will be shown in production.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Access to multiple AI models via OpenRouter (GPT-4o, Claude, Gemini, Llama, Perplexity, and others)
- Default Ooverta model with web search capabilities
- Image upload and vision support for AI models
- Conversation memory and history management
- Message editing and regeneration
- Privacy-focused visitor tracking using hashed identifiers
- Customizable themes and interface layouts
- Real-time streaming responses
- Code block syntax highlighting and copy functionality

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Framer Motion for animations
- React Markdown for response rendering
- Vercel KV for visitor tracking (production)
- SQLite for local development
- OpenRouter API for AI model access

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
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `NEXT_PUBLIC_APP_URL` - Your application URL

Optional environment variables:
- `AI_GATEWAY_API_KEY` - Admin API key for accessing `/api/admin/visitors` endpoint (required in production, optional for local dev)
- `NEXT_PUBLIC_SEGMENT_WRITE_KEY` - Segment.io write key for anonymous analytics (get from [app.segment.com](https://app.segment.com/))

## Design

The interface supports multiple visual themes and layouts. Users can customize the appearance, font size, and layout style. The design emphasizes clarity and performance with smooth animations and responsive layouts.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- Repository: [https://github.com/absol761/roovert](https://github.com/absol761/roovert)
- Website: [https://roovert.com](https://roovert.com)
