import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import {
  Zap,
  Search,
  FileText,
  Image,
  Link2,
  Share2,
  BarChart3,
  Globe,
  ArrowRight,
  CheckCircle2,
  Bot,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
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
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
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

      {/* Hero Section */}
      <section className="py-20 md:py-32 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="mr-1 h-3 w-3" />
            AI-Powered Content Marketing
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Your{" "}
            <span className="text-primary">automated SEO blog</span>
            {" "}content machine
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Add your website. Pick your keywords. We handle everything else
            &mdash; research, writing, images, SEO, publishing, and promotion.
            Fully automated content marketing.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="text-lg px-8 h-12">
              <Link href="/register">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 h-12">
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required. 5 free blog posts per month.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-muted/30 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need for content marketing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One platform replaces 5 subscriptions. From keyword research to
              published, promoted, and tracked blog posts.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Search,
                title: "AI Research",
                description:
                  "Perplexity Sonar Pro analyzes competitors, finds content gaps, and researches SERP data.",
              },
              {
                icon: Bot,
                title: "AI Writing",
                description:
                  "Gemini 3.1 Pro generates 1,500-4,000 word SEO-optimized articles with your brand voice.",
              },
              {
                icon: Image,
                title: "AI Images",
                description:
                  "Imagen 4.0 creates unique featured images. No stock photos needed.",
              },
              {
                icon: Link2,
                title: "Internal Linking",
                description:
                  "Automated internal linking engine connects your content for better SEO.",
              },
              {
                icon: Globe,
                title: "Multi-Website",
                description:
                  "Manage blogs for multiple websites from a single dashboard.",
              },
              {
                icon: Share2,
                title: "Social Posting",
                description:
                  "Auto-share to Twitter/X and LinkedIn when posts are published.",
              },
              {
                icon: BarChart3,
                title: "Analytics",
                description:
                  "Track rankings, traffic, and content performance with GSC integration.",
              },
              {
                icon: Zap,
                title: "IndexNow",
                description:
                  "Instant search engine notification for faster indexing.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl p-6 border hover:shadow-lg transition-shadow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground">
              Three steps to automated content marketing
            </p>
          </div>
          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Add Your Website",
                description:
                  "Enter your domain, describe your niche, and configure your brand voice and target audience.",
              },
              {
                step: "2",
                title: "Add Keywords",
                description:
                  "Manually add keywords or let AI generate topic clusters. Set priorities and let the queue work.",
              },
              {
                step: "3",
                title: "AI Does the Rest",
                description:
                  "Research, write, optimize, generate images, publish, and promote — all fully automated.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free. Scale as you grow.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              { name: "Free", price: 0, sites: 1, posts: 5, highlight: false },
              { name: "Starter", price: 29, sites: 3, posts: 20, highlight: false },
              { name: "Growth", price: 79, sites: 10, posts: 60, highlight: true },
              { name: "Agency", price: 199, sites: 50, posts: 200, highlight: false },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`bg-background rounded-xl p-6 border ${
                  plan.highlight ? "border-primary shadow-lg relative" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-3 mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {plan.sites} website{plan.sites !== 1 ? "s" : ""}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {plan.posts} posts/month
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    AI image generation
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    SEO optimization
                  </li>
                </ul>
                <Button
                  asChild
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to automate your content marketing?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of businesses using AI to grow their organic traffic.
          </p>
          <Button asChild size="lg" className="text-lg px-8 h-12">
            <Link href="/register">
              Start for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
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
