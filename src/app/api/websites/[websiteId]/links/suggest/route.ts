import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateJSON } from "@/lib/ai/gemini";
import { crawlWebsite } from "@/lib/website-crawler";

export const maxDuration = 60;

export interface SuggestedLink {
  keyword: string;
  url: string;
  reason: string;
}

export interface SuggestResponse {
  suggestions: SuggestedLink[];
  steps: {
    crawl: "ok" | "failed";
    gemini: "ok" | "failed";
    error?: string;
    pagesFound: number;
  };
  error?: string;
}

async function generateLinkPairsWithGemini(
  domain: string,
  websiteName: string,
  niche: string,
  pagesContext: string,
  existingKeywords: string[]
): Promise<{ links: SuggestedLink[]; status: "ok" | "failed"; error?: string }> {
  if (!process.env.GOOGLE_AI_API_KEY) return { links: [], status: "failed" };

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

Generate 15-25 high-value internal link pairs. Return a JSON array:
[
  {
    "keyword": "the keyword phrase",
    "url": "https://full-url-to-page",
    "reason": "one sentence why this link is valuable for SEO"
  }
]`;

  try {
    const links = await generateJSON<SuggestedLink[]>(
      prompt,
      "You are an SEO internal linking expert. Return a JSON array only."
    );
    return { links: Array.isArray(links) ? links : [], status: Array.isArray(links) && links.length > 0 ? "ok" : "failed" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Links Gemini error]", msg);
    return { links: [], status: "failed", error: msg };
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
        faviconUrl: true,
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

    // Crawl the actual website directly — no Perplexity needed
    let crawlStatus: "ok" | "failed" = "failed";
    let pagesContext = "";
    let pagesFound = 0;

    try {
      const crawlResult = await crawlWebsite(domain);

      // Auto-update favicon if we found one and it's not set
      if (crawlResult.favicon && !website.faviconUrl) {
        await prisma.website.update({
          where: { id: websiteId },
          data: { faviconUrl: crawlResult.favicon },
        }).catch(() => {});
      }

      if (crawlResult.pages.length > 0) {
        crawlStatus = "ok";
        pagesFound = crawlResult.pages.length;
        pagesContext = crawlResult.pages
          .map((p) => `${p.title} | ${p.url}`)
          .join("\n");
      }
    } catch (err) {
      console.error("[Crawl error]", err);
    }

    // Generate keyword→URL pairs with Gemini using crawled pages
    const geminiResult = await generateLinkPairsWithGemini(
      domain,
      website.name,
      website.niche ?? "general",
      pagesContext,
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

    const response: SuggestResponse = {
      suggestions: filtered,
      steps: {
        crawl: crawlStatus,
        gemini: geminiResult.status,
        error: geminiResult.error,
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
