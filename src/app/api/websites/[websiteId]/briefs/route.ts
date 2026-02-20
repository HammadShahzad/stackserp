/**
 * Content Briefs API
 * GET  /api/websites/:id/briefs     → List briefs
 * POST /api/websites/:id/briefs     → Generate a new brief with AI
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateJSON } from "@/lib/ai/gemini";
import { researchKeyword } from "@/lib/ai/research";

export const maxDuration = 60;

type Params = { params: Promise<{ websiteId: string }> };

async function verifyAccess(websiteId: string, userId: string) {
  const m = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: { select: { id: true } } } } },
  });
  return m?.organization.websites.some((w) => w.id === websiteId) ?? false;
}

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await params;
  if (!(await verifyAccess(websiteId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const briefs = await prisma.contentBrief.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(briefs);
}

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await params;
  if (!(await verifyAccess(websiteId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const keyword = body.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { niche: true, brandName: true, targetAudience: true },
  });
  if (!website) return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const research = await researchKeyword(keyword, website);

  interface BriefData {
    title: string;
    outline: { heading: string; points: string[] }[];
    suggestedWordCount: number;
    contentGaps: string[];
    uniqueAngle: string;
    suggestedHeadings: string[];
    competitorUrls: string[];
  }

  const briefData = await generateJSON<BriefData>(
    `Create a detailed content brief for the keyword "${keyword}" for ${website.brandName} (${website.niche}).

Target audience: ${website.targetAudience}

Research context:
- Top ranking content: ${research.topRankingContent}
- Content gaps: ${research.contentGaps.join(", ")}
- Competitor headings: ${research.competitorHeadings.join(", ")}

Generate a content brief with:
1. A compelling article title
2. Detailed outline with H2 sections (5-8) and key points for each
3. Suggested word count (1500-4000)
4. Content gaps to address
5. Unique angle/perspective
6. Recommended H2/H3 headings
7. Competitor URLs analyzed (list 3-5 placeholder URLs)

Return JSON: { "title", "outline": [{"heading","points":[]}], "suggestedWordCount", "contentGaps": [], "uniqueAngle", "suggestedHeadings": [], "competitorUrls": [] }`,
    "You are an SEO content strategist. Return valid JSON only."
  );

  const brief = await prisma.contentBrief.create({
    data: {
      websiteId,
      title: briefData.title,
      targetKeyword: keyword,
      outline: briefData.outline as object,
      competitorUrls: briefData.competitorUrls || [],
      suggestedWordCount: briefData.suggestedWordCount || 2000,
      suggestedHeadings: briefData.suggestedHeadings as object || [],
      contentGaps: briefData.contentGaps || [],
      uniqueAngle: briefData.uniqueAngle || null,
      status: "DRAFT",
    },
  });

  return NextResponse.json(brief, { status: 201 });
}
