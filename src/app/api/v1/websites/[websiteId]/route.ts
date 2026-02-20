/**
 * Public API v1 — Website Details
 * GET /api/v1/websites/:websiteId → Get website details with settings
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ websiteId: string }> };

async function verifyWebsiteAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: { include: { websites: { select: { id: true } } } },
    },
  });
  return (
    membership?.organization.websites.some((w) => w.id === websiteId) ?? false
  );
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rateCheck = checkRateLimit(auth.ctx.keyId);
  if (!rateCheck.allowed)
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateCheck.resetAt.toISOString(),
        },
      }
    );

  if (!hasScope(auth.ctx, "websites:read"))
    return NextResponse.json(
      { error: "Insufficient scope: websites:read required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: { blogSettings: true },
  });

  if (!website)
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      id: website.id,
      name: website.name,
      domain: website.domain,
      subdomain: website.subdomain,
      customDomain: website.customDomain,
      niche: website.niche,
      description: website.description,
      targetAudience: website.targetAudience,
      tone: website.tone,
      brandName: website.brandName,
      brandUrl: website.brandUrl,
      logoUrl: website.logoUrl,
      primaryColor: website.primaryColor,
      status: website.status,
      hostingMode: website.hostingMode,
      autoPublish: website.autoPublish,
      postsPerWeek: website.postsPerWeek,
      sitemapEnabled: website.sitemapEnabled,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
      blogSettings: website.blogSettings
        ? {
            contentLength: website.blogSettings.contentLength,
            includeImages: website.blogSettings.includeImages,
            includeFAQ: website.blogSettings.includeFAQ,
            includeTableOfContents:
              website.blogSettings.includeTableOfContents,
            writingStyle: website.blogSettings.writingStyle,
            preferredModel: website.blogSettings.preferredModel,
          }
        : null,
    },
  });
}
