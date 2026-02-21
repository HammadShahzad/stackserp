"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react";

const plans = [
  {
    name: "Free",
    description: "Perfect for trying things out",
    monthlyPrice: 0,
    annualPrice: 0,
    highlight: false,
    cta: "Get Started Free",
    features: {
      websites: "1",
      postsPerMonth: "2",
      aiImages: "2",
      apiAccess: false,
      cmsPush: false,
      socialPublishing: false,
      topicClusters: "0",
      analytics: "Basic",
      teamMembers: "1",
      support: "Community",
      whiteLabel: false,
    },
  },
  {
    name: "Starter",
    description: "For individuals & small blogs",
    monthlyPrice: 29,
    annualPrice: 23,
    highlight: false,
    cta: "Get Started",
    features: {
      websites: "3",
      postsPerMonth: "20",
      aiImages: "20",
      apiAccess: true,
      cmsPush: "WordPress",
      socialPublishing: "1 platform",
      topicClusters: "2/month",
      analytics: "Standard",
      teamMembers: "3",
      support: "Email",
      whiteLabel: false,
    },
  },
  {
    name: "Growth",
    description: "For growing businesses",
    monthlyPrice: 79,
    annualPrice: 63,
    highlight: true,
    cta: "Get Started",
    features: {
      websites: "10",
      postsPerMonth: "60",
      aiImages: "60",
      apiAccess: true,
      cmsPush: "All CMS",
      socialPublishing: "All platforms",
      topicClusters: "10/month",
      analytics: "Advanced",
      teamMembers: "10",
      support: "Priority",
      whiteLabel: false,
    },
  },
  {
    name: "Agency",
    description: "For agencies & large teams",
    monthlyPrice: 199,
    annualPrice: 159,
    highlight: false,
    cta: "Get Started",
    features: {
      websites: "50",
      postsPerMonth: "200",
      aiImages: "200",
      apiAccess: true,
      cmsPush: "All CMS",
      socialPublishing: "All platforms",
      topicClusters: "Unlimited",
      analytics: "Advanced",
      teamMembers: "Unlimited",
      support: "Dedicated",
      whiteLabel: true,
    },
  },
];

const featureLabels: Record<string, string> = {
  websites: "Websites",
  postsPerMonth: "Posts/month",
  aiImages: "AI Images/month",
  apiAccess: "API Access",
  cmsPush: "CMS Push",
  socialPublishing: "Social Publishing",
  topicClusters: "Topic Clusters",
  analytics: "Analytics",
  teamMembers: "Team Members",
  support: "Support",
  whiteLabel: "White Label",
};

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the remainder of your billing cycle. When downgrading, the change takes effect at the start of your next billing cycle.",
  },
  {
    question: "What happens when I hit my post limit?",
    answer:
      "When you reach your monthly post limit, queued posts will pause until the next billing cycle. You can upgrade your plan at any time to increase your limit, or purchase additional post credits.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "We offer a generous Free plan with 5 posts/month so you can try the platform risk-free. No credit card required. When you're ready to scale, upgrade to a paid plan.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Annual billing gives you a 20% discount compared to monthly pricing. You'll be billed once per year. You can cancel anytime and continue using the service until the end of your billing period.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Absolutely. You can cancel at any time from your account settings. Your plan will remain active until the end of your current billing period. No questions asked.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied within the first 14 days, contact support for a full refund.",
  },
  {
    question: "How do team members work?",
    answer:
      "Each plan includes a set number of team seats: Free (1), Starter (3), Growth (10), Agency (unlimited). Team members share the same workspace — websites, posts, and keywords are all accessible to everyone on the team. You can assign roles: Owner (full access including billing), Admin (manage team and settings), or Member (view and edit content). Adding someone requires they have a StackSerp account — just enter their email in Team settings.",
  },
  {
    question: "Can I give different permissions to team members?",
    answer:
      "Yes. Every team member has a role: Owner, Admin, or Member. Owners have full control including billing. Admins can manage websites, generate content, and invite new members. Members can create and edit content but cannot change settings or manage the team.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* Navigation */}
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="mr-1 h-3 w-3" />
            Simple Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Plans that scale with{" "}
            <span className="text-primary">your growth</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Start free. Upgrade when you&apos;re ready. No hidden fees, no
            surprises.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span
              className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}
            >
              Monthly
            </span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span
              className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}
            >
              Annual
            </span>
            {annual && (
              <Badge variant="secondary" className="ml-1 text-xs">
                Save 20%
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {plans.map((plan) => {
              const price = annual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <div
                  key={plan.name}
                  className={`bg-background rounded-xl border flex flex-col ${
                    plan.highlight
                      ? "border-primary shadow-lg shadow-primary/10 relative scale-[1.02]"
                      : "hover:shadow-md transition-shadow"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Most Popular</Badge>
                    </div>
                  )}

                  <div className="p-6 pb-0">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.description}
                    </p>
                    <div className="mt-4 mb-6">
                      <span className="text-4xl font-bold">${price}</span>
                      {price > 0 && (
                        <span className="text-muted-foreground">/mo</span>
                      )}
                      {annual && price > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Billed annually
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-6 flex-1">
                    <ul className="space-y-3 mb-6">
                      {Object.entries(plan.features).map(([key, value]) => {
                        const isBoolean = typeof value === "boolean";
                        return (
                          <li
                            key={key}
                            className="flex items-center gap-2 text-sm"
                          >
                            {isBoolean && !value ? (
                              <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                            <span
                              className={
                                isBoolean && !value
                                  ? "text-muted-foreground/50"
                                  : ""
                              }
                            >
                              {isBoolean
                                ? featureLabels[key]
                                : `${value} ${featureLabels[key]?.toLowerCase() || key}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="p-6 pt-0">
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      <Link href="/register">{plan.cta}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about billing and plans
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-background border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm md:text-base pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                )}
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
    </>
  );
}
