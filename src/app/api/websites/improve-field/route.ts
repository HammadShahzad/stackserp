import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateText } from "@/lib/ai/gemini";
import { checkAiRateLimit } from "@/lib/api-helpers";

const FIELD_PROMPTS: Record<string, string> = {
  niche: "Rewrite this niche/industry description to be clearer and more specific for SEO content targeting. Keep it concise (under 10 words).",
  description: "Rewrite this business description to be clear, compelling, and concise (2-3 sentences). Focus on what the business does and the value it provides.",
  targetAudience: "Rewrite this target audience description to be more specific and useful for content targeting. Include demographics, pain points, or goals. Keep it to 1-2 sentences.",
  tone: "Rewrite this brand tone description to be a clear, actionable writing style guide (e.g. 'professional yet approachable with a touch of humor'). Keep it under 15 words.",
  uniqueValueProp: "Rewrite this unique value proposition to be compelling, specific, and differentiating. What makes this business clearly better than alternatives? 1-2 sentences.",
  suggestedCtaText: "Rewrite this call-to-action text to be more compelling and action-oriented. Keep it under 8 words.",
  brandName: "Clean up this brand name — proper capitalization, no domain suffixes. Return only the brand name.",
  targetLocation: "Rewrite this geographic target to be clear and specific (e.g. 'United States' or 'UK and Western Europe'). Keep it concise.",
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitErr = checkAiRateLimit(session.user.id, "improve-field", 30);
    if (rateLimitErr) return rateLimitErr;

    const { field, value, brandName, niche } = await req.json();

    if (!field || !value || typeof value !== "string" || value.length > 1000) {
      return NextResponse.json({ error: "field and value are required" }, { status: 400 });
    }

    const fieldInstruction = FIELD_PROMPTS[field] || "Rewrite this text to be clearer, more professional, and more specific. Keep the same intent.";

    const context = [
      brandName ? `Brand: ${brandName}` : "",
      niche ? `Niche: ${niche}` : "",
    ].filter(Boolean).join(". ");

    const improved = await generateText(
      `${fieldInstruction}

${context ? `Context: ${context}\n` : ""}Original text: "${value}"

Return ONLY the improved text — no quotes, no explanation, no labels.`,
      "You are a concise copywriting expert. Return only the improved text.",
      { temperature: 0.5, maxTokens: 300 },
    );

    return NextResponse.json({ improved: improved.trim().replace(/^["']|["']$/g, "") });
  } catch (error) {
    console.error("Improve field error:", error);
    return NextResponse.json({ error: "Failed to improve text" }, { status: 500 });
  }
}
