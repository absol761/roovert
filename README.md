# Roovert: The Truth, Unfiltered

> Rigorously Pursuing Truth. An AI Engine of Truth.

A minimalist, high-performance AI startup homepage built with Next.js, Tailwind CSS, and Vercel.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/absol761/roovert.git
cd roovert
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values. **Never commit `.env.local` or any file containing secrets.**

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔒 Security

This project follows security best practices:

### Environment Variables
- **Never commit** `.env.local` or any file containing actual secrets
- Use `.env.example` as a template for required variables
- All environment files are excluded via `.gitignore`

### Security Headers
The application includes comprehensive security headers:
- Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Content Security Policy (CSP)
- Referrer Policy
- Permissions Policy

### Best Practices
- Source maps are disabled in production
- React Strict Mode enabled
- All sensitive files excluded from version control
- Security headers configured in `next.config.ts`

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) with App Router
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com)
- **Language:** TypeScript
- **Deployment:** Optimized for [Vercel](https://vercel.com)

## 📁 Project Structure

```
roovert/
├── app/
│   ├── globals.css      # Global styles and theme
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Homepage
├── public/              # Static assets
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore rules
├── next.config.ts      # Next.js configuration with security headers
└── package.json        # Dependencies
```

## 🎨 Design Philosophy

- **Minimalist:** High-contrast, kinetic typography
- **Dark Mode:** Deep Space Black (#050505) background
- **Accent Color:** Transformative Teal (#008080)
- **Tone:** Bold, direct, elite - no generic helper text

## 🚢 Deployment

### Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new):

1. Push your code to GitHub
2. Import your repository on Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform (Vercel, etc.):

- `NEXT_PUBLIC_API_URL` - Your API endpoint
- `NEXT_PUBLIC_APP_URL` - Your application URL

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- Repository: [https://github.com/absol761/roovert](https://github.com/absol761/roovert)
- Website: [https://roovert.com](https://roovert.com) (coming soon)

---

Built with precision. Designed for truth.
