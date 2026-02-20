# StackSerp - AI-Powered SEO Blog SaaS

A SaaS platform that lets users manage **automated, AI-powered SEO blog content** for **multiple websites** from a single dashboard.

## What It Does

1. **Researches** competitors and content gaps using Perplexity AI
2. **Generates** high-quality, SEO-optimized blog posts using Gemini AI
3. **Creates** featured images using Imagen 4.0
4. **Optimizes** with internal linking, meta tags, structured data
5. **Publishes** directly to the user's website (or hosts it)
6. **Promotes** on social media (X/Twitter, LinkedIn)
7. **Indexes** via IndexNow for instant Google discovery
8. **Tracks** rankings, traffic, and content performance

## Tech Stack

- **Next.js 15** (App Router) - Full-stack framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** + **shadcn/ui** - Modern UI
- **Prisma** + **PostgreSQL** - Database
- **NextAuth.js** - Authentication
- **Stripe** - Billing & subscriptions
- **Gemini AI** - Content generation
- **Perplexity AI** - Research
- **Imagen 4.0** - Image generation
- **Backblaze B2** - Media storage

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account (for billing)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your .env values

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login & Register pages
│   ├── (dashboard)/     # Dashboard (protected)
│   │   └── dashboard/
│   │       ├── websites/    # Website management
│   │       ├── billing/     # Subscription management
│   │       └── settings/    # Account settings
│   ├── (marketing)/     # Landing page & marketing
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components
│   └── dashboard/       # Dashboard-specific components
├── lib/                 # Utilities, Prisma, Auth, Stripe
└── types/               # TypeScript type definitions
```

## Pricing Plans

| Plan | Price | Websites | Posts/mo | Images/mo |
|------|-------|----------|----------|-----------|
| Free | $0 | 1 | 5 | 5 |
| Starter | $29/mo | 3 | 20 | 20 |
| Growth | $79/mo | 10 | 60 | 60 |
| Agency | $199/mo | 50 | 200 | 200 |

## License

Private - All rights reserved.
