import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Features — StackSerp",
  description:
    "AI content generation, multi-website management, SEO optimization, CMS integrations, social publishing, analytics and more. Everything you need for content marketing.",
  openGraph: {
    title: "Features — StackSerp",
    description:
      "AI content generation, multi-website management, SEO optimization, and more.",
  },
};
import {
  Zap,
  ArrowRight,
  Sparkles,
  Brain,
  Globe,
  Search,
  FileText,
  Plug,
  Share2,
  BarChart3,
  Network,
  CalendarDays,
  Code2,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Content Generation",
    subtitle: "7-step pipeline from research to publish",
    description:
      "Our AI doesn't just write — it researches, outlines, drafts, matches your tone, optimizes for SEO, generates metadata, and creates a custom featured image. Every post goes through a rigorous 7-step pipeline to ensure quality.",
    steps: [
      "Deep topic research via Perplexity Sonar Pro",
      "Structured outline with H2/H3 headings",
      "1,500–4,000 word long-form draft",
      "Brand voice & tone matching",
      "On-page SEO optimization",
      "Meta title, description & schema markup",
      "AI-generated featured image",
    ],
  },
  {
    icon: Globe,
    title: "Multi-Website Management",
    subtitle: "One dashboard, unlimited sites",
    description:
      "Manage content for all your websites from a single dashboard. Each site gets its own keyword queue, brand voice settings, publishing schedule, and analytics. Perfect for agencies and multi-brand businesses.",
    steps: [
      "Separate keyword queues per site",
      "Individual brand voice & tone settings",
      "Per-site publishing schedules",
      "Cross-site analytics overview",
      "Team permissions per website",
    ],
  },
  {
    icon: Search,
    title: "SEO Engine",
    subtitle: "Automated on-page optimization",
    description:
      "Every piece of content is automatically optimized for search engines. From meta tags and structured data to internal linking and content scoring — our SEO engine handles the technical details so you can focus on strategy.",
    steps: [
      "Auto-generated meta titles & descriptions",
      "JSON-LD structured data markup",
      "Intelligent internal linking engine",
      "Content quality & SEO scoring",
      "IndexNow instant indexing",
      "Canonical URL management",
    ],
  },
  {
    icon: FileText,
    title: "Direct CMS Publishing",
    subtitle: "Publish straight to your blog",
    description:
      "StackSerp generates content and pushes it directly to your existing blog or CMS. No extra hosting needed. Your posts go live on your own domain with full SEO optimization, featured images, and proper formatting.",
    steps: [
      "One-click publish to WordPress",
      "Webhook support for any CMS",
      "Automatic SEO meta tags",
      "Featured image generation",
      "Proper heading hierarchy & formatting",
    ],
  },
  {
    icon: Plug,
    title: "CMS Integrations",
    subtitle: "Push to WordPress, Ghost, Shopify & more",
    description:
      "Already have a CMS? StackSerp integrates directly. Push finished posts to WordPress, Ghost, Shopify, Webflow, or any platform via webhook. Content is formatted and optimized before it reaches your CMS.",
    steps: [
      "WordPress REST API integration",
      "Ghost publishing",
      "Shopify blog support",
      "Webflow CMS collections",
      "Custom webhook for any platform",
    ],
  },
  {
    icon: Share2,
    title: "Social Media Publishing",
    subtitle: "Auto-post when content goes live",
    description:
      "Automatically share your published content on social media. StackSerp generates platform-optimized captions and posts to Twitter/X and LinkedIn the moment your article goes live.",
    steps: [
      "Twitter/X auto-posting",
      "LinkedIn auto-sharing",
      "Platform-optimized captions",
      "Scheduled social posts",
      "Engagement tracking",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics & Reporting",
    subtitle: "Track what matters",
    description:
      "Connect Google Search Console and track your content performance in real time. See which posts drive traffic, monitor keyword rankings, and measure the ROI of your content marketing efforts.",
    steps: [
      "Google Search Console integration",
      "Per-post traffic analytics",
      "Keyword ranking tracking",
      "Content performance scoring",
      "Monthly performance reports",
    ],
  },
  {
    icon: Network,
    title: "Topic Clusters",
    subtitle: "AI-powered content strategy",
    description:
      "Let AI plan your content strategy. StackSerp generates topic clusters with a pillar page and supporting articles, creating a web of interlinked content that signals topical authority to search engines.",
    steps: [
      "AI-generated pillar content plans",
      "Supporting article suggestions",
      "Automatic internal link mapping",
      "Topical authority scoring",
      "Cluster performance analytics",
    ],
  },
  {
    icon: CalendarDays,
    title: "Content Calendar",
    subtitle: "Visual scheduling and planning",
    description:
      "See your entire content pipeline at a glance. The visual calendar shows scheduled, in-progress, and published posts across all your websites. Drag, reschedule, and plan ahead effortlessly.",
    steps: [
      "Visual month/week/day views",
      "Drag-and-drop rescheduling",
      "Multi-website calendar overlay",
      "Publication status tracking",
      "Bulk scheduling tools",
    ],
  },
  {
    icon: Code2,
    title: "Public API",
    subtitle: "Full REST API for custom integrations",
    description:
      "Build custom workflows with our comprehensive REST API. Programmatically create posts, manage keywords, trigger generation, and pull analytics data. Everything you can do in the dashboard, you can do via API.",
    steps: [
      "RESTful endpoints for all resources",
      "API key authentication",
      "Webhook event notifications",
      "Rate limiting with generous quotas",
      "Comprehensive API documentation",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Logo className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">StackSerp</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/features"
                className="text-sm font-medium text-foreground"
              >
                Features
              </Link>
              <Link
                href="/#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Pricing
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="mr-1 h-3 w-3" />
            Full Feature Set
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Everything you need for{" "}
            <span className="text-primary">content marketing</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            One platform replaces your entire content marketing stack. From AI
            research to published, promoted, and tracked blog posts.
          </p>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto space-y-32">
          {features.map((feature, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={feature.title}
                className={`flex flex-col gap-12 lg:gap-16 items-center ${
                  isEven ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                {/* Text */}
                <div className="flex-1 max-w-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-primary mb-2">
                    {feature.subtitle}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    {feature.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.steps.map((step) => (
                      <li
                        key={step}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual / Mockup Card */}
                <div className="flex-1 w-full max-w-lg">
                  <div className="bg-muted/50 border rounded-xl p-8 aspect-[4/3] flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                        <feature.icon className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {feature.title}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to automate your content marketing?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using AI to grow their organic traffic.
            Start free — no credit card required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="text-lg px-8 h-12">
              <Link href="/register">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-lg px-8 h-12"
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <Logo className="h-4 w-4" />
            </div>
            <span className="font-semibold">StackSerp</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} StackSerp. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
