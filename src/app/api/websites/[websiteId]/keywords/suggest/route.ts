import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateJSON } from "@/lib/ai/gemini";
import { verifyWebsiteAccess } from "@/lib/api-helpers";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    let seedKeyword = "";
    try {
      const body = await req.json();
      seedKeyword = body.seedKeyword?.trim() || "";
    } catch {
      // No body or invalid JSON — that's fine, proceed without seed
    }

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: {
        niche: true,
        targetAudience: true,
        brandName: true,
        description: true,
        brandUrl: true,
        domain: true,
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    // Get existing keywords to avoid duplicates
    const existing = await prisma.blogKeyword.findMany({
      where: { websiteId },
      select: { keyword: true },
    });
    const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()));
    const existingList = existing.length > 0
      ? `\n\nAlready added keywords (do NOT repeat these):\n${existing.slice(0, 50).map(k => `- ${k.keyword}`).join("\n")}`
      : "";

    const websiteUrl = website.brandUrl || (website.domain ? `https://${website.domain}` : "");

    interface SuggestionsResponse {
      keywords: Array<{
        keyword: string;
        intent: "informational" | "commercial" | "navigational" | "transactional";
        difficulty: "low" | "medium" | "high";
        priority: number;
        rationale: string;
      }>;
    }

    const topicFocus = seedKeyword
      ? `\n\n## FOCUS TOPIC: "${seedKeyword}"\nAll 20 keywords MUST be specifically about "${seedKeyword}" as it relates to ${website.brandName}'s ${website.niche} business. Do NOT suggest keywords outside the scope of "${seedKeyword}".`
      : "";

    const result = await generateJSON<SuggestionsResponse>(
      `You are an SEO strategist for the following business. Generate 20 high-value blog keyword ideas STRICTLY relevant to this specific business.

## Business Details:
- Brand: ${website.brandName}${websiteUrl ? ` (${websiteUrl})` : ""}
- Niche: ${website.niche}
- Description: ${website.description || "N/A"}
- Target audience: ${website.targetAudience}${topicFocus}

## Rules:
- Every keyword MUST directly relate to ${website.brandName}'s niche: "${website.niche}"${seedKeyword ? `\n- Every keyword MUST be about or related to "${seedKeyword}"` : ""}
- Do NOT suggest generic or off-topic keywords unrelated to this business
- Focus on keywords that a potential customer of ${website.brandName} would actually search for
- Long-tail keywords (3-6 words) that can support a 1000-2000 word blog post
- Mix of informational ("how to..."), commercial ("best..."), and comparison keywords
- Realistic difficulty — not too broad (entire industry), not too obscure${existingList}

Return JSON:
{
  "keywords": [
    {
      "keyword": "exact keyword phrase here",
      "intent": "informational",
      "difficulty": "low",
      "priority": 8,
      "rationale": "Why this keyword is relevant to ${website.brandName} and its audience"
    }
  ]
}`,
      `You are an SEO strategist specializing in the ${website.niche} industry for ${website.brandName}.${seedKeyword ? ` Focus all suggestions around the topic: "${seedKeyword}".` : ""} Return only valid JSON. Every keyword must be directly relevant to this specific business.`
    );

    // Filter out already existing keywords
    const filtered = result.keywords.filter(
      (k) => !existingSet.has(k.keyword.toLowerCase())
    );

    return NextResponse.json({ suggestions: filtered });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Keyword suggest error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
