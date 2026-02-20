import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import {
  Zap,
  Search,
  FileText,
  Image as ImageIcon,
  Link2,
  Share2,
  BarChart3,
  Globe,
  ArrowRight,
  CheckCircle2,
  Bot,
  Sparkles,
  XCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Star,
  Quote,
  Layout,
  Cpu
} from "lucide-react";

export const metadata: Metadata = {
  title: "StackSerp — Automate Your SEO Blog in Minutes",
  description:
    "Publish months of high-ranking SEO content without writing a single word. AI research, writing, and publishing—all on autopilot.",
  openGraph: {
    title: "StackSerp — Automate Your SEO Blog in Minutes",
    description:
      "Publish months of high-ranking SEO content without writing a single word. AI research, writing, and publishing—all on autopilot.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-110 shadow-lg shadow-primary/20">
                <Logo className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">StackSerp</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#features"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                FAQ
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
                <Link href="/register">
                  Start Ranking Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-sm animate-fade-in-up">
            <Sparkles className="mr-2 h-3.5 w-3.5 fill-primary" />
            <span>New: Agentic Research Mode Live</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] animate-fade-in-up delay-100">
            Dominate Search Rankings <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600">
              Without Hiring Writers.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in-up delay-200">
            Generate high-quality, SEO-optimized blog posts in minutes. 
            Perfect for agencies and growth marketers who need results, not fluff.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up delay-300">
            <Button asChild size="lg" className="text-lg px-8 h-14 w-full sm:w-auto shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-1">
              <Link href="/register">
                Start Ranking for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 h-14 w-full sm:w-auto bg-background/50 backdrop-blur border-muted-foreground/20 hover:bg-muted/50 transition-all">
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative mx-auto max-w-5xl rounded-xl border bg-background/50 p-2 shadow-2xl backdrop-blur-sm lg:rounded-2xl lg:p-4 animate-fade-in-up delay-500">
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
               {/* Mockup Header */}
               <div className="flex items-center border-b bg-muted/30 px-4 py-2.5">
                 <div className="flex space-x-2">
                   <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                   <div className="h-3 w-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                   <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                 </div>
                 <div className="mx-auto flex h-6 w-1/2 max-w-[300px] items-center justify-center rounded-md bg-muted/50 text-[10px] text-muted-foreground">
                   stackserp.com/dashboard/generator
                 </div>
               </div>
               
               {/* Mockup Body */}
               <div className="grid md:grid-cols-12 gap-0 h-[400px] md:h-[500px]">
                 {/* Sidebar */}
                 <div className="hidden md:block col-span-2 border-r bg-muted/10 p-4 space-y-4">
                   <div className="h-8 w-full bg-primary/10 rounded-md animate-pulse"></div>
                   <div className="space-y-2">
                     <div className="h-6 w-3/4 bg-muted/40 rounded animate-pulse"></div>
                     <div className="h-6 w-full bg-muted/40 rounded animate-pulse"></div>
                     <div className="h-6 w-5/6 bg-muted/40 rounded animate-pulse"></div>
                   </div>
                 </div>
                 
                 {/* Main Content */}
                 <div className="col-span-12 md:col-span-7 p-6 space-y-6">
                   <div className="flex items-center justify-between">
                     <div className="space-y-2">
                       <div className="h-8 w-64 bg-muted/60 rounded animate-pulse"></div>
                       <div className="h-4 w-96 bg-muted/40 rounded animate-pulse"></div>
                     </div>
                     <Badge className="bg-green-500/10 text-green-600 border-green-200">SEO Score: 98/100</Badge>
                   </div>
                   
                   <div className="space-y-4">
                     <div className="h-4 w-full bg-muted/30 rounded animate-pulse delay-75"></div>
                     <div className="h-4 w-[95%] bg-muted/30 rounded animate-pulse delay-100"></div>
                     <div className="h-4 w-[90%] bg-muted/30 rounded animate-pulse delay-150"></div>
                     <div className="h-32 w-full bg-muted/20 rounded-lg animate-pulse delay-200 border-dashed border-2 flex items-center justify-center text-muted-foreground/30">
                       AI Generated Image
                     </div>
                     <div className="h-4 w-full bg-muted/30 rounded animate-pulse delay-300"></div>
                     <div className="h-4 w-[92%] bg-muted/30 rounded animate-pulse delay-400"></div>
                   </div>
                 </div>
                 
                 {/* SEO Panel */}
                 <div className="hidden md:block col-span-3 border-l bg-muted/5 p-4 space-y-4">
                   <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Optimization</div>
                   <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <div className="h-3 w-32 bg-muted/40 rounded"></div>
                        </div>
                      ))}
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-blue-500" />
                          <span className="text-xs font-semibold text-blue-700">AI Suggestions</span>
                        </div>
                        <div className="h-12 w-full bg-blue-100/30 rounded text-xs p-2 text-blue-900/60">
                           Adding more internal links could boost authority...
                        </div>
                      </div>
                   </div>
                 </div>
               </div>
            </div>
            
            {/* Floating Badges */}
            <div className="absolute -right-4 top-20 bg-background/90 backdrop-blur border p-3 rounded-lg shadow-xl hidden lg:block animate-float">
               <div className="flex items-center gap-3">
                 <div className="bg-green-100 p-2 rounded-full">
                   <TrendingUp className="h-5 w-5 text-green-600" />
                 </div>
                 <div>
                   <div className="text-xs text-muted-foreground">Traffic Growth</div>
                   <div className="font-bold text-sm">+240% vs last month</div>
                 </div>
               </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mt-12">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>5 free posts/mo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trusted By */}
      <section className="py-10 border-y bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-8">
            Trusted by 2,000+ Modern Marketing Teams
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 text-xl font-bold"><Zap className="h-6 w-6" /> TechFlow</div>
            <div className="flex items-center gap-2 text-xl font-bold"><Globe className="h-6 w-6" /> GlobalReach</div>
            <div className="flex items-center gap-2 text-xl font-bold"><BarChart3 className="h-6 w-6" /> ScaleUp</div>
            <div className="flex items-center gap-2 text-xl font-bold"><Bot className="h-6 w-6" /> AI Daily</div>
            <div className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="h-6 w-6" /> RankFast</div>
          </div>
        </div>
      </section>

      {/* Problem Agitation Section */}
      <section className="py-24 px-4 bg-background relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="mb-4 border-red-200 bg-red-50 text-red-600">The Problem</Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Why is SEO still so <span className="text-red-600 underline decoration-red-300 decoration-wavy underline-offset-4">painful?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                You know you need content to grow, but the process is broken. 
                Most founders spend 20+ hours a week just managing writers.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 p-4 rounded-lg bg-red-50/50 border border-transparent hover:border-red-100 transition-colors">
                  <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground text-lg">Wasting hours on research</strong>
                    <span className="text-muted-foreground">Guessing keywords and staring at blank Google Docs is not a strategy.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 rounded-lg bg-red-50/50 border border-transparent hover:border-red-100 transition-colors">
                  <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground text-lg">Spending $500+ per article</strong>
                    <span className="text-muted-foreground">Managing freelancers who miss deadlines and deliver fluff is a full-time job.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 rounded-lg bg-red-50/50 border border-transparent hover:border-red-100 transition-colors">
                  <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground text-lg">The "Content Treadmill"</strong>
                    <span className="text-muted-foreground">Formatting, finding images, and fixing meta tags manually kills your momentum.</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-red-100 to-transparent rounded-2xl opacity-50 blur-3xl group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-card border shadow-xl rounded-2xl p-8 transform group-hover:scale-[1.02] transition-transform duration-500">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-32 bg-red-100 rounded text-xs flex items-center px-2 text-red-700 font-bold">INVOICE #4092</div>
                    <div className="text-red-600 font-bold">Unpaid</div>
                  </div>
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                  <div className="h-40 w-full bg-muted/50 rounded flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-sm">Waiting for draft (3 days overdue)...</span>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                     <div className="h-8 w-24 bg-red-100 rounded" />
                     <div className="h-8 w-24 bg-muted rounded" />
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl font-bold transform rotate-3 flex flex-col items-center border-4 border-white">
                  <span className="text-xs uppercase opacity-80">Total Cost</span>
                  <span className="text-2xl">$450.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution / Features Section */}
      <section id="features" className="py-24 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/10 text-primary">The Solution</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Your Entire Content Team in One AI.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              StackSerp replaces 5 different tools and a freelancer team. 
              From keyword to published post in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-background rounded-2xl p-8 shadow-sm border hover:border-blue-500/50 hover:shadow-lg transition-all group">
              <div className="h-14 w-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Deep Research Agent</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We don't just guess. Our AI analyzes top-ranking competitors, finds content gaps, and sources real data to ensure you rank #1.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">1</div>
                  <span className="text-sm font-medium">Live SERP Analysis</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">2</div>
                  <span className="text-sm font-medium">Competitor Gap Finder</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">3</div>
                  <span className="text-sm font-medium">Citations & Sources</span>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-background rounded-2xl p-8 shadow-sm border hover:border-purple-500/50 hover:shadow-lg transition-all group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Bot className="h-40 w-40" />
               </div>
              <div className="h-14 w-14 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Human-Like Writing</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Powered by Gemini 3.1 Pro + Claude. We write long-form content (2,000+ words) that sounds like you, not a robot.
              </p>
               <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">1</div>
                  <span className="text-sm font-medium">Custom Brand Voice</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">2</div>
                  <span className="text-sm font-medium">Auto-Internal Linking</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">3</div>
                  <span className="text-sm font-medium">No Fluff or Jargon</span>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-background rounded-2xl p-8 shadow-sm border hover:border-green-500/50 hover:shadow-lg transition-all group">
              <div className="h-14 w-14 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">One-Click Publish</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Connect your CMS and publish directly. We handle formatting, images, meta tags, and schema automatically.
              </p>
               <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">1</div>
                  <span className="text-sm font-medium">WordPress, Webflow, Shopify</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">2</div>
                  <span className="text-sm font-medium">AI-Generated Images</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">3</div>
                  <span className="text-sm font-medium">Instant Indexing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Comparison */}
      <section id="how-it-works" className="py-24 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              From Keyword to Ranking in 3 Steps
            </h2>
            <p className="text-lg text-muted-foreground">It's really this simple.</p>
          </div>
          
          <div className="relative border-l-2 border-muted ml-4 md:ml-1/2 space-y-20">
            {[
              {
                step: 1,
                title: "Enter Your Topic",
                text: "Just give us a keyword or a broad topic. We'll find the best opportunities and cluster them for authority.",
                icon: Search,
                color: "blue"
              },
              {
                step: 2,
                title: "Customize & Generate",
                text: "Set your tone, word count, and format. Our AI researches and writes the full article in minutes.",
                icon: Sparkles,
                color: "purple"
              },
              {
                step: 3,
                title: "Publish & Rank",
                text: "Review the draft (if you want) and push to your site with one click. We notify Google immediately.",
                icon: TrendingUp,
                color: "green"
              }
            ].map((item, i) => (
              <div key={i} className="relative pl-8 md:pl-0">
                <div className="md:w-1/2 md:mx-auto md:relative md:flex md:justify-end md:pr-16 md:text-right">
                  <div className={`
                    absolute left-[-9px] top-0 h-5 w-5 rounded-full border-4 border-background 
                    ${item.color === 'blue' ? 'bg-blue-500' : item.color === 'purple' ? 'bg-purple-500' : 'bg-green-500'}
                    md:left-1/2 md:-translate-x-1/2 md:top-2 shadow-lg z-10
                  `}></div>
                  
                  <div className={`md:w-full flex flex-col ${i % 2 === 0 ? 'md:items-end md:text-right md:pr-0' : 'md:items-start md:text-left md:pl-16 md:ml-auto md:flex-row-reverse md:justify-end'}`}>
                    <div className={`${i % 2 !== 0 ? 'md:absolute md:left-[55%]' : ''} mb-4 md:mb-0 bg-muted/20 p-6 rounded-2xl border hover:border-${item.color}-500/30 transition-colors w-full md:max-w-md`}>
                       <div className={`h-12 w-12 rounded-lg bg-${item.color}-100 flex items-center justify-center mb-4 text-${item.color}-600 ${i % 2 === 0 ? 'md:ml-auto' : ''}`}>
                         <item.icon className="h-6 w-6" />
                       </div>
                      <h3 className="text-xl font-bold mb-2 flex items-center gap-2 md:inline-flex">
                        <span className="md:hidden">{item.step}.</span> {item.title}
                      </h3>
                      <p className="text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 bg-muted/10 border-y">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Loved by Growth Teams
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
             {[
               {
                 quote: "We increased our organic traffic by 400% in 3 months. StackSerp is the secret weapon for our agency.",
                 author: "Alex J.",
                 role: "Founder, GrowthAgency",
                 rating: 5
               },
               {
                 quote: "I used to pay writers $300/article. Now I generate better content for pennies. It's a no-brainer.",
                 author: "Sarah M.",
                 role: "Marketing Director, SaaS Co",
                 rating: 5
               },
               {
                 quote: "The internal linking feature alone saved me weeks of manual work. Best SEO tool I've used this year.",
                 author: "David K.",
                 role: "SEO Specialist",
                 rating: 5
               }
             ].map((t, i) => (
               <div key={i} className="bg-background p-8 rounded-2xl shadow-sm border relative">
                 <Quote className="absolute top-6 right-6 h-8 w-8 text-muted-foreground/10" />
                 <div className="flex gap-1 mb-4">
                   {[...Array(t.rating)].map((_, i) => (
                     <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                   ))}
                 </div>
                 <p className="text-lg mb-6 leading-relaxed">"{t.quote}"</p>
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500"></div>
                   <div>
                     <div className="font-bold">{t.author}</div>
                     <div className="text-sm text-muted-foreground">{t.role}</div>
                   </div>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple Pricing, ROI in Days.
            </h2>
            <p className="text-lg text-muted-foreground">
              Cheaper than one hour of a freelancer's time.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              { name: "Free", price: 0, sites: 1, posts: 5, highlight: false, btn: "Start Free" },
              { name: "Starter", price: 29, sites: 3, posts: 20, highlight: false, btn: "Get Starter" },
              { name: "Growth", price: 79, sites: 10, posts: 60, highlight: true, btn: "Get Growth" },
              { name: "Agency", price: 199, sites: 50, posts: 200, highlight: false, btn: "Get Agency" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`bg-background rounded-xl p-8 border-2 flex flex-col ${
                  plan.highlight 
                    ? "border-primary shadow-2xl relative scale-105 z-10" 
                    : "border-muted shadow-md hover:border-primary/20"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary px-3 py-1 text-sm shadow-lg">Most Popular</Badge>
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>
                <div className="flex-1">
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <strong>{plan.sites}</strong> website{plan.sites !== 1 ? "s" : ""}
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <strong>{plan.posts}</strong> posts/month
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      AI Image Generation
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      Auto-Internal Linking
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      Instant Indexing
                    </li>
                  </ul>
                </div>
                <Button
                  asChild
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <Link href="/register">{plan.btn}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 bg-muted/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
             {[
               { q: "Will the content pass AI detectors?", a: "We focus on quality and value first. Our 'Human-Like' writing mode uses advanced prompting and multi-model editing to create natural, engaging content that reads well for humans, which is what actually matters to Google." },
               { q: "Can I edit the posts before publishing?", a: "Absolutely. You get a full markdown editor to review, tweak, and perfect every post before it goes live. You're always in control." },
               { q: "Does it work for my niche?", a: "Yes. StackSerp uses Perplexity for real-time research, so it can write about current events, technical topics, and specific niches with up-to-date accuracy." },
               { q: "How does the 'Auto-Internal Linking' work?", a: "We scan your existing blog posts and automatically find relevant anchor text opportunities in the new articles to link back to your other pages, boosting your SEO structure." }
             ].map((faq, i) => (
               <div key={i} className="border rounded-xl p-6 bg-background hover:shadow-md transition-shadow">
                 <h3 className="font-bold text-lg mb-2">{faq.q}</h3>
                 <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Stop waiting. Start ranking.
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join the smart founders who are automating their growth. 
            Get your first 5 posts for free today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="text-lg px-10 h-14 w-full sm:w-auto shadow-xl hover:scale-105 transition-transform bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/register">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
             <p className="text-sm text-muted-foreground mt-4 sm:mt-0 sm:hidden">
              No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Logo className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">StackSerp</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              The all-in-one AI content marketing platform for startups and agencies.
            </p>
          </div>
          
          <div className="flex gap-8 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="mailto:support@stackserp.com" className="hover:text-foreground">Contact</Link>
          </div>
          
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} StackSerp.
          </p>
        </div>
      </footer>
    </div>
  );
}
