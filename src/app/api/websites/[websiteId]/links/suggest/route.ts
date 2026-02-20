import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SuggestedLink {
  keyword: string;
  url: string;
  reason: string;
}

export interface SuggestResponse {
  suggestions: SuggestedLink[];
  steps: {
    perplexity: "ok" | "skipped" | "failed";
    gemini: "ok" | "failed";
    pagesFound: number;
  };
  error?: string;
}

async function discoverPagesWithPerplexity(domain: string): Promise<{
  content: string;
  status: "ok" | "skipped" | "failed";
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { content: "", status: "skipped" };

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content:
              "You are a website crawler assistant. List the real, actual pages/sections found on a website with their full URLs. Be factual — only include pages that actually exist.",
          },
          {
            role: "user",
            content: `Visit ${domain} and list all the important pages you find (homepage, product pages, feature pages, pricing, blog, about, contact, etc.). For each page provide: the page title and its full URL. Format as a simple list: "Page Title | https://full-url". Include at least 10-20 pages if they exist.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) return { content: "", status: "failed" };
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, status: content ? "ok" : "failed" };
  } catch {
    return { content: "", status: "failed" };
  }
}

async function generateLinkPairsWithGemini(
  domain: string,
  websiteName: string,
  niche: string,
  pagesContext: string,
  existingKeywords: string[]
): Promise<{ links: SuggestedLink[]; status: "ok" | "failed" }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return { links: [], status: "failed" };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const existingList =
    existingKeywords.length > 0
      ? `\n\nAlready mapped keywords (skip these): ${existingKeywords.join(", ")}`
      : "";

  const pagesSection = pagesContext
    ? `\n\nPages discovered on the site:\n${pagesContext}`
    : `\n\nWebsite domain: ${domain} — no page list available, use the domain to infer likely pages (homepage, /pricing, /features, /about, /blog, etc.)`;

  const prompt = `You are an SEO internal linking expert. Generate keyword → URL pairs for internal linking on the website "${websiteName}" (${domain}) in the "${niche}" niche.${pagesSection}${existingList}

For each important page/feature/topic on this website, create a keyword that:
1. Is a natural phrase someone would write in a blog post (2-5 words)
2. Accurately describes what that page is about
3. Is different from existing keywords listed above

Return ONLY valid JSON array, no markdown:
[
  {
    "keyword": "the keyword phrase",
    "url": "https://full-url-to-page",
    "reason": "one sentence why this link is valuable for SEO"
  }
]

Generate 15-25 high-value internal link pairs. If no page list was provided, use common page patterns for this type of website.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { links: [], status: "failed" };
    const links = JSON.parse(jsonMatch[0]) as SuggestedLink[];
    return { links, status: links.length > 0 ? "ok" : "failed" };
  } catch {
    return { links: [], status: "failed" };
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: {
        id: true,
        name: true,
        domain: true,
        brandUrl: true,
        niche: true,
        organizationId: true,
        internalLinks: { select: { keyword: true } },
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const org = await prisma.organization.findFirst({
      where: {
        id: website.organizationId,
        members: { some: { userId: session.user.id } },
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const domain = (website.brandUrl || `https://${website.domain}`).replace(/\/$/, "");
    const existingKeywords = website.internalLinks.map((l: { keyword: string }) => l.keyword);

    // Step 1: Discover pages with Perplexity
    const perplexityResult = await discoverPagesWithPerplexity(domain);

    // Step 2: Generate keyword→URL pairs with Gemini (works even without Perplexity)
    const geminiResult = await generateLinkPairsWithGemini(
      domain,
      website.name,
      website.niche ?? "general",
      perplexityResult.content,
      existingKeywords
    );

    // Filter valid suggestions
    const existing = new Set(existingKeywords.map((k) => k.toLowerCase()));
    const filtered = geminiResult.links.filter(
      (s) =>
        s.keyword?.trim() &&
        s.url?.trim() &&
        !existing.has(s.keyword.toLowerCase()) &&
        (s.url.startsWith("http://") || s.url.startsWith("https://"))
    );

    // Count pages found (lines with "|" separator)
    const pagesFound = perplexityResult.content
      ? perplexityResult.content.split("\n").filter((l) => l.includes("|")).length
      : 0;

    const response: SuggestResponse = {
      suggestions: filtered,
      steps: {
        perplexity: perplexityResult.status,
        gemini: geminiResult.status,
        pagesFound,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating link suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
