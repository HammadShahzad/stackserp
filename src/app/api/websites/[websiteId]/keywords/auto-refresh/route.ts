/**
 * POST /api/websites/:id/keywords/auto-refresh
 * AI-powered keyword suggestions when the queue is running low.
 * Analyzes existing content, niche, and trends to suggest new keywords.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateJSON } from "@/lib/ai/gemini";

export const maxDuration = 60;

type Params = { params: Promise<{ websiteId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: { include: { websites: { select: { id: true } } } } },
  });
  if (!membership?.organization.websites.some((w) => w.id === websiteId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [website, existingPosts, existingKeywords] = await Promise.all([
    prisma.website.findUnique({
      where: { id: websiteId },
      select: { niche: true, brandName: true, targetAudience: true, description: true },
    }),
    prisma.blogPost.findMany({
      where: { websiteId, status: "PUBLISHED" },
      select: { title: true, focusKeyword: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
    prisma.blogKeyword.findMany({
      where: { websiteId },
      select: { keyword: true },
    }),
  ]);

  if (!website) return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const coveredTopics = [
    ...existingPosts.map((p) => p.focusKeyword || p.title),
    ...existingKeywords.map((k) => k.keyword),
  ].filter(Boolean);

  interface KeywordSuggestion {
    keyword: string;
    intent: string;
    difficulty: string;
    reasoning: string;
  }

  const suggestions = await generateJSON<{ keywords: KeywordSuggestion[] }>(
    `You are an SEO keyword strategist for ${website.brandName}, a ${website.description} targeting ${website.targetAudience} in the ${website.niche} niche.

Topics already covered (do NOT suggest these):
${coveredTopics.slice(0, 30).map((t) => `- ${t}`).join("\n")}

Suggest 15-20 new keyword ideas that:
1. Fill content gaps in their existing library
2. Target different search intents (informational, transactional, commercial)
3. Include a mix of head terms and long-tail keywords
4. Are relevant to ${website.niche} and would attract ${website.targetAudience}
5. Have realistic ranking potential for a growing blog

For each keyword provide:
- keyword: the target keyword phrase
- intent: "informational" | "transactional" | "commercial" | "navigational"
- difficulty: "low" | "medium" | "high"
- reasoning: one sentence explaining why this keyword is valuable

Return JSON: { "keywords": [{ "keyword", "intent", "difficulty", "reasoning" }] }`,
    "You are an SEO expert. Return valid JSON only."
  );

  return NextResponse.json({
    suggestions: suggestions.keywords || [],
    coveredTopics: coveredTopics.length,
    websiteName: website.brandName,
  });
}
