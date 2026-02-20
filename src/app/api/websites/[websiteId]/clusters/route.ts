import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateJSON } from "@/lib/ai/gemini";
import { verifyWebsiteAccess } from "@/lib/api-helpers";
import { crawlWebsite } from "@/lib/website-crawler";

export const maxDuration = 60;

interface ClusterData {
  pillarKeyword: string;
  name: string;
  supportingKeywords: string[];
  rationale: string;
}

async function researchWebsiteDirectly(
  brandUrl: string,
): Promise<{ content: string; status: "ok" | "failed" }> {
  try {
    const crawl = await crawlWebsite(brandUrl);
    if (crawl.pages.length === 0) return { content: "", status: "failed" };

    const content = crawl.pages
      .map((p) => `${p.title} — ${p.url}`)
      .join("\n");
    return { content, status: "ok" };
  } catch {
    return { content: "", status: "failed" };
  }
}

async function generateClustersWithGemini(
  website: {
    name: string;
    brandName: string;
    brandUrl: string;
    niche: string;
    description: string;
    targetAudience: string;
    tone: string;
  },
  existingKeywords: string[],
  perplexityResearch: string
): Promise<{ clusters: ClusterData[]; status: "ok" | "failed"; error?: string }> {
  if (!process.env.GOOGLE_AI_API_KEY) return { clusters: [], status: "failed" };

  const existingSection =
    existingKeywords.length > 0
      ? `\n\nExisting keywords in this account (use these as the primary source for supporting keywords, grouped by theme):\n${existingKeywords.slice(0, 60).join(", ")}`
      : "";

  const researchSection = perplexityResearch
    ? `\n\nReal-time research about this specific website:\n${perplexityResearch}`
    : "";

  const prompt = `You are a senior SEO strategist building topic clusters for a specific business.

BUSINESS DETAILS:
- Brand: ${website.brandName} (${website.brandUrl})
- Blog name: ${website.name}
- Niche: ${website.niche}
- Description: ${website.description}
- Target audience: ${website.targetAudience}
- Tone: ${website.tone}
${researchSection}${existingSection}

Generate 5 topic clusters SPECIFICALLY tailored to "${website.brandName}" and what this business actually does.

Rules:
- Each pillar keyword must be a real topic this specific business should rank for
- Supporting keywords must be realistic long-tail searches their customers actually make
- Do NOT generate generic SEO topics — everything must be specific to this brand's niche
- If existing keywords are provided, prefer grouping those into clusters over inventing new ones
- Pillar keywords: high search volume potential (100-10k/month)
- Supporting keywords: long-tail, 3-6 words, lower competition

Return valid JSON only:
{
  "clusters": [
    {
      "pillarKeyword": "specific pillar keyword for this business",
      "name": "Cluster Theme Name",
      "supportingKeywords": ["long-tail keyword 1", "long-tail keyword 2"],
      "rationale": "Why this cluster matters for ${website.brandName}'s SEO strategy"
    }
  ]
}`;

  try {
    const parsed = await generateJSON<{ clusters: ClusterData[] }>(
      prompt,
      "You are a senior SEO strategist. Return valid JSON only."
    );
    const clusters = parsed.clusters ?? [];
    return { clusters, status: clusters.length > 0 ? "ok" : "failed" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Clusters Gemini error]", msg);
    return { clusters: [], status: "failed", error: msg };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const clusters = await prisma.topicCluster.findMany({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clusters);
  } catch (error) {
    console.error("Error fetching clusters:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const body = await req.json();

    // --- AI generation: returns suggestions for review, does NOT save yet ---
    if (body.generate) {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
        select: {
          id: true,
          name: true,
          brandName: true,
          brandUrl: true,
          domain: true,
          niche: true,
          description: true,
          targetAudience: true,
          tone: true,
          organizationId: true,
          blogKeywords: { select: { keyword: true }, take: 80 },
        },
      });

      if (!website) {
        return NextResponse.json(
          { error: "Website not found" },
          { status: 404 }
        );
      }

      const existingKeywords = website.blogKeywords.map((k: { keyword: string }) => k.keyword);
      const siteUrl = website.brandUrl || (website.domain ? `https://${website.domain}` : "");

      // Step 1: Crawl the website directly (no Perplexity needed)
      const research = await researchWebsiteDirectly(siteUrl);

      // Step 2: Generate tailored clusters with Gemini
      const geminiResult = await generateClustersWithGemini(
        {
          name: website.name,
          brandName: website.brandName,
          brandUrl: siteUrl,
          niche: website.niche,
          description: website.description,
          targetAudience: website.targetAudience,
          tone: website.tone,
        },
        existingKeywords,
        research.content
      );

      return NextResponse.json({
        suggestions: geminiResult.clusters,
        steps: {
          crawl: research.status,
          gemini: geminiResult.status,
          error: geminiResult.error,
        },
      });
    }

    // --- Bulk save from review dialog ---
    if (body.saveClusters && Array.isArray(body.clusters)) {
      const created = await Promise.all(
        (body.clusters as ClusterData[]).map((c) =>
          prisma.topicCluster.create({
            data: {
              websiteId,
              name: c.name,
              pillarKeyword: c.pillarKeyword,
              supportingKeywords: c.supportingKeywords,
              status: "PLANNING",
            },
          })
        )
      );
      return NextResponse.json(created, { status: 201 });
    }

    // --- Update cluster status ---
    if (body.updateStatus && body.clusterId) {
      const updated = await prisma.topicCluster.update({
        where: { id: body.clusterId, websiteId },
        data: { status: body.status || "IN_PROGRESS" },
      });
      return NextResponse.json(updated);
    }

    // --- Manual single cluster creation ---
    const cluster = await prisma.topicCluster.create({
      data: {
        websiteId,
        name: body.name,
        pillarKeyword: body.pillarKeyword,
        supportingKeywords: body.supportingKeywords || [],
        status: "PLANNING",
      },
    });

    return NextResponse.json(cluster, { status: 201 });
  } catch (error) {
    console.error("Error creating cluster:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const { searchParams } = new URL(req.url);
    const clusterId = searchParams.get("id");

    if (!clusterId) {
      return NextResponse.json(
        { error: "Cluster ID required" },
        { status: 400 }
      );
    }

    await prisma.topicCluster.delete({
      where: { id: clusterId, websiteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting cluster:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
