# Roovert

Rigorously Pursuing Truth. An AI Engine of Truth.

A minimalist AI interface built with Next.js. Query multiple AI models through a single unified interface. The default model (Ooverta) uses web-aware reasoning to provide accurate, up-to-date information.

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
```

Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai). Never commit `.env.local` or any file containing secrets.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Multiple AI model support (GPT-4o, Claude 3.5 Sonnet, Gemini, Llama, Perplexity, and more)
- Web-aware default model with real-time information access
- Privacy-focused visitor tracking (no cookies, hashed identifiers only)
- Customizable interface with multiple themes and layouts
- Real-time stats and visitor analytics

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS 4
- SQLite for visitor tracking
- OpenRouter API for model access

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

## Design

The interface uses a minimalist design with high-contrast typography. Dark mode is the default with a deep black background (#050505) and teal accent color (#008080). The tone is direct and focused, avoiding generic helper text.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- Repository: [https://github.com/absol761/roovert](https://github.com/absol761/roovert)
- Website: [https://roovert.com](https://roovert.com)
