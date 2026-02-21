import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateText } from "@/lib/ai/gemini";

export const maxDuration = 30;

async function verifyAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });
  return membership?.organization.websites.find((w) => w.id === websiteId) || null;
}

/**
 * POST /api/websites/[websiteId]/ai-rewrite
 * AI-rewrite a section of content: rewrite, expand, shorten, improve, or custom.
 * Body: { text: string, action: 'rewrite' | 'expand' | 'shorten' | 'improve' | 'custom', customPrompt?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;
  const website = await verifyAccess(websiteId, session.user.id);
  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const { text, action, customPrompt } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const actions: Record<string, string> = {
    rewrite: `Rewrite this text to be clearer and more engaging while keeping the same meaning and factual content. Maintain a professional yet conversational tone.`,
    expand: `Expand this text with more detail, concrete examples, statistics, and explanation. Add 2-3x more content while keeping it relevant and valuable.`,
    shorten: `Condense this text to about half its length. Keep only the key points and most important information. Cut fluff and redundancy.`,
    improve: `Improve this text for SEO and readability. Make it more scannable with better sentence structure, stronger word choices, and clearer transitions. Fix any grammar issues.`,
    custom: customPrompt?.trim() || "Improve this text.",
  };

  const instruction = actions[action] || actions.improve;

  const prompt = `${instruction}

The blog is for ${website.brandName}, a ${website.niche} platform. Match its tone.

## Text to ${action}:
${text}

## Rules:
- Output ONLY the rewritten text in Markdown format (no code fences, no explanations)
- Preserve any existing markdown links and formatting
- Keep the same general structure (headings, lists, etc.) unless "shorten" or "expand"`;

  const result = await generateText(
    prompt,
    `You are an expert blog editor for ${website.brandName}, a ${website.niche} platform.`,
    { temperature: 0.7, maxTokens: 2048 }
  );

  const output = result
    .replace(/^```(?:markdown|md|html|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  return NextResponse.json({ result: output, action });
}
